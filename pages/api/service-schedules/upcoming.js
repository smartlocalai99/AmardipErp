import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { cleanNumber, ensureServiceSchedulesTable } from "@/lib/serviceSchedules";
import { fetchCustomerAutomationRows, getServiceDueCustomerCodes, getServiceDueCustomerMobiles, isServiceDueStatus } from "@/lib/customerAutomationSheet";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const SCHEDULED_STATUSES = new Set(["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "MISSED"]);
const VALID_MODES = new Set(["all", "scheduled", "to_be_scheduled", "today"]);

// Returns the ILIKE fragment (or null if there's no search term) instead of
// pushing it straight onto whereParts — the same fragment also needs to run
// a second time, inside to_be_scheduled_rows below, so a customer who
// doesn't pass the "due this month" heuristic (blank mobile number, a
// re-coded customer_code the sheet doesn't recognize, or simply not due
// yet) can still be found by typing their name, instead of a search that
// only ever narrows a list they were never going to appear in.
function buildSearchCondition(params, search) {
  const cleanSearch = String(search || "").trim();
  if (!cleanSearch) return null;

  params.push(`%${cleanSearch}%`);
  return `
    concat_ws(
      ' ',
      customer_code,
      customer_name,
      mobile_no,
      city,
      address
    ) ILIKE $${params.length}
  `;
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
    const pageSize = cleanNumber(req.query.pageSize, 25, 10, 1000);
    const offset = (page - 1) * pageSize;
    const mode = VALID_MODES.has(String(req.query.mode || "all"))
      ? String(req.query.mode || "all")
      : "all";
    const status = String(req.query.status || "all").trim().toUpperCase();

    // The CUSTOMER_AUTOMATION sheet is the primary source for who's under
    // an active AMC/warranty contract — the DB's own customer_status is
    // hand-edited and drifts. Fails open to the DB's own AMC/EMC/WARRANTY
    // status if the sheet is unreachable, so this list never goes empty
    // just because of a transient Sheets API issue.
    let serviceDueCodes = [];
    let serviceDueMobiles = [];
    try {
      [serviceDueCodes, serviceDueMobiles] = await Promise.all([
        getServiceDueCustomerCodes(),
        getServiceDueCustomerMobiles(),
      ]);
    } catch (err) {
      console.error("Failed to fetch service-due customers from sheet, falling back to DB status:", err);
    }

    const params = [serviceDueCodes, serviceDueMobiles];
    const whereParts = [];

    const searchCondition = buildSearchCondition(params, req.query.search);
    if (searchCondition) whereParts.push(searchCondition);

    if (mode === "scheduled") {
      whereParts.push("row_type = 'SCHEDULED'");
    } else if (mode === "to_be_scheduled") {
      whereParts.push("row_type = 'TO_BE_SCHEDULED'");
    } else if (mode === "today") {
      whereParts.push("row_type = 'SCHEDULED' AND scheduled_date = CURRENT_DATE");
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
          s.preferred_time,
          s.status AS schedule_status,
          s.assigned_technician_user_id,
          s.assigned_technician_name,
          co.assigned_by_username,
          s.service_type,
          co.checked_in_at,
          jc.duration_minutes,
          jc.completed_at,
          s.created_at,
          FALSE AS matched_via_search
        FROM service_schedules s
        JOIN elevator_service_customers c ON c.id = s.customer_id
        LEFT JOIN last_visits lv ON lv.customer_id = c.id
        LEFT JOIN complaints co ON co.id = s.linked_complaint_id
        LEFT JOIN LATERAL (
          SELECT t.duration_minutes, t.completed_at
          FROM technician_job_completions t
          WHERE t.complaint_id = co.id
          ORDER BY t.created_at DESC
          LIMIT 1
        ) jc ON co.id IS NOT NULL
        WHERE s.schedule_month = date_trunc('month', CURRENT_DATE)::date
          AND s.status IN ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'MISSED', 'COMPLETED')
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
          NULL::text AS preferred_time,
          'TO_BE_SCHEDULED'::text AS schedule_status,
          NULL::integer AS assigned_technician_user_id,
          NULL::text AS assigned_technician_name,
          NULL::text AS assigned_by_username,
          'MONTHLY_SERVICE'::text AS service_type,
          NULL::timestamptz AS checked_in_at,
          NULL::integer AS duration_minutes,
          NULL::timestamptz AS completed_at,
          NULL::timestamptz AS created_at,
          FALSE AS matched_via_search
        FROM elevator_service_customers c
        LEFT JOIN last_visits lv ON lv.customer_id = c.id
        WHERE ${
          serviceDueCodes.length > 0
            // Matches by code OR mobile number — staff periodically re-code
            // a customer in the sheet (e.g. AMC4 -> 23AMCMT5) without
            // updating the app's own customer_code, which used to make
            // that customer silently vanish from this list even though
            // both the sheet and the DB agree they're on an active
            // contract. Mobile number doesn't get relabeled, so it
            // recovers those cases.
            ? `(UPPER(TRIM(c.customer_code)) = ANY($1::text[]) OR regexp_replace(COALESCE(c.mobile_no, ''), '\\D', '', 'g') = ANY($2::text[]))`
            : "UPPER(TRIM(COALESCE(c.customer_status, ''))) IN ('AMC', 'EMC', '1M', '2M', 'WARRANTY')"
        }
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
      -- Search results only: a customer typed by name/code/mobile/city who
      -- isn't actually flagged "due this month" (blank mobile number, a
      -- re-coded customer_code the sheet doesn't recognize, or genuinely
      -- not due yet). Tagged matched_via_search so it can still be found
      -- and assigned, without inflating the "Unassigned" count above —
      -- that number is a real due-this-month metric and shouldn't grow
      -- just because a broad search term happens to match more names.
      off_list_matches AS (
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
          NULL::text AS preferred_time,
          'TO_BE_SCHEDULED'::text AS schedule_status,
          NULL::integer AS assigned_technician_user_id,
          NULL::text AS assigned_technician_name,
          NULL::text AS assigned_by_username,
          'MONTHLY_SERVICE'::text AS service_type,
          NULL::timestamptz AS checked_in_at,
          NULL::integer AS duration_minutes,
          NULL::timestamptz AS completed_at,
          NULL::timestamptz AS created_at,
          TRUE AS matched_via_search
        FROM elevator_service_customers c
        LEFT JOIN last_visits lv ON lv.customer_id = c.id
        WHERE ${searchCondition ? searchCondition : "FALSE"}
          AND NOT (
            ${
              serviceDueCodes.length > 0
                ? `(UPPER(TRIM(c.customer_code)) = ANY($1::text[]) OR regexp_replace(COALESCE(c.mobile_no, ''), '\\D', '', 'g') = ANY($2::text[]))`
                : "UPPER(TRIM(COALESCE(c.customer_status, ''))) IN ('AMC', 'EMC', '1M', '2M', 'WARRANTY')"
            }
          )
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
        UNION ALL
        SELECT * FROM off_list_matches
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
        COUNT(*) FILTER (WHERE row_type = 'TO_BE_SCHEDULED' AND NOT matched_via_search)::int AS to_be_scheduled,
        COUNT(*) FILTER (WHERE row_type = 'SCHEDULED' AND schedule_status != 'COMPLETED')::int AS assigned,
        COUNT(*) FILTER (WHERE row_type = 'SCHEDULED' AND schedule_status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE row_type = 'SCHEDULED' AND scheduled_date = CURRENT_DATE)::int AS today,
        COUNT(*)::int AS total
      FROM filtered_rows
      `,
      params
    );

    let total = summaryResult.rows[0]?.total || 0;
    let fallbackUnassigned = 0;
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const rowsResult = await query(
      `
      ${baseSql}
      SELECT *
      FROM filtered_rows
      ORDER BY
        CASE WHEN row_type = 'TO_BE_SCHEDULED' THEN 0 ELSE 1 END,
        CASE WHEN row_type = 'TO_BE_SCHEDULED' THEN last_service_date END ASC NULLS FIRST,
        CASE
          WHEN row_type != 'TO_BE_SCHEDULED' AND schedule_status = 'COMPLETED' THEN completed_at
          WHEN row_type != 'TO_BE_SCHEDULED' THEN created_at
        END DESC NULLS LAST,
        scheduled_date ASC NULLS LAST,
        customer_name ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      [...params, pageSize, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    let responseRows = rowsResult.rows;
    // Recovery path for legacy customer-sheet data whose customer codes or
    // phone numbers no longer match the database roster. Keep the normal SQL
    // path authoritative whenever it returns rows; only recover an empty
    // unfiltered month view so the admin never sees a false zero state.
    if (total === 0 && !req.query.search && mode === "all" && (!status || status === "ALL")) {
      const sheetRows = (await fetchCustomerAutomationRows()).filter((row) => isServiceDueStatus(row.status));
      const customerRows = await query(`
        SELECT id, customer_code, customer_name, address, city, mobile_no, customer_status
        FROM elevator_service_customers
      `);
      const byCode = new Map(customerRows.rows.map((row) => [String(row.customer_code || "").trim().toUpperCase(), row]));
      const byMobile = new Map(customerRows.rows.map((row) => [String(row.mobile_no || "").replace(/\D/g, "").slice(-10), row]));
      responseRows = sheetRows.map((sheetRow, index) => {
        const customer = byCode.get(sheetRow.customerCode.toUpperCase()) || byMobile.get(sheetRow.mobileNo.replace(/\D/g, "").slice(-10));
        return {
          row_type: "TO_BE_SCHEDULED",
          schedule_id: null,
          customer_id: customer?.id || null,
          customer_code: customer?.customer_code || sheetRow.customerCode,
          customer_name: customer?.customer_name || sheetRow.customerName,
          mobile_no: customer?.mobile_no || sheetRow.mobileNo,
          city: customer?.city || sheetRow.city,
          address: customer?.address || sheetRow.address,
          customer_status: sheetRow.status,
          amc_warranty_due: sheetRow.amcWarrantyDueText,
          schedule_month: new Date().toISOString().slice(0, 7) + "-01",
          scheduled_date: null,
          preferred_time: null,
          schedule_status: "TO_BE_SCHEDULED",
          assigned_technician_user_id: null,
          assigned_technician_name: null,
          service_type: "MONTHLY_SERVICE",
          checked_in_at: null,
          duration_minutes: null,
          completed_at: null,
          fallback_row: index,
        };
      });
      total = responseRows.length;
      fallbackUnassigned = responseRows.length;
    }

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(200).json({
      success: true,
      rows: responseRows.map((row) => ({
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
        preferredTime: row.preferred_time,
        scheduleStatus: row.schedule_status,
        assignedTechnicianUserId: row.assigned_technician_user_id,
        assignedTechnicianName: row.assigned_technician_name,
        assignedByUsername: row.assigned_by_username || null,
        serviceType: row.service_type,
        checkedInAt: row.checked_in_at,
        durationMinutes: row.duration_minutes,
        completedAt: row.completed_at,
      })),
      summary: {
        scheduled: summaryResult.rows[0]?.scheduled || 0,
        toBeScheduled: fallbackUnassigned || summaryResult.rows[0]?.to_be_scheduled || 0,
        unassigned: fallbackUnassigned || summaryResult.rows[0]?.to_be_scheduled || 0,
        assigned: fallbackUnassigned ? 0 : summaryResult.rows[0]?.assigned || 0,
        completed: fallbackUnassigned ? 0 : summaryResult.rows[0]?.completed || 0,
        today: summaryResult.rows[0]?.today || 0,
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
