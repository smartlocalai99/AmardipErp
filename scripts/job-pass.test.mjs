import assert from "node:assert/strict";
import { signJobPass, verifyJobPass } from "../lib/jobPass.js";

const token = signJobPass({ complaintId: "abc-123", workerId: 7 });
assert.equal(typeof token, "string");

const decoded = verifyJobPass(token);
assert.deepEqual(decoded, { complaintId: "abc-123", workerId: 7 });

assert.throws(() => verifyJobPass("not-a-real-token"));
assert.throws(() => signJobPass({ complaintId: null, workerId: 7 }));

console.log("job-pass tests passed");
