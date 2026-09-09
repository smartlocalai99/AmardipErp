import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { onboardQuotationAsProject } from "@/lib/quotations";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Quotation project onboarding audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can onboard a project from a quotation." });
  }

  try {
    const result = await onboardQuotationAsProject({
      quotationId: req.query.id,
      agreedAmount: req.body?.agreedAmount,
      advanceAmount: req.body?.advanceAmount,
    });
    await safeAudit({
      req,
      actor,
      entityType: "QUOTATION_PROJECT",
      entityId: result.project.id,
      action: "PROJECT_ONBOARDED_FROM_QUOTATION",
      newValues: { project: result.project, quotationId: req.query.id, quotationNo: result.quotation.quotationNo },
      changedFields: ["status", "agreed_amount", "advance_amount", "balance_amount"],
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error("Onboard project from quotation error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to onboard project." });
  }
}
