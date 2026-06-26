import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureServiceSchedulesTable } from "@/lib/serviceSchedules";

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

    await ensureServiceSchedulesTable();

    const result = await query(`
      WITH technician_names AS (
        SELECT NULLIF(TRIM(technician_1), '') AS name
        FROM elevator_service_visits
        WHERE NULLIF(TRIM(technician_1), '') IS NOT NULL
        UNION
        SELECT NULLIF(TRIM(technician_2), '') AS name
        FROM elevator_service_visits
        WHERE NULLIF(TRIM(technician_2), '') IS NOT NULL
      )
      SELECT
        (SELECT COUNT(*)::int FROM elevator_service_visits) AS total_service_visits,
        (SELECT COUNT(*) FILTER (WHERE customer_id IS NOT NULL)::int FROM elevator_service_visits) AS linked_service_visits,
        (SELECT COUNT(*) FILTER (WHERE customer_id IS NULL)::int FROM elevator_service_visits) AS unlinked_service_visits,
        (SELECT MAX(service_date) FROM elevator_service_visits) AS last_service_date,
        (SELECT COUNT(*) FILTER (WHERE service_type ILIKE '%breakdown%')::int FROM elevator_service_visits) AS total_breakdowns,
        (SELECT COUNT(*) FILTER (WHERE service_type ILIKE '%month%' OR service_type ILIKE '%monthly%')::int FROM elevator_service_visits) AS total_monthly_services,
        (SELECT COUNT(*) FILTER (WHERE payment_amount IS NOT NULL)::int FROM elevator_service_visits) AS total_payments_collected,
        (SELECT COUNT(*)::int FROM technician_names) AS unique_technicians,
        date_trunc('month', CURRENT_DATE)::date AS current_month_start,
        (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date AS current_month_end,
        (
          SELECT COUNT(*)::int
          FROM service_schedules
          WHERE schedule_month = date_trunc('month', CURRENT_DATE)::date
            AND status IN ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'MISSED')
        ) AS scheduled_upcoming_services,
        (
          SELECT COUNT(*)::int
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
        ) AS to_be_scheduled_services
    `);

    const row = result.rows[0] || {};
    const scheduledUpcomingServices = row.scheduled_upcoming_services || 0;
    const toBeScheduledServices = row.to_be_scheduled_services || 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalServiceVisits: row.total_service_visits || 0,
        linkedServiceVisits: row.linked_service_visits || 0,
        unlinkedServiceVisits: row.unlinked_service_visits || 0,
        lastServiceDate: row.last_service_date || null,
        totalBreakdowns: row.total_breakdowns || 0,
        totalMonthlyServices: row.total_monthly_services || 0,
        totalPaymentsCollected: row.total_payments_collected || 0,
        uniqueTechnicians: row.unique_technicians || 0,
        scheduledUpcomingServices,
        toBeScheduledServices,
        upcomingServicesTotal: scheduledUpcomingServices + toBeScheduledServices,
        currentMonthStart: row.current_month_start || null,
        currentMonthEnd: row.current_month_end || null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch service visit stats:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch service visit stats",
    });
  }
}
