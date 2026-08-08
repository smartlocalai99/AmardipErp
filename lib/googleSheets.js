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

function rowNumberFromUpdatedRange(updatedRange) {
  // e.g. "'Form Responses 1'!A524:N524" -> 524
  const match = updatedRange && updatedRange.match(/![A-Z]+(\d+)/);
  return match ? Number(match[1]) : null;
}

// Appends the quotation's spec to the client's real "Form Responses 1" data
// table (columns A-N — the same table their Google Form submits into), waits
// for "boq automation"'s array formulas to recalculate off the mirrored row,
// then reads the real customer price back from that row's column Z. This is
// the one real price source for quotations — replacing the old in-app v1
// placeholder cost formula. Never write into "boq automation" itself — see
// the comment on PRICE_OUTPUT_TAB above.
export async function appendBoqRowAndGetPrice(quotation) {
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

  // Array formulas need a moment to recalculate before column Z has a value —
  // poll a few times rather than trusting one fixed delay. Measured against
  // the real sheet, 5s was sometimes not enough; this budgets ~10.5s of
  // waiting, staying under the 15s Vercel function limit (vercel.json) with
  // room for the append call and each get call's own network time.
  const attempts = [1000, 1500, 1500, 2000, 2000, 2500];
  let price = null;

  for (const delayMs of attempts) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const priceRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${PRICE_OUTPUT_TAB}'!Z${rowNumber}`,
    });

    const rawPrice = priceRes.data.values?.[0]?.[0];
    const candidate = Number(String(rawPrice ?? "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(candidate) && candidate > 0) {
      price = candidate;
      break;
    }
  }

  if (price === null) {
    throw new Error(`Row ${rowNumber} was added to Form Responses 1, but "boq automation" hasn't calculated a customer price yet. Try again in a moment.`);
  }

  return { rowNumber, price };
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
