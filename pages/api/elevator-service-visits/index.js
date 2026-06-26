import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

function cleanNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function addTextFilter(whereParts, params, column, value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return;

  params.push(`%${cleanValue}%`);
  whereParts.push(`${column} ILIKE $${params.length}`);
}

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

    const page = cleanNumber(req.query.page, 1, 1, 999999);
    const pageSize = cleanNumber(req.query.pageSize, 25, 10, 100);
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim();
    const fromDate = String(req.query.fromDate || "").trim();
    const toDate = String(req.query.toDate || "").trim();

    const params = [];
    const whereParts = [];

    if (search) {
      params.push(`%${search}%`);
      whereParts.push(`
        concat_ws(
          ' ',
          v.customer_code,
          v.customer_name_snapshot,
          v.mobile_no_snapshot,
          v.city_snapshot,
          v.service_type,
          v.technician_1,
          v.technician_2,
          v.remarks,
          c.customer_name,
          c.mobile_no,
          c.city
        ) ILIKE $${params.length}
      `);
    }

    addTextFilter(whereParts, params, "v.customer_code", req.query.customerCode);
    addTextFilter(whereParts, params, "v.service_type", req.query.serviceType);

    const technician = String(req.query.technician || "").trim();
    if (technician) {
      params.push(`%${technician}%`);
      whereParts.push(`(v.technician_1 ILIKE $${params.length} OR v.technician_2 ILIKE $${params.length})`);
    }

    if (fromDate) {
      params.push(fromDate);
      whereParts.push(`v.service_date >= $${params.length}`);
    }

    if (toDate) {
      params.push(toDate);
      whereParts.push(`v.service_date <= $${params.length}`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countResult = await query(
      `
      SELECT COUNT(*)::int AS total
      FROM elevator_service_visits v
      LEFT JOIN elevator_service_customers c ON v.customer_id = c.id
      ${whereSql}
      `,
      params
    );

    const total = countResult.rows[0]?.total || 0;
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const dataResult = await query(
      `
      SELECT
        v.id,
        v.customer_id,
        v.service_date,
        v.customer_code,
        COALESCE(c.customer_name, v.customer_name_snapshot) AS customer_name,
        v.customer_name_snapshot,
        v.mobile_no_snapshot,
        v.city_snapshot,
        v.service_type,
        v.technician_1,
        v.technician_2,
        v.ard_condition,
        v.motor_condition,
        v.gear_oil_condition,
        v.brake_condition,
        v.rope_condition,
        v.rail_clips_condition,
        v.limit_switch_condition,
        v.gate_locks_condition,
        v.rcr_condition,
        v.sensors_condition,
        v.osg_condition,
        v.payment_amount,
        v.remarks,
        CASE WHEN v.customer_id IS NULL THEN 'Unlinked' ELSE 'Linked' END AS link_status
      FROM elevator_service_visits v
      LEFT JOIN elevator_service_customers c ON v.customer_id = c.id
      ${whereSql}
      ORDER BY
        v.service_date DESC NULLS LAST,
        v.created_at DESC NULLS LAST
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      [...params, pageSize, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      success: true,
      visits: dataResult.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to fetch elevator service visits:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch elevator service visits",
    });
  }
}
