import { google } from "googleapis";

const SOURCE_SHEET_ID = "1kuPjN3QsWd6-ruqo25zr9xaFoOWViaQH_yusbI73FJ0";
const TARGET_TAB = "MONTH_SERVICE";

// The sheet's own 9 columns (A-I) were already there, hand-maintained by
// staff — never touched here. Everything from ARD CONDITION onward (J-X)
// is new, added the first time this successfully runs, to hold what the
// app actually collects that the sheet never had a place for.
const NEW_HEADERS = [
  "ARD CONDITION", "MOTOR CONDITION", "GEAR OIL CONDITION", "BRAKE CONDITION",
  "ROPE CONDITION", "RAIL CLIPS CONDITION", "LIMIT SWITCH CONDITION",
  "GATE LOCKS", "RCR CONDITION", "SENSORS", "OSG CONDITION",
  "STATUS RESOLUTION", "CUSTOMER REP NAME", "LOCATION", "SOURCE",
];

let headersEnsured = false;

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  // Needs the read-write scope — every other integration in this codebase
  // only ever reads (spreadsheets.readonly). Writing also requires the
  // sheet itself to share Editor access with this service account, which
  // is a manual step in Google Sheets' own sharing dialog, not something
  // any scope or code change can grant.
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

// Idempotent — only writes the new header labels once, the first time
// they're found missing, so repeated calls (every job completion) don't
// keep re-writing row 1.
async function ensureHeaders(sheets) {
  if (headersEnsured) return;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: `'${TARGET_TAB}'!J1`,
  });
  if (!existing.data.values?.[0]?.[0]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SOURCE_SHEET_ID,
      range: `'${TARGET_TAB}'!J1`,
      valueInputOption: "RAW",
      requestBody: { values: [NEW_HEADERS] },
    });
  }
  headersEnsured = true;
}

// Appends one row to MONTH_SERVICE for a monthly service job the app just
// completed, so staff see app-completed visits in the same ledger as
// everything else instead of only inside the app. Best-effort and
// fail-open by design: a sheet outage, a rate limit, or (until an admin
// shares the sheet with this service account as Editor) a permission
// error must never block a worker from actually completing and saving a
// real job to the database.
export async function appendServiceCompletionToSheet(data) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    await ensureHeaders(sheets);

    const checklist = data.checklist || {};
    const row = [
      formatSheetDate(data.serviceDate || new Date()),
      data.customerCode || "",
      data.customerName || "",
      data.hocDate ? formatSheetDate(data.hocDate) : "",
      data.remarks || "",
      data.serviceType || "",
      "",
      data.technician1 || "",
      data.technician2 || "",
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
      data.statusResolution || "",
      data.customerRepName || "",
      data.location || "",
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
    console.error("Failed to append service completion to MONTH_SERVICE sheet (non-blocking):", error.message);
  }
}
