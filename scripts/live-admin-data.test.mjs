import assert from "node:assert/strict";
import test from "node:test";

const customerStatsModule = await import("../lib/customerStatsHandler.js").catch(() => ({}));

test("customer totals are queried again on every request", async () => {
  assert.equal(
    typeof customerStatsModule.createCustomerStatsHandler,
    "function",
    "createCustomerStatsHandler must provide an uncached stats endpoint",
  );

  const databaseRows = [
    { total_customers: 7, active_amc: 3 },
    { total_customers: 8, active_amc: 4 },
  ];
  let queryCount = 0;

  const handler = customerStatsModule.createCustomerStatsHandler({
    getUserFromRequest: async () => ({ id: 1, role: "admin" }),
    query: async () => ({ rows: [databaseRows[queryCount++]] }),
  });

  function createResponse() {
    return {
      headers: {},
      statusCode: null,
      payload: null,
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };
  }

  const firstResponse = createResponse();
  await handler({ method: "GET" }, firstResponse);

  const secondResponse = createResponse();
  await handler({ method: "GET" }, secondResponse);

  assert.equal(firstResponse.payload.stats.totalCustomers, 7);
  assert.equal(secondResponse.payload.stats.totalCustomers, 8);
  assert.equal(secondResponse.payload.stats.activeAmc, 4);
  assert.equal(queryCount, 2);
  assert.match(secondResponse.headers["Cache-Control"], /no-store/);
});
