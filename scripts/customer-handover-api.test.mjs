import assert from "node:assert/strict";
import test from "node:test";

const handlerModule = await import("../lib/customerHandoverHandler.js").catch(() => ({}));

function responseRecorder() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test("endpoint returns the linked customer's PDF with private no-store headers", async () => {
  assert.equal(typeof handlerModule.createCustomerHandoverHandler, "function");
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async (_sql, params) => ({ rows: params[0] === 44 && params[1] === "lift-1" ? [{
      id: "lift-1", customer_code: "LIFT-1", customer_name: "Linked Customer",
      address: "Main Road", city: "Kadapa", hoc_date: "2026-08-29",
      no_of_passenger: "8", elevator_type: null,
    }] : [] }),
    generatePdf: (letter) => Buffer.from(`PDF:${letter.customerName}:${letter.dueDate}`),
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.match(res.headers["Cache-Control"], /no-store/);
  assert.match(res.body.toString(), /Linked Customer:29\/08\/2027/);
});

test("endpoint does not reveal an unlinked customer record", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async () => ({ rows: [] }),
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "someone-elses-lift" } }, res);
  assert.equal(res.statusCode, 404);
});

test("endpoint rejects missing HOC before PDF generation", async () => {
  let generated = false;
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async () => ({ rows: [{ id: "lift-2", customer_name: "No HOC", hoc_date: null }] }),
    generatePdf: () => { generated = true; return Buffer.from("wrong"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-2" } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(generated, false);
});

test("endpoint requires authentication", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => null,
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 401);
});

test("endpoint allows only customer accounts", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 1, role: "admin" }),
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 403);
});

test("endpoint allows only GET requests", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 1, role: "customer" }),
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "POST", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 405);
});
