import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canEditBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { generateBoqForQuotation, getQuotationById } from "@/lib/quotations";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Quotation audit failed:", err);
  }
}

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  if (req.method === "GET") {
    try {
      const quotation = await getQuotationById({ id: req.query.id, actor });
      if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found." });
      return res.status(200).json({ success: true, quotation });
    } catch (err) {
      return res.status(403).json({ success: false, message: err.message || "Unauthorized." });
    }
  }

  if (req.method === "PATCH") {
    const hasPermission = await isBoqAdmin(actor);
    if (!canEditBoq(actor, hasPermission)) {
      return res.status(403).json({ success: false, message: "Front office cannot edit BOQ or quotation pricing." });
    }
    try {
      const result = await generateBoqForQuotation({ quotationId: req.query.id, actor, costs: req.body || {} });
      await safeAudit({ req, actor, entityType: "QUOTATION", entityId: req.query.id, action: "QUOTATION_UPDATED", newValues: result.costBreakdown, changedFields: ["costBreakdown"] });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || "Failed to update quotation." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
