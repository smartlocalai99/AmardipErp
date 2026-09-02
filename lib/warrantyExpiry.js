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
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Warranty customers (per the live HOC-date rule) whose warranty ends within
// `daysAhead` days and who haven't already been sent a notice.
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

// Cross-checks each candidate's customer_code against the staff-maintained
// source sheet, so a customer who has already renewed into AMC there (but
// whose local customer_status hasn't been updated yet) is not sent a stale
// expiry notice. Falls back to the DB-only candidate list if the sheet is
// unreachable or not configured, rather than blocking the whole run.
export async function filterOutAlreadyConvertedInSheet(candidates) {
  if (candidates.length === 0) return candidates;
  const sheets = getSheetsClient();
  if (!sheets) return candidates;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `'${SOURCE_SHEET_TAB}'!B:H`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = response.data.values || [];
    const statusByCode = new Map();
    for (const row of rows) {
      const code = String(row[0] || "").trim().toUpperCase();
      const status = String(row[6] || "").trim().toUpperCase();
      if (code) statusByCode.set(code, status);
    }

    return candidates.filter((c) => {
      const sheetStatus = statusByCode.get(String(c.customer_code || "").trim().toUpperCase());
      return !sheetStatus || !CONTRACT_STATUSES.has(sheetStatus);
    });
  } catch (error) {
    console.error("Warranty-expiry sheet cross-check failed, proceeding with DB-only candidates:", error);
    return candidates;
  }
}

// Records the notice (idempotent) and, for candidates with a linked customer
// login, alerts them that the letter is ready in their Documents tab.
export async function recordAndNotify(candidates) {
  let sent = 0;

  for (const candidate of candidates) {
    const inserted = await query(
      `INSERT INTO warranty_expiry_notices (customer_id, expiry_date)
       VALUES ($1, $2)
       ON CONFLICT (customer_id) DO NOTHING
       RETURNING id`,
      [candidate.id, candidate.expiry_date],
    );
    if (inserted.rowCount === 0) continue;

    const userResult = await query(
      `SELECT id FROM users
        WHERE role = 'customer'
          AND regexp_replace(COALESCE(username, ''), '\\D', '', 'g') = regexp_replace(COALESCE($1, ''), '\\D', '', 'g')
          AND regexp_replace(COALESCE($1, ''), '\\D', '', 'g') <> ''
        LIMIT 1`,
      [candidate.mobile_no],
    );
    const userId = userResult.rows[0]?.id;
    sent += 1;
    if (!userId) continue;

    const expiryLabel = new Date(candidate.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const message = `Your lift's warranty ends on ${expiryLabel}. A warranty expiry letter is ready in your Documents — renew your AMC to stay covered.`;

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
  }

  return sent;
}

export async function runWarrantyExpiryCheck(daysAhead = 30) {
  const candidates = await findExpiringWarrantyCandidates(daysAhead);
  const eligible = await filterOutAlreadyConvertedInSheet(candidates);
  const skippedAlreadyConverted = candidates.length - eligible.length;
  const sent = await recordAndNotify(eligible);
  return { candidateCount: candidates.length, skippedAlreadyConverted, sent };
}
