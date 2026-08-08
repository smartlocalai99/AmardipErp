import { getUserFromRequest } from "@/lib/auth";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { getQuotationById } from "@/lib/quotations";
import { getFullBoqRow } from "@/lib/googleSheets";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can open the full BOQ." });
  }

  try {
    const quotation = await getQuotationById({ id: req.query.id, actor });
    if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found." });
    if (!quotation.sheetRow) {
      return res.status(400).json({ success: false, message: "This quotation doesn't have a price from the sheet yet." });
    }

    const rows = await getFullBoqRow(quotation.sheetRow);
    return res.status(200).json({ success: true, rows, sheetRow: quotation.sheetRow });
  } catch (err) {
    console.error("Fetch BOQ row error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to fetch the BOQ row." });
  }
}
