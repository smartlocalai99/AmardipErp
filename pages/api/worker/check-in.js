import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureComplaintsTable } from "@/lib/complaints";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { safeSendPush } from "@/lib/pushNotifications";
import { createCustomerNotification } from "@/lib/customerNotifications";
import { resolveComplaintNotificationRecipients } from "@/lib/customerAccounts";

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
      `SELECT id, complaint_no, customer_name, assigned_technician_user_id, status,
              complaint_type, customer_id, customer_user_id
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
    // visit_started_at is the current visit's start: set on the first
    // check-in and again on the next visit after a Not Resolved submit
    // cleared it (resuming the time-on-site clock); a repeat tap mid-visit
    // keeps it. NOW() is fixed for the statement, so "= NOW()" tells whether
    // this call is what set it.
    const updated = await query(
      `UPDATE complaints
          SET checked_in_at = COALESCE(checked_in_at, NOW()),
              check_in_latitude = COALESCE(check_in_latitude, $2),
              check_in_longitude = COALESCE(check_in_longitude, $3),
              check_in_accuracy_meters = COALESCE(check_in_accuracy_meters, $4),
              check_in_address = COALESCE(check_in_address, $5),
              visit_started_at = CASE WHEN status IN ('RESOLVED', 'CLOSED', 'CANCELLED') THEN visit_started_at
                                      ELSE COALESCE(visit_started_at, NOW()) END,
              status = CASE WHEN status = 'ASSIGNED' THEN 'IN_PROGRESS' ELSE status END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING checked_in_at, visit_started_at,
                  (checked_in_at = NOW()) AS first_arrival,
                  COALESCE(visit_started_at = NOW(), false) AS started_visit`,
      [jobDbId, latitude, longitude, accuracyMeters, address]
    );
    const { checked_in_at: checkedInAt, visit_started_at: visitStartedAt, first_arrival: isFirstCheckIn, started_visit: startedVisit } = updated.rows[0];

    if (startedVisit) {
      const arrivalTime = formatArrivalTime(new Date(visitStartedAt));
      const adminTab = complaint.complaint_type === "SERVICE_REQUEST" ? "service" : "complaints";
      await safeSendPush(
        { roles: ["superadmin", "admin", "manager", "front_office"] },
        {
          title: isFirstCheckIn ? "Technician arrived on site" : "Technician back on site",
          body: `${actor.name || actor.username} arrived at ${complaint.customer_name || "the customer site"} for ${complaint.complaint_no || "a job"} at ${arrivalTime}.`,
          data: { url: `/Admindashboard?tab=${adminTab}`, complaintId: jobDbId },
        }
      );

      const customerTab = complaint.complaint_type === "SERVICE_REQUEST" ? "service" : "complaints";
      const customerUserIds = await resolveComplaintNotificationRecipients({
        customerUserId: complaint.customer_user_id,
        customerId: complaint.customer_id,
      });
      if (customerUserIds.length > 0) {
        const message = `${actor.name || actor.username} has arrived at your site for ${complaint.complaint_no || "your job"} at ${arrivalTime}.`;
        await Promise.all(
          customerUserIds.map((userId) =>
            createCustomerNotification({
              userId,
              category: "Technician arrived",
              message,
              data: { type: "TECHNICIAN_ARRIVED", complaintId: jobDbId },
            }).catch((error) => console.error("Failed to persist technician-arrived notification:", error))
          )
        );

        await safeSendPush(
          { userIds: customerUserIds },
          {
            title: "Technician arrived",
            body: message,
            data: { url: `/Customerdashboard?tab=${customerTab}`, complaintId: jobDbId },
          }
        );
      }
    }

    return res.status(200).json({
      success: true,
      checkedInAt,
      visitStartedAt,
      checkInAddress: address,
    });
  } catch (err) {
    console.error("check-in error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to record check-in." });
  }
}
