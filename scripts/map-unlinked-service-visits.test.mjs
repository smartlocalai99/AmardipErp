import assert from "node:assert/strict";
import {
  buildUpdatePlan,
  confirmedServiceVisitMappings,
} from "./map-unlinked-service-visits.mjs";

const mockGroups = confirmedServiceVisitMappings.map((mapping) => ({
  customer_code: mapping.source.customerCode,
  customer_name_snapshot: mapping.source.customerName,
  city_snapshot: mapping.source.city,
  mobile_no_snapshot: mapping.source.mobile,
  records: mapping.expected.records,
  first_date: mapping.expected.firstDate,
  last_date: mapping.expected.lastDate,
}));

const mockCustomers = confirmedServiceVisitMappings.map((mapping, index) => ({
  customer_code: mapping.targetCustomerCode,
  id: `customer-${index}`,
}));

const plan = buildUpdatePlan({
  groups: mockGroups,
  customers: mockCustomers,
});

assert.equal(confirmedServiceVisitMappings.length, 36);
assert.equal(plan.ready.length, 36);
assert.equal(plan.skipped.length, 0);
assert.equal(
  plan.ready.reduce((sum, item) => sum + item.mapping.expected.records, 0),
  66
);

const missingCustomerPlan = buildUpdatePlan({
  groups: mockGroups,
  customers: mockCustomers.filter((customer) => customer.customer_code !== "AMCP2"),
});

assert.equal(missingCustomerPlan.ready.length, 34);
assert.equal(missingCustomerPlan.skipped.length, 2);
assert.deepEqual(
  missingCustomerPlan.skipped.map((item) => item.mapping.reviewNo),
  [3, 27]
);

const changedGroupPlan = buildUpdatePlan({
  groups: mockGroups.map((group) =>
    group.customer_name_snapshot === "PULSE HOSPITAL"
      ? { ...group, records: 2 }
      : group
  ),
  customers: mockCustomers,
});

assert.equal(changedGroupPlan.ready.length, 35);
assert.equal(changedGroupPlan.skipped.length, 1);
assert.equal(changedGroupPlan.skipped[0].mapping.reviewNo, 23);

console.log("map-unlinked-service-visits tests passed");
