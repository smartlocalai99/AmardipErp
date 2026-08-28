import assert from "node:assert/strict";
import test from "node:test";
import pool, { query } from "../lib/db.js";
import {
  CUSTOMER_DUE_DATE_SQL,
  getCustomerDueDate,
  parseCustomerDate,
} from "../lib/customerDates.js";

function localDateParts(date) {
  if (!date) return null;
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

test("parseCustomerDate accepts real import formats and rejects impossible dates", () => {
  assert.deepEqual(localDateParts(parseCustomerDate("2026-08-29")), [2026, 8, 29]);
  assert.deepEqual(localDateParts(parseCustomerDate("31/12/2026")), [2026, 12, 31]);
  assert.deepEqual(localDateParts(parseCustomerDate("1/9/2026")), [2026, 9, 1]);
  assert.deepEqual(localDateParts(parseCustomerDate("29/2/2028")), [2028, 2, 29]);
  assert.equal(parseCustomerDate("29/2/2027"), null);
  assert.equal(parseCustomerDate("31/9/2025"), null);
  assert.equal(parseCustomerDate(""), null);
  assert.equal(parseCustomerDate(null), null);
});

test("getCustomerDueDate falls back when the warranty date is invalid", () => {
  assert.deepEqual(
    localDateParts(getCustomerDueDate({
      amc_warranty_due: "31/9/2025",
      amc_ending_date: "15/10/2025",
    })),
    [2025, 10, 15]
  );
});

test("CUSTOMER_DUE_DATE_SQL parses and validates dates inside PostgreSQL", async () => {
  const result = await query(`
    WITH fixtures(amc_warranty_due, amc_ending_date, expected_order) AS (
      VALUES
        ('31/12/2026'::text, NULL::text, 1),
        ('1/9/2026'::text, NULL::text, 2),
        ('2026-08-29'::text, NULL::text, 3),
        ('31/9/2025'::text, '15/10/2025'::text, 4),
        ('31/9/2025'::text, NULL::text, 5),
        (NULL::text, '29/2/2028'::text, 6)
    )
    SELECT (${CUSTOMER_DUE_DATE_SQL})::text AS due_date
    FROM fixtures
    ORDER BY expected_order
  `);

  assert.deepEqual(
    result.rows.map((row) => row.due_date),
    ["2026-12-31", "2026-09-01", "2026-08-29", "2025-10-15", null, "2028-02-29"]
  );
});

test.after(async () => {
  await pool.end();
});
