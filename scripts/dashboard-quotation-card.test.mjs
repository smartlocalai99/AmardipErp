import assert from "node:assert/strict";
import { getQuotationDashboardCard } from "../lib/quotationDashboard.js";

assert.deepEqual(getQuotationDashboardCard({ role: "superadmin" }, true), {
  visible: true,
  buttonText: "Create Quotation",
  secondaryText: "BOQ pricing enabled",
});

assert.deepEqual(getQuotationDashboardCard({ role: "admin" }, true), {
  visible: true,
  buttonText: "Create Quotation",
  secondaryText: "BOQ pricing enabled",
});

assert.deepEqual(getQuotationDashboardCard({ role: "front_office" }, false), {
  visible: true,
  buttonText: "View Quotations",
  secondaryText: "Generated quotations only",
});

assert.equal(getQuotationDashboardCard({ role: "worker" }, false).visible, false);
assert.equal(getQuotationDashboardCard({ role: "customer" }, false).visible, false);
assert.equal(getQuotationDashboardCard({ role: "storekeeper" }, false).visible, false);

console.log("dashboard quotation card tests passed");
