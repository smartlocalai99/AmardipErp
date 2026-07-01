import { getUserFromRequest } from "@/lib/auth";
import { listRecentTransactions } from "@/lib/inventory";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || !STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Store access required." });
  }

  try {
    const transactions = await listRecentTransactions({ limit: req.query.limit });
    return res.status(200).json({ success: true, transactions });
  } catch (err) {
    console.error("List transactions error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to list transactions." });
  }
}
