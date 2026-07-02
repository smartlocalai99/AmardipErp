import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { assignComplaintToWorker, getComplaintById } from "@/lib/complaints";
import { safeSendPush } from "@/lib/pushNotifications";
import { createMaterialRequests, normalizeAllocatedItems } from "@/lib/materialRequests";
import { query } from "@/lib/db";

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

  const allocatedItems = normalizeAllocatedItems(req.body?.allocatedItems);

  await query("BEGIN");
  let complaint;
  let before;
  try {
    before = await getComplaintById(req.query.id);
    complaint = await assignComplaintToWorker({
      complaintId: req.query.id,
      workerUserId,
      actor,
      assignmentNotes: req.body?.assignmentNotes,
    });

    if (allocatedItems.length > 0) {
      await createMaterialRequests({
        complaintId: complaint.id,
        requestedBy: actor.id,
        items: allocatedItems,
        status: "approved",
      });
    }

    await query("COMMIT");
  } catch (err) {
    await query("ROLLBACK");
    console.error("Assign complaint error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to assign complaint." });
  }

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
  await safeSendPush(
    { userIds: [complaint.assignedTechnicianUserId] },
    {
      title: "New job assigned",
      body: `${complaint.complaintNo} - ${complaint.customerName || "Customer"} is assigned to you.`,
      data: { url: "/Techniciandashboard?tab=jobs", complaintId: complaint.id },
    }
  );
  return res.status(200).json({ success: true, complaint });
}
