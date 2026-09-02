import { query } from "./db.js";

let customerAccountSchemaReady = false;

export async function ensureUsersDesignationColumn() {
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)");
}

export async function ensureUserLoginDeviceColumns() {
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device VARCHAR(160);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  `);
}

// Staff PINs are short and shown back to the superadmin in the DB Users
// Directory on request, so alongside the bcrypt hash used for real
// authentication, the plaintext is kept here purely for that display.
export async function ensureUserPasswordPlainColumn() {
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(100)");
}

export async function ensureCustomerAccountSchema() {
  if (customerAccountSchemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS customer_user_links (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES elevator_service_customers(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, customer_id)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_user_links_customer
      ON customer_user_links(customer_id);
  `);

  customerAccountSchemaReady = true;
}
