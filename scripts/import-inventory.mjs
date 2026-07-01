import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RAW_FILE = path.join(__dirname, "data", "inventory-raw.txt");

const KNOWN_UNITS = new Set(["Nos", "Meter", "Kg", "Set", "Roll", "Box", "Packet", "Litre", "Other"]);

export function normalizeUnit(unit) {
  const clean = String(unit || "").trim();
  if (!KNOWN_UNITS.has(clean)) return "Nos"; // covers "None" and any other stray label
  return clean;
}

const LINE_PATTERN = /^(.*?)\s*—\s*Stock:\s*-?\s*([\d,]+(?:\.\d+)?)\s+(\S+)\s*$/;

export function parseInventoryLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  const match = trimmed.match(LINE_PATTERN);
  if (!match) return null;

  const [, rawName, rawQuantity, rawUnit] = match;
  const name = rawName.trim();
  const stockQuantity = Number(rawQuantity.replace(/,/g, ""));
  if (!name || Number.isNaN(stockQuantity)) return null;

  return { name, unit: normalizeUnit(rawUnit), stockQuantity };
}

export function parseInventoryFile(text) {
  return String(text)
    .split(/\r?\n/)
    .map(parseInventoryLine)
    .filter(Boolean);
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
  if (!env) throw new Error("DATABASE_URL is missing");
  return env.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

async function upsertItems(pool, items) {
  const schemaSql = fs.readFileSync(path.join(__dirname, "..", "sql", "inventory_schema.sql"), "utf8");
  await pool.query(schemaSql);

  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const result = await pool.query(
      `
      INSERT INTO inventory_items (name, unit, stock_quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (name)
      DO UPDATE SET unit = EXCLUDED.unit, stock_quantity = EXCLUDED.stock_quantity, updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
      `,
      [item.name, item.unit, item.stockQuantity]
    );
    if (result.rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }

  return { inserted, updated };
}

async function main() {
  const rawFile = process.argv.find((arg) => arg.endsWith(".txt")) || DEFAULT_RAW_FILE;
  const dryRun = !process.argv.includes("--apply");
  const items = parseInventoryFile(fs.readFileSync(rawFile, "utf8"));

  console.log(`Parsed ${items.length} inventory items from ${rawFile}`);
  console.table(items.slice(0, 10));
  console.log(`${dryRun ? "Dry run" : "Apply"}: pass --apply to write to the database.`);

  if (dryRun) return;

  const pool = new Pool({ connectionString: loadDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  try {
    const result = await upsertItems(pool, items);
    console.log(`Inserted ${result.inserted}, updated ${result.updated}`);
  } finally {
    await pool.end();
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
