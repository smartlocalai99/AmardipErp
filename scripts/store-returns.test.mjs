import assert from "node:assert/strict";
import { normalizeReturnItems } from "../lib/inventory.js";

assert.deepEqual(normalizeReturnItems([{ itemId: "4", quantity: "2.5" }]), [{ itemId: 4, quantity: 2.5 }]);
assert.deepEqual(normalizeReturnItems(null), []);
assert.deepEqual(normalizeReturnItems([{ itemId: 0, quantity: 1 }, { itemId: 2, quantity: 0 }]), []);
assert.deepEqual(normalizeReturnItems([{ itemId: "bad", quantity: 1 }, { itemId: 2, quantity: -1 }]), []);

console.log("store returns tests passed");
