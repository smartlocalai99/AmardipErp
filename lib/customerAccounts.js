import { query } from "./db.js";
import { ensureCustomerAccountSchema } from "./usersSchema.js";
import { ensureWarrantyExpiryNoticesSchema } from "./warrantyExpiry.js";

export function normalizeMobileNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

export async function getCustomerIdsForUser(userId) {
  await ensureCustomerAccountSchema();

  const result = await query(
    `
    SELECT customer_id
    FROM customer_user_links
    WHERE user_id = $1
    ORDER BY created_at, customer_id
    `,
    [userId]
  );

  return result.rows.map((row) => row.customer_id);
}

// The reverse of getCustomerIdsForUser — who's logged into the portal for
// this customer record. Complaints created by a customer already carry
// customer_user_id directly, but most breakdowns are raised by admin on a
// customer's behalf and only ever get customer_id set, leaving
// customer_user_id null — which silently skipped every customer
// notification (assignment, arrival, completion) for those tickets. This
// resolves the actual login(s) to notify in that case.
export async function getUserIdsForCustomer(customerId) {
  if (!customerId) return [];
  await ensureCustomerAccountSchema();

  const result = await query(
    `
    SELECT user_id
    FROM customer_user_links
    WHERE customer_id = $1
    ORDER BY created_at, user_id
    `,
    [customerId]
  );

  return result.rows.map((row) => row.user_id);
}

// One call site, one answer: who should be notified for this complaint.
// Prefers the direct customer_user_id (set when the customer raised the
// ticket themselves); falls back to every login linked to the underlying
// customer record (the common case for admin-raised breakdowns/services).
export async function resolveComplaintNotificationRecipients(complaint) {
  if (complaint?.customerUserId) return [complaint.customerUserId];
  if (complaint?.customerId) return getUserIdsForCustomer(complaint.customerId);
  return [];
}

export async function getCustomerRecordsForUser(userId) {
  await ensureCustomerAccountSchema();
  await ensureWarrantyExpiryNoticesSchema();

  const result = await query(
    `
    SELECT
      c.id,
      c.record_no,
      c.customer_code,
      c.customer_name,
      c.address,
      c.city,
      c.mobile_no,
      c.location,
      c.hoc_date,
      c.customer_status,
      c.amc_warranty_due,
      c.amc_starting_date,
      c.amc_ending_date,
      c.no_of_passenger,
      c.elevator_type,
      (w.id IS NOT NULL) AS warranty_notice_sent
    FROM customer_user_links cul
    JOIN elevator_service_customers c ON c.id = cul.customer_id
    LEFT JOIN warranty_expiry_notices w ON w.customer_id = c.id
    WHERE cul.user_id = $1
    ORDER BY c.record_no NULLS LAST, c.customer_name, c.id
    `,
    [userId]
  );

  return result.rows;
}

export async function getCustomerServiceVisitsForUser(userId, limit = 50) {
  await ensureCustomerAccountSchema();

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
  const result = await query(
    `
    SELECT
      v.id,
      v.customer_id,
      v.service_date::text AS service_date,
      COALESCE(c.customer_code, v.customer_code) AS customer_code,
      COALESCE(c.customer_name, v.customer_name_snapshot) AS customer_name,
      COALESCE(c.location, c.city, v.city_snapshot) AS service_location,
      COALESCE(c.mobile_no, v.mobile_no_snapshot) AS mobile_no,
      v.service_type,
      v.technician_1,
      v.technician_2,
      v.remarks,
      v.ard_condition,
      v.motor_condition,
      v.gear_oil_condition,
      v.brake_condition,
      v.rope_condition,
      v.rail_clips_condition,
      v.limit_switch_condition,
      v.gate_locks_condition,
      v.rcr_condition,
      v.sensors_condition,
      v.osg_condition,
      -- Only app-completed visits (source_sheet = 'App - Technician
      -- Completion') trace back through service_schedules/complaints to a
      -- technician_job_completions row — spreadsheet-imported history has
      -- no signature/GPS/duration to show, and that's expected.
      co.checked_in_at,
      jc.problem_identified,
      jc.work_performed,
      jc.spare_parts_used,
      jc.customer_rep_name,
      jc.signature_image,
      jc.gps_latitude,
      jc.gps_longitude,
      jc.gps_accuracy_meters,
      jc.gps_address,
      jc.duration_minutes,
      jc.completed_at
    FROM customer_user_links cul
    JOIN elevator_service_customers c ON c.id = cul.customer_id
    JOIN elevator_service_visits v ON v.customer_id = c.id
    LEFT JOIN service_schedules ss ON ss.completed_service_visit_id = v.id
    LEFT JOIN complaints co ON co.id = ss.linked_complaint_id
    LEFT JOIN LATERAL (
      SELECT t.*
      FROM technician_job_completions t
      WHERE t.complaint_id = co.id
      ORDER BY t.created_at DESC
      LIMIT 1
    ) jc ON co.id IS NOT NULL
    WHERE cul.user_id = $1
    ORDER BY v.service_date DESC NULLS LAST, v.created_at DESC NULLS LAST
    LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}
