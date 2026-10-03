import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { isComplaintAssignee } from "@/lib/assignees";

// Lets a technician see what's happened at a site before, when they're
// actually the one assigned to it — scoped through the complaint rather
// than the customer id directly, so a worker can't browse any customer's
// history by guessing ids, only the ones they're dispatched to.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const complaintId = String(req.query.complaintId || "").trim();
  if (!complaintId) return res.status(400).json({ success: false, message: "complaintId is required." });

  try {
    const complaintResult = await query(
      `SELECT id, customer_id, assigned_technician_user_id FROM complaints WHERE id = $1 LIMIT 1`,
      [complaintId]
    );
    const complaint = complaintResult.rows[0];
    if (!complaint) return res.status(404).json({ success: false, message: "Job not found." });

    const isAssigned = Number(complaint.assigned_technician_user_id) === Number(actor.id)
      || (await isComplaintAssignee(complaintId, actor.id));
    if (!isAssigned) return res.status(403).json({ success: false, message: "This job is not assigned to you." });

    if (!complaint.customer_id) {
      return res.status(200).json({ success: true, visits: [], priorComplaints: [] });
    }

    const [visitsResult, priorComplaintsResult] = await Promise.all([
      query(
        `SELECT id, service_date, service_type, technician_1, technician_2, remarks
           FROM elevator_service_visits
          WHERE customer_id = $1
          ORDER BY service_date DESC NULLS LAST
          LIMIT 10`,
        [complaint.customer_id]
      ),
      query(
        `SELECT id, complaint_no, complaint_type, status, description, resolved_at, closed_at, created_at
           FROM complaints
          WHERE customer_id = $1 AND id != $2 AND status IN ('RESOLVED', 'CLOSED')
          ORDER BY COALESCE(resolved_at, closed_at, created_at) DESC
          LIMIT 10`,
        [complaint.customer_id, complaintId]
      ),
    ]);

    return res.status(200).json({
      success: true,
      visits: visitsResult.rows.map((v) => ({
        id: v.id,
        serviceDate: v.service_date,
        serviceType: v.service_type,
        technicians: [v.technician_1, v.technician_2].filter(Boolean).join(" & "),
        remarks: v.remarks,
      })),
      priorComplaints: priorComplaintsResult.rows.map((c) => ({
        id: c.id,
        complaintNo: c.complaint_no,
        complaintType: c.complaint_type,
        status: c.status,
        description: c.description,
        resolvedAt: c.resolved_at || c.closed_at || c.created_at,
      })),
    });
  } catch (err) {
    console.error("Worker customer-history error:", err);
    return res.status(500).json({ success: false, message: "Failed to load customer history." });
  }
}
