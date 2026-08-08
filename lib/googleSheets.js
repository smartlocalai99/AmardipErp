import { google } from "googleapis";

const SHEET_TAB = "boq automation";

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
  // e.g. "'boq automation'!A524:N524" -> 524
  const match = updatedRange && updatedRange.match(/![A-Z]+(\d+)/);
  return match ? Number(match[1]) : null;
}

// Appends the quotation's spec to the client's "boq automation" sheet
// (columns A-N), waits for its array formulas to recalculate, then reads
// back the real customer price from column Z of that same row. This is the
// one real price source for quotations — replacing the old in-app v1
// placeholder cost formula.
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
    range: `'${SHEET_TAB}'!A:N`,
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
      range: `'${SHEET_TAB}'!Z${rowNumber}`,
    });

    const rawPrice = priceRes.data.values?.[0]?.[0];
    const candidate = Number(String(rawPrice ?? "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(candidate) && candidate > 0) {
      price = candidate;
      break;
    }
  }

  if (price === null) {
    throw new Error(`Row ${rowNumber} was added, but the sheet hasn't calculated a customer price yet. Try again in a moment.`);
  }

  return { rowNumber, price };
}
