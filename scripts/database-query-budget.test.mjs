import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileFunction } from "node:vm";
import test from "node:test";

// Isolate only external imports; execute the actual module functions without
// loading application credentials or opening a connection to production.
async function loadModule(relativePath, dependencies, exports) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const body = source
    .replace(/^import .*;\r?\n/gm, "")
    .replace(/export default /g, "")
    .replace(/export (?=(?:async )?function|const|let)/g, "");
  return compileFunction(`${body}\nreturn { ${exports.join(", ")} };`, Object.keys(dependencies))(...Object.values(dependencies));
}

function responseRecorder() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("service statistics retain live values without separately scanning for every total", async () => {
  const statements = [];
  const { handler } = await loadModule("../pages/api/elevator-service-visits/stats.js", {
    getUserFromRequest: async () => ({ id: 1, role: "admin" }),
    ensureServiceSchedulesTable: async () => {},
    query: async (sql) => {
      statements.push(sql);
      return { rows: [{ total_service_visits: statements.length, linked_service_visits: 1, scheduled_upcoming_services: 2, to_be_scheduled_services: 3 }] };
    },
  }, ["handler"]);
  const first = responseRecorder();
  const second = responseRecorder();
  await handler({ method: "GET" }, first);
  await handler({ method: "GET" }, second);
  assert.equal(first.body.stats.totalServiceVisits, 1);
  assert.equal(second.body.stats.totalServiceVisits, 2);
  assert.equal(second.body.stats.upcomingServicesTotal, 5);
  assert.match(second.headers["Cache-Control"], /no-store/);
  assert.equal(statements.length, 2);
  assert.ok((statements[0].match(/FROM elevator_service_visits\b/g) || []).length <= 4,
    "visit totals should share one aggregate scan; distinct technicians and current-month lookup remain separate");
});

test("module availability fits two database round trips even with all modules installed", async () => {
  const calls = [];
  const { getModuleAvailability } = await loadModule("../lib/moduleAvailability.js", {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes("to_regclass")) {
        return { rows: Array.isArray(params[0])
          ? params[0].map((name) => ({ table_name: name, relation: name }))
          : [{ table_name: params[0] }] };
      }
      return { rows: [{ count: 7, customer_count: 7, amc_count: 2, service_visit_count: 4,
        schedule_count: 1, active_service_plan_customer_count: 3, inventory_count: 5,
        complaint_count: 6, technician_count: 2, quotation_count: 8 }] };
    },
  }, ["getModuleAvailability"]);
  const modules = await getModuleAvailability();
  assert.ok(calls.length <= 2, `expected at most 2 queries, received ${calls.length}`);
  assert.equal(modules.customers.count, 7);
  assert.equal(modules.amc.count, 2);
  assert.equal(modules.servicePlanner.count, 4);
  assert.equal(modules.reports.count, 11);
  assert.equal(modules.technicians.count, 2);
  assert.equal(modules.quotations.count, 8);
});

test("missing optional module tables never appear in the count query", async () => {
  const statements = [];
  const { getModuleAvailability } = await loadModule("../lib/moduleAvailability.js", {
    query: async (sql, params) => {
      statements.push(sql);
      if (sql.includes("to_regclass")) {
        return { rows: Array.isArray(params[0])
          ? params[0].map((name) => ({ table_name: name, relation: null }))
          : [{ table_name: null }] };
      }
      assert.doesNotMatch(sql, /FROM\s+"?(elevator_service_customers|elevator_service_visits|service_schedules|inventory_items|complaints|users|quotation_requests)\b/);
      return { rows: [{}] };
    },
  }, ["getModuleAvailability"]);
  const modules = await getModuleAvailability();
  assert.equal(modules.customers.enabled, false);
  assert.equal(modules.servicePlanner.count, 0);
  assert.equal(modules.technicians.enabled, false);
  assert.equal(modules.complaints.enabled, true);
  assert.ok(statements.length <= 2);
});

test("assignment replacement uses one atomic statement regardless of team size", async () => {
  const calls = [];
  const { ensureAssigneeTables, setComplaintAssignees } = await loadModule("../lib/assignees.js", {
    query: async (sql, params) => { calls.push({ sql, params }); return { rows: [], rowCount: 0 }; },
  }, ["ensureAssigneeTables", "setComplaintAssignees"]);
  await ensureAssigneeTables();
  calls.length = 0;
  assert.deepEqual(await setComplaintAssignees("complaint-1", [1, "2", 2, 3, 4, 5]), [1, 2, 3, 4, 5]);
  assert.equal(calls.length, 1, "bulk replacement should not send a delete plus one INSERT per technician");
  assert.deepEqual(calls[0].params, ["complaint-1", [1, 2, 3, 4, 5]]);
  assert.match(calls[0].sql, /NOT\s*\(user_id = ANY\(\$2::int\[\]\)\)/);
  assert.match(calls[0].sql, /NOT EXISTS/);
});

test("concurrent first assignment lookups share schema initialization", async () => {
  let queries = 0;
  const { ensureAssigneeTables } = await loadModule("../lib/assignees.js", {
    query: async () => { queries += 1; await Promise.resolve(); return { rows: [] }; },
  }, ["ensureAssigneeTables"]);
  await Promise.all([ensureAssigneeTables(), ensureAssigneeTables(), ensureAssigneeTables()]);
  assert.equal(queries, 1);
});

test("quotation statistics include permission without needing a quotation-list read", async () => {
  for (const [role, allowed] of [["admin", true], ["front_office", false]]) {
    const { handler } = await loadModule("../pages/api/quotations/stats.js", {
      getUserFromRequest: async () => ({ id: 1, role }),
      isBoqAdmin: async () => allowed,
      ensureQuotationTables: async () => {},
      query: async () => ({ rows: [{ total_quotations: 3, draft_quotations: 1 }] }),
      listOngoingProjectsFromSheet: async () => null,
    }, ["handler"]);
    const response = responseRecorder();
    await handler({ method: "GET" }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.canGenerate, allowed);
    assert.equal(response.body.totalQuotations, 3);
    if (!allowed) assert.equal(response.body.draftQuotations, undefined);
  }
});

test("optional index setup reuses existing indexes rather than allocating duplicate copies", async () => {
  const existing = new Map([
    ["elevator_service_customers:customer_status", "idx_elevator_customers_status"],
    ["elevator_service_customers:customer_code", "idx_elevator_customers_code"],
    ["elevator_service_customers:mobile_no", "idx_elevator_customers_mobile"],
    ["elevator_service_customers:record_no", "elevator_service_customers_record_no_key"],
    ["elevator_service_visits:customer_id", "idx_service_visits_customer_id"],
    ["elevator_service_visits:service_date", "idx_service_visits_service_date"],
    ["users:username", "users_username_key"],
  ]);
  const duplicates = [];
  const { handler } = await loadModule("../pages/api/admin/apply-indexes.js", {
    getUserFromRequest: async () => ({ id: 1, role: "superadmin" }),
    query: async (sql) => {
      const [, name, table, columns] = sql.match(/CREATE INDEX IF NOT EXISTS (\w+) ON (\w+) \(([^)]+)\)/);
      const key = `${table}:${columns.replace(/ (ASC|DESC)| NULLS (FIRST|LAST)/g, "")}`;
      if (existing.has(key) && existing.get(key) !== name) duplicates.push(name);
      return { rows: [] };
    },
  }, ["handler"]);
  const result = responseRecorder();
  await handler({ method: "GET" }, result);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(duplicates, [], "equivalent indexes already exist under the original schema names");
});
