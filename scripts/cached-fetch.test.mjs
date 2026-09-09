import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clearSessionCache, getSessionCache, makeUserCacheKey, setSessionCache } from "../lib/adminCache.js";

const source = (await readFile(new URL("../lib/cachedFetch.js", import.meta.url), "utf8"))
  .replace("@/lib/adminCache", new URL("../lib/adminCache.js", import.meta.url).href);
const { cachedGetJson } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

function mockBrowser(t) {
  const entries = Object.create(null);
  const storage = new Proxy(entries, {
    get(target, key) {
      if (key === "getItem") return (name) => target[name] ?? null;
      if (key === "setItem") return (name, value) => { target[name] = String(value); };
      if (key === "removeItem") return (name) => { delete target[name]; };
      return target[key];
    },
  });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: storage };
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
  return storage;
}

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test("live reads share simultaneous requests but fetch again after completion", async (t) => {
  mockBrowser(t);
  let calls = 0;
  let resolveFetch;
  t.mock.method(globalThis, "fetch", () => {
    calls += 1;
    return new Promise((resolve) => { resolveFetch = resolve; });
  });
  const options = { user: "live", ttlMs: 0 };
  const first = cachedGetJson("/live-counts", options);
  const second = cachedGetJson("/live-counts", options);
  assert.equal(calls, 1);
  resolveFetch(response({ stats: { total: 1 } }));
  assert.deepEqual(await first, await second);
  const third = cachedGetJson("/live-counts", options);
  assert.equal(calls, 2);
  resolveFetch(response({ stats: { total: 2 } }));
  assert.deepEqual(await third, { stats: { total: 2 } });
});

test("an older response cannot replace or detach an in-progress refresh", async (t) => {
  mockBrowser(t);
  const pending = [];
  t.mock.method(globalThis, "fetch", () => new Promise((resolve) => pending.push(resolve)));
  const options = { user: "refresh-race" };
  const first = cachedGetJson("/counts", options);
  const refreshed = cachedGetJson("/counts", { ...options, forceRefresh: true });
  pending[0](response({ total: 1 }));
  await first;
  const joining = cachedGetJson("/counts", options);
  pending[1](response({ total: 2 }));
  assert.deepEqual(await joining, { total: 2 });
  await refreshed;
  assert.equal(pending.length, 2);
  assert.deepEqual(await cachedGetJson("/counts", options), { total: 2, _fromCache: true });
});

test("late responses cannot overwrite a completed newer refresh", async (t) => {
  mockBrowser(t);
  const pending = [];
  t.mock.method(globalThis, "fetch", () => new Promise((resolve) => pending.push(resolve)));
  const options = { user: "completion-race" };
  const first = cachedGetJson("/counts", options);
  const refreshed = cachedGetJson("/counts", { ...options, forceRefresh: true });
  pending[1](response({ total: 2 }));
  await refreshed;
  pending[0](response({ total: 1 }));
  await first;
  assert.deepEqual(await cachedGetJson("/counts", options), { total: 2, _fromCache: true });
});

test("invalidation after a mutation retires earlier reads", async (t) => {
  mockBrowser(t);
  const pending = [];
  t.mock.method(globalThis, "fetch", () => new Promise((resolve) => pending.push(resolve)));
  const options = { user: "mutation" };
  const beforeMutation = cachedGetJson("/counts", options);
  clearSessionCache();
  const afterMutation = cachedGetJson("/counts", options);
  assert.equal(pending.length, 2);
  pending[0](response({ total: 1 }));
  await beforeMutation;
  pending[1](response({ total: 2 }));
  await afterMutation;
  assert.deepEqual(await cachedGetJson("/counts", options), { total: 2, _fromCache: true });
});

test("cancelled requests reject instead of returning old cached data", async (t) => {
  mockBrowser(t);
  setSessionCache(makeUserCacheKey("cancel", "/counts"), { total: 1 });
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("Cancelled", "AbortError"); });
  await assert.rejects(cachedGetJson("/counts", {
    user: "cancel", forceRefresh: true, fetchOptions: { signal: controller.signal },
  }), { name: "AbortError" });
});

test("expired cache remains available during a temporary network outage", async (t) => {
  const storage = mockBrowser(t);
  storage.setItem(makeUserCacheKey("offline", "/counts"), JSON.stringify({
    value: { total: 4 }, savedAt: Date.now() - 60_000,
  }));
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Network unavailable"); });
  const result = await cachedGetJson("/counts", { user: "offline", ttlMs: 1000 });
  assert.equal(result.total, 4);
  assert.equal(result._fromStaleCache, true);
});

test("authorization failures are never concealed by cached data", async (t) => {
  mockBrowser(t);
  setSessionCache(makeUserCacheKey("forbidden", "/counts"), { total: 4 });
  t.mock.method(globalThis, "fetch", async () => response({ message: "Forbidden" }, 403));
  await assert.rejects(cachedGetJson("/counts", { user: "forbidden", forceRefresh: true }), /Forbidden/);
});

test("cache entries are bounded and old data eventually expires", (t) => {
  const storage = mockBrowser(t);
  storage.setItem("unrelated", "keep me");
  for (let index = 0; index < 150; index += 1) {
    setSessionCache(makeUserCacheKey("bounded", `search-${index}`), { index });
  }
  assert.ok(Object.keys(storage).length < 151);
  assert.deepEqual(getSessionCache(makeUserCacheKey("bounded", "search-149"), 1000), { index: 149 });
  assert.equal(storage.getItem("unrelated"), "keep me");
  const oldKey = makeUserCacheKey("bounded", "old");
  storage.setItem(oldKey, JSON.stringify({ value: { index: -1 }, savedAt: Date.now() - 48 * 60 * 60 * 1000 }));
  assert.equal(getSessionCache(oldKey, 0), null);
});

test("blocked browser storage does not prevent live data fetching", async (t) => {
  mockBrowser(t);
  Object.defineProperty(globalThis.window, "localStorage", {
    get() { throw new DOMException("Blocked", "SecurityError"); },
  });
  t.mock.method(globalThis, "fetch", async () => response({ total: 5 }));
  assert.deepEqual(await cachedGetJson("/counts", { user: "blocked" }), { total: 5 });
});
