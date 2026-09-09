import { getUserFromRequest } from "@/lib/auth";
import { isProjectAssignee, getProjectSheetLogSummary } from "@/lib/quotations";
import { isValidChecklistItem } from "@/lib/projectChecklist";
import { setProjectChecklistItem } from "@/lib/projectChecklistStore";
import { appendErectionSheetCompletion } from "@/lib/erectionSheet";
import { safeSendPush } from "@/lib/pushNotifications";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { itemKey, completed } = req.body || {};
  if (!isValidChecklistItem(itemKey)) {
    return res.status(400).json({ success: false, message: "Unknown checklist item." });
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

    const checklistCompletions = await setProjectChecklistItem({
      projectId: req.query.id,
      itemKey,
      completed: Boolean(completed),
      actor,
    });

    // Only log/notify for marking a step done — un-checking one has no
    // "form submission" equivalent, and there's nothing worth alerting
    // admins about. Best-effort throughout: neither a Sheets hiccup nor a
    // push failure should fail the checklist update itself, already saved.
    if (completed) {
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
        }).catch((err) => console.error("Failed to log completion to Erection Sheet:", err));
      }

      await safeSendPush(
        { roles: ["superadmin"] },
        {
          title: "Checklist step completed",
          body: `${actor.name || actor.username} marked "${itemKey}" done${summary?.customerName ? ` for ${summary.customerName}` : ""}.`,
          data: { url: "/admin/quotations?tab=projects", projectId: req.query.id },
        }
      ).catch((err) => console.error("Failed to notify admins of checklist completion:", err));
    }

    // Only the checklist changed — the rest of the project (name, crew,
    // amounts) didn't, so the client merges this into what it already has
    // instead of us re-fetching and re-sending the whole project again.
    return res.status(200).json({ success: true, checklistCompletions });
  } catch (err) {
    console.error("Worker project checklist update error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to update checklist." });
  }
}
