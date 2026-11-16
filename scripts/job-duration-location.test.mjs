import test from "node:test";
import assert from "node:assert/strict";
import { formatJobDuration, erectionStepMinutes, crewAssignedAt, minutesBetween } from "../lib/jobDuration.js";
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

test("erection step time runs from the worker's assignment, then from the previous tick", () => {
  const assignedAtByUser = new Map([["7", "2026-11-10T04:00:00Z"], ["8", "2026-11-11T03:00:00Z"]]);
  const minutes = erectionStepMinutes(
    [
      { itemKey: "B", completedByUserId: 7, completedAt: "2026-11-10T07:30:00Z" },
      { itemKey: "A", completedByUserId: 7, completedAt: "2026-11-10T05:00:00Z" },
      // Worker 8 joins the next morning; their first step counts from their own assignment.
      { itemKey: "C", completedByUserId: 8, completedAt: "2026-11-11T05:00:00Z" },
      { itemKey: "D", completedByUserId: 7, completedAt: "2026-11-11T06:15:00Z" },
    ],
    { assignedAtByUser, projectStartAt: "2026-11-09T12:00:00Z" }
  );
  assert.equal(minutes.get("A"), 60); // 04:00 assignment -> 05:00
  assert.equal(minutes.get("B"), 150); // previous tick 05:00 -> 07:30
  assert.equal(minutes.get("C"), 120); // worker 8 assigned 03:00 -> 05:00
  assert.equal(minutes.get("D"), 75); // previous tick 05:00 -> 06:15

  // Worker no longer on the crew: falls back to the project's start date.
  const removed = erectionStepMinutes(
    [{ itemKey: "A", completedByUserId: 9, completedAt: "2026-11-10T05:00:00Z" }],
    { assignedAtByUser, projectStartAt: "2026-11-10T02:00:00Z" }
  );
  assert.equal(removed.get("A"), 180);

  // A known assignment time always wins over the project's start date.
  const known = erectionStepMinutes(
    [{ itemKey: "A", completedByUserId: 7, completedAt: "2026-11-10T05:00:00Z" }],
    { assignedAtByUser, projectStartAt: "2026-11-10T04:30:00Z" }
  );
  assert.equal(known.get("A"), 60);

  // Nothing known before the first tick.
  assert.equal(erectionStepMinutes([{ itemKey: "A", completedAt: "2026-11-10T05:00:00Z" }]).get("A"), null);
});

test("crew assignment times and elapsed minutes", () => {
  const map = crewAssignedAt([{ id: 7, assignedAt: "2026-11-10T04:00:00Z" }, { id: 8 }]);
  assert.equal(map.get("7"), "2026-11-10T04:00:00Z");
  assert.equal(map.has("8"), false);
  assert.equal(minutesBetween("2026-11-10T04:00:00Z", "2026-11-11T06:30:00Z"), 26 * 60 + 30);
  assert.equal(formatJobDuration(minutesBetween("2026-11-10T04:00:00Z", "2026-11-11T06:30:00Z")), "1d 2h");
  assert.equal(minutesBetween(null), null);
  assert.equal(minutesBetween("2026-11-12T00:00:00Z", "2026-11-11T00:00:00Z"), null);
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
