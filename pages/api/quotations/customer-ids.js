import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { planLegacyCustomerCodeRenames, applyLegacyCustomerCodeRenames } from "@/lib/quotations";
import { getCustomerListCodes, renameCustomerListCodes } from "@/lib/customerAutomationSheet";

// One-time fix for customers onboarded before the client's ID format was
// applied (their ID is the quotation number). GET shows the planned new IDs
// without changing anything; POST applies them in the database, then in
// the CUSTOMER_LIST sheet.
export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });
  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can change customer IDs." });
  }

  try {
    // Lift numbers must continue after the sheet's own entries too, so the
    // sheet has to be readable before anything is renamed.
    const sheetCodes = await getCustomerListCodes();

    if (req.method === "GET") {
      const renames = await planLegacyCustomerCodeRenames(sheetCodes);
      return res.status(200).json({ success: true, renames });
    }

    const renames = await applyLegacyCustomerCodeRenames(sheetCodes);
    let sheetCellsUpdated = 0;
    let sheetError = null;
    if (renames.length) {
      try {
        sheetCellsUpdated = await renameCustomerListCodes(renames);
      } catch (err) {
        console.error("Customer IDs renamed in the ERP but not in CUSTOMER_LIST:", err);
        sheetError = "Renamed in the ERP, but the CUSTOMER_LIST sheet couldn't be updated. Change these IDs in the sheet by hand.";
      }
      await createAuditLog({
        req,
        actor,
        entityType: "CUSTOMER",
        entityId: "customer-id-format",
        action: "CUSTOMER_IDS_RENAMED",
        newValues: { renames, sheetCellsUpdated },
        changedFields: ["customer_code"],
      }).catch((err) => console.error("Customer ID rename audit failed:", err));
    }
    return res.status(200).json({ success: true, renames, sheetCellsUpdated, sheetError });
  } catch (err) {
    console.error("Customer ID rename error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to update customer IDs." });
  }
}
