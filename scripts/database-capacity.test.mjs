import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

const { capacityStatus, collectDatabaseCapacity } = await import("../lib/databaseCapacity.mjs").catch(() => ({}));

test("capacity warns at 70%, becomes critical at 85%, and never treats invalid metrics as healthy", () => {
  assert.equal(typeof capacityStatus, "function");
  assert.equal(capacityStatus(32_000_000, 500_000_000).level, "ok");
  assert.equal(capacityStatus(350_000_000, 500_000_000).level, "warning");
  assert.equal(capacityStatus(425_000_000, 500_000_000).level, "critical");
  assert.equal(capacityStatus(600_000_000, 500_000_000).percent, 120);
  for (const value of [NaN, -1, undefined, null, "", "32"]) assert.throws(() => capacityStatus(value, 500_000_000));
  for (const limit of [NaN, 0, -1]) assert.throws(() => capacityStatus(10, limit));
});

test("capacity inspection uses read-only metadata and releases the connection on failure", async () => {
  assert.equal(typeof collectDatabaseCapacity, "function");
  const calls = [];
  let released = false;
  const client = Object.assign(new EventEmitter(), {
    query: async (sql) => {
      calls.push(sql);
      if (sql.includes("pg_database_size")) throw new Error("inspection failed");
      return { rows: [] };
    },
    release: () => { released = true; },
  });
  await assert.rejects(collectDatabaseCapacity({ connect: async () => client }), /inspection failed/);
  assert.equal(calls[0], "BEGIN READ ONLY");
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(released, true);
});

test("capacity inspection consumes socket errors and discards the broken client", async () => {
  const client = new EventEmitter();
  const error = new Error("socket closed");
  let releaseError;
  client.query = async (sql) => {
    if (sql.includes("pg_database_size")) {
      client.emit("error", error);
      return new Promise(() => {});
    }
    return { rows: [] };
  };
  client.release = (failure) => { releaseError = failure; };
  await assert.rejects(collectDatabaseCapacity({ connect: async () => client }), (failure) => failure === error);
  assert.equal(releaseError, error);
  assert.equal(client.listenerCount("error"), 0);
});
