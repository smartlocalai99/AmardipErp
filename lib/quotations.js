import { query, withTransaction } from "./db.js";
import { canViewQuotation, isBoqAdmin } from "./quotationPermissions.js";
import { appendBoqRow, pollBoqPrice } from "./googleSheets.js";
import { ensureAssigneeTables, setProjectAssignees, getProjectAssignees, getProjectAssigneesForMany } from "./assignees.js";
import { getProjectChecklistCompletions, getProjectChecklistCompletionsForMany } from "./projectChecklistStore.js";

export const QUOTATION_STATUSES = ["DRAFT", "BOQ_GENERATED", "CALCULATED", "SENT", "ACCEPTED", "REJECTED", "CONVERTED_TO_CUSTOMER", "CONVERTED_TO_PROJECT"];
export const FLOOR_OPTIONS = ["G+1", "G+2", "G+3", "G+4", "G+5"];
export const PASSENGER_OPTIONS = [6, 8, 10, 13, 18];
export const DOOR_TYPE_OPTIONS = [
  "MS FRAME COLLAPSIBLE GATE",
  "SS FRAME COLLAPSIBLE GATE",
  "MS SWING DOOR SMALL VISION",
  "SS SWING DOOR SMALL VISION",
  "MANUAL MS TELISCOPIC DOOR",
  "MANUAL SS TELISCOPIC DOOR",
  "MS CLAD AUTO DOOR",
  "SS CLAD AUTO DOOR",
  "SS HALF VISION GLASS AUTO DOOR",
  "SS FULL VISION GLASS AUTO DOOR",
  "MS HALF VISION GLASS AUTO DOOR",
  "MS FULL VISION GLASS AUTO DOOR",
];
export const CABIN_TYPE_OPTIONS = ["MS CABIN", "SS CABIN", "SS CABIN AUTO DOOR", "MS CABIN AUTO DOOR"];
export const MOTOR_TYPE_OPTIONS = ["GEARED MOTOR", "GEAR LESS MOTOR"];
export const HEAD_ROOM_OPTIONS = ["MACHINE ROOM", "MACHINE ROOM LESS"];
export const DOOR_OPENING_OPTIONS = ["600MM", "700MM", "800MM", "900MM", "1000MM", "1200MM"];

