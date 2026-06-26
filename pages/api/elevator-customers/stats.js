import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (BLOCKED_ROLES.has(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed",
      });
    }

    const result = await query(`
      SELECT
        COUNT(*)::int AS total_customers,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'AMC')::int AS active_amc,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'EMC')::int AS active_emc,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'WARRANTY')::int AS warranty_count,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'OUT OF WARRANTY')::int AS out_of_warranty_count,
        COUNT(*) FILTER (WHERE NULLIF(TRIM(mobile_no), '') IS NULL)::int AS missing_mobile_count
      FROM elevator_service_customers
    `);

    const row = result.rows[0] || {};

    return res.status(200).json({
      success: true,
      stats: {
        totalCustomers: row.total_customers || 0,
        activeAmc: row.active_amc || 0,
        activeEmc: row.active_emc || 0,
        warrantyCount: row.warranty_count || 0,
        outOfWarrantyCount: row.out_of_warranty_count || 0,
        missingMobileCount: row.missing_mobile_count || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch customer stats:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer stats",
    });
  }
}