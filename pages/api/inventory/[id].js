import { getUserFromRequest } from "@/lib/auth";
import { adjustInventoryItem, getInventoryItemById } from "@/lib/inventory";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });
  if (!STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Inventory is not available for this role." });
  }

  const { id } = req.query;

  if (req.method === "PATCH") {
    try {
      const item = await adjustInventoryItem(
        { itemId: id, newQuantity: req.body?.newQuantity, notes: req.body?.notes },
        actor
      );
      return res.status(200).json({ success: true, item });
    } catch (err) {
      console.error("Adjust inventory item error:", err);
      return res.status(400).json({ success: false, message: err.message || "Failed to update item." });
    }
  }

  if (req.method === "GET") {
    const item = await getInventoryItemById(id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found." });
    return res.status(200).json({ success: true, item });
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
