import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { syncServiceHistory } = await import("../lib/serviceHistorySync.mjs");
const apply = process.argv.includes("--apply");

try {
  const result = await syncServiceHistory({ apply });
  console.log(JSON.stringify(result, null, 2));
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write these rows.");
  }
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  const { default: pool } = await import("../lib/db.js");
  await pool.end();
}
