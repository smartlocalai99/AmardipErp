import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureServiceSchedulesTable } from "@/lib/serviceSchedules";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const LIST_LIMIT = 25;
const SUMMARY_CACHE_MS = 60 * 1000;

let summaryCache = null;

async function requireAdmin(req, res) {
  const user = await getUserFromRequest(req);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
    return null;
  }

  if (BLOCKED_ROLES.has(user.role)) {
    res.status(403).json({
      success: false,
      message: "Not allowed",
    });
    return null;
  }

  return user;
}

const customerSelect = `
  id,
  record_no,
  customer_code,
  customer_name,
  mobile_no,
  city,
  address,
  customer_status,
  amc_warranty_due
`;

const joinedCustomerSelect = `
  c.id,
  c.record_no,
  c.customer_code,
  c.customer_name,
  c.mobile_no,
  c.city,
  c.address,
  c.customer_status,
  c.amc_warranty_due
`;

const parsedCustomerCte = `
  WITH raw_customers AS (
    SELECT
      ${customerSelect},
      TRIM(COALESCE(amc_warranty_due, '')) AS due_text
    FROM elevator_service_customers
  ),
  parsed_customers AS (
    SELECT
      id,
      record_no,
      customer_code,
      customer_name,
      mobile_no,
      city,
      address,
      customer_status,
      amc_warranty_due,
      CASE
        WHEN due_text = '' THEN NULL::date
        WHEN due_text ~ '^\\d{4}-\\d{2}-\\d{2}$'
          AND substring(due_text, 6, 2)::int BETWEEN 1 AND 12
          AND substring(due_text, 9, 2)::int BETWEEN 1 AND EXTRACT(day FROM (date_trunc('month', make_date(substring(due_text, 1, 4)::int, substring(due_text, 6, 2)::int, 1)) + interval '1 month - 1 day'))::int
          THEN make_date(substring(due_text, 1, 4)::int, substring(due_text, 6, 2)::int, substring(due_text, 9, 2)::int)
        WHEN due_text ~ '^\\d{2}/\\d{2}/\\d{4}$'
          AND substring(due_text, 4, 2)::int BETWEEN 1 AND 12
          AND substring(due_text, 1, 2)::int BETWEEN 1 AND EXTRACT(day FROM (date_trunc('month', make_date(substring(due_text, 7, 4)::int, substring(due_text, 4, 2)::int, 1)) + interval '1 month - 1 day'))::int
          THEN make_date(substring(due_text, 7, 4)::int, substring(due_text, 4, 2)::int, substring(due_text, 1, 2)::int)
        WHEN due_text ~ '^\\d{2}-\\d{2}-\\d{4}$'
          AND substring(due_text, 4, 2)::int BETWEEN 1 AND 12
          AND substring(due_text, 1, 2)::int BETWEEN 1 AND EXTRACT(day FROM (date_trunc('month', make_date(substring(due_text, 7, 4)::int, substring(due_text, 4, 2)::int, 1)) + interval '1 month - 1 day'))::int
          THEN make_date(substring(due_text, 7, 4)::int, substring(due_text, 4, 2)::int, substring(due_text, 1, 2)::int)
        ELSE NULL::date
      END AS due_date
    FROM raw_customers
  )
`;