let quotationTablesReady = false;

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function requiredText(value, label) {
  const text = textOrNull(value);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function requiredNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} is required.`);
  return number;
}

function pickOption(value, options, label) {
  const text = requiredText(value, label).toUpperCase();
  if (!options.includes(text)) throw new Error(`Invalid ${label}.`);
  return text;
}

function money(value, fallback = 0) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 100) / 100;
}

function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function buildQuotationNo({ yearMonth, sequence }) {
  return `QTN-${yearMonth}-${String(sequence).padStart(4, "0")}`;
}

export function normalizeQuotationInput(input = {}) {
  return {
    serialNo: textOrNull(input.serialNo ?? input.serial_no),
    customerName: requiredText(input.customerName ?? input.customer_name ?? input.name, "Name"),
    address: textOrNull(input.address),
    mobileNo: requiredText(input.mobileNo ?? input.mobile_no, "Mobile No"),
    wellWidth: requiredNumber(input.wallWidth ?? input.wall_width ?? input.wellWidth ?? input.well_width, "Wall Width"),
    wellDepth: requiredNumber(input.wallDepth ?? input.wall_depth ?? input.wellDepth ?? input.well_depth, "Wall Depth"),
    noOfFloors: pickOption(input.noOfFloors ?? input.no_of_floors, FLOOR_OPTIONS, "No. of Floors"),
    noOfPassenger: Number(pickOption(input.noOfPassenger ?? input.no_of_passenger, PASSENGER_OPTIONS.map(String), "No. of Passenger")),
    doorType: pickOption(input.doorType ?? input.door_type, DOOR_TYPE_OPTIONS, "Door Type"),
    cabinType: pickOption(input.cabinType ?? input.cabin_type, CABIN_TYPE_OPTIONS, "Cabin Type"),
    motorType: pickOption(input.motorType ?? input.motor_type, MOTOR_TYPE_OPTIONS, "Motor Type"),
    headRoom: pickOption(input.headRoom ?? input.head_room, HEAD_ROOM_OPTIONS, "Head Room"),
    doorOpening: pickOption(input.doorOpening ?? input.door_opening, DOOR_OPENING_OPTIONS, "Door Opening"),
  };
}

export function validateQuotationInput(input) {
  return normalizeQuotationInput(input);
}

export function validateProjectAmounts(input = {}) {
  const agreedAmount = requiredNumber(input.agreedAmount ?? input.agreed_amount, "Agreed amount");
  const advanceAmount = requiredNumber(input.advanceAmount ?? input.advance_amount, "Advance amount");
  if (advanceAmount > agreedAmount) throw new Error("Advance amount cannot be greater than agreed amount.");
  return { agreedAmount: money(agreedAmount), advanceAmount: money(advanceAmount), balanceAmount: money(agreedAmount - advanceAmount) };
}

export function calculateQuotationCost(input = {}) {
  // TODO: Replace these v1 editable defaults with exact BOQ Excel rate mapping after client confirms formulas.
  const commonMaterial = money(input.commonMaterial ?? input.common_material);
  const doorMaterial = money(input.doorMaterial ?? input.door_material);
  const cabinMaterial = money(input.cabinMaterial ?? input.cabin_material);
  const motorMaterial = money(input.motorMaterial ?? input.motor_material);
  const ropeCost = money(input.ropeCost ?? input.rope_cost);
  const railCost = money(input.railCost ?? input.rail_cost);
  const additionalLfCost = money(input.additionalLfCost ?? input.additional_lf_cost);
  const labourTransport = money(input.labourTransport ?? input.labour_transport, 75000);
  const taxPercent = money(input.taxPercent ?? input.tax_percent, 18);
  const marginPercent = money(input.marginPercent ?? input.margin_percent, 15);
  const discountAmount = money(input.discountAmount ?? input.discount_amount, 0);
  const totalMaterialCost = money(commonMaterial + doorMaterial + cabinMaterial + motorMaterial + ropeCost + railCost + additionalLfCost);
  const taxAmount = money((totalMaterialCost * taxPercent) / 100);
  const projectCost = money(totalMaterialCost + labourTransport + taxAmount);
  const marginAmount = money((projectCost * marginPercent) / 100);
  const customerPrice = money(projectCost + marginAmount);
  const finalPrice = money(customerPrice - discountAmount);

  return {
    commonMaterial,
    doorMaterial,
    cabinMaterial,
    motorMaterial,
    ropeCost,
    railCost,
    additionalLfCost,
    totalMaterialCost,
    labourTransport,
    taxPercent,
    taxAmount,
    projectCost,
    marginPercent,
    marginAmount,
    discountAmount,
    customerPrice,
    finalPrice,
  };
}

export async function ensureQuotationTables() {
  if (quotationTablesReady) return;
  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS quotation_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quotation_no TEXT UNIQUE NOT NULL,
      serial_no TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      customer_name TEXT NOT NULL,
      address TEXT,
      mobile_no TEXT NOT NULL,
      well_width NUMERIC NOT NULL,
      well_depth NUMERIC NOT NULL,
      no_of_floors TEXT NOT NULL,
      no_of_passenger INTEGER NOT NULL,
      door_type TEXT NOT NULL,
      cabin_type TEXT NOT NULL,
      motor_type TEXT NOT NULL,
      head_room TEXT NOT NULL,
      door_opening TEXT NOT NULL,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by_username TEXT,
      generated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      generated_by_username TEXT,
      generated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS quotation_cost_breakdowns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quotation_id UUID NOT NULL REFERENCES quotation_requests(id) ON DELETE CASCADE,
      common_material NUMERIC DEFAULT 0,
      door_material NUMERIC DEFAULT 0,
      cabin_material NUMERIC DEFAULT 0,
      motor_material NUMERIC DEFAULT 0,
      rope_cost NUMERIC DEFAULT 0,
      rail_cost NUMERIC DEFAULT 0,
      additional_lf_cost NUMERIC DEFAULT 0,
      total_material_cost NUMERIC DEFAULT 0,
      labour_transport NUMERIC DEFAULT 0,
      tax_percent NUMERIC DEFAULT 18,
      tax_amount NUMERIC DEFAULT 0,
      project_cost NUMERIC DEFAULT 0,
      margin_percent NUMERIC DEFAULT 15,
      margin_amount NUMERIC DEFAULT 0,
      discount_amount NUMERIC DEFAULT 0,
      customer_price NUMERIC DEFAULT 0,
      final_price NUMERIC DEFAULT 0,
      calculation_snapshot JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(quotation_id)
    );

    CREATE INDEX IF NOT EXISTS idx_quotation_requests_status ON quotation_requests(status);
    CREATE INDEX IF NOT EXISTS idx_quotation_requests_created_at ON quotation_requests(created_at);
    -- UNIQUE(quotation_id) already provides its lookup index.

    ALTER TABLE quotation_requests ADD COLUMN IF NOT EXISTS converted_customer_id UUID;
    ALTER TABLE quotation_requests ADD COLUMN IF NOT EXISTS pending_sheet_row INTEGER;
    ALTER TABLE quotation_requests ADD COLUMN IF NOT EXISTS converted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE quotation_requests ADD COLUMN IF NOT EXISTS converted_by_username TEXT;

    CREATE TABLE IF NOT EXISTS quotation_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quotation_id UUID NOT NULL UNIQUE REFERENCES quotation_requests(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES elevator_service_customers(id) ON DELETE RESTRICT,
      agreed_amount NUMERIC(12,2) NOT NULL CHECK (agreed_amount > 0),
      advance_amount NUMERIC(12,2) NOT NULL CHECK (advance_amount >= 0 AND advance_amount <= agreed_amount),
      balance_amount NUMERIC(12,2) NOT NULL CHECK (balance_amount >= 0),
      status TEXT NOT NULL DEFAULT 'ONGOING',
      google_sheet_row INTEGER,
      onboarded_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_quotation_projects_status ON quotation_projects(status);
    ALTER TABLE quotation_projects ADD COLUMN IF NOT EXISTS google_sheet_row INTEGER;
    ALTER TABLE quotation_projects ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE quotation_projects ADD COLUMN IF NOT EXISTS started_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE quotation_projects ADD COLUMN IF NOT EXISTS started_by_username TEXT;
  `);
  quotationTablesReady = true;
}

