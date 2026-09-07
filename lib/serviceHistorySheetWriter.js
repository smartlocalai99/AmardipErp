import { google } from "googleapis";

const SOURCE_SHEET_ID = "1kuPjN3QsWd6-ruqo25zr9xaFoOWViaQH_yusbI73FJ0";
// The same detailed sheet lib/serviceHistorySync.mjs already reads FROM
// (its columns already match everything the app collects — the client
// asked for app completions to land here, not in the MONTH_SERVICE
// summary tab this used to target). SOURCE is the one new column, added
// so the nightly sync (see below) can tell an app-written row apart from
// a human-entered one and skip re-importing it.
const TARGET_TAB = "Form Responses 4";
const NEW_HEADER_CELL = "AB1";
const NEW_HEADER = "SOURCE";

let headerEnsured = false;

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  // Needs the read-write scope — every other integration in this codebase
  // only ever reads (spreadsheets.readonly). Writing also requires (a) the
  // sheet sharing Editor access with this service account, and (b) this
  // specific tab's protected-range settings naming this account as an
  // allowed editor — "Form Responses 4" (being a Google Forms response
  // sheet) is locked down sheet-wide by default. Neither is something any
  // scope or code change can grant; both are manual steps in Google
  // Sheets' own sharing / Protected sheets & ranges dialogs.
  const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

function formatSheetDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function formatSheetTimestamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${formatSheetDate(d)} ${hh}:${min}:${ss}`;
}

// Idempotent — only writes the SOURCE header once, the first time it's
// found missing, so repeated calls (every job completion) don't keep
// re-writing it.
async function ensureHeader(sheets) {
  if (headerEnsured) return;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: `'${TARGET_TAB}'!${NEW_HEADER_CELL}`,
  });
  if (!existing.data.values?.[0]?.[0]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `'${TARGET_TAB}'!${NEW_HEADER_CELL}`,
      valueInputOption: "RAW",
      requestBody: { values: [[NEW_HEADER]] },
    });
  }
  headerEnsured = true;
}

// Appends one row to "Form Responses 4" for a monthly service job the app
// just completed, in the exact same column layout the sheet already uses
// (SNO left blank — its numbering convention resets unpredictably through
// the sheet's history and isn't used for anything downstream; the sync's
// own dedup key is the row number, not SNO). Best-effort and fail-open:
// a sheet outage, rate limit, or missing permission must never block a
// worker from actually completing and saving a real job to the database.
export async function appendServiceCompletionToSheet(data) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    await ensureHeader(sheets);

    const checklist = data.checklist || {};
    const now = new Date();
    const row = [
      formatSheetTimestamp(now),
      "",
      formatSheetDate(data.serviceDate || now),
      data.customerCode || "",
      data.customerName || "",
      data.address || "",
      data.city || "",
      data.mobileNo || "",
      data.hocDate ? formatSheetDate(data.hocDate) : "",
      data.customerStatus || "",
      checklist.ard || "",
      checklist.motor || "",
      checklist.gearOil || "",
      checklist.brake || "",
      checklist.rope || "",
      checklist.railClips || "",
      checklist.limitSwitch || "",
      checklist.gateLocks || "",
      checklist.rcr || "",
      checklist.sensors || "",
      checklist.osg || "",
      data.remarks || "",
      data.serviceType || "",
      "",
      data.technician1 || "",
      data.technician2 || "",
      data.amcWarrantyDue || "",
      "App",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `'${TARGET_TAB}'!A:A`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch (error) {
    console.error("Failed to append service completion to Form Responses 4 sheet (non-blocking):", error.message);
  }
}
