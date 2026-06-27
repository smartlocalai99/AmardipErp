import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { createComplaint, listComplaints } from "@/lib/complaints";

const LIST_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);
const CREATE_ROLES = new Set(["superadmin", "admin", "manager", "front_office", "customer"]);

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Complaint audit log failed:", err);
  }
}

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  if (req.method === "GET") {
    if (!LIST_ROLES.has(actor.role)) {
      return res.status(403).json({ success: false, message: "Complaints list is not available for this role." });
    }

    try {
      const result = await listComplaints({
        actor,
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters: {
          search: req.query.search,
          status: req.query.status,
          priority: req.query.priority,
          complaintType: req.query.complaintType,
          assignedTechnicianUserId: req.query.assignedTechnicianUserId,
        },
      });
      return res.status(200).json({ success: true, complaints: result.rows, ...result });
    } catch (err) {
      console.error("Fetch complaints error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to fetch complaints." });
    }
  }

  if (req.method === "POST") {
    if (!CREATE_ROLES.has(actor.role)) {
      return res.status(403).json({ success: false, message: "Complaint creation is not available for this role." });
    }

    try {
      const complaint = await createComplaint({ actor, input: req.body || {} });
      await safeAudit({
        req,
        actor,
        entityType: "COMPLAINT",
        entityId: complaint.id,
        action: "COMPLAINT_CREATED",
        newValues: complaint,
        changedFields: ["complaint"],
      });
      return res.status(201).json({ success: true, complaint });
    } catch (err) {
      console.error("Create complaint error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to create complaint." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
