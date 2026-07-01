import { getUserFromRequest } from "@/lib/auth";
import { issueMaterialsForJob } from "@/lib/materialRequests";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || !STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Store access required." });
  }

  try {
    const { token, items } = req.body || {};
    const result = await issueMaterialsForJob({ token, items, actor });
    return res.status(200).json({ success: true, complaint: result.complaint, issued: result.issued });
  } catch (err) {
    console.error("Issue materials error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to issue materials." });
  }
}
