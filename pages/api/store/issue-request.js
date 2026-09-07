import { getUserFromRequest } from "@/lib/auth";
import { issueMaterialRequestDirectly } from "@/lib/materialRequests";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

// Issues straight against an existing material_requests row (worker-raised
// from the app, or admin-allocated at assignment) — the alternative to
// scanning a Store Pass QR, for whenever the worker isn't standing there.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || !STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Store access required." });
  }

  try {
    const { requestId, quantity } = req.body || {};
    if (!requestId) return res.status(400).json({ success: false, message: "requestId is required." });
    const result = await issueMaterialRequestDirectly({ requestId, quantity, actor });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("Issue material request error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to issue this request." });
  }
}
