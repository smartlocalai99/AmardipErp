import assert from "node:assert/strict";
import test from "node:test";

const documentsModule = await import("../lib/customerDocuments.js");

test("buildCustomerDocuments includes the handing-over letter but omits the warranty-expiry notice by default", () => {
  const docs = documentsModule.buildCustomerDocuments({
    id: "1", customer_code: "LIFT-A", customer_name: "Alpha", hoc_date: "2025-08-29", elevator_type: "Passenger Lift",
  });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].documentType, "handing-over");
});

test("buildCustomerDocuments adds the warranty-expiry notice once warranty_notice_sent is true", () => {
  const docs = documentsModule.buildCustomerDocuments({
    id: "1", customer_code: "LIFT-A", customer_name: "Alpha", hoc_date: "2025-08-29", elevator_type: "Passenger Lift",
    warranty_notice_sent: true,
  });
  assert.equal(docs.length, 2);
  assert.deepEqual(docs.map((d) => d.documentType), ["handing-over", "warranty-expiry"]);
});

test("filterCustomerDocuments omits invalid-HOC records and searches across both document kinds", () => {
  const customers = [
    { id: "1", customer_code: "LIFT-A", customer_name: "Alpha", hoc_date: "2025-08-29", elevator_type: "Passenger Lift", warranty_notice_sent: true },
    { id: "2", customer_code: "LIFT-B", customer_name: "Beta", hoc_date: null, elevator_type: "Goods Lift" },
  ];

  const all = documentsModule.filterCustomerDocuments(customers, "");
  assert.equal(all.length, 2);

  const warrantyOnly = documentsModule.filterCustomerDocuments(customers, "expiry");
  assert.deepEqual(warrantyOnly.map((d) => d.documentType), ["warranty-expiry"]);
});
