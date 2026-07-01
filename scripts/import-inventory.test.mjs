import assert from "node:assert/strict";
import { normalizeUnit, parseInventoryLine, parseInventoryFile } from "./import-inventory.mjs";

assert.equal(normalizeUnit("None"), "Nos");
assert.equal(normalizeUnit("Meter"), "Meter");
assert.equal(normalizeUnit("Other"), "Other");

// stray copy-pasted "-" before the quantity is NOT a negative sign
assert.deepEqual(parseInventoryLine("12V 26AH SMF BATTERIES — Stock: - 8 Nos"), {
  name: "12V 26AH SMF BATTERIES",
  unit: "Nos",
  stockQuantity: 8,
});

// thousands separator
assert.deepEqual(parseInventoryLine("NUTS 6MM — Stock:  11,180 Nos"), {
  name: "NUTS 6MM",
  unit: "Nos",
  stockQuantity: 11180,
});

// decimal quantity
assert.deepEqual(parseInventoryLine("FIS V360S — Stock:  44.9 Nos"), {
  name: "FIS V360S",
  unit: "Nos",
  stockQuantity: 44.9,
});

// "None" unit normalizes to "Nos"
assert.deepEqual(parseInventoryLine("650 S/V DOORS — Stock:  0 None"), {
  name: "650 S/V DOORS",
  unit: "Nos",
  stockQuantity: 0,
});

// plain positive, no dash
assert.deepEqual(parseInventoryLine("Controller board — Stock: 2.0 Nos"), {
  name: "Controller board",
  unit: "Nos",
  stockQuantity: 2,
});

const parsed = parseInventoryFile("Controller board — Stock: 2.0 Nos\n\nNUTS 6MM — Stock:  11,180 Nos\n");
assert.equal(parsed.length, 2);

console.log("import-inventory parser tests passed");
