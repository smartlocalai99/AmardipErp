import { getUserFromRequest } from "@/lib/auth";
import { resolveJobPass, listMaterialRequestsForComplaint } from "@/lib/materialRequests";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || !STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Store access required." });
  }

  try {
    const { complaint, workerId } = await resolveJobPass(req.body?.token);
    const materialRequests = await listMaterialRequestsForComplaint(complaint.id);
    return res.status(200).json({
      success: true,
      job: {
        complaintId: complaint.id,
        complaintNo: complaint.complaintNo,
        customerName: complaint.customerName,
        assignedTechnicianName: complaint.assignedTechnicianName,
        workerId,
        status: complaint.status,
      },
      materialRequests,
    });
  } catch (err) {
    console.error("Scan job pass error:", err);
    return res.status(400).json({ success: false, message: err.message || "Invalid or expired store pass." });
  }
}
