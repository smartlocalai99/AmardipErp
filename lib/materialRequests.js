import { query } from "./db.js";
import { ensureInventoryTables, getInventoryItemById } from "./inventory.js";
import { ensureComplaintsTable, getComplaintById } from "./complaints.js";
import { verifyJobPass } from "./jobPass.js";

const TERMINAL_COMPLAINT_STATUSES = new Set(["RESOLVED", "CLOSED", "CANCELLED"]);
let tableReady = false;

export async function ensureMaterialRequestsTable() {
  if (tableReady) return;
  await ensureInventoryTables();
  await ensureComplaintsTable();
  tableReady = true;
}

export function normalizeRequestRow(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    complaintId: row.complaint_id,
    itemId: row.item_id,
    itemName: row.item_name || null,
    itemUnit: row.item_unit || null,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name || null,
    requestedQuantity: Number(row.requested_quantity),
    issuedQuantity: Number(row.issued_quantity),
    status: row.status,
    approvedBy: row.approved_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_JOINS = `
  SELECT r.*, i.name AS item_name, i.unit AS item_unit, u.name AS requested_by_name
  FROM material_requests r
  JOIN inventory_items i ON i.id = r.item_id
  LEFT JOIN users u ON u.id = r.requested_by
`;

export function normalizeAllocatedItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((line) => ({ itemId: Number(line?.itemId), quantity: Number(line?.quantity) }))
    .filter((line) => line.itemId && line.quantity > 0);
}

export async function createMaterialRequests({ complaintId, requestedBy, items, status = "pending" }) {
  await ensureMaterialRequestsTable();
  if (!Array.isArray(items) || items.length === 0) throw new Error("At least one item is required.");
  if (!["pending", "approved"].includes(status)) throw new Error("Invalid status.");

  const complaint = await getComplaintById(complaintId);
  if (!complaint) throw new Error("Job not found.");

  const created = [];
  for (const line of items) {
    const item = await getInventoryItemById(line.itemId);
    if (!item) throw new Error(`Inventory item ${line.itemId} not found.`);
    const quantity = Number(line.quantity);
    if (!quantity || quantity <= 0) throw new Error(`Invalid quantity for ${item.name}.`);

    const result = await query(
      `
      INSERT INTO material_requests (complaint_id, item_id, requested_by, requested_quantity, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [complaintId, item.id, requestedBy, quantity, status]
    );
    created.push(normalizeRequestRow({ ...result.rows[0], item_name: item.name, item_unit: item.unit }));
  }

  return created;
}

export async function listMaterialRequestsForComplaint(complaintId) {
  await ensureMaterialRequestsTable();
  const result = await query(
    `${SELECT_WITH_JOINS} WHERE r.complaint_id = $1 ORDER BY r.created_at DESC`,
    [complaintId]
  );
  return result.rows.map(normalizeRequestRow);
}

function assertJobOpenForWorker(complaint, workerId) {
  if (!complaint) throw new Error("Job not found.");
  if (Number(complaint.assignedTechnicianUserId) !== Number(workerId)) {
    throw new Error("This job pass is no longer valid for this worker.");
  }
  if (TERMINAL_COMPLAINT_STATUSES.has(complaint.status)) {
    throw new Error("This job is closed; the store pass is no longer valid.");
  }
}

export async function resolveJobPass(token) {
  const { complaintId, workerId } = verifyJobPass(token);
  const complaint = await getComplaintById(complaintId);
  assertJobOpenForWorker(complaint, workerId);
  return { complaint, workerId };
}

// Atomic issue: verifies the pass again, decrements stock, logs the ledger,
// and reconciles matching material_requests rows. lib/db.js's pool is
// max:1 (see lib/db.js comment), so sequential query() calls below all run
// on the same underlying connection — BEGIN/COMMIT/ROLLBACK here is safe
// without a separate pg.Client checkout.
export async function issueMaterialsForJob({ token, items, actor }) {
  await ensureMaterialRequestsTable();
  if (!Array.isArray(items) || items.length === 0) throw new Error("At least one item is required.");

  const { complaint, workerId } = await resolveJobPass(token);

  await query("BEGIN");
  try {
    const issued = [];
    for (const line of items) {
      const quantity = Number(line.quantity);
      if (!quantity || quantity <= 0) throw new Error("Invalid quantity.");

      const itemResult = await query("SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE", [line.itemId]);
      const item = itemResult.rows[0];
      if (!item) throw new Error(`Inventory item ${line.itemId} not found.`);
      const currentStock = Number(item.stock_quantity);
      if (currentStock < quantity) {
        throw new Error(`Insufficient stock for ${item.name}: only ${currentStock} ${item.unit} available.`);
      }

      const newStock = currentStock - quantity;
      await query("UPDATE inventory_items SET stock_quantity = $1, updated_at = NOW() WHERE id = $2", [newStock, item.id]);
      await query(
        `
        INSERT INTO inventory_transactions (item_id, complaint_id, type, quantity_delta, balance_after, performed_by, worker_id, notes)
        VALUES ($1, $2, 'issue', $3, $4, $5, $6, $7)
        `,
        [item.id, complaint.id, -quantity, newStock, actor?.id || null, workerId, line.notes || null]
      );

      const matchingRequest = await query(
        "SELECT id FROM material_requests WHERE complaint_id = $1 AND item_id = $2 AND status IN ('pending', 'approved', 'partially_issued') LIMIT 1",
        [complaint.id, item.id]
      );
      if (matchingRequest.rows[0]) {
        await query(
          "UPDATE material_requests SET issued_quantity = issued_quantity + $1, status = 'issued', updated_at = NOW() WHERE id = $2",
          [quantity, matchingRequest.rows[0].id]
        );
      } else {
        await query(
          `
          INSERT INTO material_requests (complaint_id, item_id, requested_by, requested_quantity, issued_quantity, status, approved_by)
          VALUES ($1, $2, $3, $4, $4, 'issued', $3)
          `,
          [complaint.id, item.id, workerId, quantity]
        );
      }

      issued.push({ itemId: item.id, name: item.name, unit: item.unit, quantity, balanceAfter: newStock });
    }

    await query("COMMIT");
    return { complaint, issued };
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}
