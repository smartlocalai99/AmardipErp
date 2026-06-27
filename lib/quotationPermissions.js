import { query } from "./db.js";

const BOQ_PERMISSION_ROLES = new Set(["superadmin", "admin", "manager"]);
const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const FRONT_OFFICE_VISIBLE_STATUSES = new Set(["BOQ_GENERATED", "CALCULATED", "SENT", "ACCEPTED", "REJECTED", "CONVERTED_TO_CUSTOMER"]);

let permissionTablesReady = false;

export async function ensureQuotationPermissionTables() {
  if (permissionTablesReady) return;

  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS quotation_admin_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT,
      role TEXT,
      can_generate_boq BOOLEAN DEFAULT true,
      can_edit_boq BOOLEAN DEFAULT true,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_quotation_admin_permissions_user_id ON quotation_admin_permissions(user_id);
  `);

  permissionTablesReady = true;
}

export function isPermissionManageRole(user) {
  return user?.role === "superadmin";
}

export function canViewQuotation(user, quotationStatus, hasPermission = false) {
  if (!user || BLOCKED_ROLES.has(user.role)) return false;
  if (user.role === "front_office") return FRONT_OFFICE_VISIBLE_STATUSES.has(quotationStatus);
  if (user.role === "superadmin") return true;
  return BOQ_PERMISSION_ROLES.has(user.role) && hasPermission;
}

export function canGenerateBoq(user, hasPermission = false) {
  if (!user || user.role === "front_office" || BLOCKED_ROLES.has(user.role)) return false;
  if (user.role === "superadmin") return true;
  return BOQ_PERMISSION_ROLES.has(user.role) && hasPermission;
}

export function canEditBoq(user, hasPermission = false) {
  return canGenerateBoq(user, hasPermission);
}

export async function isBoqAdmin(user) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (!BOQ_PERMISSION_ROLES.has(user.role)) return false;
  await ensureQuotationPermissionTables();
  const result = await query("SELECT 1 FROM quotation_admin_permissions WHERE user_id = $1 LIMIT 1", [user.id]);
  return result.rowCount > 0;
}

export async function listBoqAdmins() {
  await ensureQuotationPermissionTables();
  const result = await query(`
    SELECT p.id, p.user_id, p.username, p.role, p.can_generate_boq, p.can_edit_boq, p.created_at, u.name
    FROM quotation_admin_permissions p
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
  `);
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    role: row.role,
    name: row.name,
    canGenerateBoq: row.can_generate_boq,
    canEditBoq: row.can_edit_boq,
    createdAt: row.created_at,
  }));
}

export async function addBoqAdmin({ userId, actor }) {
  await ensureQuotationPermissionTables();
  const count = await query("SELECT COUNT(*)::int AS count FROM quotation_admin_permissions");
  const existing = await query("SELECT 1 FROM quotation_admin_permissions WHERE user_id = $1 LIMIT 1", [userId]);
  if (existing.rowCount === 0 && count.rows[0].count >= 6) {
    throw new Error("Only 6 BOQ admins are allowed.");
  }

  const userResult = await query(
    "SELECT id, username, name, role FROM users WHERE id = $1 AND role IN ('superadmin', 'admin', 'manager') LIMIT 1",
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) throw new Error("Only admin, superadmin, or manager users can be BOQ admins.");

  const result = await query(
    `
    INSERT INTO quotation_admin_permissions (user_id, username, role, created_by_user_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id)
    DO UPDATE SET username = EXCLUDED.username, role = EXCLUDED.role, updated_at = NOW()
    RETURNING *
    `,
    [user.id, user.username, user.role, actor?.id || null]
  );
  return result.rows[0];
}

export async function removeBoqAdmin({ userId }) {
  await ensureQuotationPermissionTables();
  const result = await query("DELETE FROM quotation_admin_permissions WHERE user_id = $1 RETURNING *", [userId]);
  return result.rows[0] || null;
}