export async function getQuotationStatus(id) {
  await ensureQuotationTables();
  const result = await query("SELECT status FROM quotation_requests WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0]?.status || null;
}

export async function generateQuotationNo(now = new Date()) {
  await ensureQuotationTables();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = await query(
    "SELECT quotation_no FROM quotation_requests WHERE quotation_no LIKE $1 ORDER BY quotation_no DESC LIMIT 1",
    [`QTN-${yearMonth}-%`]
  );
  const last = result.rows[0]?.quotation_no;
  return buildQuotationNo({ yearMonth, sequence: last ? Number(last.split("-").pop()) + 1 : 1 });
}

function normalizeQuotationRow(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    quotationNo: row.quotation_no,
    serialNo: row.serial_no,
    status: row.status,
    customerName: row.customer_name,
    address: row.address,
    mobileNo: row.mobile_no,
    wellWidth: Number(row.well_width),
    wellDepth: Number(row.well_depth),
    noOfFloors: row.no_of_floors,
    noOfPassenger: row.no_of_passenger,
    doorType: row.door_type,
    cabinType: row.cabin_type,
    motorType: row.motor_type,
    headRoom: row.head_room,
    doorOpening: row.door_opening,
    commonMaterial: numberOrNull(row.common_material),
    doorMaterial: numberOrNull(row.door_material),
    cabinMaterial: numberOrNull(row.cabin_material),
    motorMaterial: numberOrNull(row.motor_material),
    ropeCost: numberOrNull(row.rope_cost),
    railCost: numberOrNull(row.rail_cost),
    additionalLfCost: numberOrNull(row.additional_lf_cost),
    labourTransport: numberOrNull(row.labour_transport),
    taxPercent: numberOrNull(row.tax_percent),
    marginPercent: numberOrNull(row.margin_percent),
    discountAmount: numberOrNull(row.discount_amount),
    finalPrice: numberOrNull(row.final_price),
    customerPrice: numberOrNull(row.customer_price),
    sheetRow: row.calculation_snapshot?.sheetRow ?? null,
    convertedCustomerId: row.converted_customer_id ?? null,
    projectId: row.project_id ?? null,
    agreedAmount: numberOrNull(row.agreed_amount),
    advanceAmount: numberOrNull(row.advance_amount),
    balanceAmount: numberOrNull(row.balance_amount),
    projectStatus: row.project_status ?? null,
    onboardedAt: row.onboarded_at ?? null,
    createdByUsername: row.created_by_username,
    generatedByUsername: row.generated_by_username,
    convertedByUsername: row.converted_by_username,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveQuotation({ actor, input }) {
  await ensureQuotationTables();
  const q = normalizeQuotationInput(input);
  const quotationNo = await generateQuotationNo();
  const result = await query(
    `
    INSERT INTO quotation_requests (
      quotation_no, serial_no, customer_name, address, mobile_no, well_width, well_depth,
      no_of_floors, no_of_passenger, door_type, cabin_type, motor_type, head_room, door_opening,
      created_by_user_id, created_by_username
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING *
    `,
    [quotationNo, q.serialNo, q.customerName, q.address, q.mobileNo, q.wellWidth, q.wellDepth, q.noOfFloors, q.noOfPassenger, q.doorType, q.cabinType, q.motorType, q.headRoom, q.doorOpening, actor?.id || null, actor?.username || actor?.name || null]
  );
  return normalizeQuotationRow(result.rows[0]);
}

// Prices a quotation using the client's real "boq automation" Google Sheet
// (its formulas are the actual business pricing logic) instead of the old
// in-app v1 placeholder cost-category formula.
export async function generateBoqForQuotation({ quotationId, actor }) {
  await ensureQuotationTables();

  const existing = await query("SELECT * FROM quotation_requests WHERE id = $1 LIMIT 1", [quotationId]);
  const quotationRow = existing.rows[0];
  if (!quotationRow) throw new Error("Quotation not found.");
  const quotation = normalizeQuotationRow(quotationRow);

  // If a previous attempt already appended a row to the sheet but the price
  // poll afterward timed out or failed, reuse that same row instead of
  // appending a second, duplicate row for the same quotation.
  let rowNumber = quotationRow.pending_sheet_row;
  if (!rowNumber) {
    rowNumber = await appendBoqRow(quotation);
    await query("UPDATE quotation_requests SET pending_sheet_row = $1, updated_at = NOW() WHERE id = $2", [rowNumber, quotationId]);
  }

  const price = await pollBoqPrice(rowNumber);
  const snapshot = { source: "google_sheets", sheetTab: "boq automation", sheetRow: rowNumber, price };

  await query(
    `
    INSERT INTO quotation_cost_breakdowns (
      quotation_id, customer_price, final_price, calculation_snapshot
    )
    VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (quotation_id) DO UPDATE SET
      customer_price=EXCLUDED.customer_price,
      final_price=EXCLUDED.final_price,
      calculation_snapshot=EXCLUDED.calculation_snapshot,
      updated_at=NOW()
    `,
    [quotationId, price, price, JSON.stringify(snapshot)]
  );
  const result = await query(
    `
    UPDATE quotation_requests
    SET status='BOQ_GENERATED', generated_by_user_id=$1, generated_by_username=$2, generated_at=NOW(), updated_at=NOW()
    WHERE id=$3
    RETURNING *
    `,
    [actor?.id || null, actor?.username || actor?.name || null, quotationId]
  );
  if (!result.rows[0]) throw new Error("Quotation not found.");
  return {
    quotation: normalizeQuotationRow({ ...result.rows[0], final_price: price, customer_price: price }),
    costBreakdown: { finalPrice: price, customerPrice: price, sheetRow: rowNumber },
  };
}

export async function getQuotationById({ id, actor }) {
  await ensureQuotationTables();
  const hasPermission = await isBoqAdmin(actor);
  const result = await query(
    `
    SELECT q.*, c.common_material, c.door_material, c.cabin_material, c.motor_material,
           c.rope_cost, c.rail_cost, c.additional_lf_cost, c.labour_transport,
              c.tax_percent, c.margin_percent, c.discount_amount, c.final_price, c.customer_price,
              p.id AS project_id, p.agreed_amount, p.advance_amount, p.balance_amount,
              p.status AS project_status, p.onboarded_at,
           c.calculation_snapshot
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
            LEFT JOIN quotation_projects p ON p.quotation_id = q.id
    WHERE q.id = $1
    LIMIT 1
    `,
    [id]
  );
  const quotation = normalizeQuotationRow(result.rows[0]);
  if (!quotation) return null;
  if (!canViewQuotation(actor, quotation.status, hasPermission)) throw new Error("Unauthorized.");
  return quotation;
}

export async function listQuotations({ actor, page = 1, pageSize = 25, search = "", status = "" }) {
  await ensureQuotationTables();
  const hasPermission = await isBoqAdmin(actor);
  const clauses = [];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (actor.role === "front_office") clauses.push("q.status <> 'DRAFT'");
  if (status) clauses.push(`q.status = ${add(status)}`);
  if (search) {
    const term = `%${search}%`;
    clauses.push(`(q.quotation_no ILIKE ${add(term)} OR q.customer_name ILIKE ${add(term)} OR q.mobile_no ILIKE ${add(term)})`);
  }
  if (!["superadmin", "front_office"].includes(actor.role) && !hasPermission) throw new Error("Unauthorized.");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const count = await query(`SELECT COUNT(*)::int AS total FROM quotation_requests q ${where}`, params);
  const rows = await query(
    `
    SELECT q.*, c.common_material, c.door_material, c.cabin_material, c.motor_material,
           c.rope_cost, c.rail_cost, c.additional_lf_cost, c.labour_transport,
              c.tax_percent, c.margin_percent, c.discount_amount, c.final_price, c.customer_price,
              p.id AS project_id, p.agreed_amount, p.advance_amount, p.balance_amount,
              p.status AS project_status, p.onboarded_at,
           c.calculation_snapshot
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
            LEFT JOIN quotation_projects p ON p.quotation_id = q.id
    ${where}
    ORDER BY q.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `,
    [...params, safePageSize, (safePage - 1) * safePageSize]
  );
  return { rows: rows.rows.map(normalizeQuotationRow), total: count.rows[0]?.total || 0, page: safePage, pageSize: safePageSize, canGenerate: canGenerateBoqLocal(actor, hasPermission) };
}

function canGenerateBoqLocal(actor, hasPermission) {
  return actor?.role === "superadmin" || (["admin", "manager"].includes(actor?.role) && hasPermission);
}

export async function updateQuotationStatus({ id, status }) {
  await ensureQuotationTables();
  if (!QUOTATION_STATUSES.includes(status)) throw new Error("Invalid quotation status.");
  const result = await query("UPDATE quotation_requests SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *", [status, id]);
  if (!result.rows[0]) throw new Error("Quotation not found.");
  return normalizeQuotationRow(result.rows[0]);
}

// Formats using local calendar getters, not toISOString(), which would shift
// the date backward for timezones ahead of UTC (e.g. IST) when local midnight
// converts to the previous UTC day.
function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Converts an accepted quotation into a real onboarded customer record with a
// default 1-year AMC starting today, and marks the quotation CONVERTED_TO_CUSTOMER.
export async function onboardQuotationAsCustomer({ quotationId, actor }) {
  await ensureQuotationTables();

  const existing = await query("SELECT * FROM quotation_requests WHERE id = $1 LIMIT 1", [quotationId]);
  const quotation = existing.rows[0];
  if (!quotation) throw new Error("Quotation not found.");
  if (quotation.status === "CONVERTED_TO_CUSTOMER") {
    throw new Error("This quotation has already been onboarded as a customer.");
  }

  const today = new Date();
  const startDate = isoDate(today);
  const endDate = isoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate() - 1));

  const customerResult = await query(
    `
    INSERT INTO elevator_service_customers (
      customer_code, customer_name, address, mobile_no,
      no_of_floors, no_of_passenger, door_type, cabin,
      customer_status, amc_starting_date, amc_ending_date, amc_warranty_due,
      remarks
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'AMC',$9,$10,$11,$12)
    RETURNING *
    `,
    [
      quotation.quotation_no,
      quotation.customer_name,
      quotation.address,
      quotation.mobile_no,
      quotation.no_of_floors,
      String(quotation.no_of_passenger),
      quotation.door_type,
      quotation.cabin_type,
      startDate,
      endDate,
      endDate,
      `Onboarded from quotation ${quotation.quotation_no}. Default 1-year AMC applied on onboarding.`,
    ]
  );
  const customer = customerResult.rows[0];

  const updated = await query(
    `UPDATE quotation_requests SET status='CONVERTED_TO_CUSTOMER', converted_customer_id=$1, converted_by_user_id=$2, converted_by_username=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
    [customer.id, actor?.id || null, actor?.username || actor?.name || null, quotationId]
  );

  return { customer, quotation: normalizeQuotationRow(updated.rows[0]) };
}

export async function onboardQuotationAsProject({ quotationId, agreedAmount, advanceAmount, actor }) {
  await ensureQuotationTables();
  const amounts = validateProjectAmounts({ agreedAmount, advanceAmount });

  return withTransaction(async () => {
    const existing = await query("SELECT * FROM quotation_requests WHERE id = $1 FOR UPDATE", [quotationId]);
    const quotation = existing.rows[0];
    if (!quotation) throw new Error("Quotation not found.");
    if (quotation.status === "CONVERTED_TO_PROJECT") {
      const existingProject = await query("SELECT * FROM quotation_projects WHERE quotation_id=$1 LIMIT 1", [quotationId]);
      if (!existingProject.rows[0]) throw new Error("This quotation is marked as a project but has no project record.");
      return { project: normalizeProjectRow(existingProject.rows[0]), quotation: normalizeQuotationRow(quotation) };
    }

    let customerId = quotation.converted_customer_id;
    if (!customerId) {
      const customerResult = await query(
        `
        INSERT INTO elevator_service_customers (
          customer_code, customer_name, address, mobile_no,
          no_of_floors, no_of_passenger, door_type, cabin,
          customer_status, amc_starting_date, amc_ending_date, amc_warranty_due,
          remarks
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'AMC',$9,$10,$11,$12)
        RETURNING id
        `,
        [quotation.quotation_no, quotation.customer_name, quotation.address, quotation.mobile_no, quotation.no_of_floors, String(quotation.no_of_passenger), quotation.door_type, quotation.cabin_type, isoDate(new Date()), isoDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate() - 1)), isoDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate() - 1)), `Onboarded from project ${quotation.quotation_no}.`]
      );
      customerId = customerResult.rows[0].id;
    }

    const projectResult = await query(
      `
      INSERT INTO quotation_projects (quotation_id, customer_id, agreed_amount, advance_amount, balance_amount)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [quotationId, customerId, amounts.agreedAmount, amounts.advanceAmount, amounts.balanceAmount]
    );
    const updated = await query(
      `UPDATE quotation_requests SET status='CONVERTED_TO_PROJECT', converted_customer_id=$1, converted_by_user_id=$2, converted_by_username=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      [customerId, actor?.id || null, actor?.username || actor?.name || null, quotationId]
    );
    return { project: normalizeProjectRow(projectResult.rows[0]), quotation: normalizeQuotationRow(updated.rows[0]) };
  });
}

function normalizeProjectRow(row = {}) {
  return {
    id: row.id,
    quotationId: row.quotation_id,
    customerId: row.customer_id,
    agreedAmount: Number(row.agreed_amount),
    advanceAmount: Number(row.advance_amount),
    balanceAmount: Number(row.balance_amount),
    status: row.status,
    googleSheetRow: row.google_sheet_row ?? null,
    onboardedAt: row.onboarded_at,
    customerName: row.customer_name,
    mobileNo: row.mobile_no,
    city: row.city || "",
    quotationNo: row.quotation_no,
    startedAt: row.started_at ?? null,
    startedByUsername: row.started_by_username ?? null,
    // Populated by the caller (listOngoingProjects/startProject) via the
    // project_assignees join table — absent here means "not loaded", not
    // "no crew assigned", matching the same convention as complaints/schedules.
    assignees: row.assignees || undefined,
    checklistCompletions: row.checklistCompletions || undefined,
  };
}

export async function listOngoingProjects({ actor, page = 1, pageSize = 25, search = "" }) {
  await ensureQuotationTables();
  const hasPermission = await isBoqAdmin(actor);
  if (!["superadmin", "front_office"].includes(actor.role) && !hasPermission) throw new Error("Unauthorized.");
  const params = [];
  const clauses = ["p.status = 'ONGOING'"];
  const add = (value) => { params.push(value); return `$${params.length}`; };
  if (search) {
    const term = `%${search}%`;
    clauses.push(`(q.quotation_no ILIKE ${add(term)} OR c.customer_name ILIKE ${add(term)} OR c.mobile_no ILIKE ${add(term)})`);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const count = await query(`SELECT COUNT(*)::int AS total FROM quotation_projects p JOIN quotation_requests q ON q.id = p.quotation_id JOIN elevator_service_customers c ON c.id = p.customer_id ${where}`, params);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const rows = await query(
    `SELECT p.*, q.quotation_no, c.customer_name, c.mobile_no
     FROM quotation_projects p
     JOIN quotation_requests q ON q.id = p.quotation_id
     JOIN elevator_service_customers c ON c.id = p.customer_id
     ${where} ORDER BY p.onboarded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safePageSize, (safePage - 1) * safePageSize]
  );
  const projects = rows.rows.map(normalizeProjectRow);
  const projectIds = projects.map((project) => project.id);
  const [assigneesByProject, checklistByProject] = await Promise.all([
    getProjectAssigneesForMany(projectIds),
    getProjectChecklistCompletionsForMany(projectIds),
  ]);
  for (const project of projects) {
    project.assignees = assigneesByProject.get(project.id) || [];
    project.checklistCompletions = checklistByProject.get(project.id) || [];
  }
  return { rows: projects, total: count.rows[0]?.total || 0, page: safePage, pageSize: safePageSize };
}

