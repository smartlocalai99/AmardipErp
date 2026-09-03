import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getServicePeriodRange } from "../lib/serviceVisitFilters.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, "..");

assert.deepEqual(getServicePeriodRange("2026", "9"), {
  fromDate: "2026-09-01",
  toDateExclusive: "2026-10-01",
});

assert.deepEqual(getServicePeriodRange("2026", "12"), {
  fromDate: "2026-12-01",
  toDateExclusive: "2027-01-01",
});

assert.deepEqual(getServicePeriodRange("2026", ""), {
  fromDate: "2026-01-01",
  toDateExclusive: "2027-01-01",
});

assert.equal(getServicePeriodRange("invalid", "9"), null);
assert.equal(getServicePeriodRange("2026", "13"), null);

const [globalsSource, serviceHistorySource, technicianSource] = await Promise.all([
  readFile(path.join(projectRoot, "styles/globals.css"), "utf8"),
  readFile(path.join(projectRoot, "components/admin/service/ServiceVisitsTable.jsx"), "utf8"),
  readFile(path.join(projectRoot, "pages/Techniciandashboard.jsx"), "utf8"),
]);

assert.match(globalsSource, /\.amardip-modal-layer\s*\{[^}]*z-index:\s*100/s);
assert.match(serviceHistorySource, /placeholder="Search customer name"/);
assert.match(serviceHistorySource, />Year</);
assert.match(serviceHistorySource, />Month</);
assert.doesNotMatch(serviceHistorySource, /placeholder="Service type"/);
assert.doesNotMatch(serviceHistorySource, /placeholder="Technician"/);
assert.doesNotMatch(serviceHistorySource, /type="date"/);
assert.doesNotMatch(serviceHistorySource, /function Pager/);
assert.doesNotMatch(serviceHistorySource, /\/ page</);
assert.match(serviceHistorySource, /amardip-modal-layer fixed inset-0/);
assert.match(technicianSource, /amardip-modal-layer absolute inset-0[\s\S]{0,500}QR Lift Scan Simulator/);

console.log("service visits history tests passed");
