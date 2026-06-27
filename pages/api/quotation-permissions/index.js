import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { addBoqAdmin, isPermissionManageRole, listBoqAdmins, removeBoqAdmin } from "@/lib/quotationPermissions";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("BOQ permission audit failed:", err);
  }
}

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor || !isPermissionManageRole(actor)) {
    return res.status(403).json({ success: false, message: "Superadmin access required." });
  }

  if (req.method === "GET") {
    const admins = await listBoqAdmins();
    return res.status(200).json({ success: true, admins, count: admins.length, max: 6 });
  }

  if (req.method === "POST") {
    try {
      const permission = await addBoqAdmin({ userId: Number(req.body?.userId), actor });
      await safeAudit({ req, actor, entityType: "BOQ_ADMIN", entityId: permission.user_id, action: "BOQ_ADMIN_ADDED", newValues: permission, changedFields: ["userId"] });
      return res.status(201).json({ success: true, permission });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || "Failed to add BOQ admin." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const removed = await removeBoqAdmin({ userId: Number(req.body?.userId || req.query.userId) });
      await safeAudit({ req, actor, entityType: "BOQ_ADMIN", entityId: req.body?.userId || req.query.userId, action: "BOQ_ADMIN_REMOVED", oldValues: removed, changedFields: ["userId"] });
      return res.status(200).json({ success: true, removed });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || "Failed to remove BOQ admin." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
