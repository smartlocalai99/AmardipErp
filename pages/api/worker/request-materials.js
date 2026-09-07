import { getUserFromRequest } from "@/lib/auth";
import { getComplaintById } from "@/lib/complaints";
import { createMaterialRequests, normalizeAllocatedItems } from "@/lib/materialRequests";
import { safeSendPush } from "@/lib/pushNotifications";

// The QR pass covers "I'm at the store, hand me what's on this job" — this
// covers the other real case: a worker who already knows what a job needs
// (or forgot to collect something) requests it from wherever they are, and
// the store issues it against that request later, no QR involved.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { jobDbId, items } = req.body || {};
  if (!jobDbId) {
    return res.status(400).json({ success: false, message: "Job ID is required." });
  }
  const normalizedItems = normalizeAllocatedItems(items);
  if (normalizedItems.length === 0) {
    return res.status(400).json({ success: false, message: "Select at least one item and quantity." });
  }

  try {
    const complaint = await getComplaintById(jobDbId);
    if (!complaint) return res.status(404).json({ success: false, message: "Job not found." });
    const isAssignee = Number(complaint.assignedTechnicianUserId) === Number(actor.id)
      || (complaint.assignees || []).some((assignee) => Number(assignee.id) === Number(actor.id));
    if (!isAssignee) {
      return res.status(403).json({ success: false, message: "This job is not assigned to you." });
    }

    const created = await createMaterialRequests({
      complaintId: jobDbId,
      requestedBy: actor.id,
      items: normalizedItems,
      status: "pending",
    });

    const itemSummary = created.map((r) => `${r.requestedQuantity} ${r.itemUnit} ${r.itemName}`).join(", ");
    await safeSendPush(
      { roles: ["storekeeper", "admin", "superadmin", "manager"] },
      {
        title: "Material request from technician",
        body: `${actor.name || actor.username} requested ${itemSummary} for ${complaint.complaintNo || "a job"}.`,
        data: { url: "/Storedashboard?tab=requests", complaintId: jobDbId },
      }
    );

    return res.status(201).json({ success: true, requests: created });
  } catch (err) {
    console.error("Worker material request error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to submit material request." });
  }
}
