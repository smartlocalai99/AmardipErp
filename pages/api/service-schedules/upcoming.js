import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { cleanNumber, ensureServiceSchedulesTable } from "@/lib/serviceSchedules";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const SCHEDULED_STATUSES = new Set(["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "MISSED"]);
const VALID_MODES = new Set(["all", "scheduled", "to_be_scheduled"]);

function addSearchFilter(whereParts, params, search) {
  const cleanSearch = String(search || "").trim();
  if (!cleanSearch) return;

  params.push(`%${cleanSearch}%`);
  whereParts.push(`
    concat_ws(
      ' ',
      customer_code,
      customer_name,
      mobile_no,
      city,
      address
    ) ILIKE $${params.length}
  `);
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

    await ensureServiceSchedulesTable();

    const page = cleanNumber(req.query.page, 1, 1, 999999);
    const pageSize = cleanNumber(req.query.pageSize, 25, 10, 100);
    const offset = (page - 1) * pageSize;
    const mode = VALID_MODES.has(String(req.query.mode || "all"))
      ? String(req.query.mode || "all")
      : "all";
    const status = String(req.query.status || "all").trim().toUpperCase();

    const params = [];
    const whereParts = [];

    addSearchFilter(whereParts, params, req.query.search);

    if (mode === "scheduled") {
      whereParts.push("row_type = 'SCHEDULED'");
    } else if (mode === "to_be_scheduled") {
      whereParts.push("row_type = 'TO_BE_SCHEDULED'");
    }

    if (status && status !== "ALL") {
      params.push(status);
      whereParts.push("schedule_status = $" + params.length);
    }

    const filteredWhereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const baseSql = `
      WITH last_visits AS (
        SELECT
          customer_id,
          MAX(service_date) AS last_service_date
        FROM elevator_service_visits
        WHERE customer_id IS NOT NULL
        GROUP BY customer_id
      ),
      scheduled_rows AS (
        SELECT
          'SCHEDULED'::text AS row_type,
          s.id AS schedule_id,
          c.id AS customer_id,
          c.customer_code,
          c.customer_name,
          c.mobile_no,
          c.city,
          c.address,
          c.customer_status,
          c.amc_warranty_due,
          c.amc_starting_date,
          c.amc_ending_date,
          lv.last_service_date,
          CASE
            WHEN lv.last_service_date IS NULL THEN NULL
            ELSE (CURRENT_DATE - lv.last_service_date)::int
          END AS days_since_last_service,
          s.schedule_month,
          s.scheduled_date,
          s.status AS schedule_status,
          s.assigned_technician_name,
          s.service_type
        FROM service_schedules s
        JOIN elevator_service_customers c ON c.id = s.customer_id
        LEFT JOIN last_visits lv ON lv.customer_id = c.id
        WHERE s.schedule_month = date_trunc('month', CURRENT_DATE)::date
          AND s.status IN ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'MISSED')
      ),
      to_be_scheduled_rows AS (
        SELECT
          'TO_BE_SCHEDULED'::text AS row_type,
          NULL::uuid AS schedule_id,
          c.id AS customer_id,
          c.customer_code,
          c.customer_name,
          c.mobile_no,
          c.city,
          c.address,
          c.customer_status,
          c.amc_warranty_due,
          c.amc_starting_date,
          c.amc_ending_date,
          lv.last_service_date,
          CASE
            WHEN lv.last_service_date IS NULL THEN NULL
            ELSE (CURRENT_DATE - lv.last_service_date)::int
          END AS days_since_last_service,
          date_trunc('month', CURRENT_DATE)::date AS schedule_month,
          NULL::date AS scheduled_date,
          'TO_BE_SCHEDULED'::text AS schedule_status,
          NULL::text AS assigned_technician_name,
          'MONTHLY_SERVICE'::text AS service_type
        FROM elevator_service_customers c
        LEFT JOIN last_visits lv ON lv.customer_id = c.id
        WHERE UPPER(TRIM(COALESCE(c.customer_status, ''))) IN ('AMC', 'EMC', 'WARRANTY')
          AND NOT EXISTS (
            SELECT 1
            FROM elevator_service_visits v
            WHERE v.customer_id = c.id
              AND v.service_date >= date_trunc('month', CURRENT_DATE)::date
              AND v.service_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
          )
          AND NOT EXISTS (
            SELECT 1
            FROM service_schedules s
            WHERE s.customer_id = c.id
              AND s.schedule_month = date_trunc('month', CURRENT_DATE)::date
              AND s.status NOT IN ('CANCELLED', 'COMPLETED')
          )
      ),
      unified_rows AS (
        SELECT * FROM scheduled_rows
        UNION ALL
        SELECT * FROM to_be_scheduled_rows
      ),
      filtered_rows AS (
        SELECT *
        FROM unified_rows
        ${filteredWhereSql}
      )
    `;

    const summaryResult = await query(
      `
      ${baseSql}
      SELECT
        COUNT(*) FILTER (WHERE row_type = 'SCHEDULED')::int AS scheduled,
        COUNT(*) FILTER (WHERE row_type = 'TO_BE_SCHEDULED')::int AS to_be_scheduled,
        COUNT(*)::int AS total
      FROM filtered_rows
      `,
      params
    );

    const total = summaryResult.rows[0]?.total || 0;
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const rowsResult = await query(
      `
      ${baseSql}
      SELECT *
      FROM filtered_rows
      ORDER BY
        CASE WHEN row_type = 'TO_BE_SCHEDULED' THEN 0 ELSE 1 END,
        scheduled_date ASC NULLS LAST,
        last_service_date ASC NULLS FIRST,
        customer_name ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      [...params, pageSize, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      success: true,
      rows: rowsResult.rows.map((row) => ({
        rowType: row.row_type,
        scheduleId: row.schedule_id,
        customerId: row.customer_id,
        customerCode: row.customer_code,
        customerName: row.customer_name,
        mobileNo: row.mobile_no,
        city: row.city,
        address: row.address,
        customerStatus: row.customer_status,
        amcWarrantyDue: row.amc_warranty_due,
        amcStartingDate: row.amc_starting_date,
        amcEndingDate: row.amc_ending_date,
        lastServiceDate: row.last_service_date,
        daysSinceLastService: row.days_since_last_service,
        scheduleMonth: row.schedule_month,
        scheduledDate: row.scheduled_date,
        scheduleStatus: row.schedule_status,
        assignedTechnicianName: row.assigned_technician_name,
        serviceType: row.service_type,
      })),
      summary: {
        scheduled: summaryResult.rows[0]?.scheduled || 0,
        toBeScheduled: summaryResult.rows[0]?.to_be_scheduled || 0,
        total,
      },
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
    console.error("Upcoming service schedules API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming services",
    });
  }
}
