import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq } from "@/lib/quotationPermissions";
import { isBoqAdmin } from "@/lib/quotationPermissions";
import { listQuotations, saveQuotation } from "@/lib/quotations";

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
      const result = await listQuotations({
        actor,
        page: req.query.page,
        pageSize: req.query.pageSize,
        search: req.query.search || "",
        status: req.query.status || "",
      });
      return res.status(200).json({ success: true, quotations: result.rows, ...result });
    } catch (err) {
      return res.status(403).json({ success: false, message: err.message || "Unauthorized." });
    }
  }

  if (req.method === "POST") {
    const hasPermission = await isBoqAdmin(actor);
    if (!canGenerateBoq(actor, hasPermission)) {
      return res.status(403).json({ success: false, message: "Only selected BOQ admins can create quotations." });
    }

    try {
      const quotation = await saveQuotation({ actor, input: req.body || {} });
      await safeAudit({ req, actor, entityType: "QUOTATION", entityId: quotation.id, action: "QUOTATION_CREATED", newValues: quotation, changedFields: ["quotation"] });
      return res.status(201).json({ success: true, quotation });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || "Failed to create quotation." });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
