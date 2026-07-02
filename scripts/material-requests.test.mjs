import assert from "node:assert/strict";
import { normalizeAllocatedItems } from "../lib/materialRequests.js";

assert.deepEqual(
  normalizeAllocatedItems([
    { itemId: "5", quantity: "2" },
    { itemId: 7, quantity: 1 },
  ]),
  [
    { itemId: 5, quantity: 2 },
    { itemId: 7, quantity: 1 },
  ]
);

assert.deepEqual(normalizeAllocatedItems(undefined), []);
assert.deepEqual(normalizeAllocatedItems(null), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: 0, quantity: 2 }]), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: 5, quantity: 0 }]), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: 5, quantity: -1 }]), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: "abc", quantity: 2 }]), []);

console.log("materialRequests tests passed");
