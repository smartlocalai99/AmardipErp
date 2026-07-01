import { getUserFromRequest } from "@/lib/auth";
import { canViewComplaint, getComplaintById } from "@/lib/complaints";
import { createMaterialRequests, listMaterialRequestsForComplaint } from "@/lib/materialRequests";

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  if (req.method === "GET") {
    const { complaintId } = req.query;
    const complaint = await getComplaintById(complaintId);
    if (!complaint || !canViewComplaint(actor, complaint)) {
      return res.status(403).json({ success: false, message: "Not your job." });
    }
    const requests = await listMaterialRequestsForComplaint(complaintId);
    return res.status(200).json({ success: true, requests });
  }

  if (req.method === "POST") {
    try {
      const { complaintId, items } = req.body || {};
      const complaint = await getComplaintById(complaintId);
      if (!complaint || !canViewComplaint(actor, complaint)) {
        return res.status(403).json({ success: false, message: "Not your job." });
      }
      const requests = await createMaterialRequests({ complaintId, requestedBy: actor.id, items });
      return res.status(201).json({ success: true, requests });
    } catch (err) {
      console.error("Create material request error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to submit request." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
