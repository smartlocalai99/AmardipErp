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

    const page = cleanNumber(req.query.page, 1, 1, 999999);
    const pageSize = cleanNumber(req.query.pageSize, 25, 10, 100);
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim();

    const params = [];
    let whereSql = "";

    if (search) {
      params.push(`%${search}%`);

      whereSql = `
        WHERE concat_ws(
          ' ',
          record_no::text,
          customer_code,
          customer_name,
          address,
          city,
          mobile_no,
          hoc_date,
          customer_status,
          amc_warranty_due,
          amc_starting_date,
          amc_ending_date,
          no_of_passenger,
          door_type,
          cabin,
          no_of_floors,
          motor_make,
          controller_make,
          drive_make,
          ard_make,
          drive_model_no,
          motor_model_no,
          elevator_type,
          door_make,
          remarks
        ) ILIKE $1
      `;
    }

    const countResult = await query(
      `
      SELECT COUNT(*)::int AS total
      FROM elevator_service_customers
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
        record_no,
        customer_code,
        customer_name,
        address,
        city,
        mobile_no,
        hoc_date,
        customer_status,
        amc_warranty_due,
        amc_starting_date,
        amc_ending_date,
        no_of_passenger,
        door_type,
        cabin,
        no_of_floors,
        motor_make,
        controller_make,
        drive_make,
        ard_make,
        drive_model_no,
        motor_model_no,
        elevator_type,
        door_make,
        remarks,
        created_at,
        updated_at
      FROM elevator_service_customers
      ${whereSql}
      ORDER BY
        record_no ASC NULLS LAST,
        customer_code ASC NULLS LAST,
        customer_name ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      [...params, pageSize, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      success: true,
      customers: dataResult.rows,
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
    console.error("Failed to fetch elevator customers:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch elevator customers",
    });
  }
}