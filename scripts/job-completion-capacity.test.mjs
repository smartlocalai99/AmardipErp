import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Execute the actual API handler with its I/O boundaries stubbed. Both
// requests see the original open job, as happens with a double submit.
test("a repeated concurrent completion cannot write another completion, visit or notification", async () => {
  let claimed = false;
  let completionInserts = 0;
  let visitInserts = 0;
  let notifications = 0;
  const events = [];
  globalThis.__completionTest = {
    getUserFromRequest: async () => ({ id: 3, role: "worker", name: "Worker" }),
    query: async (sql) => {
      events.push(sql);
      if (sql.includes("FROM complaints co")) return { rows: [{ id: "job", assigned_technician_user_id: 3, status: "ASSIGNED", customer_user_id: 8, customer_id: "customer" }] };
      if (sql.includes("SELECT id FROM service_schedules")) return { rows: [{ id: "schedule" }] };
      if (sql.includes("UPDATE complaints")) {
        const guarded = sql.includes("RETURNING") && sql.includes("NOT IN");
        const accepted = !guarded || !claimed;
        claimed = true;
        return { rowCount: accepted ? 1 : 0, rows: accepted ? [{ id: "job" }] : [] };
      }
      if (sql.includes("INSERT INTO technician_job_completions")) completionInserts++;
      if (sql.includes("INSERT INTO elevator_service_visits")) {
        visitInserts++;
        return { rows: [{ id: "visit" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    withTransaction: async (work) => work(),
    safeSendPush: async () => {},
    createCustomerNotification: async () => { notifications++; },
    getComplaintAssignees: async () => [],
    ensureAssigneeTables: async () => {},
    reverseGeocode: async () => null,
    appendServiceCompletionToSheet: async () => {},
  };
  const source = (await readFile(new URL("../pages/api/worker/complete-job.js", import.meta.url), "utf8"))
    .replace(/^import \{([^}]+)\} from [^;]+;$/gm, "const {$1} = globalThis.__completionTest;");
  const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  const first = response();
  const second = response();
  await Promise.all([
    handler({ method: "POST", body: { jobDbId: "job" } }, first),
    handler({ method: "POST", body: { jobDbId: "job" } }, second),
  ]);
  delete globalThis.__completionTest;
  assert.equal(first.code, 200);
  assert.equal(second.code, 409);
  assert.equal(completionInserts, 1);
  assert.equal(visitInserts, 1);
  assert.equal(notifications, 1);
  assert.ok(events.findIndex((sql) => sql.includes("UPDATE complaints")) < events.findIndex((sql) => sql.includes("INSERT INTO technician_job_completions")));
});
