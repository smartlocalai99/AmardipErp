import { query } from "@/lib/db";
import { ensureCustomerAccountSchema } from "@/lib/usersSchema";

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
