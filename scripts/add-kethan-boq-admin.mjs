import fs from "node:fs";
import { Pool } from "pg";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is missing");
  return line.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

const pool = new Pool({
  connectionString: loadDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query(`
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
  `);

  const userResult = await pool.query("SELECT id, username, role FROM users WHERE username = 'kethan' LIMIT 1");
  const user = userResult.rows[0];
  if (!user) {
    console.log("kethan user not found.");
    return;
  }
  if (!["admin", "manager", "superadmin"].includes(user.role)) {
    console.log("kethan is not an admin, manager, or superadmin user.");
    return;
  }

  const existing = await pool.query("SELECT 1 FROM quotation_admin_permissions WHERE user_id = $1 LIMIT 1", [user.id]);
  if (existing.rowCount > 0) {
    console.log("kethan is already a BOQ admin.");
    return;
  }

  const count = await pool.query("SELECT COUNT(*)::int AS count FROM quotation_admin_permissions");
  if (count.rows[0].count >= 6) {
    console.log("Maximum 6 BOQ admins reached. Remove one BOQ admin before adding kethan.");
    return;
  }

  await pool.query(
    `
    INSERT INTO quotation_admin_permissions (user_id, username, role, can_generate_boq, can_edit_boq)
    VALUES ($1, $2, $3, true, true)
    `,
    [user.id, user.username, user.role]
  );
  console.log("kethan added as BOQ admin.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
