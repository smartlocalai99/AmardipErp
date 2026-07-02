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
