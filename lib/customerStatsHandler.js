import { IN_WARRANTY_SQL, HOC_DATE_SQL } from "./customerDates.js";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

export function createCustomerStatsHandler({ getUserFromRequest, query }) {
  return async function customerStatsHandler(req, res) {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    try {
      const user = await getUserFromRequest(req);
      if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
      if (BLOCKED_ROLES.has(user.role)) {
        return res.status(403).json({ success: false, message: "Not allowed" });
      }

      const result = await query(`
        SELECT
          COUNT(*)::int AS total_customers,
          -- "1M"/"2M" are short informal service arrangements that are AMC
          -- in substance, so they count as AMC here.
          COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) IN ('AMC', '1M', '2M'))::int AS active_amc,
          COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'EMC')::int AS active_emc,
          -- Computed live from HOC date + 1 year, not the (sometimes stale)
          -- status text, so it self-corrects as warranties lapse.
          COUNT(*) FILTER (WHERE ${IN_WARRANTY_SQL})::int AS warranty_count,
          COUNT(*) FILTER (
            WHERE ${HOC_DATE_SQL} IS NOT NULL
              AND NOT (${IN_WARRANTY_SQL})
              AND UPPER(TRIM(COALESCE(customer_status, ''))) NOT IN ('AMC', 'EMC', '1M', '2M')
          )::int AS out_of_warranty_count,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(mobile_no), '') IS NULL)::int AS missing_mobile_count
        FROM elevator_service_customers
      `);

      const row = result.rows[0] || {};
      const payload = {
        success: true,
        stats: {
          totalCustomers: row.total_customers || 0,
          activeAmc: row.active_amc || 0,
          activeEmc: row.active_emc || 0,
          warrantyCount: row.warranty_count || 0,
          outOfWarrantyCount: row.out_of_warranty_count || 0,
          missingMobileCount: row.missing_mobile_count || 0,
        },
      };

      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return res.status(200).json(payload);
    } catch (error) {
      console.error("Failed to fetch customer stats:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch customer stats" });
    }
  };
}
