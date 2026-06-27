import assert from "node:assert/strict";
import { buildWorkerUsers, normalizeRole, slugUsername } from "./import-workers.mjs";

assert.equal(normalizeRole("SR ELECTRICIAN"), "worker");
assert.equal(normalizeRole("FRONT OFFICE"), "front_office");
assert.equal(slugUsername("S CHANDRA SEKHAR"), "s_chandra_sekhar");

const users = buildWorkerUsers([
  { name: "RANJITH SINGH", designation: "SR ELECTRICIAN" },
  { name: "AFREEN", designation: "FRONT OFFICE" },
]);

assert.deepEqual(users, [
  {
    username: "ranjith_singh",
    name: "RANJITH SINGH",
    role: "worker",
    phone: null,
    designation: "SR ELECTRICIAN",
  },
  {
    username: "afreen",
    name: "AFREEN",
    role: "front_office",
    phone: null,
    designation: "FRONT OFFICE",
  },
]);

console.log("import-workers tests passed");
