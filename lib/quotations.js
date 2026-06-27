import { query } from "./db.js";
import { canViewQuotation, isBoqAdmin } from "./quotationPermissions.js";

export const QUOTATION_STATUSES = ["DRAFT", "BOQ_GENERATED", "CALCULATED", "SENT", "ACCEPTED", "REJECTED", "CONVERTED_TO_CUSTOMER"];
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

export function buildQuotationNo({ yearMonth, sequence }) {
  return `QTN-${yearMonth}-${String(sequence).padStart(4, "0")}`;
}

export function normalizeQuotationInput(input = {}) {
  return {
    serialNo: textOrNull(input.serialNo ?? input.serial_no),
    customerName: requiredText(input.customerName ?? input.customer_name ?? input.name, "Name"),
    address: textOrNull(input.address),
    mobileNo: requiredText(input.mobileNo ?? input.mobile_no, "Mobile No"),
    wellWidth: requiredNumber(input.wellWidth ?? input.well_width, "Well Width"),
    wellDepth: requiredNumber(input.wellDepth ?? input.well_depth, "Well Depth"),
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
    CREATE INDEX IF NOT EXISTS idx_quotation_cost_breakdowns_quotation_id ON quotation_cost_breakdowns(quotation_id);
  `);
  quotationTablesReady = true;
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
    finalPrice: row.final_price === null || row.final_price === undefined ? null : Number(row.final_price),
    customerPrice: row.customer_price === null || row.customer_price === undefined ? null : Number(row.customer_price),
    createdByUsername: row.created_by_username,
    generatedByUsername: row.generated_by_username,
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

export async function generateBoqForQuotation({ quotationId, actor, costs = {} }) {
  await ensureQuotationTables();
  const calculated = calculateQuotationCost(costs);
  const snapshot = { ...calculated, formulaVersion: "v1-placeholder" };
  await query(
    `
    INSERT INTO quotation_cost_breakdowns (
      quotation_id, common_material, door_material, cabin_material, motor_material, rope_cost, rail_cost,
      additional_lf_cost, total_material_cost, labour_transport, tax_percent, tax_amount, project_cost,
      margin_percent, margin_amount, discount_amount, customer_price, final_price, calculation_snapshot
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
    ON CONFLICT (quotation_id) DO UPDATE SET
      common_material=EXCLUDED.common_material, door_material=EXCLUDED.door_material,
      cabin_material=EXCLUDED.cabin_material, motor_material=EXCLUDED.motor_material,
      rope_cost=EXCLUDED.rope_cost, rail_cost=EXCLUDED.rail_cost, additional_lf_cost=EXCLUDED.additional_lf_cost,
      total_material_cost=EXCLUDED.total_material_cost, labour_transport=EXCLUDED.labour_transport,
      tax_percent=EXCLUDED.tax_percent, tax_amount=EXCLUDED.tax_amount, project_cost=EXCLUDED.project_cost,
      margin_percent=EXCLUDED.margin_percent, margin_amount=EXCLUDED.margin_amount,
      discount_amount=EXCLUDED.discount_amount, customer_price=EXCLUDED.customer_price,
      final_price=EXCLUDED.final_price, calculation_snapshot=EXCLUDED.calculation_snapshot, updated_at=NOW()
    `,
    [quotationId, calculated.commonMaterial, calculated.doorMaterial, calculated.cabinMaterial, calculated.motorMaterial, calculated.ropeCost, calculated.railCost, calculated.additionalLfCost, calculated.totalMaterialCost, calculated.labourTransport, calculated.taxPercent, calculated.taxAmount, calculated.projectCost, calculated.marginPercent, calculated.marginAmount, calculated.discountAmount, calculated.customerPrice, calculated.finalPrice, JSON.stringify(snapshot)]
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
  return { quotation: normalizeQuotationRow({ ...result.rows[0], final_price: calculated.finalPrice, customer_price: calculated.customerPrice }), costBreakdown: calculated };
}

export async function getQuotationById({ id, actor }) {
  await ensureQuotationTables();
  const hasPermission = await isBoqAdmin(actor);
  const result = await query(
    `
    SELECT q.*, c.final_price, c.customer_price
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
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
    SELECT q.*, c.final_price, c.customer_price
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
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
