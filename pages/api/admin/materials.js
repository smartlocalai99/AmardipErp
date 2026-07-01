import { getUserFromRequest } from "@/lib/auth";
import { listAllMaterialRequests, updateMaterialRequestStatus } from "@/lib/materialRequests";

const LIST_ROLES = new Set(["superadmin", "admin", "manager", "front_office", "storekeeper"]);
const APPROVE_ROLES = new Set(["superadmin", "admin", "manager"]);

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor || !LIST_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Not available for this role." });
  }

  if (req.method === "GET") {
    try {
      const requests = await listAllMaterialRequests({ status: req.query.status });
      return res.status(200).json({ success: true, requests });
    } catch (err) {
      console.error("List material requests error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to list requests." });
    }
  }

  if (req.method === "PATCH") {
    if (!APPROVE_ROLES.has(actor.role)) {
      return res.status(403).json({ success: false, message: "Approval requires admin access." });
    }
    try {
      const request = await updateMaterialRequestStatus({
        id: req.body?.id,
        status: req.body?.status,
        approvedBy: actor.id,
      });
      return res.status(200).json({ success: true, request });
    } catch (err) {
      console.error("Update material request error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to update request." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
