import { google } from "googleapis";

// "boq automation" is a computed/mirrored tab, not real data — its columns
// A-N are a single ARRAYFORMULA spilling down from 'Form Responses 1', and
// O-Z are array formulas calculating cost off that mirrored data. Writing
// directly into "boq automation" breaks the array formula's spill (#REF!).
// The real data table — the one the client's own Google Form submits into —
// is "Form Responses 1". We must only ever append there, and only ever read
// the calculated price back from "boq automation".
const DATA_ENTRY_TAB = "Form Responses 1";
const PRICE_OUTPUT_TAB = "boq automation";

// The real header row of "boq automation", columns A-Z, as confirmed against
// the live sheet — used to label the full BOQ row for display.
export const BOQ_ROW_HEADINGS = [
  "Timestamp",
  "S.NO",
  "Name",
  "Address",
  "Mobile No",
  "Wall Width",
  "Wall Depth",
  "No. of Floors",
  "No. of Passenger",
  "Door Type",
  "Cabin Type",
  "Head Room",
  "Motor Type",
  "Door Opening",
  "Common Material",
  "Door Material",
  "Cabin Material",
  "Motor Material",
  "Rope Cost",
  "Rail Cost",
  "Additional LF Cost",
  "Total Cost",
  "Labour & Transport",
  "Tax",
  "Project Cost",
  "Customer Price",
];

let sheetsClient = null;
let ongoingProjectsTabTitle = null;
const DEFAULT_ONGOING_PROJECT_SHEET_ID = "1kuPjN3QsWd6-ruqo25zr9xaFoOWViaQH_yusbI73FJ0";
const DEFAULT_ONGOING_PROJECT_TAB = "ONGOING";
const ONGOING_PROJECT_CACHE_MS = 60 * 1000;
let ongoingProjectsCache = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey || !process.env.GOOGLE_SHEET_ID) {
    throw new Error("Google Sheets is not configured. Set GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEET_ID.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

async function getOngoingProjectsTabTitle() {
  if (ongoingProjectsTabTitle) return ongoingProjectsTabTitle;
  const configuredTitle = process.env.GOOGLE_ONGOING_PROJECT_TAB || DEFAULT_ONGOING_PROJECT_TAB;
  if (configuredTitle) {
    ongoingProjectsTabTitle = configuredTitle;
    return ongoingProjectsTabTitle;
  }

  const gid = Number(process.env.GOOGLE_ONGOING_PROJECT_GID || 47509655);
  if (!Number.isInteger(gid)) throw new Error("GOOGLE_ONGOING_PROJECT_GID must be a valid sheet tab id.");
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_ONGOING_PROJECT_SHEET_ID || DEFAULT_ONGOING_PROJECT_SHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });
  const tab = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === gid);
  if (!tab?.properties?.title) throw new Error(`Google Sheet tab ${gid} was not found.`);
  ongoingProjectsTabTitle = tab.properties.title;
  return ongoingProjectsTabTitle;
}

function rowNumberFromUpdatedRange(updatedRange) {
  // e.g. "'Form Responses 1'!A524:N524" -> 524
  const match = updatedRange && updatedRange.match(/![A-Z]+(\d+)/);
  return match ? Number(match[1]) : null;
}

// Appends the quotation's spec to the client's real "Form Responses 1" data
// table (columns A-N — the same table their Google Form submits into) and
// returns the row it landed on. Callers must persist this row number before
// polling for the price (see pollBoqPrice) — if the poll times out and the
// caller retries by calling this again, it appends a second, duplicate row
// for the same quotation. The row number must be saved first so a retry can
// re-poll the existing row instead of appending again.
export async function appendBoqRow(quotation) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const values = [[
    new Date().toISOString(), // A: Timestamp
    "", // B: S.NO
    quotation.customerName, // C
    quotation.address || "", // D
    quotation.mobileNo, // E
    quotation.wellWidth, // F: Wall Width
    quotation.wellDepth, // G: Wall Depth
    quotation.noOfFloors, // H
    quotation.noOfPassenger, // I
    quotation.doorType, // J
    quotation.cabinType, // K
    quotation.headRoom, // L
    quotation.motorType, // M
    quotation.doorOpening, // N
  ]];

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${DATA_ENTRY_TAB}'!A:N`,
    valueInputOption: "USER_ENTERED",
    // OVERWRITE (not INSERT_ROWS) — writes into the next empty row after the
    // table in place. INSERT_ROWS physically shifts rows, which under two
    // near-simultaneous quotation submissions can shift a row out from under
    // the row number we were just told to read back column Z from.
    insertDataOption: "OVERWRITE",
    requestBody: { values },
  });

  const rowNumber = rowNumberFromUpdatedRange(appendRes.data.updates?.updatedRange);
  if (!rowNumber) {
    throw new Error("Added the row to the sheet but could not tell which row it landed on.");
  }

  return rowNumber;
}

