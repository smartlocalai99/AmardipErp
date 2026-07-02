import { getUserFromRequest } from "@/lib/auth";
import { recordJobReturns } from "@/lib/inventory";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || !STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Store access required." });
  }

  try {
    const { jobId, items, notes } = req.body || {};
    const result = await recordJobReturns({ jobReference: jobId, items, notes }, actor);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("Record return error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to record return." });
  }
}
