// One-off backfill: the staff accounts created by reset-staff-accounts.mjs
// / regenerate-staff-pins.mjs predate the password_plain column (added so
// the superadmin's Staff Directory can show a PIN back without needing a
// reset first). Their real PINs are known from that session's output —
// bcrypt can't be reversed, so this is the only way to populate them now.
// Run with --apply to write; without it, prints the plan only.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";

const KNOWN_PINS = {
  k_chiranjeevi: "7718",
  iqbal: "9326",
  amarnath: "1234",
  dileep: "1234",
  ranjith: "8640",
  schandra: "4341",
  kranti: "7196",
  mahaboob: "2626",
  mchandra: "1447",
  charan: "1117",
  praveen: "3057",
  sekhar: "8436",
  sameer: "2168",
  afreen: "2617",
  suresh: "5256",
  nagaraju: "8647",
  dhanush: "7507",
  bhaskar: "2404",
  vasu: "4096",
  saradhi: "8913",
};

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
  if (!env) throw new Error("DATABASE_URL is missing");
  return env.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const entries = Object.entries(KNOWN_PINS);
  console.table(entries.map(([username, pin]) => ({ username, pin })));
  console.log(`${dryRun ? "Dry run" : "Apply"}: ${entries.length} accounts.`);

  if (dryRun) return;

  const pool = new Pool({ connectionString: loadDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(100)");
    let updated = 0;
    for (const [username, pin] of entries) {
      const result = await pool.query("UPDATE users SET password_plain = $1 WHERE username = $2", [pin, username]);
      updated += result.rowCount;
    }
    console.log(`Updated ${updated} of ${entries.length} accounts.`);
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
