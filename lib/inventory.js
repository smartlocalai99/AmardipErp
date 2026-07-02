import fs from "node:fs";
import path from "node:path";
import { query } from "./db.js";
import { ensureComplaintsTable } from "./complaints.js";

export const UNITS = ["Nos", "Meter", "Kg", "Set", "Roll", "Box", "Packet", "Litre", "Other"];

let tablesReady = false;

export async function ensureInventoryTables() {
  if (tablesReady) return;
  // inventory_transactions.complaint_id references complaints(id), so that
  // table must exist first.
  await ensureComplaintsTable();
  const sql = fs.readFileSync(path.join(process.cwd(), "sql", "inventory_schema.sql"), "utf8");
  await query(sql);
  tablesReady = true;
}

function trimToNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function normalizeItemRow(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    stockQuantity: Number(row.stock_quantity),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function listInventoryItems({ search } = {}) {
  await ensureInventoryTables();
  const params = [];
  let whereSql = "";
  if (search) {
    params.push(`%${String(search).trim()}%`);
    whereSql = "WHERE name ILIKE $1";
  }
  const result = await query(
    `SELECT * FROM inventory_items ${whereSql} ORDER BY name ASC LIMIT 1000`,
    params
  );
  return result.rows.map(normalizeItemRow);
}

export async function getInventoryItemById(id) {
  await ensureInventoryTables();
  const result = await query("SELECT * FROM inventory_items WHERE id = $1 LIMIT 1", [id]);
  return normalizeItemRow(result.rows[0]);
}

async function logTransaction({ itemId, complaintId = null, type, quantityDelta, balanceAfter, performedBy, workerId = null, notes = null }) {
  await query(
    `
    INSERT INTO inventory_transactions (item_id, complaint_id, type, quantity_delta, balance_after, performed_by, worker_id, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [itemId, complaintId, type, quantityDelta, balanceAfter, performedBy || null, workerId, trimToNull(notes)]
  );
}

export async function createInventoryItem({ name, unit, stockQuantity = 0, notes = null }, actor) {
  await ensureInventoryTables();
  const cleanName = trimToNull(name);
  if (!cleanName) throw new Error("Item name is required.");
  if (!UNITS.includes(unit)) throw new Error("Invalid unit.");
  const quantity = Number(stockQuantity) || 0;

  const result = await query(
    `
    INSERT INTO inventory_items (name, unit, stock_quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (name) DO UPDATE SET unit = EXCLUDED.unit, stock_quantity = inventory_items.stock_quantity + EXCLUDED.stock_quantity, updated_at = NOW()
    RETURNING *
    `,
    [cleanName, unit, quantity]
  );
  const item = normalizeItemRow(result.rows[0]);

  if (quantity !== 0) {
    await logTransaction({
      itemId: item.id,
      type: "receipt",
      quantityDelta: quantity,
      balanceAfter: item.stockQuantity,
      performedBy: actor?.id,
      notes,
    });
  }

  return item;
}

export async function adjustInventoryItem({ itemId, newQuantity, notes = null }, actor) {
  await ensureInventoryTables();
  const existing = await getInventoryItemById(itemId);
  if (!existing) throw new Error("Item not found.");

  const nextQuantity = Number(newQuantity);
  if (Number.isNaN(nextQuantity) || nextQuantity < 0) throw new Error("Invalid quantity.");
  const delta = nextQuantity - existing.stockQuantity;

  const result = await query(
    "UPDATE inventory_items SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [nextQuantity, itemId]
  );
  const item = normalizeItemRow(result.rows[0]);

  if (delta !== 0) {
    await logTransaction({
      itemId: item.id,
      type: "adjustment",
      quantityDelta: delta,
      balanceAfter: item.stockQuantity,
      performedBy: actor?.id,
      notes,
    });
  }

  return item;
}

export async function recordReturn({ itemId, quantity, complaintId = null, workerId = null, notes = null }, actor) {
  await ensureInventoryTables();
  const existing = await getInventoryItemById(itemId);
  if (!existing) throw new Error("Item not found.");
  const qty = Number(quantity);
  if (!qty || qty <= 0) throw new Error("Return quantity must be greater than zero.");

  const result = await query(
    "UPDATE inventory_items SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [qty, itemId]
  );
  const item = normalizeItemRow(result.rows[0]);

  await logTransaction({
    itemId: item.id,
    complaintId,
    type: "return",
    quantityDelta: qty,
    balanceAfter: item.stockQuantity,
    performedBy: actor?.id,
    workerId,
    notes,
  });

  return item;
}

export function normalizeReturnItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((line) => ({ itemId: Number(line?.itemId), quantity: Number(line?.quantity) }))
    .filter((line) => Number.isInteger(line.itemId) && line.itemId > 0 && Number.isFinite(line.quantity) && line.quantity > 0);
}

export async function getStoreJobByReference(jobReference) {
  await ensureInventoryTables();
  const reference = trimToNull(jobReference);
  if (!reference) throw new Error("Job ID is required.");

  const jobResult = await query(
    `SELECT id, complaint_no, customer_name, assigned_technician_user_id, assigned_technician_name, status
     FROM complaints
     WHERE id::text = $1 OR UPPER(complaint_no) = UPPER($1)
     LIMIT 1`,
    [reference]
  );
  const job = jobResult.rows[0];
  if (!job) throw new Error("Job not found.");

  const itemResult = await query(
    `SELECT i.id, i.name, i.unit,
            SUM(CASE WHEN t.type = 'issue' THEN -t.quantity_delta ELSE 0 END)::numeric AS issued_quantity,
            SUM(CASE WHEN t.type = 'return' THEN t.quantity_delta ELSE 0 END)::numeric AS returned_quantity
     FROM inventory_transactions t
     JOIN inventory_items i ON i.id = t.item_id
     WHERE t.complaint_id = $1 AND t.type IN ('issue', 'return')
     GROUP BY i.id, i.name, i.unit
     HAVING SUM(CASE WHEN t.type = 'issue' THEN -t.quantity_delta ELSE 0 END) >
            SUM(CASE WHEN t.type = 'return' THEN t.quantity_delta ELSE 0 END)
     ORDER BY i.name`,
    [job.id]
  );

  return {
    id: job.id,
    complaintNo: job.complaint_no,
    customerName: job.customer_name,
    workerId: job.assigned_technician_user_id,
    assignedTechnicianName: job.assigned_technician_name,
    status: job.status,
    returnableItems: itemResult.rows.map((row) => ({
      itemId: row.id,
      name: row.name,
      unit: row.unit,
      issuedQuantity: Number(row.issued_quantity),
      returnedQuantity: Number(row.returned_quantity),
      returnableQuantity: Number(row.issued_quantity) - Number(row.returned_quantity),
    })),
  };
}

export async function listStoreJobsWithOutstandingItems({ search = "" } = {}) {
  await ensureInventoryTables();
  const term = trimToNull(search);
  const params = term ? [`%${term}%`] : [];
  const filter = term
    ? "AND (c.complaint_no ILIKE $1 OR c.customer_name ILIKE $1 OR c.assigned_technician_name ILIKE $1)"
    : "";
  const result = await query(
    `WITH movement AS (
       SELECT complaint_id, item_id,
              SUM(CASE WHEN type = 'issue' THEN -quantity_delta ELSE 0 END) -
              SUM(CASE WHEN type = 'return' THEN quantity_delta ELSE 0 END) AS outstanding
       FROM inventory_transactions
       WHERE complaint_id IS NOT NULL AND type IN ('issue', 'return')
       GROUP BY complaint_id, item_id
     )
     SELECT c.id, c.complaint_no, c.customer_name, c.assigned_technician_name, c.status,
            COUNT(m.item_id)::int AS outstanding_item_count,
            SUM(m.outstanding)::numeric AS outstanding_quantity
     FROM movement m
     JOIN complaints c ON c.id = m.complaint_id
     WHERE m.outstanding > 0 ${filter}
     GROUP BY c.id, c.complaint_no, c.customer_name, c.assigned_technician_name, c.status
     ORDER BY c.updated_at DESC
     LIMIT 200`,
    params
  );
  return result.rows.map((row) => ({
    id: row.id,
    complaintNo: row.complaint_no,
    customerName: row.customer_name,
    assignedTechnicianName: row.assigned_technician_name,
    status: row.status,
    outstandingItemCount: row.outstanding_item_count,
    outstandingQuantity: Number(row.outstanding_quantity),
  }));
}

export async function recordJobReturns({ jobReference, items, notes = null }, actor) {
  const lines = normalizeReturnItems(items);
  if (!lines.length) throw new Error("Enter at least one return quantity.");
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) throw new Error("Duplicate return item.");

  await query("BEGIN");
  try {
    let job = await getStoreJobByReference(jobReference);
    await query("SELECT id FROM complaints WHERE id = $1 FOR UPDATE", [job.id]);
    job = await getStoreJobByReference(job.id);
    const available = new Map(job.returnableItems.map((item) => [item.itemId, item]));
    for (const line of lines) {
      const item = available.get(line.itemId);
      if (!item) throw new Error("This item has no outstanding issue quantity for the job.");
      if (line.quantity > item.returnableQuantity) {
        throw new Error(`Only ${item.returnableQuantity} ${item.unit} of ${item.name} can be returned for this job.`);
      }
    }

    const returned = [];
    for (const line of lines) {
      const item = available.get(line.itemId);
      const result = await query(
        "UPDATE inventory_items SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [line.quantity, line.itemId]
      );
      const updated = normalizeItemRow(result.rows[0]);
      await logTransaction({
        itemId: line.itemId,
        complaintId: job.id,
        type: "return",
        quantityDelta: line.quantity,
        balanceAfter: updated.stockQuantity,
        performedBy: actor?.id,
        workerId: job.workerId,
        notes,
      });
      returned.push({ ...item, quantity: line.quantity, balanceAfter: updated.stockQuantity });
    }
    await query("COMMIT");
    return { job, returned };
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

export async function listRecentTransactions({ limit = 50 } = {}) {
  await ensureInventoryTables();
  const result = await query(
    `
    SELECT t.*, i.name AS item_name, i.unit AS item_unit,
           u1.name AS performed_by_name, u2.name AS worker_name
    FROM inventory_transactions t
    JOIN inventory_items i ON i.id = t.item_id
    LEFT JOIN users u1 ON u1.id = t.performed_by
    LEFT JOIN users u2 ON u2.id = t.worker_id
    ORDER BY t.created_at DESC
    LIMIT $1
    `,
    [Math.min(200, Math.max(1, Number(limit) || 50))]
  );
  return result.rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemUnit: row.item_unit,
    complaintId: row.complaint_id,
    type: row.type,
    quantityDelta: Number(row.quantity_delta),
    balanceAfter: Number(row.balance_after),
    performedByName: row.performed_by_name,
    workerName: row.worker_name,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}
