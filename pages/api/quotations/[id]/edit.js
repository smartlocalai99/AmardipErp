import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canEditBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { updateQuotationFields, generateBoqForQuotation } from "@/lib/quotations";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Quotation field edit audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canEditBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can edit a quotation." });
  }

  try {
    const { quotation, specChanged } = await updateQuotationFields({
      quotationId: req.query.id,
      input: req.body || {},
      actor,
    });

    // A spec change invalidates the last price — refetch it the same way
    // creation does, rather than leaving a stale price on a changed spec.
    let finalQuotation = quotation;
    if (specChanged) {
      const rePriced = await generateBoqForQuotation({ quotationId: req.query.id, actor });
      finalQuotation = rePriced.quotation;
    }

    await safeAudit({
      req,
      actor,
      entityType: "QUOTATION",
      entityId: req.query.id,
      action: "QUOTATION_EDITED",
      newValues: finalQuotation,
      changedFields: ["customer_name", "mobile_no", "address", "well_width", "well_depth", "no_of_floors", "no_of_passenger", "door_type", "cabin_type", "motor_type", "head_room", "door_opening"],
    });

    return res.status(200).json({ success: true, quotation: finalQuotation, rePriced: specChanged });
  } catch (err) {
    console.error("Edit quotation error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to update this quotation." });
  }
}
