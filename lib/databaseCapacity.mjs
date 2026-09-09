import { watchDatabaseClient } from "./databaseConnection.mjs";

export const DEFAULT_DATABASE_BUDGET_BYTES = 500_000_000;

export function capacityStatus(bytes, budgetBytes = DEFAULT_DATABASE_BUDGET_BYTES) {
  if (!Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(budgetBytes) || budgetBytes <= 0) {
    throw new Error("Database bytes and a positive storage budget must be valid numbers.");
  }
  const ratio = bytes / budgetBytes;
  return {
    level: ratio >= 0.85 ? "critical" : ratio >= 0.7 ? "warning" : "ok",
    bytes,
    budgetBytes,
    percent: Math.round(ratio * 1000) / 10,
  };
}

// Metadata only: no customer records, full table counts, schema writes or cleanup.
export async function collectDatabaseCapacity(pool, budgetBytes = DEFAULT_DATABASE_BUDGET_BYTES) {
  const client = await pool.connect();
  const connection = watchDatabaseClient(client);
  const query = (sql) => connection.run(() => client.query(sql));
  let releaseError;
  try {
    await query("BEGIN READ ONLY");
    await query("SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '2s'");
    const database = await query("SELECT pg_database_size(current_database())::text AS bytes");
    const tables = await query(`
      SELECT schemaname AS schema, relname AS table_name,
        n_live_tup::text AS estimated_rows, n_dead_tup::text AS estimated_dead_rows,
        pg_total_relation_size(relid)::text AS total_bytes,
        pg_indexes_size(relid)::text AS index_bytes,
        n_tup_ins::text AS inserted_since_stats_reset,
        n_tup_upd::text AS updated_since_stats_reset,
        last_autovacuum, last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC LIMIT 20
    `);
    const connections = await query(`
      SELECT COALESCE(state, 'unknown') AS state, COUNT(*)::int AS count
      FROM pg_stat_activity WHERE datname = current_database() GROUP BY state
    `);
    const duplicateIndexes = await query(`
      SELECT a.indrelid::regclass::text AS table_name,
        a.indexrelid::regclass::text AS candidate_index,
        b.indexrelid::regclass::text AS covering_index,
        pg_relation_size(a.indexrelid)::text AS candidate_bytes
      FROM pg_index a JOIN pg_index b ON a.indrelid = b.indrelid
        AND a.indexrelid <> b.indexrelid
        AND a.indkey = b.indkey AND a.indclass = b.indclass
        AND a.indcollation = b.indcollation AND a.indoption = b.indoption
        AND a.indnkeyatts = b.indnkeyatts AND a.indnatts = b.indnatts
        AND COALESCE(a.indexprs::text, '') = COALESCE(b.indexprs::text, '')
        AND COALESCE(a.indpred::text, '') = COALESCE(b.indpred::text, '')
      JOIN pg_class t ON t.oid = a.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND a.indisvalid AND b.indisvalid
        AND NOT a.indisprimary AND NOT a.indisreplident
        AND (NOT a.indisunique OR b.indisunique)
        AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = a.indexrelid)
        AND (a.indexrelid > b.indexrelid OR EXISTS (
          SELECT 1 FROM pg_constraint c WHERE c.conindid = b.indexrelid
        ))
      ORDER BY pg_relation_size(a.indexrelid) DESC LIMIT 20
    `);
    return {
      checkedAt: new Date().toISOString(),
      storage: capacityStatus(Number(database.rows[0].bytes), budgetBytes),
      tables: tables.rows,
      connections: connections.rows,
      duplicateIndexCandidates: duplicateIndexes.rows,
      note: "Current database size only. Check Neon Console for project storage across branches, monthly CU-hours and network transfer. Table counts are estimates. No data was changed.",
    };
  } finally {
    try { await query("ROLLBACK"); }
    catch (error) { releaseError = error; }
    try { client.release(connection.error || releaseError); }
    finally { connection.close(); }
  }
}
