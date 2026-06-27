import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { updateQuotationStatus } from "@/lib/quotations";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Quotation status audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });
  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) return res.status(403).json({ success: false, message: "Only BOQ admins can update quotation status." });

  try {
    const quotation = await updateQuotationStatus({ id: req.query.id, status: req.body?.status });
    await safeAudit({ req, actor, entityType: "QUOTATION", entityId: req.query.id, action: "QUOTATION_STATUS_CHANGED", newValues: { status: quotation.status }, changedFields: ["status"] });
    return res.status(200).json({ success: true, quotation });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to update status." });
  }
}
