import { getUserFromRequest } from "@/lib/auth";
import { createInventoryItem, listInventoryItems, UNITS } from "@/lib/inventory";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });
  if (!STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Inventory is not available for this role." });
  }

  if (req.method === "GET") {
    try {
      const items = await listInventoryItems({ search: req.query.search });
      return res.status(200).json({ success: true, items, units: UNITS });
    } catch (err) {
      console.error("List inventory error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to list inventory." });
    }
  }

  if (req.method === "POST") {
    try {
      const item = await createInventoryItem(req.body || {}, actor);
      return res.status(201).json({ success: true, item });
    } catch (err) {
      console.error("Create inventory item error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to create item." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
