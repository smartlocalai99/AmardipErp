import { Pool } from "pg";
import { createDatabaseRuntime } from "./databaseRuntime.mjs";

// Singleton pool — module is cached by Node.js, so this is reused across warm
// Vercel invocations. max:1 keeps each instance's DB concurrency small;
// Neon's PgBouncer handles pooling across instances. This is an application
// budget, not a provider connection limit.
const globalPool = global._pgPool || (global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
}));

if (!globalPool.listenerCount("error")) {
    // Idle sockets can close when the database suspends; pg discards them.
    // Handle the event so an idle connection error cannot crash the process.
    globalPool.on("error", (error) => console.error("[DB idle connection]", error.code || "connection closed"));
}

const runtime = global._dbRuntime || (global._dbRuntime = createDatabaseRuntime(globalPool));
export const withTransaction = runtime.withTransaction;

export async function query(text, params) {
    const start = Date.now();
    const res = await runtime.query(text, params);
    const duration = Date.now() - start;
    // Only log slow queries in production to keep Vercel log volume low
    if (process.env.NODE_ENV !== "production" || duration > 200) {
        console.log(`[DB ${duration}ms rows=${res.rowCount}]`, text.trim().slice(0, 120));
    }
    return res;
}

export default globalPool;
