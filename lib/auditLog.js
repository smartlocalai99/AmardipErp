import { query } from "@/lib/db";

let tableReady = false;

export async function ensureAuditLogTable() {
  if (tableReady) return;

  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_username TEXT,
      actor_role TEXT,

      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,

      action TEXT NOT NULL,
      old_values JSONB,
      new_values JSONB,
      changed_fields TEXT[],

      ip_address TEXT,
      user_agent TEXT,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_user_id ON admin_audit_logs(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON admin_audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);
  `);

  tableReady = true;
}

function getIpAddress(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || null;
}

export async function createAuditLog({
  req,
  actor,
  entityType,
  entityId,
  action,
  oldValues = null,
  newValues = null,
  changedFields = [],
}) {
  await ensureAuditLogTable();

  await query(
    `
    INSERT INTO admin_audit_logs (
      actor_user_id,
      actor_username,
      actor_role,
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      changed_fields,
      ip_address,
      user_agent
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::text[], $10, $11)
    `,
    [
      actor?.id || null,
      actor?.username || actor?.name || null,
      actor?.role || null,
      entityType,
      String(entityId),
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changedFields,
      getIpAddress(req),
      req.headers["user-agent"] || null,
    ]
  );
}
