import { getMaterialsForComplaints } from "./inventory.js";

// Small bridge kept out of lib/complaints.js on purpose: inventory.js
// imports ensureComplaintsTable from complaints.js, so complaints.js
// importing back from inventory.js would create a circular module
// dependency. Route handlers can safely import both directly.
export async function attachMaterialsToComplaints(rows) {
  const byComplaint = await getMaterialsForComplaints(rows.map((row) => row.id));
  for (const row of rows) {
    row.materials = byComplaint.get(row.id) || [];
  }
  return rows;
}
