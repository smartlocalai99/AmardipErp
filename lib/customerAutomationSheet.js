import { google } from "googleapis";

const SOURCE_SHEET_ID = "1kuPjN3QsWd6-ruqo25zr9xaFoOWViaQH_yusbI73FJ0";
const SOURCE_SHEET_TAB = "CUSTOMER_AUTOMATION";
// The real, editable source table for this spreadsheet — CUSTOMER_AUTOMATION
// above is a read-only QUERY() mirror of this tab, confirmed the hard way.
// New customers must be appended here, never to CUSTOMER_AUTOMATION.
const CUSTOMER_LIST_TAB = "CUSTOMER_LIST";

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

// Separate from getSheetsClient() above because appending needs write scope,
// not just spreadsheets.readonly.
function getWriteSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

// The sheet's dates are DD/MM/YYYY; our DB stores ISO (YYYY-MM-DD).
function toSheetDate(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
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
    range: `'${SOURCE_SHEET_TAB}'!B2:M`,
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
      advanceText: String(row[11] || "").trim(),
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

// Staff periodically re-code a customer in the sheet (e.g. AMC4 -> 23AMCMT5)
// without updating the app's own customer_code — matching by code alone
// then silently drops that customer from the service-due list even though
// both the sheet and the DB agree they're on an active contract. Mobile
// number is the one field that doesn't get relabeled, so it's used as a
// fallback join key alongside the code.
export async function getServiceDueCustomerMobiles(options) {
  const rows = await fetchCustomerAutomationRows(options);
  return rows
    .filter((row) => isServiceDueStatus(row.status))
    .map((row) => row.mobileNo.replace(/\D/g, "").slice(-10))
    .filter((mobile) => mobile.length === 10);
}

// Appends one newly onboarded customer — from either quotation-conversion
// path — to CUSTOMER_LIST, the real master sheet, so it's picked up by the
// CUSTOMER_AUTOMATION due-service heuristic (which mirrors this tab) without
// someone copying it in by hand later.
//
// Column Z on every existing row holds a per-row formula (a pre-filled
// Google Form link built from that row's own B-I values) — appended rows
// don't inherit it automatically, and building a matching formula string
// isn't worth the risk, so it's deliberately left blank for staff to fill
// in by hand if they want that row's quick-link too. Column AA (ADVANCE) is
// the one genuinely free column, added for the project-onboarding path;
// blank for a plain AMC-customer onboarding.
export async function appendCustomerListRow({
  customerCode,
  customerName,
  address = "",
  city = "",
  mobileNo = "",
  status = "",
  amcWarrantyDue = "",
  amcStartDate = "",
  amcEndDate = "",
  amcAmount = "",
  noOfPassenger = "",
  doorType = "",
  cabinType = "",
  noOfFloors = "",
  advance = "",
}) {
  const sheets = getWriteSheetsClient();
  if (!sheets) return;

  const existingIds = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: `'${CUSTOMER_LIST_TAB}'!A2:A`,
  });
  const nextSerial = (existingIds.data.values || []).length + 1;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SOURCE_SHEET_ID,
    range: `'${CUSTOMER_LIST_TAB}'!A:AA`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        nextSerial,           // A - serial
        customerCode,         // B - COUSTMER ID
        customerName,         // C - COUSTMER NAME
        address,              // D - ADDRESS
        city,                 // E - CITY
        mobileNo,             // F - MOBILE NO
        "",                   // G - HOC DATE (no equivalent)
        status,                // H - CUSTOMER STATUS
        toSheetDate(amcWarrantyDue), // I - AMC / WARRANTY DUE
        toSheetDate(amcStartDate),  // J - AMC STARTING DATE
        toSheetDate(amcEndDate),    // K - AMC ENDING DATE
        amcAmount,             // L - AMC AMOUNT
        noOfPassenger,         // M - NO OF PASSENGER
        doorType,              // N - DOOR TYPE
        cabinType,             // O - CABIN
        noOfFloors,            // P - NO OF FLOORS
        "", "", "", "", "", "", // Q-V - MOTOR/CONTROLLER/DRIVE/ARD MAKE + models (not collected)
        "",                    // W - ELEVATOR TYPE (not collected)
        "",                    // X - DOOR MAKE (not collected)
        "",                    // Y - LOCATION (not collected)
        "",                    // Z - per-row form-link formula, deliberately left blank
        advance,               // AA - ADVANCE
      ]],
    },
  });

  // Invalidate the read cache so the due-service heuristic (which reads
  // CUSTOMER_AUTOMATION, mirroring this tab) sees this customer immediately
  // instead of waiting out the 5-minute TTL.
  cache = null;
  cacheExpiresAt = 0;
}

// A project-onboarded customer starts as ON GOING with no dates
// (appendCustomerListRow above); once the installation checklist actually
// reaches 100% (handover), status moves to WARRANTY, and this updates that
// same row in place rather than appending a duplicate. Finds the row by
// customer code (column B) since no row number is tracked for CUSTOMER_LIST
// appends the way quotation_projects.google_sheet_row tracks the ONGOING tab.
//
// Dates here are taken as-is (already DD/MM/YYYY, matching how
// elevator_service_customers itself stores hoc_date/amc_warranty_due) —
// unlike appendCustomerListRow's fields above, NOT run through
// toSheetDate (which expects ISO input).
export async function updateCustomerListHandoverStatus(customerCode, { status, hocDate, amcWarrantyDue }) {
  const sheets = getWriteSheetsClient();
  if (!sheets) return;

  const codes = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: `'${CUSTOMER_LIST_TAB}'!B:B`,
  });
  const rowIndex = (codes.data.values || []).findIndex((row) => row[0] === customerCode);
  if (rowIndex === -1) return; // Not in the sheet (e.g. onboarded before this sync existed) — nothing to update.
  const rowNumber = rowIndex + 1; // 1-indexed to match the sheet's own row numbers.

  await sheets.spreadsheets.values.update({
    spreadsheetId: SOURCE_SHEET_ID,
    range: `'${CUSTOMER_LIST_TAB}'!G${rowNumber}:K${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      // G HOC DATE, H STATUS, I AMC/WARRANTY DUE, J/K AMC start/end (blank — no AMC yet)
      values: [[hocDate || "", status, amcWarrantyDue || "", "", ""]],
    },
  });

  cache = null;
  cacheExpiresAt = 0;
}