export async function getProjectById({ id }) {
  await ensureQuotationTables();
  const result = await query(
    `SELECT p.*, q.quotation_no, c.customer_name, c.mobile_no
     FROM quotation_projects p
     JOIN quotation_requests q ON q.id = p.quotation_id
     JOIN elevator_service_customers c ON c.id = p.customer_id
     WHERE p.id = $1
     LIMIT 1`,
    [id]
  );
  const project = normalizeProjectRow(result.rows[0]);
  if (!project) return null;
  project.assignees = await getProjectAssignees(project.id);
  project.checklistCompletions = await getProjectChecklistCompletions(project.id);
  return project;
}

export async function isProjectAssignee(projectId, userId) {
  await ensureAssigneeTables();
  const result = await query("SELECT 1 FROM project_assignees WHERE project_id = $1 AND user_id = $2 LIMIT 1", [projectId, userId]);
  return result.rowCount > 0;
}

// A technician's own started, still-active installations — the worker-app
// equivalent of the admin Ongoing Projects list, scoped to crews they're
// actually on.
export async function listProjectsForTechnician(userId) {
  await ensureQuotationTables();
  const result = await query(
    `SELECT p.*, q.quotation_no, c.customer_name, c.mobile_no
     FROM quotation_projects p
     JOIN quotation_requests q ON q.id = p.quotation_id
     JOIN elevator_service_customers c ON c.id = p.customer_id
     JOIN project_assignees pa ON pa.project_id = p.id
     WHERE pa.user_id = $1 AND p.started_at IS NOT NULL
     ORDER BY p.started_at DESC`,
    [userId]
  );
  const projects = result.rows.map(normalizeProjectRow);
  const projectIds = projects.map((project) => project.id);
  const [assigneesByProject, checklistByProject] = await Promise.all([
    getProjectAssigneesForMany(projectIds),
    getProjectChecklistCompletionsForMany(projectIds),
  ]);
  for (const project of projects) {
    project.assignees = assigneesByProject.get(project.id) || [];
    project.checklistCompletions = checklistByProject.get(project.id) || [];
  }
  return projects;
}

