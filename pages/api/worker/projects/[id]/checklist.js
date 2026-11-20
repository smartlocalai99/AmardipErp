import { getUserFromRequest } from "@/lib/auth";
import { isProjectAssignee, getProjectSheetLogSummary, markProjectHandedOver } from "@/lib/quotations";
import { isValidChecklistItem, PROJECT_CHECKLIST_ITEMS } from "@/lib/projectChecklist";
import { recordProjectStepProgress, getProjectChecklistCompletions, getProjectWorkSummary } from "@/lib/projectChecklistStore";
import { appendErectionSheetCompletion } from "@/lib/erectionSheet";
import { updateCustomerListHandoverStatus } from "@/lib/customerAutomationSheet";
import { safeSendPush } from "@/lib/pushNotifications";
import { reverseGeocode } from "@/lib/reverseGeocode";

function coordinate(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { itemKey, percent: rawPercent, completed, gpsLatitude, gpsLongitude, gpsAccuracyMeters } = req.body || {};
  if (!isValidChecklistItem(itemKey)) {
    return res.status(400).json({ success: false, message: "Unknown checklist item." });
  }
  // The step's slider: 0, 50 or 100%. An app opened before the slider
  // existed still sends completed true/false.
  const percent = rawPercent === undefined || rawPercent === null ? (completed ? 100 : 0) : Number(rawPercent);
  if (![0, 50, 100].includes(percent)) {
    return res.status(400).json({ success: false, message: "Progress must be 0%, 50% or 100%." });
  }

  try {
    // isProjectAssignee alone proves both that the project exists and that
    // this worker is on its crew (the FK guarantees the former) — skips a
    // whole extra getProjectById round trip (main row + assignees +
    // completions) just to check something this one query already answers.
    const onCrew = await isProjectAssignee(req.query.id, actor.id);
    if (!onCrew) {
      return res.status(403).json({ success: false, message: "You're not assigned to this project, or it doesn't exist." });
    }

    // Where the worker's phone was when they saved the step, labelled
    // "Area, City" — geocoded before the write so no DB work waits on it.
    const latitude = coordinate(gpsLatitude);
    const longitude = coordinate(gpsLongitude);
    const gpsAddress = latitude !== null && longitude !== null ? await reverseGeocode(latitude, longitude) : null;

    // Ends the worker's check-in session (their time stops until they check
    // in again) and saves the step at this percent, in one transaction.
    const { newlyCompleted } = await recordProjectStepProgress({
      projectId: req.query.id,
      itemKey,
      percent,
      actor,
      gps: { latitude, longitude, accuracy: gpsAccuracyMeters, address: gpsAddress },
    });
    const [checklistCompletions, work] = await Promise.all([
      getProjectChecklistCompletions(req.query.id),
      getProjectWorkSummary(req.query.id),
    ]);

    // Only log/notify when a step reaches 100% — partial progress has no
    // "form submission" equivalent in the Erection Sheet, and there's nothing
    // worth alerting admins about. Best-effort throughout: neither a Sheets
    // hiccup nor a push failure should fail the update itself, already saved.
    if (newlyCompleted) {
      const summary = await getProjectSheetLogSummary(req.query.id).catch((err) => {
        console.error("Failed to load project summary for sheet log / notification:", err);
        return null;
      });

      if (summary) {
        await appendErectionSheetCompletion({
          customerName: summary.customerName,
          city: summary.city,
          crewNames: summary.crewNames,
          completedItem: itemKey,
          actorUsername: actor.username,
          location: gpsAddress,
        }).catch((err) => console.error("Failed to log completion to Erection Sheet:", err));
      }

      // All 52 steps done — this is the handover moment: the customer
      // starts their free 1-year warranty (see markProjectHandedOver),
      // not a paid AMC contract straight away. Idempotent, so re-checking
      // an already-complete step never resets the handover date.
      let justHandedOver = null;
      if (summary?.customerId && checklistCompletions.length >= PROJECT_CHECKLIST_ITEMS.length) {
        justHandedOver = await markProjectHandedOver(summary.customerId).catch((err) => {
          console.error("Failed to mark handover on project completion:", err);
          return null;
        });
        if (justHandedOver) {
          await updateCustomerListHandoverStatus(justHandedOver.customer_code, {
            status: "WARRANTY",
            hocDate: justHandedOver.hoc_date,
            amcWarrantyDue: justHandedOver.amc_warranty_due,
          }).catch((err) => console.error("Failed to sync handover status to CUSTOMER_LIST:", err));
        }
      }

      await safeSendPush(
        { roles: ["superadmin", "admin"] },
        justHandedOver
          ? {
              title: "Installation complete — handed over",
              body: `${summary?.customerName || "The project"} is fully installed. The 1-year warranty period has started.`,
              data: { url: "/admin/quotations?tab=projects", projectId: req.query.id },
            }
          : {
              title: "Checklist step completed",
              body: `${actor.name || actor.username} marked "${itemKey}" done${summary?.customerName ? ` for ${summary.customerName}` : ""}.`,
              data: { url: "/admin/quotations?tab=projects", projectId: req.query.id },
            }
      ).catch((err) => console.error("Failed to notify admins of checklist completion:", err));
    }

    // Only the checklist changed — the rest of the project (name, crew,
    // amounts) didn't, so the client merges this into what it already has
    // instead of us re-fetching and re-sending the whole project again.
    return res.status(200).json({ success: true, checklistCompletions, work });
  } catch (err) {
    if (!err.statusCode) console.error("Worker project checklist update error:", err);
    return res.status(err.statusCode || 400).json({ success: false, message: err.message || "Failed to update checklist." });
  }
}
