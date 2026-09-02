import { google } from "googleapis";

const SOURCE_SHEET_ID = "1kuPjN3QsWd6-ruqo25zr9xaFoOWViaQH_yusbI73FJ0";
const SOURCE_SHEET_TAB = "CUSTOMER_AUTOMATION";

// Statuses that mean "this lift is under an active contract and gets a
// monthly service visit" — everything except OUT OF WARRANTY, the
// not-yet-handed-over ON GOING state, and PENDING/blank rows. 1M/2M are
// informal short-term AMC arrangements and count the same as AMC.
const SERVICE_DUE_STATUSES = new Set(["AMC", "EMC", "1M", "2M", "WARRANTY"]);

let cache = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  return google.sheets({ version: "v4", auth });
}

// The staff-maintained CUSTOMER_AUTOMATION sheet is the primary source of
// truth for who's under an active AMC/warranty contract — the DB's own
// customer_status column is hand-edited and drifts out of date. Cached for
// a few minutes so an admin loading the Service tab repeatedly doesn't fire
// a sheet API call on every keystroke of the search box.
export async function fetchCustomerAutomationRows({ forceRefresh = false } = {}) {
  if (!forceRefresh && cache && Date.now() < cacheExpiresAt) return cache;

  const sheets = getSheetsClient();
  if (!sheets) return cache || [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: `'${SOURCE_SHEET_TAB}'!B2:L`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = response.data.values || [];
  const parsed = rows
    .map((row) => ({
      customerCode: String(row[0] || "").trim(),
      customerName: String(row[1] || "").trim(),
      address: String(row[2] || "").trim(),
      city: String(row[3] || "").trim(),
      mobileNo: String(row[4] || "").trim(),
      hocDateText: String(row[5] || "").trim(),
      status: String(row[6] || "").trim().toUpperCase(),
      amcWarrantyDueText: String(row[7] || "").trim(),
      amcStartDateText: String(row[8] || "").trim(),
      amcEndDateText: String(row[9] || "").trim(),
      amcAmountText: String(row[10] || "").trim(),
    }))
    .filter((row) => row.customerCode);

  cache = parsed;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return parsed;
}

export function isServiceDueStatus(status) {
  return SERVICE_DUE_STATUSES.has(String(status || "").trim().toUpperCase());
}

// Customer codes (the sheet's "COUSTMER ID" column) currently under an
// active AMC or warranty contract, per the sheet — the full roster that
// needs a monthly service visit, spanning both AMC and warranty-covered
// customers in one list, exactly as the sheet tracks them.
export async function getServiceDueCustomerCodes(options) {
  const rows = await fetchCustomerAutomationRows(options);
  return rows
    .filter((row) => isServiceDueStatus(row.status))
    .map((row) => row.customerCode.toUpperCase());
}
