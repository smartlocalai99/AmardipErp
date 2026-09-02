import assert from "node:assert/strict";
import test from "node:test";

const documentModule = await import("../lib/customerWarrantyLetter.js");

test("buildWarrantyExpiryLetterData reuses the handover mapping with expiryDate = hoc + 1 year", () => {
  const letter = documentModule.buildWarrantyExpiryLetterData({
    id: "customer-1",
    customer_code: "LIFT-101",
    customer_name: "Sample Residency",
    address: "Patel Road",
    city: "Kadapa",
    hoc_date: "29/08/2025",
    no_of_passenger: "8",
  });

  assert.equal(letter.customerName, "Sample Residency");
  assert.equal(letter.hocDate, "29/08/2025");
  assert.equal(letter.expiryDate, "29/08/2026");
});

test("records without a valid HOC produce no warranty letter or descriptor", () => {
  assert.equal(documentModule.buildWarrantyExpiryLetterData({ id: "missing" }), null);
  assert.equal(documentModule.buildWarrantyExpiryDescriptor({ id: "invalid", hoc_date: "31/09/2026" }), null);
});

test("descriptor names the warranty expiry notice per linked lift", () => {
  const descriptor = documentModule.buildWarrantyExpiryDescriptor({
    id: "customer-3",
    customer_code: "LIFT-303",
    customer_name: "Third Customer",
    elevator_type: "Goods Lift",
    hoc_date: "2025-08-29",
  });

  assert.deepEqual(descriptor, {
    id: "warranty-expiry-customer-3",
    customerId: "customer-3",
    name: "Warranty Expiry Notice - LIFT-303",
    category: "Warranty & Handover",
    type: "PDF",
    date: "29/08/2026",
    liftLabel: "Goods Lift",
    downloadName: "warranty-expiry-notice-LIFT-303.pdf",
  });
});
