import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { onboardQuotationAsCustomer } from "@/lib/quotations";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Quotation onboarding audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can onboard a customer from a quotation." });
  }

  try {
    const { customer, quotation } = await onboardQuotationAsCustomer({ quotationId: req.query.id });

    await safeAudit({
      req,
      actor,
      entityType: "CUSTOMER",
      entityId: customer.id,
      action: "CUSTOMER_ONBOARDED_FROM_QUOTATION",
      newValues: { customer, sourceQuotationId: req.query.id, sourceQuotationNo: quotation.quotationNo },
      changedFields: ["customer_status", "amc_starting_date", "amc_ending_date", "amc_warranty_due"],
    });

    return res.status(200).json({ success: true, customer, quotation });
  } catch (err) {
    console.error("Onboard customer from quotation error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to onboard customer." });
  }
}
