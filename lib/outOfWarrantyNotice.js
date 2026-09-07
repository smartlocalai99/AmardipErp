import { HOC_DATE_SQL, IN_WARRANTY_SQL, parseCustomerDate } from "./customerDates.js";
import { addOneCalendarYear, formatLetterDate } from "./customerHandoverDocument.js";
import { createCustomerNotification } from "./customerNotifications.js";
import { sendPushToUserIds } from "./pushNotifications.js";
import { ensureWarrantyExpiryNoticesSchema } from "./warrantyExpiry.js";
import { query } from "./db.js";

// A customer counts as "out of warranty" once their handover-based warranty
// window (HOC + 1 year) has passed and they still haven't been converted to
// an AMC/EMC contract — i.e. no active coverage of any kind. Customers never
// handed over at all (no HOC date — "ON GOING") are excluded; that's a
// different stage, not a lapsed one.
const OUT_OF_WARRANTY_SQL = `(
  ${HOC_DATE_SQL} IS NOT NULL
  AND NOT (${IN_WARRANTY_SQL})
  AND UPPER(TRIM(COALESCE(customer_status, ''))) NOT IN ('AMC', 'EMC', '1M', '2M')
)`;

// Reuses the same warranty_expiry_notices table (and its UNIQUE customer_id
// constraint) as the "expiring soon" letter — it's the same letter and the
// same one-notice-per-customer lifecycle, just triggered from a different,
// later point in that lifecycle. This is also what makes the dedupe work:
// once a customer has been sent either letter, they never get sent again.
export async function findOutOfWarrantyCandidates() {
  await ensureWarrantyExpiryNoticesSchema();
  const result = await query(
    `
    SELECT c.id, c.customer_code, c.customer_name, c.mobile_no,
           (${HOC_DATE_SQL} + INTERVAL '1 year')::date AS expiry_date,
           w.sent_at, w.amc_amount
      FROM elevator_service_customers c
      LEFT JOIN warranty_expiry_notices w ON w.customer_id = c.id
     WHERE ${OUT_OF_WARRANTY_SQL}
    ORDER BY (w.sent_at IS NOT NULL), (${HOC_DATE_SQL} + INTERVAL '1 year') ASC
    `
  );
  return result.rows;
}

export async function sendOutOfWarrantyLetterToCustomer(customerId, amcAmount) {
  await ensureWarrantyExpiryNoticesSchema();

  const amount = amcAmount === undefined || amcAmount === null || amcAmount === ""
    ? null
    : Number(amcAmount);
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    throw new Error("Enter a valid AMC amount, or leave it blank.");
  }

  const candidateResult = await query(
    `
    SELECT c.id, c.customer_code, c.customer_name, c.mobile_no, c.hoc_date,
           (${HOC_DATE_SQL} + INTERVAL '1 year')::date AS expiry_date
      FROM elevator_service_customers c
      LEFT JOIN warranty_expiry_notices w ON w.customer_id = c.id
     WHERE c.id = $1 AND ${OUT_OF_WARRANTY_SQL} AND w.id IS NULL
     LIMIT 1
    `,
    [customerId]
  );
  const candidate = candidateResult.rows[0];
  if (!candidate) {
    throw new Error("This customer is no longer eligible — already sent, or now covered by AMC/warranty.");
  }

  const hoc = parseCustomerDate(candidate.hoc_date);
  const hocDateText = formatLetterDate(hoc);
  const warrantyDueDateText = formatLetterDate(addOneCalendarYear(hoc));

  await query(
    `INSERT INTO warranty_expiry_notices (customer_id, expiry_date, amc_amount, hoc_date_text, warranty_due_date_text)
     VALUES ($1, $2, $3, $4, $5)`,
    [candidate.id, candidate.expiry_date, amount, hocDateText, warrantyDueDateText]
  );

  const userResult = await query(
    `SELECT id FROM users
      WHERE role = 'customer'
        AND regexp_replace(COALESCE(username, ''), '\\D', '', 'g') = regexp_replace(COALESCE($1, ''), '\\D', '', 'g')
        AND regexp_replace(COALESCE($1, ''), '\\D', '', 'g') <> ''
      LIMIT 1`,
    [candidate.mobile_no]
  );
  const userId = userResult.rows[0]?.id;
  if (!userId) return { notified: false };

  const expiryLabel = new Date(candidate.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const message = `Your lift's warranty ended on ${expiryLabel} and it isn't on an AMC yet. A notice is ready in your Documents — renew your AMC to stay covered.`;

  await createCustomerNotification({
    userId,
    category: "Out of warranty notice",
    message,
    data: { type: "OUT_OF_WARRANTY", customerRecordId: candidate.id },
  }).catch((error) => console.error("Failed to persist out-of-warranty notification:", error));

  await sendPushToUserIds([userId], {
    title: "Out of warranty notice",
    body: message,
    data: { url: "/Customerdashboard?tab=documents", type: "OUT_OF_WARRANTY" },
  }).catch((error) => console.error("Failed to push out-of-warranty notice:", error));

  return { notified: true };
}
