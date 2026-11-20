import test from "node:test";
import assert from "node:assert/strict";
import { formatJobDuration, minutesBetween } from "../lib/jobDuration.js";
import { projectStepPercents, projectProgressPercent, PROJECT_CHECKLIST_ITEMS } from "../lib/projectChecklist.js";
import { areaLabelFromAddress, readableLocation } from "../lib/location.js";

test("durations read in hours under a day and in days + hours after", () => {
  assert.equal(formatJobDuration(null), null);
  assert.equal(formatJobDuration(-5), null);
  assert.equal(formatJobDuration(0), "0m");
  assert.equal(formatJobDuration(45), "45m");
  assert.equal(formatJobDuration(120), "2h");
  assert.equal(formatJobDuration(320), "5h 20m");
  assert.equal(formatJobDuration(23 * 60 + 59), "23h 59m");
  assert.equal(formatJobDuration(24 * 60), "1d");
  assert.equal(formatJobDuration(26 * 60 + 30), "1d 2h");
  assert.equal(formatJobDuration(3 * 24 * 60 + 5 * 60 + 10), "3d 5h");
});

test("elapsed minutes between two times", () => {
  assert.equal(minutesBetween("2026-11-10T04:00:00Z", "2026-11-11T06:30:00Z"), 26 * 60 + 30);
  assert.equal(formatJobDuration(minutesBetween("2026-11-10T04:00:00Z", "2026-11-11T06:30:00Z")), "1d 2h");
  assert.equal(minutesBetween("2026-11-10T04:00:00Z", new Date("2026-11-10T04:45:00Z").getTime()), 45);
  assert.equal(minutesBetween(null), null);
  assert.equal(minutesBetween("2026-11-12T00:00:00Z", "2026-11-11T00:00:00Z"), null);
});

test("erection step progress: completed steps are 100%, saved halves 50%, the rest 0%", () => {
  const project = {
    checklistCompletions: [{ itemKey: "SITE PREPARATION" }, { itemKey: "TEMPLATE PREPARATION" }],
    work: {
      steps: [
        { itemKey: "HOLE MARKING FOR MOTOR CHANNELS", percent: 50 },
        // Saved back down to 0 after a mistake.
        { itemKey: "TEMPLATE FIXING AT SITE", percent: 0 },
        // Completion row is the source of truth for 100%.
        { itemKey: "TEMPLATE PREPARATION", percent: 50 },
      ],
    },
  };
  const percents = projectStepPercents(project);
  assert.equal(percents.size, PROJECT_CHECKLIST_ITEMS.length);
  assert.equal(percents.get("SITE PREPARATION"), 100);
  assert.equal(percents.get("TEMPLATE PREPARATION"), 100);
  assert.equal(percents.get("HOLE MARKING FOR MOTOR CHANNELS"), 50);
  assert.equal(percents.get("TEMPLATE FIXING AT SITE"), 0);
  assert.equal(percents.get("LIFT NORMAL"), 0);
  // (100 + 100 + 50) / 52 steps
  assert.equal(projectProgressPercent(project), Math.round(250 / PROJECT_CHECKLIST_ITEMS.length));
  assert.equal(projectProgressPercent({}), 0);
  const all = { checklistCompletions: PROJECT_CHECKLIST_ITEMS.map((itemKey) => ({ itemKey })) };
  assert.equal(projectProgressPercent(all), 100);
});

test("new GPS labels are 'Area, City' without route codes or generic blocks", () => {
  // Real Nominatim responses for Kadapa and Proddatur.
  assert.equal(
    areaLabelFromAddress({ road: "MDR0380", residential: "Kadapa Urban", quarter: "Nagarajupeta", city: "Kadapa", county: "Kadapa Mandal", state_district: "YSR Kadapa", state: "Andhra Pradesh", postcode: "516003", country: "India" }),
    "Nagarajupeta, Kadapa"
  );
  assert.equal(
    areaLabelFromAddress({ residential: "Proddutur Urban", town: "Proddatur", county: "Proddatur Mandal", state_district: "YSR Kadapa", state: "Andhra Pradesh" }),
    "Proddatur"
  );
  assert.equal(areaLabelFromAddress({ road: "Gandhi Road", city: "Kadapa" }), "Gandhi Road, Kadapa");
  assert.equal(areaLabelFromAddress({ village: "Chennur", county: "Chennur Mandal" }), "Chennur");
  assert.equal(areaLabelFromAddress({}), null);
});

test("already-saved full addresses display as 'Area, City'", () => {
  assert.equal(
    readableLocation("MDR0380, Kadapa Urban, Nagarajupeta, Kadapa, Kadapa Mandal, YSR Kadapa, Andhra Pradesh, 516003, India"),
    "Nagarajupeta, Kadapa"
  );
  assert.equal(
    readableLocation("Kadapa Urban, Sankarapuram, Kadapa, Kadapa Mandal, YSR Kadapa, Andhra Pradesh, 516002, India"),
    "Sankarapuram, Kadapa"
  );
  assert.equal(
    readableLocation("Sri Sai Residency, Gandhi Road, Nagarajupeta, Kadapa, Kadapa Mandal, YSR Kadapa, Andhra Pradesh, 516003, India"),
    "Nagarajupeta, Kadapa"
  );
  assert.equal(
    readableLocation("Proddutur Urban, Proddatur, Proddatur Mandal, YSR Kadapa, Andhra Pradesh, 516360, India"),
    "Proddatur, YSR Kadapa"
  );
  assert.equal(readableLocation("Nagarajupeta, Kadapa"), "Nagarajupeta, Kadapa");
  assert.equal(readableLocation(""), null);
  assert.equal(readableLocation(null), null);
});
