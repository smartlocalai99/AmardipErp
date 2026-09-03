import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureServiceSchedulesTable } from "@/lib/serviceSchedules";
import { getScheduleAssignees } from "@/lib/assignees";
import { getJobCompletionsForMany } from "@/lib/complaints";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const ALLOWED_STATUSES = ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
  if (BLOCKED_ROLES.has(user.role)) return res.status(403).json({ success: false, message: "Not allowed" });

  await ensureServiceSchedulesTable();

  // service_schedules.id is a UUID (gen_random_uuid()), not an integer —
  // Number.parseInt on a UUID string returns NaN (UUIDs routinely start with
  // a letter), so every GET/PATCH/DELETE to this route was returning 400
  // "Invalid id" regardless of the actual id. This is why opening a service
  // schedule's detail view, and deleting one, never actually worked.
  const id = String(req.query.id || "");
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_PATTERN.test(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  if (req.method === "GET") {
    const scheduleResult = await query(
      `SELECT s.*, c.customer_name, c.customer_code, c.city, c.address, c.mobile_no,
              c.customer_status, c.hoc_date, c.amc_warranty_due, c.amc_starting_date, c.amc_ending_date
         FROM service_schedules s
         JOIN elevator_service_customers c ON c.id = s.customer_id
        WHERE s.id = $1`,
      [id]
    );
    if (!scheduleResult.rowCount) return res.status(404).json({ success: false, message: "Not found" });
    const row = scheduleResult.rows[0];

    const assignees = await getScheduleAssignees(id);

    // Everything the technician actually recorded in the field — checklist,
    // GPS, work report — lives on technician_job_completions keyed by the
    // complaint this schedule dispatched, not on the schedule itself.
    let jobCompletion = null;
    if (row.linked_complaint_id) {
      const completions = await getJobCompletionsForMany([row.linked_complaint_id]);
      jobCompletion = completions.get(row.linked_complaint_id) || null;
    }

    // Prior visits for this same customer, so opening one service card
    // shows their history, not just this one appointment.
    const historyResult = await query(
      `SELECT id, service_date, service_type, technician_1, technician_2, remarks
         FROM elevator_service_visits
        WHERE customer_id = $1
        ORDER BY service_date DESC
        LIMIT 10`,
      [row.customer_id]
    );

    return res.status(200).json({
      success: true,
      schedule: {
        id: row.id,
        customerName: row.customer_name,
        customerCode: row.customer_code,
        city: row.city,
        address: row.address,
        mobileNo: row.mobile_no,
        customerStatus: row.customer_status,
        hocDate: row.hoc_date,
        amcWarrantyDue: row.amc_warranty_due,
        amcStartingDate: row.amc_starting_date,
        amcEndingDate: row.amc_ending_date,
        status: row.status,
        scheduledDate: row.scheduled_date,
        notes: row.notes,
        assignees,
        jobCompletion,
        history: historyResult.rows.map((v) => ({
          id: v.id,
          serviceDate: v.service_date,
          serviceType: v.service_type,
          technicians: [v.technician_1, v.technician_2].filter(Boolean).join(" & "),
          remarks: v.remarks,
        })),
      },
    });
  }

  if (req.method === "PATCH") {
    const { status } = req.body || {};
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const result = await query(
      `UPDATE service_schedules SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, schedule: result.rows[0] });
  }

  if (req.method === "DELETE") {
    const result = await query(`DELETE FROM service_schedules WHERE id = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
