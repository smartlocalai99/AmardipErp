import { google } from "googleapis";
import pool from "./db.js";

export const SERVICE_HISTORY_SPREADSHEET_ID =
  process.env.SERVICE_HISTORY_GOOGLE_SHEET_ID ||
  "1kuPjN3QsWd6-ruqo25zr9xaFoOWViaQH_yusbI73FJ0";
export const SERVICE_HISTORY_SOURCE_TAB = "Form Responses 4";
export const SERVICE_HISTORY_MONTHLY_TAB = "MONTH_SERVICE";
export const SERVICE_HISTORY_MONTHLY_GID = 692088699;

const SOURCE_SHEET_KEY = SERVICE_HISTORY_SOURCE_TAB;
const BATCH_SIZE = 750;

function cleanText(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

export function normalizeLookupKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeMobile(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function normalizeHeader(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function parseSheetDate(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const serialEpoch = Date.UTC(1899, 11, 30);
    return new Date(serialEpoch + Math.floor(value) * 86400000)
      .toISOString()
      .slice(0, 10);
  }

  const cleaned = String(value).trim();
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const indianMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  let year;
  let month;
  let day;

  if (isoMatch) {
    [, year, month, day] = isoMatch.map(Number);
  } else if (indianMatch) {
    [, day, month, year] = indianMatch.map(Number);
    if (year < 100) year += 2000;
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseSheetTimestamp(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(cleaned)) return cleaned;

  const match = cleaned.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i
  );
  if (!match) return null;

  let [, day, month, year, hour = "0", minute = "0", second = "0", meridiem] = match;
  year = Number(year);
  if (year < 100) year += 2000;
  hour = Number(hour);
  if (meridiem) {
    const upperMeridiem = meridiem.toUpperCase();
    if (upperMeridiem === "PM" && hour < 12) hour += 12;
    if (upperMeridiem === "AM" && hour === 12) hour = 0;
  }

  const datePart = parseSheetDate(`${day}/${month}/${year}`);
  if (!datePart || hour > 23) return null;
  return `${datePart}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+05:30`;
}

function parsePayment(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const numericText = cleaned
    .replace(/^₹\s*/, "")
    .replace(/^RS\.?\s*/i, "")
    .replace(/\s*\/-\s*$/, "")
    .replace(/,/g, "")
    .trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(numericText)) return null;
  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildColumnMap(headers) {
  return new Map(headers.map((header, index) => [normalizeHeader(header), index]));
}

function getCell(row, columnMap, ...names) {
  for (const name of names) {
    const index = columnMap.get(normalizeHeader(name));
    if (index !== undefined) return row[index];
  }
  return null;
}

export function parseServiceHistoryRows(values) {
  const [headers = [], ...dataRows] = values || [];
  const columnMap = buildColumnMap(headers);
  const requiredHeaders = ["SERVICE DATE", "COUSTMER ID", "CUSTOMER NAME", "SERVICE TYPE"];
  const missingHeaders = requiredHeaders.filter(
    (header) => !columnMap.has(normalizeHeader(header))
  );

  if (missingHeaders.length) {
    throw new Error(`Service sheet is missing columns: ${missingHeaders.join(", ")}`);
  }

  const parsedRows = [];
  dataRows.forEach((row, index) => {
    if (!row?.some((value) => String(value ?? "").trim())) return;

    const sourceRowNo = index + 2;
    const parsed = {
      source_row_no: sourceRowNo,
      source_sheet: SOURCE_SHEET_KEY,
      source_sno: cleanText(getCell(row, columnMap, "SNO")),
      submitted_at: parseSheetTimestamp(getCell(row, columnMap, "Timestamp")),
      service_date: parseSheetDate(getCell(row, columnMap, "SERVICE DATE")),
      customer_code: cleanText(getCell(row, columnMap, "COUSTMER ID", "CUSTOMER ID")),
      customer_name_snapshot: cleanText(getCell(row, columnMap, "CUSTOMER NAME")),
      address_snapshot: cleanText(getCell(row, columnMap, "ADDRESS")),
      city_snapshot: cleanText(getCell(row, columnMap, "CITY")),
      mobile_no_snapshot: cleanText(getCell(row, columnMap, "MOBILE NO")),
      hoc_date_snapshot: parseSheetDate(getCell(row, columnMap, "HOC DATE")),
      customer_status_snapshot: cleanText(getCell(row, columnMap, "CUSTOMER STATUS")),
      ard_condition: cleanText(getCell(row, columnMap, "ARD CONDITION")),
      motor_condition: cleanText(getCell(row, columnMap, "MOTOR CONDITION")),
      gear_oil_condition: cleanText(getCell(row, columnMap, "GEAR OIL CONDITION")),
      brake_condition: cleanText(getCell(row, columnMap, "BRAKE CONDITION")),
      rope_condition: cleanText(getCell(row, columnMap, "ROPE CONDITION")),
      rail_clips_condition: cleanText(getCell(row, columnMap, "RAIL CLIPS CONDITION")),
      limit_switch_condition: cleanText(getCell(row, columnMap, "LIMIT SWITCH CONDITION")),
      gate_locks_condition: cleanText(getCell(row, columnMap, "GATE LOCKS")),
      rcr_condition: cleanText(getCell(row, columnMap, "RCR CONDITION")),
      sensors_condition: cleanText(getCell(row, columnMap, "SENSORS")),
      osg_condition: cleanText(getCell(row, columnMap, "OSG CONDITION")),
      remarks: cleanText(getCell(row, columnMap, "REMARKS")),
      service_type: cleanText(getCell(row, columnMap, "SERVICE TYPE")),
      payment_amount: parsePayment(getCell(row, columnMap, "PAYMENT")),
      technician_1: cleanText(getCell(row, columnMap, "TECHNICIAN 1")),
      technician_2: cleanText(getCell(row, columnMap, "TECHNICIAN 2")),
      amc_warranty_due_snapshot: parseSheetDate(
        getCell(row, columnMap, "AMC / WARRANTY DUE")
      ),
    };

    parsed.raw_row = {
      source_sno: parsed.source_sno,
      submitted_at: parsed.submitted_at,
      service_date: parsed.service_date,
      customer_code: parsed.customer_code,
      customer_name_snapshot: parsed.customer_name_snapshot,
      address_snapshot: parsed.address_snapshot,
      city_snapshot: parsed.city_snapshot,
      mobile_no_snapshot: parsed.mobile_no_snapshot,
      hoc_date_snapshot: parsed.hoc_date_snapshot,
      customer_status_snapshot: parsed.customer_status_snapshot,
      ard_condition: parsed.ard_condition,
      motor_condition: parsed.motor_condition,
      gear_oil_condition: parsed.gear_oil_condition,
      brake_condition: parsed.brake_condition,
      rope_condition: parsed.rope_condition,
      rail_clips_condition: parsed.rail_clips_condition,
      limit_switch_condition: parsed.limit_switch_condition,
      gate_locks_condition: parsed.gate_locks_condition,
      rcr_condition: parsed.rcr_condition,
      sensors_condition: parsed.sensors_condition,
      osg_condition: parsed.osg_condition,
      remarks: parsed.remarks,
      service_type: parsed.service_type,
      payment_amount: cleanText(getCell(row, columnMap, "PAYMENT")),
      technician_1: parsed.technician_1,
      technician_2: parsed.technician_2,
      amc_warranty_due_snapshot: parsed.amc_warranty_due_snapshot,
    };

    parsedRows.push(parsed);
  });

  return parsedRows;
}

function addCandidate(registry, key, customerId) {
  if (!key || !customerId) return;
  if (!registry.has(key)) registry.set(key, new Set());
  registry.get(key).add(customerId);
}

function uniqueCandidate(registry, key) {
  const candidates = key ? registry.get(key) : null;
  return candidates?.size === 1 ? [...candidates][0] : null;
}

export function createCustomerMatcher({ customers = [], aliases = [] }) {
  const directCode = new Map();
  const directMobile = new Map();
  const directNameHoc = new Map();
  const directName = new Map();
  const aliasCode = new Map();
  const aliasMobile = new Map();
  const aliasNameHoc = new Map();
  const aliasName = new Map();

  customers.forEach((customer) => {
    const nameKey = normalizeLookupKey(customer.customer_name);
    const hocKey = parseSheetDate(customer.hoc_date);
    addCandidate(directCode, normalizeLookupKey(customer.customer_code), customer.id);
    addCandidate(directMobile, normalizeMobile(customer.mobile_no), customer.id);
    addCandidate(directName, nameKey, customer.id);
    if (nameKey) {
      addCandidate(directNameHoc, `${nameKey}|${hocKey || ""}`, customer.id);
    }
  });

  aliases.forEach((alias) => {
    const nameKey = normalizeLookupKey(alias.customer_name_snapshot);
    const hocKey = parseSheetDate(alias.hoc_date_snapshot);
    addCandidate(aliasCode, normalizeLookupKey(alias.customer_code), alias.customer_id);
    addCandidate(aliasMobile, normalizeMobile(alias.mobile_no_snapshot), alias.customer_id);
    addCandidate(aliasName, nameKey, alias.customer_id);
    if (nameKey) {
      addCandidate(aliasNameHoc, `${nameKey}|${hocKey || ""}`, alias.customer_id);
    }
  });

  return (row) => {
    const codeKey = normalizeLookupKey(row.customer_code);
    const mobileKey = normalizeMobile(row.mobile_no_snapshot);
    const nameKey = normalizeLookupKey(row.customer_name_snapshot);
    const nameHocKey = nameKey
      ? `${nameKey}|${row.hoc_date_snapshot || ""}`
      : "";

    const directCodeMatch = uniqueCandidate(directCode, codeKey);
    const aliasCodeMatch = uniqueCandidate(aliasCode, codeKey);
    const directMobileMatch = uniqueCandidate(directMobile, mobileKey);
    const aliasMobileMatch = uniqueCandidate(aliasMobile, mobileKey);
    const nameHocMatch =
      uniqueCandidate(directNameHoc, nameHocKey) ||
      uniqueCandidate(aliasNameHoc, nameHocKey);
    const nameMatch =
      uniqueCandidate(directName, nameKey) || uniqueCandidate(aliasName, nameKey);

    const mobileMatch = directMobileMatch || aliasMobileMatch;

    if (directCodeMatch) {
      return { customerId: directCodeMatch, reason: "customer_code" };
    }

    if (aliasCodeMatch) {
      if (mobileMatch && mobileMatch !== aliasCodeMatch) {
        return { customerId: null, reason: "conflict" };
      }
      return {
        customerId: aliasCodeMatch,
        reason: "known_code_alias",
      };
    }

    if (mobileMatch) {
      if (nameHocMatch && nameHocMatch !== mobileMatch) {
        return { customerId: null, reason: "conflict" };
      }
      return {
        customerId: mobileMatch,
        reason: directMobileMatch ? "mobile" : "known_mobile_alias",
      };
    }

    if (nameHocMatch) return { customerId: nameHocMatch, reason: "name_and_hoc" };
    if (nameMatch) return { customerId: nameMatch, reason: "unique_name" };
    return { customerId: null, reason: "unmatched" };
  };
}

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Google Sheets credentials are not configured.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function fetchServiceHistoryRows() {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SERVICE_HISTORY_SPREADSHEET_ID,
    range: `'${SERVICE_HISTORY_SOURCE_TAB}'!A:AA`,
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return parseServiceHistoryRows(response.data.values || []);
}

async function loadCustomerMatchingData(client) {
  const [customerResult, aliasResult] = await Promise.all([
    client.query(`
      SELECT id, customer_code, customer_name, mobile_no, hoc_date
      FROM elevator_service_customers
    `),
    client.query(`
      SELECT customer_id, customer_code, customer_name_snapshot,
             mobile_no_snapshot, hoc_date_snapshot::text
      FROM elevator_service_visits
      WHERE customer_id IS NOT NULL
    `),
  ]);
  return { customers: customerResult.rows, aliases: aliasResult.rows };
}

async function upsertBatch(client, rows) {
  const result = await client.query(
    `
    INSERT INTO elevator_service_visits AS current_visit (
      customer_id, source_sheet, source_row_no, source_sno, submitted_at,
      service_date, customer_code, customer_name_snapshot, address_snapshot,
      city_snapshot, mobile_no_snapshot, hoc_date_snapshot,
      customer_status_snapshot, ard_condition, motor_condition,
      gear_oil_condition, brake_condition, rope_condition,
      rail_clips_condition, limit_switch_condition, gate_locks_condition,
      rcr_condition, sensors_condition, osg_condition, remarks, service_type,
      payment_amount, technician_1, technician_2,
      amc_warranty_due_snapshot, raw_row
    )
    SELECT
      NULLIF(x.customer_id, '')::uuid,
      x.source_sheet,
      x.source_row_no,
      NULLIF(x.source_sno, ''),
      NULLIF(x.submitted_at, '')::timestamptz,
      NULLIF(x.service_date, '')::date,
      NULLIF(x.customer_code, ''),
      NULLIF(x.customer_name_snapshot, ''),
      NULLIF(x.address_snapshot, ''),
      NULLIF(x.city_snapshot, ''),
      NULLIF(x.mobile_no_snapshot, ''),
      NULLIF(x.hoc_date_snapshot, '')::date,
      NULLIF(x.customer_status_snapshot, ''),
      NULLIF(x.ard_condition, ''),
      NULLIF(x.motor_condition, ''),
      NULLIF(x.gear_oil_condition, ''),
      NULLIF(x.brake_condition, ''),
      NULLIF(x.rope_condition, ''),
      NULLIF(x.rail_clips_condition, ''),
      NULLIF(x.limit_switch_condition, ''),
      NULLIF(x.gate_locks_condition, ''),
      NULLIF(x.rcr_condition, ''),
      NULLIF(x.sensors_condition, ''),
      NULLIF(x.osg_condition, ''),
      NULLIF(x.remarks, ''),
      NULLIF(x.service_type, ''),
      x.payment_amount,
      NULLIF(x.technician_1, ''),
      NULLIF(x.technician_2, ''),
      NULLIF(x.amc_warranty_due_snapshot, '')::date,
      x.raw_row
    FROM jsonb_to_recordset($1::jsonb) AS x(
      customer_id text, source_sheet text, source_row_no integer,
      source_sno text, submitted_at text, service_date text,
      customer_code text, customer_name_snapshot text, address_snapshot text,
      city_snapshot text, mobile_no_snapshot text, hoc_date_snapshot text,
      customer_status_snapshot text, ard_condition text, motor_condition text,
      gear_oil_condition text, brake_condition text, rope_condition text,
      rail_clips_condition text, limit_switch_condition text,
      gate_locks_condition text, rcr_condition text, sensors_condition text,
      osg_condition text, remarks text, service_type text,
      payment_amount numeric, technician_1 text, technician_2 text,
      amc_warranty_due_snapshot text, raw_row jsonb
    )
    ON CONFLICT (source_sheet, source_row_no) DO UPDATE SET
      customer_id = COALESCE(current_visit.customer_id, EXCLUDED.customer_id),
      source_sno = EXCLUDED.source_sno,
      submitted_at = EXCLUDED.submitted_at,
      service_date = EXCLUDED.service_date,
      customer_code = EXCLUDED.customer_code,
      customer_name_snapshot = EXCLUDED.customer_name_snapshot,
      address_snapshot = EXCLUDED.address_snapshot,
      city_snapshot = EXCLUDED.city_snapshot,
      mobile_no_snapshot = EXCLUDED.mobile_no_snapshot,
      hoc_date_snapshot = EXCLUDED.hoc_date_snapshot,
      customer_status_snapshot = EXCLUDED.customer_status_snapshot,
      ard_condition = EXCLUDED.ard_condition,
      motor_condition = EXCLUDED.motor_condition,
      gear_oil_condition = EXCLUDED.gear_oil_condition,
      brake_condition = EXCLUDED.brake_condition,
      rope_condition = EXCLUDED.rope_condition,
      rail_clips_condition = EXCLUDED.rail_clips_condition,
      limit_switch_condition = EXCLUDED.limit_switch_condition,
      gate_locks_condition = EXCLUDED.gate_locks_condition,
      rcr_condition = EXCLUDED.rcr_condition,
      sensors_condition = EXCLUDED.sensors_condition,
      osg_condition = EXCLUDED.osg_condition,
      remarks = EXCLUDED.remarks,
      service_type = EXCLUDED.service_type,
      payment_amount = EXCLUDED.payment_amount,
      technician_1 = EXCLUDED.technician_1,
      technician_2 = EXCLUDED.technician_2,
      amc_warranty_due_snapshot = EXCLUDED.amc_warranty_due_snapshot,
      raw_row = EXCLUDED.raw_row,
      updated_at = NOW()
    WHERE (
      current_visit.customer_id, current_visit.source_sno,
      current_visit.submitted_at, current_visit.service_date,
      current_visit.customer_code, current_visit.customer_name_snapshot,
      current_visit.address_snapshot, current_visit.city_snapshot,
      current_visit.mobile_no_snapshot, current_visit.hoc_date_snapshot,
      current_visit.customer_status_snapshot, current_visit.ard_condition,
      current_visit.motor_condition, current_visit.gear_oil_condition,
      current_visit.brake_condition, current_visit.rope_condition,
      current_visit.rail_clips_condition, current_visit.limit_switch_condition,
      current_visit.gate_locks_condition, current_visit.rcr_condition,
      current_visit.sensors_condition, current_visit.osg_condition,
      current_visit.remarks, current_visit.service_type,
      current_visit.payment_amount, current_visit.technician_1,
      current_visit.technician_2, current_visit.amc_warranty_due_snapshot,
      current_visit.raw_row
    ) IS DISTINCT FROM (
      COALESCE(current_visit.customer_id, EXCLUDED.customer_id), EXCLUDED.source_sno,
      EXCLUDED.submitted_at, EXCLUDED.service_date,
      EXCLUDED.customer_code, EXCLUDED.customer_name_snapshot,
      EXCLUDED.address_snapshot, EXCLUDED.city_snapshot,
      EXCLUDED.mobile_no_snapshot, EXCLUDED.hoc_date_snapshot,
      EXCLUDED.customer_status_snapshot, EXCLUDED.ard_condition,
      EXCLUDED.motor_condition, EXCLUDED.gear_oil_condition,
      EXCLUDED.brake_condition, EXCLUDED.rope_condition,
      EXCLUDED.rail_clips_condition, EXCLUDED.limit_switch_condition,
      EXCLUDED.gate_locks_condition, EXCLUDED.rcr_condition,
      EXCLUDED.sensors_condition, EXCLUDED.osg_condition,
      EXCLUDED.remarks, EXCLUDED.service_type,
      EXCLUDED.payment_amount, EXCLUDED.technician_1,
      EXCLUDED.technician_2, EXCLUDED.amc_warranty_due_snapshot,
      EXCLUDED.raw_row
    )
    RETURNING (xmax = 0) AS inserted
    `,
    [JSON.stringify(rows)]
  );

  return result.rows.reduce(
    (totals, row) => {
      if (row.inserted) totals.inserted += 1;
      else totals.updated += 1;
      return totals;
    },
    { inserted: 0, updated: 0 }
  );
}

export async function syncServiceHistory({ apply = true } = {}) {
  const sheetRows = await fetchServiceHistoryRows();
  const client = await pool.connect();

  try {
    const [matchingData, existingResult] = await Promise.all([
      loadCustomerMatchingData(client),
      client.query(
        `SELECT source_row_no FROM elevator_service_visits WHERE source_sheet = $1`,
        [SOURCE_SHEET_KEY]
      ),
    ]);
    const existingRows = new Set(existingResult.rows.map((row) => row.source_row_no));
    const matcher = createCustomerMatcher(matchingData);
    const matchReasons = {};
    const newMatchReasons = {};

    const mappedRows = sheetRows.map((row) => {
      const match = matcher(row);
      matchReasons[match.reason] = (matchReasons[match.reason] || 0) + 1;
      if (!existingRows.has(row.source_row_no)) {
        newMatchReasons[match.reason] = (newMatchReasons[match.reason] || 0) + 1;
      }
      return { ...row, customer_id: match.customerId };
    });
    const newRows = mappedRows.filter((row) => !existingRows.has(row.source_row_no));

    const summary = {
      spreadsheetId: SERVICE_HISTORY_SPREADSHEET_ID,
      monthlyTab: SERVICE_HISTORY_MONTHLY_TAB,
      monthlyGid: SERVICE_HISTORY_MONTHLY_GID,
      sourceTab: SERVICE_HISTORY_SOURCE_TAB,
      sheetRows: mappedRows.length,
      existingSourceRows: existingRows.size,
      newSourceRows: newRows.length,
      newLinkedRows: newRows.filter((row) => row.customer_id).length,
      newUnmatchedRows: newRows.filter((row) => !row.customer_id).length,
      linkedRows: mappedRows.filter((row) => row.customer_id).length,
      unmatchedRows: mappedRows.filter((row) => !row.customer_id).length,
      matchReasons,
      newMatchReasons,
      applied: apply,
    };

    if (!apply) return summary;

    await client.query("BEGIN");
    let inserted = 0;
    let updated = 0;
    for (let index = 0; index < mappedRows.length; index += BATCH_SIZE) {
      const batchResult = await upsertBatch(
        client,
        mappedRows.slice(index, index + BATCH_SIZE)
      );
      inserted += batchResult.inserted;
      updated += batchResult.updated;
    }
    await client.query("COMMIT");

    return {
      ...summary,
      inserted,
      updated,
      unchanged: mappedRows.length - inserted - updated,
    };
  } catch (error) {
    if (apply) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    throw error;
  } finally {
    client.release();
  }
}
