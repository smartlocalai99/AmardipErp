// Re-issues a fresh PIN for each username below and prints the plaintext
// table — used once, right after reset-staff-accounts.mjs, because that
// script's first --apply run had its PIN table discarded by a `| tail`
// before it could be read back.
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const ADMIN_PIN = "1234";

const USERNAMES = {
  storekeeper: ["k_chiranjeevi", "iqbal"],
  admin: ["amarnath", "dileep"],
  worker: [
    "ranjith", "schandra", "kranti", "mahaboob",
    "mchandra", "charan", "praveen", "sekhar",
    "sameer", "afreen", "suresh", "nagaraju", "dhanush", "bhaskar",
    "vasu", "saradhi",
  ],
};

function randomPin() {
  return String(crypto.randomInt(1000, 10000));
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
  if (!env) throw new Error("DATABASE_URL is missing");
  return env.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

async function main() {
  const pool = new Pool({ connectionString: loadDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  const rows = [];
  try {
    for (const [role, usernames] of Object.entries(USERNAMES)) {
      for (const username of usernames) {
        const pin = role === "admin" ? ADMIN_PIN : randomPin();
        const passwordHash = await bcrypt.hash(pin, 10);
        const result = await pool.query(
          "UPDATE users SET password_hash = $1 WHERE username = $2 AND role = $3 RETURNING name, phone",
          [passwordHash, username, role]
        );
        if (result.rowCount !== 1) throw new Error(`Expected exactly one row for ${username} (${role}), got ${result.rowCount}`);
        rows.push({ name: result.rows[0].name, username, role, phone: result.rows[0].phone || "-", pin });
      }
    }
  } finally {
    await pool.end();
  }

  console.table(rows);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
