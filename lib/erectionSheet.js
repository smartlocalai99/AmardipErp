import { google } from "googleapis";

// The Erection Sheet Google Form's own response spreadsheet — confirmed a
// genuine flat data table (not a formula/QUERY mirror like the
// CUSTOMER_AUTOMATION incident) before this was written: every cell in a
// sample of real rows was identical under FORMULA and FORMATTED_VALUE
// render modes. Safe to append to, same as Google Forms itself does.
const SPREADSHEET_ID = "1fupVtKq0gC4ENya1IHJRHF5UB9ALdfyycHJ3szwV79Q";
// "Form responses 1" was a one-time historical backfill (41 rows, all
// submitted 21/08/2026, nothing since); "Form responses 2" is the sheet
// actually still being used day to day — confirmed by its most recent row
// being from the day before this was written.
const TAB_NAME = "Form responses 2";

function getWriteSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTimestamp(date) {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Logs one completed installation step as its own row — matching what a
// technician would otherwise have submitted by hand, minus SECTION (no
// equivalent in the app) and one item per row instead of the paper form's
// occasional multi-select batching. Only called for marking a step done;
// un-checking one doesn't have a "form submission" equivalent to log.
export async function appendErectionSheetCompletion({ customerName, city, crewNames = [], completedItem, actorUsername }) {
  const sheets = getWriteSheetsClient();
  if (!sheets) return;

  const now = new Date();
  const [t1 = "", t2 = "", t3 = "", t4 = ""] = crewNames;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${TAB_NAME}'!A:K`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        formatTimestamp(now),
        formatDate(now),
        customerName || "",
        city || "",
        t1,
        t2,
        t3,
        t4,
        completedItem,
        "",
        `Logged automatically via Amardip ERP by @${actorUsername || "technician"}`,
      ]],
    },
  });
}
