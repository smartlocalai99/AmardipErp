import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { appendOngoingProjectRow } from "@/lib/googleSheets";
import { markProjectSheetRow, onboardQuotationAsProject } from "@/lib/quotations";
import { appendCustomerAutomationRow } from "@/lib/customerAutomationSheet";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Quotation project onboarding audit failed:", err);
  }
}

// Best-effort, same reasoning as the plain customer-onboarding route: a
// Sheets hiccup must not fail a project onboarding already committed to
// Postgres. `advance` is the one field this path has that plain customer
// onboarding doesn't.
async function safeAppendCustomerAutomationRow(customer, advance) {
  try {
    await appendCustomerAutomationRow({
      customerCode: customer.customer_code,
      customerName: customer.customer_name,
      address: customer.address || "",
      mobileNo: customer.mobile_no || "",
      status: customer.customer_status || "AMC",
      amcWarrantyDue: customer.amc_warranty_due,
      amcStartDate: customer.amc_starting_date,
      amcEndDate: customer.amc_ending_date,
      amcAmount: advance?.agreedAmount,
      advance: advance?.advanceAmount,
    });
  } catch (err) {
    console.error("Failed to append onboarded project customer to CUSTOMER_AUTOMATION sheet:", err);
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
    let sheetRow = result.project.googleSheetRow;
    if (!sheetRow) {
      sheetRow = await appendOngoingProjectRow(result.project, result.quotation);
      await markProjectSheetRow({ projectId: result.project.id, rowNumber: sheetRow });
      result.project.googleSheetRow = sheetRow;

      const customerRow = await query("SELECT * FROM elevator_service_customers WHERE id = $1 LIMIT 1", [result.project.customerId]);
      if (customerRow.rows[0]) {
        await safeAppendCustomerAutomationRow(customerRow.rows[0], {
          agreedAmount: result.project.agreedAmount,
          advanceAmount: result.project.advanceAmount,
        });
      }
    }
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
