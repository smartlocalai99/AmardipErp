import { google } from "googleapis";
import { query } from "./db.js";
import { HOC_DATE_SQL, IN_WARRANTY_SQL } from "./customerDates.js";
import { createCustomerNotification } from "./customerNotifications.js";
import { sendPushToUserIds } from "./pushNotifications.js";

const SOURCE_SHEET_ID = "1kuPjN3QsWd6-ruqo25zr9xaFoOWViaQH_yusbI73FJ0";
const SOURCE_SHEET_TAB = "CUSTOMER_AUTOMATION";
const CONTRACT_STATUSES = new Set(["AMC", "EMC", "1M", "2M"]);

export async function ensureWarrantyExpiryNoticesSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS warranty_expiry_notices (
      id SERIAL PRIMARY KEY,
      customer_id UUID NOT NULL UNIQUE REFERENCES elevator_service_customers(id) ON DELETE CASCADE,
      expiry_date DATE NOT NULL,
      amc_amount NUMERIC,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query("ALTER TABLE warranty_expiry_notices ADD COLUMN IF NOT EXISTS amc_amount NUMERIC");
}

// Warranty customers (per the live HOC-date rule) whose warranty ends within
// `daysAhead` days and who haven't already been sent a notice — this is what
// the admin sees to decide who to send a letter to. Sending is manual and
// per-customer (an admin-entered AMC amount is required each time), not an
// automated bulk job.
export async function findExpiringWarrantyCandidates(daysAhead = 30) {
  await ensureWarrantyExpiryNoticesSchema();
  const result = await query(
    `
    SELECT c.id, c.customer_code, c.customer_name, c.mobile_no,
           (${HOC_DATE_SQL} + INTERVAL '1 year')::date AS expiry_date
      FROM elevator_service_customers c
      LEFT JOIN warranty_expiry_notices w ON w.customer_id = c.id
     WHERE ${IN_WARRANTY_SQL}
       AND (${HOC_DATE_SQL} + INTERVAL '1 year') <= (CURRENT_DATE + $1 * INTERVAL '1 day')
       AND w.id IS NULL
    `,
    [daysAhead],
  );
  return result.rows;
}

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  return google.sheets({ version: "v4", auth });
}

// True if the source sheet already shows this customer converted to an
// AMC-type contract (staff renew there first) — sending would be stale.
// Sheet-unreachable/not-configured fails open (returns false) so a single
// send action never gets blocked by an unrelated outage.
async function hasAlreadyConvertedInSheet(customerCode) {
  const sheets = getSheetsClient();
  if (!sheets || !customerCode) return false;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `'${SOURCE_SHEET_TAB}'!B:H`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = response.data.values || [];
    const target = String(customerCode).trim().toUpperCase();
    for (const row of rows) {
      const code = String(row[0] || "").trim().toUpperCase();
      if (code !== target) continue;
      const status = String(row[6] || "").trim().toUpperCase();
      return CONTRACT_STATUSES.has(status);
    }
    return false;
  } catch (error) {
    console.error("Warranty-expiry sheet cross-check failed, proceeding:", error);
    return false;
  }
}

// Sends the warranty-expiry letter to exactly one customer: re-validates
// they're still a genuine candidate (still in warranty, not already sent),
// cross-checks the source sheet for a since-converted AMC status, records
// the notice (which is what makes the PDF servable and excludes them from
// future candidate lists), and notifies them.
export async function sendWarrantyExpiryLetterToCustomer(customerId, amcAmount) {
  const amount = Number(amcAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("A valid AMC amount is required.");
  }

  await ensureWarrantyExpiryNoticesSchema();

  const candidateResult = await query(
    `
    SELECT c.id, c.customer_code, c.customer_name, c.mobile_no,
           (${HOC_DATE_SQL} + INTERVAL '1 year')::date AS expiry_date
      FROM elevator_service_customers c
      LEFT JOIN warranty_expiry_notices w ON w.customer_id = c.id
     WHERE c.id = $1 AND ${IN_WARRANTY_SQL} AND w.id IS NULL
     LIMIT 1
    `,
    [customerId],
  );
  const candidate = candidateResult.rows[0];
  if (!candidate) {
    throw new Error("This customer is no longer eligible — already sent, converted to AMC, or out of warranty.");
  }

  if (await hasAlreadyConvertedInSheet(candidate.customer_code)) {
    throw new Error("The source sheet shows this customer has already converted to AMC — skipped.");
  }

  await query(
    `INSERT INTO warranty_expiry_notices (customer_id, expiry_date, amc_amount) VALUES ($1, $2, $3)`,
    [candidate.id, candidate.expiry_date, amount],
  );

  const userResult = await query(
    `SELECT id FROM users
      WHERE role = 'customer'
        AND regexp_replace(COALESCE(username, ''), '\\D', '', 'g') = regexp_replace(COALESCE($1, ''), '\\D', '', 'g')
        AND regexp_replace(COALESCE($1, ''), '\\D', '', 'g') <> ''
      LIMIT 1`,
    [candidate.mobile_no],
  );
  const userId = userResult.rows[0]?.id;
  if (!userId) return { notified: false };

  const expiryLabel = new Date(candidate.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const message = `Your lift's warranty ended on ${expiryLabel}. A warranty expiry letter is ready in your Documents — renew your AMC to stay covered.`;

  await createCustomerNotification({
    userId,
    category: "Warranty expiry notice",
    message,
    data: { type: "WARRANTY_EXPIRING", customerRecordId: candidate.id },
  }).catch((error) => console.error("Failed to persist warranty-expiry notification:", error));

  await sendPushToUserIds([userId], {
    title: "Warranty expiry notice",
    body: message,
    data: { url: "/Customerdashboard?tab=documents", type: "WARRANTY_EXPIRING" },
  }).catch((error) => console.error("Failed to push warranty-expiry notification:", error));

  return { notified: true };
}
