import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Replace only network/auth boundaries. The production initializers and API
// handler still execute, and no test can open a connection to the live database.
const dbUrl = "test:database-lifecycle-db";
const authUrl = "test:database-lifecycle-auth";
const complaintsUrl = "test:database-lifecycle-complaints";
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/db" || specifier === "./db.js") {
      return { url: dbUrl, shortCircuit: true };
    }
    if (specifier === "@/lib/auth") return { url: authUrl, shortCircuit: true };
    if (specifier === "./complaints.js") return { url: complaintsUrl, shortCircuit: true };
    if (specifier === "@/lib/pushNotifications") {
      return { url: new URL("../lib/pushNotifications.js", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === dbUrl) return {
      format: "module", shortCircuit: true,
      source: "export const query = (...args) => globalThis.__lifecycleQuery(...args); export const withTransaction = (fn) => fn();",
    };
    if (url === authUrl) return {
      format: "module", shortCircuit: true,
      source: "export const getUserFromRequest = async () => ({ id: 42, role: 'worker' });",
    };
    if (url === complaintsUrl) return {
      format: "module", shortCircuit: true,
      source: "export const ensureComplaintsTable = async () => {};",
    };
    return nextLoad(url, context);
  },
});

test.after(() => {
  hooks.deregister();
  delete globalThis.__lifecycleQuery;
});

for (const [file, ensureName] of [
  ["passkeys.js", "ensurePasskeyTables"],
  ["pushNotifications.js", "ensurePushSubscriptionsTable"],
  ["customerNotifications.js", "ensureCustomerNotificationsTable"],
  ["auditLog.js", "ensureAuditLogTable"],
  ["warrantyExpiry.js", "ensureWarrantyExpiryNoticesSchema"],
]) {
  test(`${ensureName} shares initialization across concurrent and subsequent requests`, async () => {
    const queries = [];
    let release;
    const blocked = new Promise((resolve) => { release = resolve; });
    globalThis.__lifecycleQuery = async (sql) => {
      queries.push(sql);
      await blocked;
      return { rows: [], rowCount: 0 };
    };
    const mod = await import(`../lib/${file}?concurrent`);
    const pending = [mod[ensureName](), mod[ensureName](), mod[ensureName]()];
    await Promise.resolve();
    const startedWhileBlocked = queries.length;
    release();
    await Promise.all(pending);
    assert.equal(startedWhileBlocked, 1, "concurrent requests must share the same database setup");
    const initializedCount = queries.length;
    await mod[ensureName]();
    assert.equal(queries.length, initializedCount, "warm requests must not repeat schema writes");
  });

  test(`${ensureName} retries after a database setup failure`, async () => {
    let fail = true;
    let queries = 0;
    globalThis.__lifecycleQuery = async () => {
      queries += 1;
      if (fail) throw new Error("database unavailable");
      return { rows: [], rowCount: 0 };
    };
    const mod = await import(`../lib/${file}?retry`);
    await assert.rejects(mod[ensureName](), /database unavailable/);
    fail = false;
    await mod[ensureName]();
    assert.ok(queries > 1, "a failed initializer must not permanently poison the process");
  });
}

test("subscription registration asks PostgreSQL to skip unchanged device ownership and keys", async () => {
  const queries = [];
  globalThis.__lifecycleQuery = async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [], rowCount: 0 };
  };
  const { default: handler } = await import("../pages/api/push/subscribe.js");
  const res = {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ method: "POST", body: { subscription: {
    endpoint: "https://push.example/device", keys: { p256dh: "public", auth: "secret" },
  } } }, res);
  const upsert = queries.find(({ sql }) => /INSERT INTO push_subscriptions/.test(sql));
  assert.deepEqual(upsert.params, [42, "https://push.example/device", "public", "secret"]);
  assert.match(upsert.sql, /WHERE\s+\(push_subscriptions\.user_id,\s*push_subscriptions\.p256dh,\s*push_subscriptions\.auth\)\s+IS DISTINCT FROM\s+\(EXCLUDED\.user_id,\s*EXCLUDED\.p256dh,\s*EXCLUDED\.auth\)/);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true, "a skipped no-op update is still successful registration");
});

for (const supportsUsed of [true, false]) {
  test(`inventory initialization ${supportsUsed ? "preserves an already current" : "upgrades a legacy"} transaction constraint`, async () => {
    const queries = [];
    globalThis.__lifecycleQuery = async (sql) => {
      queries.push(sql);
      return { rows: [{ supports_used: supportsUsed }], rowCount: 1 };
    };
    const { ensureInventoryTables } = await import(`../lib/inventory.js?used=${supportsUsed}`);
    await ensureInventoryTables();
    const alters = queries.filter((sql) => /ALTER TABLE inventory_transactions/.test(sql));
    assert.equal(alters.length, supportsUsed ? 0 : 1);
    const initializedCount = queries.length;
    await ensureInventoryTables();
    assert.equal(queries.length, initializedCount);
  });
}
