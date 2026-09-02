// One-off account reset: wipes the old storekeeper/worker/front_office
// accounts (keeping the "kethan" admin and the superadmin utility account)
// and creates the fresh store, admin, and worker roster below with 4-digit
// PIN logins. Run with --apply to actually write; without it, prints the
// plan only.
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const ADMIN_PIN = "1234";

const STORE_USERS = [
  { name: "K CHIRANJEEVI", phone: "9247932353" },
  { name: "IQBAL", phone: "9247932352" },
];

const ADMIN_USERS = [
  { name: "G AMARNATH REDDY", phone: "9063857857", username: "amarnath" },
  { name: "A V DILEEP REDDY", phone: "9553233700", username: "dileep" },
];

const WORKER_USERS = [
  { name: "RANJITH SINGH", phone: "8341181411", username: "ranjith" },
  { name: "S CHANDRA SEKHAR", phone: "7095080999", username: "schandra" },
  { name: "KRANTI", phone: "9052175410" },
  { name: "S MAHABOOB BASHA", phone: "9392879753", username: "mahaboob" },
  { name: "M CHANDRA SEKHAR YADAV", phone: "6300374661", username: "mchandra" },
  { name: "K VISHNU CHARAN", phone: "8074147571", username: "charan" },
  { name: "PRAVEEN", phone: "8125709458" },
  { name: "SEKHAR", phone: "9133546656" },
  { name: "SAMEER", phone: "9676364429" },
  { name: "AFREEN", phone: "9347480340" },
  { name: "SURESH", phone: "8144769665" },
  { name: "NAGARAJU", phone: "9160184354" },
  { name: "DHANUSH", phone: "9440235673" },
  { name: "BHASKAR", phone: "9398021087" },
  { name: "VASU", phone: "7780286365" },
  { name: "PARTHA SARADHI", phone: null, username: "saradhi" },
];

export function slugUsername(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function randomPin() {
  return String(crypto.randomInt(1000, 10000));
}

export function buildPlan() {
  return [
    ...STORE_USERS.map((person) => ({ ...person, role: "storekeeper", username: person.username || slugUsername(person.name), pin: randomPin() })),
    ...ADMIN_USERS.map((person) => ({ ...person, role: "admin", username: person.username || slugUsername(person.name), pin: ADMIN_PIN })),
    ...WORKER_USERS.map((person) => ({ ...person, role: "worker", username: person.username || slugUsername(person.name), pin: randomPin() })),
  ];
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
  if (!env) throw new Error("DATABASE_URL is missing");
  return env.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

async function applyPlan(pool, plan) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device VARCHAR(160)");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");

    // Delete the old roster first — the fresh names follow the same slug
    // convention, so several intentionally reuse the old usernames.
    const removed = await client.query(
      "DELETE FROM users WHERE role IN ('storekeeper', 'worker', 'front_office') RETURNING username"
    );

    const collision = await client.query(
      "SELECT username FROM users WHERE username = ANY($1)",
      [plan.map((person) => person.username)]
    );
    if (collision.rowCount > 0) {
      throw new Error(`Username collision against a kept account, aborting: ${collision.rows.map((r) => r.username).join(", ")}`);
    }

    let inserted = 0;
    for (const person of plan) {
      const passwordHash = await bcrypt.hash(person.pin, 10);
      await client.query(
        `INSERT INTO users (username, password_hash, name, role, phone, designation)
         VALUES ($1, $2, $3, $4, $5, NULL)`,
        [person.username, passwordHash, person.name, person.role, person.phone]
      );
      inserted += 1;
    }

    await client.query("COMMIT");
    return { removedCount: removed.rowCount, insertedCount: inserted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const plan = buildPlan();

  console.table(plan.map(({ name, username, role, phone, pin }) => ({ name, username, role, phone: phone || "-", pin })));
  console.log(`${dryRun ? "Dry run" : "Apply"}: ${plan.length} accounts. Old storekeeper/worker/front_office rows will be deleted; "kethan" and "superadmin" are kept.`);

  if (dryRun) return;

  const pool = new Pool({ connectionString: loadDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  try {
    const result = await applyPlan(pool, plan);
    console.log(`Removed ${result.removedCount} old rows. Inserted ${result.insertedCount} new accounts.`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
