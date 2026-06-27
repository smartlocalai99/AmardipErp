import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { assignComplaintToWorker, getComplaintById } from "@/lib/complaints";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Complaint assignment audit log failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || !ALLOWED_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Unauthorized." });
  }

  const workerUserId = Number(req.body?.assignedTechnicianUserId);
  if (!workerUserId) {
    return res.status(400).json({ success: false, message: "Select a worker." });
  }

  try {
    const before = await getComplaintById(req.query.id);
    const complaint = await assignComplaintToWorker({
      complaintId: req.query.id,
      workerUserId,
      actor,
      assignmentNotes: req.body?.assignmentNotes,
    });
    await safeAudit({
      req,
      actor,
      entityType: "COMPLAINT",
      entityId: complaint.id,
      action: "COMPLAINT_ASSIGNED",
      oldValues: before,
      newValues: complaint,
      changedFields: ["assignedTechnicianUserId", "assignedTechnicianName", "status"],
    });
    return res.status(200).json({ success: true, complaint });
  } catch (err) {
    console.error("Assign complaint error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to assign complaint." });
  }
}
