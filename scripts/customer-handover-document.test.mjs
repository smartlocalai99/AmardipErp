import assert from "node:assert/strict";
import test from "node:test";

const documentModule = await import("../lib/customerHandoverDocument.js").catch(() => ({}));

test("buildHandoverLetterData maps customer data and adds exactly one calendar year", () => {
  assert.equal(typeof documentModule.buildHandoverLetterData, "function");
  const letter = documentModule.buildHandoverLetterData({ id: "customer-1", customer_code: "LIFT-101", customer_name: "Sample Residency", address: "Patel Road", city: "Kadapa", hoc_date: "29/08/2026", no_of_passenger: "8" });
  assert.deepEqual(letter, { customerId: "customer-1", customerName: "Sample Residency", recipientLocation: "KADAPA", installationAddress: "Patel Road, Kadapa", liftDescription: "8 Passenger Lift", reference: "LIFT-101", hocDate: "29/08/2026", dueDate: "29/08/2027" });
});

test("29 February anniversary uses 28 February in a non-leap year", () => {
  const letter = documentModule.buildHandoverLetterData({ id: "customer-2", customer_name: "Leap Day Customer", hoc_date: "29/02/2028" });
  assert.equal(letter.dueDate, "28/02/2029");
});

test("records without a valid HOC produce no letter or document descriptor", () => {
  assert.equal(documentModule.buildHandoverLetterData({ id: "missing" }), null);
  assert.equal(documentModule.buildHandoverDocumentDescriptor({ id: "invalid", hoc_date: "31/09/2026" }), null);
});

test("descriptor distinguishes one handing-over letter per linked lift", () => {
  const descriptor = documentModule.buildHandoverDocumentDescriptor({ id: "customer-3", customer_code: "LIFT-303", customer_name: "Third Customer", elevator_type: "Goods Lift", hoc_date: "2026-08-29" });
  assert.deepEqual(descriptor, { id: "handover-customer-3", customerId: "customer-3", name: "Handing Over Letter - LIFT-303", category: "Warranty & Handover", type: "PDF", date: "29/08/2026", liftLabel: "Goods Lift", downloadName: "handing-over-letter-LIFT-303.pdf" });
});
