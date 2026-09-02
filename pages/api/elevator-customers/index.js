import { getUserFromRequest } from "@/lib/auth";
import { CUSTOMER_DUE_DATE_SQL, IN_WARRANTY_SQL } from "@/lib/customerDates";
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
    const pageSize = cleanNumber(req.query.pageSize, 25, 10, 500);
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const validDueFilters = new Set(["this_month", "next_month", "expired"]);
    const dueFilterRaw = String(req.query.dueFilter || "").trim().toLowerCase();
    const dueFilter = validDueFilters.has(dueFilterRaw) ? dueFilterRaw : "";
    const validBuckets = new Set(["warranty"]);
    const bucketRaw = String(req.query.bucket || "").trim().toLowerCase();
    const bucket = validBuckets.has(bucketRaw) ? bucketRaw : "";

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

    if (dueFilter === "expired") {
      whereParts.push(`due_date IS NOT NULL AND due_date < CURRENT_DATE`);
    } else if (dueFilter === "this_month") {
      whereParts.push(`
        due_date IS NOT NULL
        AND due_date >= CURRENT_DATE
        AND due_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
      `);
    } else if (dueFilter === "next_month") {
      whereParts.push(`due_date IS NOT NULL AND date_trunc('month', due_date) = date_trunc('month', CURRENT_DATE + INTERVAL '1 month')`);
    }

    if (dueFilter) {
      whereParts.push(`UPPER(TRIM(COALESCE(customer_status, ''))) IN ('AMC', 'EMC', 'WARRANTY')`);
    }

    // Computed live from HOC date + 1 year (not the status text alone), so a
    // stale "WARRANTY" label past its year doesn't keep showing up here.
    if (bucket === "warranty") {
      whereParts.push(IN_WARRANTY_SQL);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Dates are free-text from import (some invalid, e.g. 31/11/2026), so use
    // the shared strict parser for ISO and slash-formatted customer dates.
    // Computed once in a CTE so both the count and the page of rows — and the
    // dueFilter/urgency ordering below — can filter/sort on the same value.
    const scopedCte = `
      WITH scoped AS (
        SELECT
          *,
          ${CUSTOMER_DUE_DATE_SQL} AS due_date
        FROM elevator_service_customers
      )
    `;

    const countResult = await query(
      `
      ${scopedCte}
      SELECT COUNT(*)::int AS total
      FROM scoped
      ${whereSql}
      `,
      params
    );

    const total = countResult.rows[0]?.total || 0;

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    // For AMC/EMC/Warranty views (or any due-date bucket), surface the most
    // urgent contracts first: expiring this month, then next month, then
    // already-expired, then active.
    const urgencyStatuses = new Set(["AMC", "EMC", "WARRANTY"]);
    const useUrgencyOrder = urgencyStatuses.has(status.toUpperCase()) || Boolean(dueFilter) || Boolean(bucket);

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
      ${scopedCte}
      SELECT
        id, record_no, customer_code, customer_name, address, city, mobile_no,
        hoc_date, customer_status, amc_warranty_due, amc_starting_date, amc_ending_date,
        no_of_passenger, door_type, cabin, no_of_floors, motor_make, controller_make,
        drive_make, ard_make, drive_model_no, motor_model_no, elevator_type, door_make,
        remarks, created_at, updated_at, due_date
      FROM scoped
      ${whereSql}
      ${orderBySql}
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      [...params, pageSize, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
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
