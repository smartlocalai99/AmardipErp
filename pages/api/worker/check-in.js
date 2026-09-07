import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureComplaintsTable } from "@/lib/complaints";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { safeSendPush } from "@/lib/pushNotifications";

function formatArrivalTime(date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { jobDbId, gpsLatitude, gpsLongitude, gpsAccuracyMeters } = req.body || {};
  if (!jobDbId) {
    return res.status(400).json({ success: false, message: "Job ID is required." });
  }

  const latitude = Number.isFinite(Number(gpsLatitude)) ? Number(gpsLatitude) : null;
  const longitude = Number.isFinite(Number(gpsLongitude)) ? Number(gpsLongitude) : null;
  const accuracyMeters = Number.isFinite(Number(gpsAccuracyMeters)) ? Number(gpsAccuracyMeters) : null;

  try {
    await ensureComplaintsTable();

    const check = await query(
      `SELECT id, complaint_no, customer_name, assigned_technician_user_id, status
         FROM complaints
        WHERE id = $1`,
      [jobDbId]
    );
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }
    const complaint = check.rows[0];
    if (String(complaint.assigned_technician_user_id) !== String(actor.id)) {
      return res.status(403).json({ success: false, message: "This job is not assigned to you." });
    }

    const address = await reverseGeocode(latitude, longitude);

    // Only the first check-in counts as "arrival" — reopening the job later
    // (e.g. to finish the report) shouldn't overwrite the original arrival
    // time or fire a second notification. Status moves to IN_PROGRESS so
    // admin's list reflects "worker is on site" in real time instead of
    // still showing ASSIGNED until the whole job is closed out — but only
    // from ASSIGNED, so it never resurrects an already-terminal job.
    const updated = await query(
      `UPDATE complaints
          SET checked_in_at = COALESCE(checked_in_at, NOW()),
              check_in_latitude = COALESCE(check_in_latitude, $2),
              check_in_longitude = COALESCE(check_in_longitude, $3),
              check_in_accuracy_meters = COALESCE(check_in_accuracy_meters, $4),
              check_in_address = COALESCE(check_in_address, $5),
              status = CASE WHEN status = 'ASSIGNED' THEN 'IN_PROGRESS' ELSE status END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING checked_in_at`,
      [jobDbId, latitude, longitude, accuracyMeters, address]
    );
    const checkedInAt = updated.rows[0].checked_in_at;
    const isFirstCheckIn = new Date(checkedInAt).getTime() > Date.now() - 5000;

    if (isFirstCheckIn) {
      const arrivalTime = formatArrivalTime(new Date(checkedInAt));
      await safeSendPush(
        { roles: ["superadmin", "admin", "manager", "front_office"] },
        {
          title: "Technician arrived on site",
          body: `${actor.name || actor.username} arrived at ${complaint.customer_name || "the customer site"} for ${complaint.complaint_no || "a job"} at ${arrivalTime}.`,
          data: { url: "/Admindashboard?tab=complaints", complaintId: jobDbId },
        }
      );
    }

    return res.status(200).json({
      success: true,
      checkedInAt,
      checkInAddress: address,
    });
  } catch (err) {
    console.error("check-in error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to record check-in." });
  }
}
