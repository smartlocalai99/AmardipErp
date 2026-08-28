import assert from "node:assert/strict";
import {
  createCustomerMatcher,
  parseServiceHistoryRows,
  parseSheetDate,
} from "../lib/serviceHistorySync.mjs";

assert.equal(parseSheetDate("03/04/2021"), "2021-04-03");
assert.equal(parseSheetDate("3/4/21"), "2021-04-03");
assert.equal(parseSheetDate("2026-08-29"), "2026-08-29");
assert.equal(parseSheetDate("31/02/2026"), null);

const parsedRows = parseServiceHistoryRows([
  [
    "Timestamp",
    "SNO",
    "SERVICE DATE",
    "COUSTMER ID",
    "CUSTOMER NAME",
    "HOC DATE",
    "REMARKS",
    "SERVICE TYPE",
    "PAYMENT ",
    "TECHNICIAN 1",
    "TECHNICIAN 2",
  ],
  [
    "29/08/2026 10:15:00",
    "7",
    "29/08/2026",
    "26-01 AG5",
    "Sample Apartments",
    "01/01/2025",
    "Routine check completed",
    "Preventive Maintenance",
    "1,250",
    "Technician One",
    "Technician Two",
  ],
]);

assert.equal(parsedRows.length, 1);
assert.equal(parsedRows[0].source_row_no, 2);
assert.equal(parsedRows[0].service_date, "2026-08-29");
assert.equal(parsedRows[0].payment_amount, 1250);
assert.equal(parsedRows[0].customer_code, "26-01 AG5");

const customers = [
  {
    id: "customer-a",
    customer_code: "2601AG5",
    customer_name: "Sample Apartments",
    mobile_no: "9876543210",
    hoc_date: "2025-01-01",
  },
  {
    id: "customer-b",
    customer_code: "2602AG5",
    customer_name: "Second Apartments",
    mobile_no: "9123456780",
    hoc_date: "2025-02-01",
  },
];
const matcher = createCustomerMatcher({
  customers,
  aliases: [
    {
      customer_id: "customer-a",
      customer_code: "LEGACY-A",
      customer_name_snapshot: "Sample Apartments",
      mobile_no_snapshot: "9876543210",
      hoc_date_snapshot: "2025-01-01",
    },
  ],
});

assert.deepEqual(
  matcher({
    customer_code: "26-01 AG5",
    customer_name_snapshot: "Sample Apartments",
    mobile_no_snapshot: "98765 43210",
    hoc_date_snapshot: "2025-01-01",
  }),
  { customerId: "customer-a", reason: "customer_code" }
);

assert.deepEqual(
  matcher({
    customer_code: "UNKNOWN",
    customer_name_snapshot: "Second Apartments",
    mobile_no_snapshot: "9123456780",
    hoc_date_snapshot: "2025-02-01",
  }),
  { customerId: "customer-b", reason: "mobile" }
);

assert.deepEqual(
  matcher({
    customer_code: "LEGACY-A",
    customer_name_snapshot: "Sample Apartments",
    mobile_no_snapshot: "9123456780",
    hoc_date_snapshot: "2025-01-01",
  }),
  { customerId: null, reason: "conflict" }
);

console.log("service-history-sync tests passed");
