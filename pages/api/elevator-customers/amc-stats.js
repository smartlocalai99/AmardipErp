import { getUserFromRequest } from "@/lib/auth";
import { CUSTOMER_DUE_DATE_SQL } from "@/lib/customerDates";
import { query } from "@/lib/db";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false });

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ success: false });
  if (BLOCKED_ROLES.has(user.role)) return res.status(403).json({ success: false });

  try {
    // Imported customer dates are text and may be D/M/YYYY, DD/MM/YYYY, or
    // ISO. Parse them strictly, preferring AMC/warranty due over AMC end.
    const result = await query(`
      WITH dated AS (
        SELECT
          id,
          customer_status,
          UPPER(TRIM(COALESCE(customer_status, ''))) IN ('AMC', 'EMC', 'WARRANTY') AS is_service_contract,
          ${CUSTOMER_DUE_DATE_SQL} AS due_date
        FROM elevator_service_customers
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_service_contract AND due_date IS NOT NULL AND due_date < CURRENT_DATE)::int AS expired,
        COUNT(*) FILTER (WHERE is_service_contract AND due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '30 days')::int AS due_in_30,
        COUNT(*) FILTER (
          WHERE is_service_contract
            AND due_date >= CURRENT_DATE
            AND due_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
        )::int AS due_this_month,
        COUNT(*) FILTER (
          WHERE is_service_contract
            AND date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE + INTERVAL '1 month')
        )::int AS due_next_month,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'AMC')::int AS status_amc,
        COUNT(*) FILTER (WHERE is_service_contract AND due_date IS NULL)::int AS no_date
      FROM dated
    `);

    const row = result.rows[0] || {};
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(200).json({
      success: true,
      stats: {
        total: row.total || 0,
        expired: row.expired || 0,
        dueIn30: row.due_in_30 || 0,
        dueThisMonth: row.due_this_month || 0,
        dueNextMonth: row.due_next_month || 0,
        statusAmc: row.status_amc || 0,
        noDate: row.no_date || 0,
      },
    });
  } catch (err) {
    console.error("amc-stats error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
