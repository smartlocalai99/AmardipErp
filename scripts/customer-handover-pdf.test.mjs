import assert from "node:assert/strict";
import test from "node:test";

const pdfModule = await import("../lib/customerHandoverPdf.js").catch(() => ({}));

test("generateCustomerHandoverPdf returns a non-empty PDF containing customer dates", () => {
  assert.equal(typeof pdfModule.generateCustomerHandoverPdf, "function");

  const pdf = pdfModule.generateCustomerHandoverPdf({
    customerId: "customer-1",
    customerName: "Sample Residency",
    recipientLocation: "KADAPA",
    installationAddress: "Patel Road, Kadapa",
    liftDescription: "8 Passenger Lift",
    reference: "LIFT-101",
    hocDate: "29/08/2026",
    dueDate: "29/08/2027",
  });

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.ok(pdf.length > 20_000);

  const rawPdf = pdf.toString("latin1");
  assert.equal((rawPdf.match(/29\/08\/2026/g) || []).length, 3);
  assert.match(rawPdf, /29\/08\/2027/);
  assert.match(rawPdf, /Sample Residency/);
  assert.match(rawPdf, /specifications agreed with you/);
});
