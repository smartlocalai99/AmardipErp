import nextEnv from "@next/env";
import { Pool } from "pg";
import { collectDatabaseCapacity, DEFAULT_DATABASE_BUDGET_BYTES } from "../lib/databaseCapacity.mjs";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured.");
const budget = process.env.DB_STORAGE_BUDGET_MB === undefined
  ? DEFAULT_DATABASE_BUDGET_BYTES
  : Number(process.env.DB_STORAGE_BUDGET_MB) * 1_000_000;
if (!Number.isFinite(budget) || budget <= 0) throw new Error("DB_STORAGE_BUDGET_MB must be positive.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false },
});
pool.on("error", (error) => console.error("Database connection closed:", error.code || "unknown"));
try {
  const report = await collectDatabaseCapacity(pool, budget);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Database: ${(report.storage.bytes / 1_000_000).toFixed(2)} MB / ${(budget / 1_000_000).toFixed(0)} MB budget (${report.storage.percent}%, ${report.storage.level})`);
    console.table(report.tables.map((row) => ({
      table: row.table_name,
      MB: (Number(row.total_bytes) / 1_000_000).toFixed(2),
      indexMB: (Number(row.index_bytes) / 1_000_000).toFixed(2),
      estimatedRows: row.estimated_rows,
      estimatedDeadRows: row.estimated_dead_rows,
    })));
    console.log("Connections:", report.connections);
    console.log("Potential duplicate indexes (review only):", report.duplicateIndexCandidates);
    console.log(report.note);
  }
  if (process.argv.includes("--check") && report.storage.level !== "ok") process.exitCode = 1;
} catch (error) {
  // Never print a connection string or database rows in error reports.
  console.error("Database capacity check failed:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
