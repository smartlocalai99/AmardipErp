import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

const { createDatabaseRuntime } = await import("../lib/databaseRuntime.mjs").catch(() => ({}));

function fixture({ rollbackFails = false, beginFails = false } = {}) {
  const events = [];
  let nextId = 0;
  const pool = {
    async query(sql) { events.push(["pool", sql]); return { rows: [] }; },
    async connect() {
      const id = ++nextId;
      return Object.assign(new EventEmitter(), {
        async query(sql) {
          events.push([id, sql]);
          if (sql === "ROLLBACK" && rollbackFails) throw new Error("rollback failed");
          if (sql === "BEGIN" && beginFails) throw new Error("begin failed");
          return { rows: [{ id }] };
        },
        release(error) { events.push([id, "release", Boolean(error)]); },
      });
    },
  };
  assert.equal(typeof createDatabaseRuntime, "function");
  return { db: createDatabaseRuntime(pool), events };
}

test("simultaneous transactions keep nested queries on their own checked-out client", async () => {
  const { db, events } = fixture();
  let continueFirst;
  const gate = new Promise((resolve) => { continueFirst = resolve; });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const first = db.withTransaction(async () => {
    await db.query("first start");
    started();
    await gate;
    return db.query("first end");
  });
  await ready;
  await db.query("outside transaction");
  await db.withTransaction(async () => db.query("second transaction"));
  continueFirst();
  assert.equal((await first).rows[0].id, 1);
  assert.deepEqual(events.filter((e) => !String(e[1]).startsWith("SET LOCAL")), [
    [1, "BEGIN"], [1, "first start"], ["pool", "outside transaction"],
    [2, "BEGIN"], [2, "second transaction"], [2, "COMMIT"], [2, "release", false],
    [1, "first end"], [1, "COMMIT"], [1, "release", false],
  ]);
});

test("failure rolls back and releases exactly once, preserving the original error", async () => {
  for (const rollbackFails of [false, true]) {
    const { db, events } = fixture({ rollbackFails });
    const original = new Error("write failed");
    await assert.rejects(db.withTransaction(async () => { throw original; }), (error) => error === original);
    assert.equal(events.filter((e) => e[1] === "ROLLBACK").length, 1);
    assert.deepEqual(events.at(-1), [1, "release", rollbackFails]);
    assert.equal(events.some((e) => e[1] === "COMMIT"), false);
  }
});

test("BEGIN failure releases a broken client and nested transactions fail without deadlocking", async () => {
  const failed = fixture({ beginFails: true });
  await assert.rejects(failed.db.withTransaction(async () => {}), /begin failed/);
  assert.deepEqual(failed.events.at(-1), [1, "release", true]);
  const { db } = fixture();
  await assert.rejects(db.withTransaction(() => db.withTransaction(async () => {})), /Nested transactions/);
});

test("work that outlives its transaction cannot use the released connection", async () => {
  const { db } = fixture();
  let lateQuery;
  let resume;
  const gate = new Promise((resolve) => { resume = resolve; });
  await db.withTransaction(async () => {
    lateQuery = gate.then(() => db.query("late write"));
  });
  resume();
  await assert.rejects(lateQuery, /already finished/);
});

test("a checked-out socket error rejects idle work, discards the client, and removes its listener", async () => {
  const client = new EventEmitter();
  const connectionError = new Error("socket closed");
  let releaseError;
  client.query = async () => ({ rows: [] });
  client.release = (error) => { releaseError = error; };
  const db = createDatabaseRuntime({ connect: async () => client });
  const result = db.withTransaction(async () => {
    // PostgreSQL can emit this between queries (including idle transaction timeout).
    setImmediate(() => client.emit("error", connectionError));
    await new Promise(() => {});
  });
  await assert.rejects(result, (error) => error === connectionError);
  assert.equal(releaseError, connectionError);
  assert.equal(client.listenerCount("error"), 0);
});
