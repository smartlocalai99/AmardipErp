import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { generateBoqForQuotation } from "@/lib/quotations";

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
  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) return res.status(403).json({ success: false, message: "Only selected BOQ admins can generate BOQ." });

  try {
    const result = await generateBoqForQuotation({ quotationId: req.query.id, actor, costs: req.body || {} });
    await safeAudit({ req, actor, entityType: "QUOTATION", entityId: req.query.id, action: "BOQ_GENERATED", newValues: result.costBreakdown, changedFields: ["costBreakdown", "status"] });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to generate BOQ." });
  }
}
