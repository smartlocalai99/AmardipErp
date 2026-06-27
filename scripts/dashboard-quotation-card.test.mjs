import assert from "node:assert/strict";
import { getQuotationDashboardCard } from "../lib/quotationDashboard.js";

assert.deepEqual(getQuotationDashboardCard({ role: "superadmin" }, true), {
  visible: true,
  title: "Create Lift Quotation",
  subtitle: "Prepare BOQ pricing and share quotation to customer on WhatsApp.",
  buttonText: "Create Quotation",
  secondaryText: "BOQ pricing enabled",
  pills: ["BOQ Enabled", "WhatsApp Share", "Rate Master"],
  variant: "banner",
});

assert.deepEqual(getQuotationDashboardCard({ role: "admin" }, true), {
  visible: true,
  title: "Create Lift Quotation",
  subtitle: "Prepare BOQ pricing and share quotation to customer on WhatsApp.",
  buttonText: "Create Quotation",
  secondaryText: "BOQ pricing enabled",
  pills: ["BOQ Enabled", "WhatsApp Share", "Rate Master"],
  variant: "banner",
});

assert.deepEqual(getQuotationDashboardCard({ role: "front_office" }, false), {
  visible: true,
  title: "Generated Quotations",
  subtitle: "View generated quotations and share them with customers.",
  buttonText: "View Quotations",
  secondaryText: "Generated quotations only",
  pills: ["View Only", "WhatsApp Share"],
  variant: "banner",
});

assert.equal(getQuotationDashboardCard({ role: "worker" }, false).visible, false);
assert.equal(getQuotationDashboardCard({ role: "customer" }, false).visible, false);
assert.equal(getQuotationDashboardCard({ role: "storekeeper" }, false).visible, false);

console.log("dashboard quotation card tests passed");
