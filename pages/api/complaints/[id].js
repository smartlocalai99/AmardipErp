import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canViewComplaint, getComplaintById, updateComplaintStatus } from "@/lib/complaints";

const UPDATE_ROLES = new Set(["superadmin", "admin", "manager", "front_office", "worker"]);

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

  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const complaint = await getComplaintById(id);
      if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found." });
      if (!canViewComplaint(actor, complaint)) {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      return res.status(200).json({ success: true, complaint });
    } catch (err) {
      console.error("Fetch complaint error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch complaint." });
    }
  }

  if (req.method === "PATCH") {
    if (!UPDATE_ROLES.has(actor.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    try {
      const before = await getComplaintById(id);
      if (!before) return res.status(404).json({ success: false, message: "Complaint not found." });
      const complaint = await updateComplaintStatus({
        complaintId: id,
        actor,
        status: req.body?.status || before.status,
        notes: req.body?.notes || req.body?.adminNotes || req.body?.officeNotes,
      });
      await safeAudit({
        req,
        actor,
        entityType: "COMPLAINT",
        entityId: complaint.id,
        action: before.status === complaint.status ? "COMPLAINT_UPDATED" : "COMPLAINT_STATUS_CHANGED",
        oldValues: { status: before.status },
        newValues: { status: complaint.status },
        changedFields: ["status"],
      });
      return res.status(200).json({ success: true, complaint });
    } catch (err) {
      console.error("Update complaint error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to update complaint." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