// Records who's actually on site for a project. Callable again after the
// first start to reassign the crew — only the very first call sets
// startedAt, so re-running this to swap technicians doesn't reset the
// project's real start date.
export async function startProject({ projectId, technicianUserIds, actor }) {
  await ensureQuotationTables();
  await ensureAssigneeTables();

  const existing = await query("SELECT * FROM quotation_projects WHERE id = $1 LIMIT 1", [projectId]);
  if (!existing.rows[0]) throw new Error("Project not found.");

  const cleanIds = [...new Set((technicianUserIds || []).map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id) && id > 0))];
  if (cleanIds.length === 0) throw new Error("Assign at least one technician to start the project.");

  const alreadyStarted = Boolean(existing.rows[0].started_at);
  if (!alreadyStarted) {
    await query(
      `UPDATE quotation_projects SET started_at = NOW(), started_by_user_id = $1, started_by_username = $2, updated_at = NOW() WHERE id = $3`,
      [actor?.id || null, actor?.username || actor?.name || null, projectId]
    );
  }
  await setProjectAssignees(projectId, cleanIds);
  return { project: await getProjectById({ id: projectId }), alreadyStarted };
}

export async function markProjectSheetRow({ projectId, rowNumber }) {
  await ensureQuotationTables();
  const result = await query(
    "UPDATE quotation_projects SET google_sheet_row=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
    [rowNumber, projectId]
  );
  return result.rows[0] ? normalizeProjectRow(result.rows[0]) : null;
}
