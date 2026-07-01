import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "super-secret-key-amardip-elevators-2026";
const JOB_PASS_TYPE = "job_pass";

export function signJobPass({ complaintId, workerId }) {
  if (!complaintId || !workerId) throw new Error("complaintId and workerId are required.");
  return jwt.sign({ type: JOB_PASS_TYPE, complaintId, workerId }, SECRET, { expiresIn: "180d" });
}

export function verifyJobPass(token) {
  if (!token) throw new Error("Missing job pass token.");
  const decoded = jwt.verify(token, SECRET);
  if (decoded.type !== JOB_PASS_TYPE) throw new Error("Invalid job pass token.");
  return { complaintId: decoded.complaintId, workerId: Number(decoded.workerId) };
}
