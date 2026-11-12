import { getUserFromRequest } from "@/lib/auth";
import { isProjectAssignee, getProjectSheetLogSummary } from "@/lib/quotations";
import { recordProjectSiteCheckIn } from "@/lib/projectChecklistStore";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { safeSendPush } from "@/lib/pushNotifications";

// A crew member's one-time GPS check-in when they start work on an erection
// project — the erection counterpart of the breakdown/service arrival
// check-in. Each worker checks in on their own phone; the earliest check-in
// is when work on site began, and the first ticked step is timed from it.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { gpsLatitude, gpsLongitude, gpsAccuracyMeters } = req.body || {};
  const latitude = gpsLatitude === null || gpsLatitude === undefined || gpsLatitude === "" ? NaN : Number(gpsLatitude);
  const longitude = gpsLongitude === null || gpsLongitude === undefined || gpsLongitude === "" ? NaN : Number(gpsLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ success: false, message: "GPS location is required to check in at site." });
  }

  try {
    const onCrew = await isProjectAssignee(req.query.id, actor.id);
    if (!onCrew) {
      return res.status(403).json({ success: false, message: "You're not assigned to this project, or it doesn't exist." });
    }

    // Geocoded before any write, so no DB work waits on the external call.
    const address = await reverseGeocode(latitude, longitude);
    const { inserted, siteCheckIns } = await recordProjectSiteCheckIn({
      projectId: req.query.id,
      actor,
      gps: { latitude, longitude, accuracy: gpsAccuracyMeters, address },
    });

    if (inserted) {
      const summary = await getProjectSheetLogSummary(req.query.id).catch(() => null);
      await safeSendPush(
        { roles: ["superadmin", "admin"] },
        {
          title: "Crew checked in at site",
          body: `${actor.name || actor.username} started work${summary?.customerName ? ` at ${summary.customerName}` : ""}${address ? ` (${address})` : ""}.`,
          data: { url: "/admin/quotations?tab=projects", projectId: req.query.id },
        }
      ).catch((err) => console.error("Failed to notify admins of project check-in:", err));
    }

    return res.status(200).json({ success: true, siteCheckIns });
  } catch (err) {
    console.error("Worker project check-in error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to check in at site." });
  }
}
