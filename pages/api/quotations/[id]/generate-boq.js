import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canEditBoq, canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { generateBoqForQuotation, getQuotationStatus } from "@/lib/quotations";

const LOCKED_STATUSES = new Set(["ACCEPTED", "REJECTED", "CONVERTED_TO_CUSTOMER"]);

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("BOQ audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const currentStatus = await getQuotationStatus(req.query.id);
  if (!currentStatus) return res.status(404).json({ success: false, message: "Quotation not found." });

  const isEdit = currentStatus !== "DRAFT";
  if (isEdit && LOCKED_STATUSES.has(currentStatus)) {
    return res.status(400).json({ success: false, message: "This quotation is locked and can no longer be edited." });
  }

  const hasPermission = await isBoqAdmin(actor);
  const allowed = isEdit ? canEditBoq(actor, hasPermission) : canGenerateBoq(actor, hasPermission);
  if (!allowed) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can edit BOQ pricing." });
  }

  try {
    const result = await generateBoqForQuotation({ quotationId: req.query.id, actor, costs: req.body || {} });
    await safeAudit({ req, actor, entityType: "QUOTATION", entityId: req.query.id, action: isEdit ? "BOQ_EDITED" : "BOQ_GENERATED", newValues: result.costBreakdown, changedFields: ["costBreakdown", "status"] });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to generate BOQ." });
  }
}
