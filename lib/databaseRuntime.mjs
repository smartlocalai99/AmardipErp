import { AsyncLocalStorage } from "node:async_hooks";
import { watchDatabaseClient } from "./databaseConnection.mjs";

// Request-local context keeps existing helper queries on the checked-out
// transaction client without letting another request borrow that connection.
export function createDatabaseRuntime(pool) {
  const transactions = new AsyncLocalStorage();

  async function query(text, params) {
    const transaction = transactions.getStore();
    if (transaction && !transaction.active) {
      throw new Error("Database transaction already finished; await all database work.");
    }
    return transaction
      ? transaction.connection.run(() => transaction.client.query(text, params))
      : pool.query(text, params);
  }

  async function withTransaction(work) {
    if (transactions.getStore()) throw new Error("Nested transactions are not supported.");
    const client = await pool.connect();
    const connection = watchDatabaseClient(client);
    const transaction = { client, connection, active: true };
    let began = false;
    let releaseError;
    try {
      await connection.run(() => client.query("BEGIN"));
      began = true;
      // Transaction-local settings work with Neon's transaction pooler and
      // prevent abandoned requests from retaining locks indefinitely.
      await connection.run(() => client.query("SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '5s'; SET LOCAL idle_in_transaction_session_timeout = '10s'"));
      const result = await connection.run(() => transactions.run(transaction, work));
      transaction.active = false;
      await connection.run(() => client.query("COMMIT"));
      return result;
    } catch (error) {
      transaction.active = false;
      if (began) {
        try { await connection.run(() => client.query("ROLLBACK")); }
        catch (rollbackError) { releaseError = rollbackError; }
      } else {
        releaseError = error;
      }
      throw error;
    } finally {
      transaction.active = false;
      try { client.release(connection.error || releaseError); }
      finally { connection.close(); }
    }
  }

  return { query, withTransaction };
}
