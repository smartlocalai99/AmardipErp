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
    const status = String(req.query.status || "").trim();

    const params = [];
    const whereParts = [];

    if (search) {
      params.push(`%${search}%`);

      whereParts.push(`
        concat_ws(
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
        ) ILIKE $${params.length}
      `);
    }

    if (status) {
      params.push(status.toUpperCase());
      whereParts.push(`UPPER(TRIM(customer_status)) = $${params.length}`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

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

    // For AMC/EMC/Warranty views, surface the most urgent contracts first:
    // expiring this month, then next month, then already-expired, then active.
    // Dates are free-text from import (some invalid, e.g. 31/11/2026), so this
    // mirrors the defensive ISO-format check already used in amc-stats.js.
    const urgencyStatuses = new Set(["AMC", "EMC", "WARRANTY"]);
    const useUrgencyOrder = urgencyStatuses.has(status.toUpperCase());

    const orderBySql = useUrgencyOrder
      ? `
        ORDER BY
          CASE
            WHEN due_date IS NULL THEN 4
            WHEN due_date < CURRENT_DATE THEN 2
            WHEN date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE) THEN 0
            WHEN date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE + INTERVAL '1 month') THEN 1
            ELSE 3
          END ASC,
          due_date ASC NULLS LAST,
          customer_name ASC
      `
      : `
        ORDER BY
          record_no ASC NULLS LAST,
          customer_code ASC NULLS LAST,
          customer_name ASC
      `;

    const dataResult = await query(
      `
      SELECT * FROM (
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
          updated_at,
          CASE
            WHEN amc_warranty_due IS NOT NULL AND amc_warranty_due::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN amc_warranty_due::text::date
            WHEN amc_ending_date IS NOT NULL AND amc_ending_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN amc_ending_date::text::date
            ELSE NULL
          END AS due_date
        FROM elevator_service_customers
        ${whereSql}
      ) AS scoped
      ${orderBySql}
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
