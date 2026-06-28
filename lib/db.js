import { Pool } from "pg";

// Singleton pool — module is cached by Node.js, so this is reused across warm
// Vercel invocations.  max:1 is intentional: Neon's PgBouncer handles external
// connection pooling; 1 connection per serverless function prevents exhausting
// Neon's free-tier limit of 5 concurrent connections.
const globalPool = global._pgPool || (global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
}));

export async function query(text, params) {
    const start = Date.now();
    const res = await globalPool.query(text, params);
    const duration = Date.now() - start;
    // Only log slow queries in production to keep Vercel log volume low
    if (process.env.NODE_ENV !== "production" || duration > 200) {
        console.log(`[DB ${duration}ms rows=${res.rowCount}]`, text.trim().slice(0, 120));
    }
    return res;
}

export default globalPool;
