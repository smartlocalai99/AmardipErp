import { getUserFromRequest } from "@/lib/auth";
import { canViewComplaint, getComplaintById } from "@/lib/complaints";
import { signJobPass } from "@/lib/jobPass";

const TERMINAL_COMPLAINT_STATUSES = new Set(["RESOLVED", "CLOSED", "CANCELLED"]);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { complaintId } = req.query;
  const complaint = await getComplaintById(complaintId);
  if (!complaint || !canViewComplaint(actor, complaint)) {
    return res.status(403).json({ success: false, message: "Not your job." });
  }
  if (TERMINAL_COMPLAINT_STATUSES.has(complaint.status)) {
    return res.status(400).json({ success: false, message: "This job is closed; no store pass needed." });
  }

  const token = signJobPass({ complaintId: complaint.id, workerId: actor.id });
  return res.status(200).json({ success: true, token });
}
