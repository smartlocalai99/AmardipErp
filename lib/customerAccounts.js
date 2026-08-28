import { query } from "./db.js";
import { ensureCustomerAccountSchema } from "./usersSchema.js";

export function normalizeMobileNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

export async function getCustomerIdsForUser(userId) {
  await ensureCustomerAccountSchema();

  const result = await query(
    `
    SELECT customer_id
    FROM customer_user_links
    WHERE user_id = $1
    ORDER BY created_at, customer_id
    `,
    [userId]
  );

  return result.rows.map((row) => row.customer_id);
}

export async function getCustomerRecordsForUser(userId) {
  await ensureCustomerAccountSchema();

  const result = await query(
    `
    SELECT
      c.id,
      c.record_no,
      c.customer_code,
      c.customer_name,
      c.address,
      c.city,
      c.mobile_no,
      c.location,
      c.hoc_date,
      c.customer_status,
      c.amc_warranty_due,
      c.amc_starting_date,
      c.amc_ending_date,
      c.no_of_passenger,
      c.elevator_type
    FROM customer_user_links cul
    JOIN elevator_service_customers c ON c.id = cul.customer_id
    WHERE cul.user_id = $1
    ORDER BY c.record_no NULLS LAST, c.customer_name, c.id
    `,
    [userId]
  );

  return result.rows;
}

export async function getCustomerServiceVisitsForUser(userId, limit = 50) {
  await ensureCustomerAccountSchema();

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
  const result = await query(
    `
    SELECT
      v.id,
      v.customer_id,
      v.service_date::text AS service_date,
      COALESCE(c.customer_code, v.customer_code) AS customer_code,
      COALESCE(c.customer_name, v.customer_name_snapshot) AS customer_name,
      COALESCE(c.location, c.city, v.city_snapshot) AS service_location,
      v.service_type,
      v.technician_1,
      v.technician_2,
      v.remarks
    FROM customer_user_links cul
    JOIN elevator_service_customers c ON c.id = cul.customer_id
    JOIN elevator_service_visits v ON v.customer_id = c.id
    WHERE cul.user_id = $1
    ORDER BY v.service_date DESC NULLS LAST, v.created_at DESC NULLS LAST
    LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}
