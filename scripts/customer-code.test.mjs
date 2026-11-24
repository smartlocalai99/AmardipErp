import test from "node:test";
import assert from "node:assert/strict";
import { doorLetter, motorLetter, floorsNumber, parseLiftCode, highestLiftNumber, istYearDigits, buildCustomerCode } from "../lib/customerCode.js";

test("builds the client's format: year, lift no., door, motor, floors", () => {
  assert.equal(buildCustomerCode({ year: "26", liftNo: 10, doorType: "SS CLAD AUTO DOOR", motorType: "GEAR LESS MOTOR", noOfFloors: "G+2" }), "2610AG2");
  assert.equal(buildCustomerCode({ year: "26", liftNo: 3, doorType: "SS FRAME COLLAPSIBLE GATE", motorType: "GEARED MOTOR", noOfFloors: "G+5" }), "2603MT5");
  assert.equal(buildCustomerCode({ year: "27", liftNo: 120, doorType: "MS SWING DOOR SMALL VISION", motorType: "GEAR LESS MOTOR", noOfFloors: "G+7" }), "27120SG7");
});

test("letters match the sheet's existing codes", () => {
  for (const door of ["SS CLAD AUTO DOOR", "MS CLAD AUTO DOOR", "SS FULL VISION GLASS AUTO DOOR", "MS HALF VISION GLASS AUTO DOOR"]) assert.equal(doorLetter(door), "A");
  for (const door of ["MS FRAME COLLAPSIBLE GATE", "SS FRAME COLLAPSIBLE GATE", "MANUAL MS TELISCOPIC DOOR", "MANUAL SS TELISCOPIC DOOR"]) assert.equal(doorLetter(door), "M");
  for (const door of ["MS SWING DOOR SMALL VISION", "SS SWING DOOR SMALL VISION"]) assert.equal(doorLetter(door), "S");
  assert.equal(motorLetter("GEAR LESS MOTOR"), "G");
  assert.equal(motorLetter("GEARED MOTOR"), "T");
  assert.equal(floorsNumber("G+5"), "5");
  assert.equal(floorsNumber("g + 7"), "7");
  assert.throws(() => floorsNumber("ground"));
});

test("reads existing codes, including pre-2020 single-digit lift numbers", () => {
  assert.deepEqual(parseLiftCode("2610AG2"), { year: "26", liftNo: 10 });
  assert.deepEqual(parseLiftCode("181MT5"), { year: "18", liftNo: 1 });
  assert.deepEqual(parseLiftCode("1810MT2"), { year: "18", liftNo: 10 });
  for (const other of ["26AMCMT5", "AMCP6", "QTN-202609-0006", "", null]) assert.equal(parseLiftCode(other), null);
});

test("next lift number continues after the highest one used that year", () => {
  // The real 2026 codes in CUSTOMER_LIST (2609 unused, 2617 used twice).
  const codes = ["2601AG4", "2602AG2", "2608AG4", "26AMCMT5", "2610AG2", "2617AT5", "2618MG3", "2619MG4", "2617AG4", "2547AG5", "QTN-202609-0006"];
  assert.equal(highestLiftNumber(codes, "26"), 19);
  assert.equal(highestLiftNumber(codes, "25"), 47);
  assert.equal(highestLiftNumber(codes, "27"), 0);
});

test("year is taken in India time", () => {
  assert.equal(istYearDigits("2026-12-31T19:00:00Z"), "27"); // already 1 Jan in India
  assert.equal(istYearDigits("2026-06-01T00:00:00Z"), "26");
});
