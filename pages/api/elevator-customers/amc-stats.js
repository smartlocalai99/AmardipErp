import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false });

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ success: false });
  if (BLOCKED_ROLES.has(user.role)) return res.status(403).json({ success: false });

  try {
    // Use the best available date column: amc_warranty_due, then amc_ending_date
    const result = await query(`
      WITH dated AS (
        SELECT
          id,
          customer_status,
          CASE
            WHEN amc_warranty_due IS NOT NULL AND amc_warranty_due::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN amc_warranty_due::text::date
            WHEN amc_ending_date IS NOT NULL AND amc_ending_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN amc_ending_date::text::date
            ELSE NULL
          END AS due_date
        FROM elevator_service_customers
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE)::int AS expired,
        COUNT(*) FILTER (WHERE due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '30 days')::int AS due_in_30,
        COUNT(*) FILTER (
          WHERE date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE)
        )::int AS due_this_month,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'AMC')::int AS status_amc,
        COUNT(*) FILTER (WHERE due_date IS NULL)::int AS no_date
      FROM dated
    `);

    const row = result.rows[0] || {};
    return res.status(200).json({
      success: true,
      stats: {
        total: row.total || 0,
        expired: row.expired || 0,
        dueIn30: row.due_in_30 || 0,
        dueThisMonth: row.due_this_month || 0,
        statusAmc: row.status_amc || 0,
        noDate: row.no_date || 0,
      },
    });
  } catch (err) {
    console.error("amc-stats error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
