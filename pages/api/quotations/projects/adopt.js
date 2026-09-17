import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { adoptLegacySheetProject } from "@/lib/quotations";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Project adoption audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can adopt a legacy project." });
  }

  try {
    const project = await adoptLegacySheetProject({
      customerName: req.body?.customerName,
      mobileNo: req.body?.mobileNo,
      address: req.body?.address,
      city: req.body?.city,
      agreedAmount: req.body?.agreedAmount,
      advanceAmount: req.body?.advanceAmount,
      googleSheetRow: req.body?.googleSheetRow,
      actor,
    });

    await safeAudit({
      req,
      actor,
      entityType: "QUOTATION_PROJECT",
      entityId: project.id,
      action: "LEGACY_PROJECT_ADOPTED",
      newValues: { project },
      changedFields: ["agreed_amount", "advance_amount", "balance_amount"],
    });

    return res.status(201).json({ success: true, project });
  } catch (err) {
    console.error("Adopt legacy project error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to adopt this project." });
  }
}
