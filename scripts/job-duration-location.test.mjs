import test from "node:test";
import assert from "node:assert/strict";
import { formatJobDuration, erectionStepMinutes } from "../lib/jobDuration.js";
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

test("erection step time is the gap since the previous tick or the site check-in", () => {
  const minutes = erectionStepMinutes(
    [
      { itemKey: "B", completedAt: "2026-11-10T07:30:00Z" },
      { itemKey: "A", completedAt: "2026-11-10T05:00:00Z" },
      { itemKey: "C", completedAt: "2026-11-11T05:00:00Z" },
    ],
    "2026-11-10T04:15:00Z"
  );
  assert.equal(minutes.get("A"), 45);
  assert.equal(minutes.get("B"), 150);
  assert.equal(minutes.get("C"), 21 * 60 + 30);

  // No check-in: the first step has nothing to measure from.
  assert.equal(erectionStepMinutes([{ itemKey: "A", completedAt: "2026-11-10T05:00:00Z" }]).get("A"), null);

  // Check-in after earlier ticks (projects already underway): the next tick
  // measures from the check-in, not from yesterday's tick.
  const late = erectionStepMinutes(
    [
      { itemKey: "A", completedAt: "2026-11-09T10:00:00Z" },
      { itemKey: "B", completedAt: "2026-11-10T06:00:00Z" },
    ],
    "2026-11-10T04:00:00Z"
  );
  assert.equal(late.get("A"), null);
  assert.equal(late.get("B"), 120);
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
