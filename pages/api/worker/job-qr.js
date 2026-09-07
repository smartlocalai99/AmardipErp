import { getUserFromRequest } from "@/lib/auth";
import { canViewComplaint, getComplaintById } from "@/lib/complaints";
import { signJobPass } from "@/lib/jobPass";

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

  // No longer refused once a job is resolved/closed: the same pass is what
  // the store scans afterward to collect back any unused parts, not just
  // to issue new ones beforehand — the scan endpoint decides what to show
  // based on the job's actual state.
  const token = signJobPass({ complaintId: complaint.id, workerId: actor.id });
  return res.status(200).json({ success: true, token });
}
