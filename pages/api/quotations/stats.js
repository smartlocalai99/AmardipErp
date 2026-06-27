import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureQuotationTables } from "@/lib/quotations";
import { isBoqAdmin } from "@/lib/quotationPermissions";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || ["customer", "worker", "storekeeper"].includes(actor.role)) {
    return res.status(403).json({ success: false, message: "Unauthorized." });
  }

  const hasBoqPermission = await isBoqAdmin(actor);
  if (!hasBoqPermission && actor.role !== "front_office") {
    return res.status(403).json({ success: false, message: "Unauthorized." });
  }

  await ensureQuotationTables();
  const frontOffice = actor.role === "front_office";
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE $1::boolean = false OR status <> 'DRAFT')::int AS total_quotations,
      COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft_quotations,
      COUNT(*) FILTER (WHERE status IN ('BOQ_GENERATED', 'CALCULATED'))::int AS generated_quotations,
      COUNT(*) FILTER (WHERE status = 'SENT')::int AS sent_quotations,
      COUNT(*) FILTER (WHERE status = 'ACCEPTED')::int AS accepted_quotations
    FROM quotation_requests
  `, [frontOffice]);

  const row = result.rows[0] || {};
  return res.status(200).json({
    success: true,
    totalQuotations: row.total_quotations || 0,
    generatedQuotations: row.generated_quotations || 0,
    sentQuotations: row.sent_quotations || 0,
    acceptedQuotations: row.accepted_quotations || 0,
    ...(frontOffice ? {} : { draftQuotations: row.draft_quotations || 0 }),
  });
}
