import { query } from "./db.js";

let tableReady = false;

export async function ensureCustomerNotificationsTable() {
  if (tableReady) return;

  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS customer_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_id ON customer_notifications(user_id);
  `);

  tableReady = true;
}

export async function createCustomerNotification({ userId, category, message, data = null }) {
  await ensureCustomerNotificationsTable();
  await query(
    `INSERT INTO customer_notifications (user_id, category, message, data) VALUES ($1, $2, $3, $4::jsonb)`,
    [userId, category, message, data ? JSON.stringify(data) : null]
  );
}

export async function listCustomerNotifications(userId) {
  await ensureCustomerNotificationsTable();
  const result = await query(
    `SELECT id, category, message, data, created_at, read_at
     FROM customer_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    category: row.category,
    message: row.message,
    data: row.data,
    createdAt: row.created_at,
    read: Boolean(row.read_at),
  }));
}

export async function markAllCustomerNotificationsRead(userId) {
  await ensureCustomerNotificationsTable();
  await query(`UPDATE customer_notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
}

export async function clearCustomerNotifications(userId) {
  await ensureCustomerNotificationsTable();
  await query(`DELETE FROM customer_notifications WHERE user_id = $1`, [userId]);
}
