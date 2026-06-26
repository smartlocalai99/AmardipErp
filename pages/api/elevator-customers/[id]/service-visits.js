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

    const customerId = String(req.query.id || "").trim();

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    const page = cleanNumber(req.query.page, 1, 1, 999999);
    const pageSize = cleanNumber(req.query.pageSize, 25, 10, 100);
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim();
    const serviceType = String(req.query.serviceType || "").trim();
    const fromDate = String(req.query.fromDate || "").trim();
    const toDate = String(req.query.toDate || "").trim();

    const params = [customerId];
    const whereParts = ["customer_id = $1"];

    if (search) {
      params.push(`%${search}%`);
      whereParts.push(`
        concat_ws(
          ' ',
          service_date::text,
          customer_code,
          customer_name_snapshot,
          city_snapshot,
          mobile_no_snapshot,
          customer_status_snapshot,
          service_type,
          technician_1,
          technician_2,
          ard_condition,
          motor_condition,
          gear_oil_condition,
          brake_condition,
          rope_condition,
          rail_clips_condition,
          limit_switch_condition,
          gate_locks_condition,
          rcr_condition,
          sensors_condition,
          osg_condition,
          payment_amount::text,
          remarks,
          source_row_no::text,
          source_sno
        ) ILIKE $${params.length}
      `);
    }

    if (serviceType) {
      params.push(`%${serviceType}%`);
      whereParts.push(`service_type ILIKE $${params.length}`);
    }

    if (fromDate) {
      params.push(fromDate);
      whereParts.push(`service_date >= $${params.length}`);
    }

    if (toDate) {
      params.push(toDate);
      whereParts.push(`service_date <= $${params.length}`);
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    const countResult = await query(
      `
      SELECT COUNT(*)::int AS total
      FROM elevator_service_visits
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
        id,
        service_date,
        customer_code,
        customer_name_snapshot,
        city_snapshot,
        mobile_no_snapshot,
        customer_status_snapshot,
        ard_condition,
        motor_condition,
        gear_oil_condition,
        brake_condition,
        rope_condition,
        rail_clips_condition,
        limit_switch_condition,
        gate_locks_condition,
        rcr_condition,
        sensors_condition,
        osg_condition,
        remarks,
        service_type,
        payment_amount,
        technician_1,
        technician_2,
        amc_warranty_due_snapshot,
        source_row_no,
        source_sno
      FROM elevator_service_visits
      ${whereSql}
      ORDER BY
        service_date DESC NULLS LAST,
        created_at DESC NULLS LAST
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
    console.error("Failed to fetch customer service visits:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer service visits",
    });
  }
}