// Polls "boq automation"'s array-formula-calculated price for a given row —
// separated from appendBoqRow so a retry (after a previous poll timed out)
// re-polls the same row instead of appending a new one.
export async function pollBoqPrice(rowNumber) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Array formulas need a moment to recalculate before column Z has a value —
  // poll a few times rather than trusting one fixed delay. Measured against
  // the real sheet, 5s was sometimes not enough; this budgets ~10.5s of
  // waiting, staying under the 15s Vercel function limit (vercel.json) with
  // room for the append call and each get call's own network time.
  const attempts = [1000, 1500, 1500, 2000, 2000, 2500];

  for (const delayMs of attempts) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const priceRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${PRICE_OUTPUT_TAB}'!Z${rowNumber}`,
    });

    const rawPrice = priceRes.data.values?.[0]?.[0];
    const candidate = Number(String(rawPrice ?? "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  throw new Error(`Row ${rowNumber} was added to Form Responses 1, but "boq automation" hasn't calculated a customer price yet. Try again in a moment.`);
}

// Fetches the entire computed row (all 26 columns, A-Z) from "boq automation"
// for a given row number — the real, complete BOQ: the customer's spec plus
// every calculated cost column, exactly as the sheet has it.
export async function getFullBoqRow(rowNumber) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${PRICE_OUTPUT_TAB}'!A${rowNumber}:Z${rowNumber}`,
  });

  const values = res.data.values?.[0] || [];
  if (values.length === 0) {
    throw new Error(`Row ${rowNumber} has no data in "boq automation".`);
  }

  return BOQ_ROW_HEADINGS.map((heading, index) => ({
    heading,
    value: values[index] ?? "",
  }));
}

// Writes one converted project to the existing ongoing-projects tab. The tab
// is resolved by its stable gid, while the row number is persisted by the
// caller so a retry cannot append the same project twice.
export async function appendOngoingProjectRow(project, quotation) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_ONGOING_PROJECT_SHEET_ID || DEFAULT_ONGOING_PROJECT_SHEET_ID;
  const tabTitle = await getOngoingProjectsTabTitle();
  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tabTitle}'!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        quotation.serialNo || quotation.quotationNo, // SNO
        quotation.customerName, // CUSTOMER NAME
        quotation.address || "", // ADDRESS
        "", // CITY
        quotation.mobileNo, // MOBILE NO
        project.status === "ONGOING" ? "ON GOING" : project.status, // CUSTOMER STATUS
      ]],
    },
  });
  const rowNumber = rowNumberFromUpdatedRange(appendRes.data.updates?.updatedRange);
  if (!rowNumber) throw new Error("Project was added to the sheet but its row could not be identified.");
  return rowNumber;
}

function amountFromPayment(payment, label) {
  const match = String(payment || "").match(new RegExp(`${label}\\s*:\\s*([0-9,.]+)`, "i"));
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function columnIndex(headers, names, fallback = -1) {
  const normalized = headers.map((header) => String(header || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  const index = normalized.findIndex((header) => names.includes(header));
  return index >= 0 ? index : fallback;
}

// Reads the existing ONGOING tab once per minute and presents its legacy
// customer rows in the same shape as database-backed projects.
export async function listOngoingProjectsFromSheet({ search = "" } = {}) {
  const now = Date.now();
  if (!ongoingProjectsCache || now - ongoingProjectsCache.loadedAt > ONGOING_PROJECT_CACHE_MS) {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_ONGOING_PROJECT_SHEET_ID || DEFAULT_ONGOING_PROJECT_SHEET_ID;
    const tabTitle = await getOngoingProjectsTabTitle();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabTitle}'!A:Z`,
      majorDimension: "ROWS",
    });
    const values = result.data.values || [];
    const headers = values[0] || [];
    const customerNameIndex = columnIndex(headers, ["customername", "coustmername"], 1);
    const addressIndex = columnIndex(headers, ["address"], 2);
    const cityIndex = columnIndex(headers, ["city"], 3);
    const mobileIndex = columnIndex(headers, ["mobileno", "mobile"], 4);
    const statusIndex = columnIndex(headers, ["customerstatus", "status"], 5);
    const paymentIndex = columnIndex(headers, ["payment"], 23);
    const idIndex = columnIndex(headers, ["sno", "customerid", "coustmerid"], 0);
    ongoingProjectsCache = {
      loadedAt: now,
      rows: values.slice(1).map((row, index) => {
        const payment = row[paymentIndex] || "";
        return {
          id: `sheet-ongoing-${index + 2}`,
          quotationId: null,
          customerId: row[idIndex] || null,
          quotationNo: row[idIndex] || "",
          customerName: row[customerNameIndex] || "Unnamed customer",
          mobileNo: row[mobileIndex] || "",
          address: row[addressIndex] || "",
          city: row[cityIndex] || "",
          agreedAmount: amountFromPayment(payment, "Agreed"),
          advanceAmount: amountFromPayment(payment, "Advance"),
          balanceAmount: amountFromPayment(payment, "Balance"),
          status: row[statusIndex] || "ONGOING",
          // The ONGOING tab has no date/timestamp column at all — column A
          // is the customer's SNO/ID, not a date. It was previously read
          // as onboardedAt directly, so every legacy row showed its ID
          // number rendered as a bogus date (e.g. customer "161" showing
          // as some date in 1970). None of these legacy rows have a real
          // onboarding date to show, so this stays null — the UI already
          // renders that as "—" rather than a wrong date.
          onboardedAt: null,
          googleSheetRow: index + 2,
          source: "google_sheet",
        };
      }).filter((row) => row.customerName !== "Unnamed customer" || row.customerId),
    };
  }

  const term = String(search).trim().toLowerCase();
  if (!term) return ongoingProjectsCache.rows;
  return ongoingProjectsCache.rows.filter((row) => [row.customerName, row.mobileNo, row.quotationNo, row.address].some((value) => String(value || "").toLowerCase().includes(term)));
}
