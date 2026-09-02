import assert from "node:assert/strict";
import test from "node:test";

const pdfModule = await import("../lib/customerWarrantyPdf.js");

test("generateWarrantyExpiryPdf returns a non-empty PDF containing customer dates", () => {
  assert.equal(typeof pdfModule.generateWarrantyExpiryPdf, "function");

  const pdf = pdfModule.generateWarrantyExpiryPdf({
    customerId: "customer-1",
    customerName: "Sample Residency",
    recipientLocation: "KADAPA",
    installationAddress: "Patel Road, Kadapa",
    liftDescription: "8 Passenger Lift",
    reference: "LIFT-101",
    hocDate: "29/08/2025",
    expiryDate: "29/08/2026",
  });

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.ok(pdf.length > 20_000);

  const rawPdf = pdf.toString("latin1");
  assert.equal((rawPdf.match(/29\/08\/2026/g) || []).length, 2);
  assert.match(rawPdf, /29\/08\/2025/);
  assert.match(rawPdf, /Sample Residency/);
  assert.match(rawPdf, /Maintenance Contract/);
  assert.match(rawPdf, /AMC/);
});
