import assert from "node:assert/strict";
import test from "node:test";

const handlerModule = await import("../lib/customerWarrantyHandler.js");

function responseRecorder() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test("endpoint returns the PDF once a warranty notice exists for that customer", async () => {
  assert.equal(typeof handlerModule.createWarrantyExpiryHandler, "function");
  const handler = handlerModule.createWarrantyExpiryHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async (_sql, params) => ({ rows: params[0] === 44 && params[1] === "lift-1" ? [{
      id: "lift-1", customer_code: "LIFT-1", customer_name: "Linked Customer",
      address: "Main Road", city: "Kadapa", hoc_date: "2025-08-29", amc_amount: "12000",
      hoc_date_text: "30/08/2025", warranty_due_date_text: "30/08/2026",
    }] : [] }),
    generatePdf: (letter) => Buffer.from(`PDF:${letter.customerName}:${letter.hocDate}:${letter.expiryDate}:${letter.amcAmount}`),
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  // Dates come from the stored sheet-sourced text (30/08), not the DB
  // hoc_date used only for eligibility (29/08).
  assert.match(res.body.toString(), /Linked Customer:30\/08\/2025:30\/08\/2026:12000/);
});

test("endpoint 404s when no warranty notice has been sent yet (join excludes the row)", async () => {
  const handler = handlerModule.createWarrantyExpiryHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async () => ({ rows: [] }),
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-2" } }, res);
  assert.equal(res.statusCode, 404);
});

test("endpoint requires authentication", async () => {
  const handler = handlerModule.createWarrantyExpiryHandler({
    getUserFromRequest: async () => null,
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 401);
});

test("endpoint allows only GET requests", async () => {
  const handler = handlerModule.createWarrantyExpiryHandler({
    getUserFromRequest: async () => ({ id: 1, role: "customer" }),
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "POST", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 405);
});
