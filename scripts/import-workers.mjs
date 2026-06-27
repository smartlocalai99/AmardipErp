import childProcess from "node:child_process";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const DEFAULT_WORKBOOK = "/Users/vardhanreddy/Downloads/AMARDIP WORKERS (1).xlsx";
const TEMP_PASSWORD = "worker123";

export function normalizeRole(designation) {
  return String(designation || "").trim().toUpperCase() === "FRONT OFFICE" ? "front_office" : "worker";
}

export function slugUsername(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildWorkerUsers(rows) {
  return rows
    .filter((row) => row.name && row.designation)
    .map((row) => ({
      username: slugUsername(row.name),
      name: row.name.trim().toUpperCase(),
      role: normalizeRole(row.designation),
      phone: null,
      designation: row.designation.trim().toUpperCase(),
    }));
}

function unzipText(workbookPath, filePath) {
  return childProcess.execFileSync("unzip", ["-p", workbookPath, filePath], { encoding: "utf8" });
}

function xmlText(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function extractSharedStrings(workbookPath) {
  const xml = unzipText(workbookPath, "xl/sharedStrings.xml");
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    return xmlText([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]).join(""));
  });
}

export function readWorkerWorkbook(workbookPath = DEFAULT_WORKBOOK) {
  const sharedStrings = extractSharedStrings(workbookPath);
  const sheetXml = unzipText(workbookPath, "xl/worksheets/sheet1.xml");
  const rows = [];

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = {};
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      const value = type === "s" ? sharedStrings[Number(raw)] || "" : raw;
      if (ref) row[ref] = value;
    }
    rows.push(row);
  }

  return rows.slice(1).map((row) => ({
    serialNo: row.A ? Number(row.A) : null,
    name: row.B || "",
    designation: row.C || "",
  }));
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const env = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
  if (!env) throw new Error("DATABASE_URL is missing");
  return env.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

async function upsertUsers(pool, users) {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)");

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  let inserted = 0;
  let updated = 0;

  for (const user of users) {
    const result = await pool.query(
      `
      INSERT INTO users (username, password_hash, name, role, phone, designation)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username)
      DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone = COALESCE(EXCLUDED.phone, users.phone),
        designation = EXCLUDED.designation
      RETURNING (xmax = 0) AS inserted
      `,
      [user.username, passwordHash, user.name, user.role, user.phone, user.designation]
    );

    if (result.rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }

  return { inserted, updated };
}

async function main() {
  const workbookPath = process.argv.find((arg) => arg.endsWith(".xlsx")) || DEFAULT_WORKBOOK;
  const dryRun = !process.argv.includes("--apply");
  const users = buildWorkerUsers(readWorkerWorkbook(workbookPath));

  console.table(users);
  console.log(`${dryRun ? "Dry run" : "Apply"} plan: ${users.length} users, password for new users: ${TEMP_PASSWORD}`);

  if (dryRun) return;

  const pool = new Pool({
    connectionString: loadDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await upsertUsers(pool, users);
    console.log(`Inserted ${result.inserted}, updated ${result.updated}`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