async function fetchRows(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    if (summaryCache && Date.now() - summaryCache.cachedAt < SUMMARY_CACHE_MS) {
      res.setHeader("Cache-Control", "private, max-age=30");
      return res.status(200).json(summaryCache.payload);
    }

    await ensureServiceSchedulesTable();

    const [
      expiryCounts,
      dueThisMonth,
      dueNext30Days,
      expired,
      monthlyCounts,
      toBeScheduledRows,
      scheduledRows,
      missedRows,
      completedRows,
      customerQualityCounts,
      missingMobileRows,
      missingCityRows,
      missingDueRows,
      missingStatusRows,
      duplicateCodeRows,
      blankCodeRows,
      noLinkedHistoryRows,
      serviceQualityCounts,
      unlinkedRows,
      missingServiceDateRows,
      missingServiceTypeRows,
      missingTechnicianRows,
    ] = await Promise.all([
      fetchRows(`
        ${parsedCustomerCte}
        SELECT
          COUNT(*) FILTER (
            WHERE due_date >= date_trunc('month', CURRENT_DATE)::date
              AND due_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
          )::int AS due_this_month,
          COUNT(*) FILTER (
            WHERE due_date >= CURRENT_DATE
              AND due_date < CURRENT_DATE + interval '30 days'
          )::int AS due_next_30_days,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE)::int AS expired
        FROM parsed_customers
      `),
      fetchRows(`
        ${parsedCustomerCte}
        SELECT ${customerSelect}, due_date
        FROM parsed_customers
        WHERE due_date >= date_trunc('month', CURRENT_DATE)::date
          AND due_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
        ORDER BY due_date ASC, customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        ${parsedCustomerCte}
        SELECT ${customerSelect}, due_date
        FROM parsed_customers
        WHERE due_date >= CURRENT_DATE
          AND due_date < CURRENT_DATE + interval '30 days'
        ORDER BY due_date ASC, customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        ${parsedCustomerCte}
        SELECT ${customerSelect}, due_date
        FROM parsed_customers
        WHERE due_date < CURRENT_DATE
        ORDER BY due_date ASC NULLS LAST, customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        WITH to_be_scheduled AS (
          SELECT c.id
          FROM elevator_service_customers c
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
        )
        SELECT
          (SELECT COUNT(*)::int FROM to_be_scheduled) AS to_be_scheduled,
          (SELECT COUNT(*)::int FROM service_schedules WHERE schedule_month = date_trunc('month', CURRENT_DATE)::date AND status IN ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS')) AS scheduled,
          (SELECT COUNT(*)::int FROM service_schedules WHERE schedule_month = date_trunc('month', CURRENT_DATE)::date AND status = 'MISSED') AS missed,
          (SELECT COUNT(*)::int FROM elevator_service_visits WHERE customer_id IS NOT NULL AND service_date >= date_trunc('month', CURRENT_DATE)::date AND service_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date) AS completed_current_month
      `),
      fetchRows(`
        SELECT ${joinedCustomerSelect}
        FROM elevator_service_customers c
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
        ORDER BY c.customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT s.id AS schedule_id, s.scheduled_date, s.status AS schedule_status, s.assigned_technician_name, ${joinedCustomerSelect}
        FROM service_schedules s
        JOIN elevator_service_customers c ON c.id = s.customer_id
        WHERE s.schedule_month = date_trunc('month', CURRENT_DATE)::date
          AND s.status IN ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS')
        ORDER BY s.scheduled_date ASC NULLS LAST, c.customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT s.id AS schedule_id, s.scheduled_date, s.status AS schedule_status, s.assigned_technician_name, ${joinedCustomerSelect}
        FROM service_schedules s
        JOIN elevator_service_customers c ON c.id = s.customer_id
        WHERE s.schedule_month = date_trunc('month', CURRENT_DATE)::date
          AND s.status = 'MISSED'
        ORDER BY s.scheduled_date ASC NULLS LAST, c.customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT
          v.id,
          v.service_date,
          v.service_type,
          v.technician_1,
          v.technician_2,
          v.payment_amount,
          c.customer_code,
          c.customer_name,
          c.mobile_no,
          c.city,
          c.customer_status
        FROM elevator_service_visits v
        JOIN elevator_service_customers c ON c.id = v.customer_id
        WHERE v.service_date >= date_trunc('month', CURRENT_DATE)::date
          AND v.service_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
        ORDER BY v.service_date DESC NULLS LAST, c.customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT
          COUNT(*) FILTER (WHERE NULLIF(TRIM(mobile_no), '') IS NULL)::int AS missing_mobile,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(city), '') IS NULL)::int AS missing_city,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(amc_warranty_due), '') IS NULL)::int AS missing_amc_warranty_due,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(customer_status), '') IS NULL)::int AS missing_customer_status,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(customer_code), '') IS NULL)::int AS blank_customer_code,
          (
            SELECT COUNT(*)::int
            FROM (
              SELECT UPPER(TRIM(customer_code))
              FROM elevator_service_customers
              WHERE NULLIF(TRIM(customer_code), '') IS NOT NULL
              GROUP BY UPPER(TRIM(customer_code))
              HAVING COUNT(*) > 1
            ) duplicates
          ) AS duplicate_customer_code_groups,
          COUNT(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1
              FROM elevator_service_visits v
              WHERE v.customer_id = elevator_service_customers.id
            )
          )::int AS no_linked_service_history
        FROM elevator_service_customers
      `),
      fetchRows(`SELECT ${customerSelect} FROM elevator_service_customers WHERE NULLIF(TRIM(mobile_no), '') IS NULL ORDER BY customer_name ASC LIMIT $1`, [LIST_LIMIT]),
      fetchRows(`SELECT ${customerSelect} FROM elevator_service_customers WHERE NULLIF(TRIM(city), '') IS NULL ORDER BY customer_name ASC LIMIT $1`, [LIST_LIMIT]),
      fetchRows(`SELECT ${customerSelect} FROM elevator_service_customers WHERE NULLIF(TRIM(amc_warranty_due), '') IS NULL ORDER BY customer_name ASC LIMIT $1`, [LIST_LIMIT]),
      fetchRows(`SELECT ${customerSelect} FROM elevator_service_customers WHERE NULLIF(TRIM(customer_status), '') IS NULL ORDER BY customer_name ASC LIMIT $1`, [LIST_LIMIT]),
      fetchRows(`
        SELECT
          UPPER(TRIM(customer_code)) AS customer_code,
          COUNT(*)::int AS duplicate_count,
          array_agg(customer_name ORDER BY customer_name) AS customer_names
        FROM elevator_service_customers
        WHERE NULLIF(TRIM(customer_code), '') IS NOT NULL
        GROUP BY UPPER(TRIM(customer_code))
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC, customer_code ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`SELECT ${customerSelect} FROM elevator_service_customers WHERE NULLIF(TRIM(customer_code), '') IS NULL ORDER BY customer_name ASC LIMIT $1`, [LIST_LIMIT]),
      fetchRows(`
        SELECT ${joinedCustomerSelect}
        FROM elevator_service_customers c
        WHERE NOT EXISTS (
          SELECT 1
          FROM elevator_service_visits v
          WHERE v.customer_id = c.id
        )
        ORDER BY c.customer_name ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT
          COUNT(*)::int AS total_service_visits,
          COUNT(*) FILTER (WHERE customer_id IS NOT NULL)::int AS linked_visits,
          COUNT(*) FILTER (WHERE customer_id IS NULL)::int AS unlinked_visits,
          COUNT(*) FILTER (WHERE service_date IS NULL)::int AS missing_service_date,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(service_type), '') IS NULL)::int AS missing_service_type,
          COUNT(*) FILTER (
            WHERE NULLIF(TRIM(technician_1), '') IS NULL
              AND NULLIF(TRIM(technician_2), '') IS NULL
          )::int AS missing_technician_name,
          COUNT(*) FILTER (WHERE payment_amount IS NOT NULL)::int AS payment_collected_count
        FROM elevator_service_visits
      `),
      fetchRows(`
        SELECT id, service_date, customer_code, customer_name_snapshot, mobile_no_snapshot, city_snapshot, service_type, technician_1, technician_2, payment_amount
        FROM elevator_service_visits
        WHERE customer_id IS NULL
        ORDER BY service_date DESC NULLS LAST, customer_name_snapshot ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT id, service_date, customer_code, customer_name_snapshot, mobile_no_snapshot, city_snapshot, service_type, technician_1, technician_2, payment_amount
        FROM elevator_service_visits
        WHERE service_date IS NULL
        ORDER BY customer_name_snapshot ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT id, service_date, customer_code, customer_name_snapshot, mobile_no_snapshot, city_snapshot, service_type, technician_1, technician_2, payment_amount
        FROM elevator_service_visits
        WHERE NULLIF(TRIM(service_type), '') IS NULL
        ORDER BY service_date DESC NULLS LAST, customer_name_snapshot ASC
        LIMIT $1
      `, [LIST_LIMIT]),
      fetchRows(`
        SELECT id, service_date, customer_code, customer_name_snapshot, mobile_no_snapshot, city_snapshot, service_type, technician_1, technician_2, payment_amount
        FROM elevator_service_visits
        WHERE NULLIF(TRIM(technician_1), '') IS NULL
          AND NULLIF(TRIM(technician_2), '') IS NULL
        ORDER BY service_date DESC NULLS LAST, customer_name_snapshot ASC
        LIMIT $1
      `, [LIST_LIMIT]),
    ]);

    const payload = {
      success: true,
      generatedAt: new Date().toISOString(),
      reports: {
        amcWarrantyExpiry: {
          counts: expiryCounts[0] || {},
          dueThisMonth,
          dueNext30Days,
          expired,
        },
        monthlyServiceDue: {
          counts: monthlyCounts[0] || {},
          toBeScheduled: toBeScheduledRows,
          scheduled: scheduledRows,
          missed: missedRows,
          completedCurrentMonth: completedRows,
        },
        customerDataQuality: {
          counts: customerQualityCounts[0] || {},
          missingMobile: missingMobileRows,
          missingCity: missingCityRows,
          missingAmcWarrantyDue: missingDueRows,
          missingCustomerStatus: missingStatusRows,
          duplicateCustomerCode: duplicateCodeRows,
          blankCustomerCode: blankCodeRows,
          noLinkedServiceHistory: noLinkedHistoryRows,
        },
        serviceDataQuality: {
          counts: serviceQualityCounts[0] || {},
          unlinkedVisits: unlinkedRows,
          missingServiceDate: missingServiceDateRows,
          missingServiceType: missingServiceTypeRows,
          missingTechnicianName: missingTechnicianRows,
        },
      },
    };

    summaryCache = {
      cachedAt: Date.now(),
      payload,
    };

    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Admin reports summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load admin reports",
    });
  }
}
