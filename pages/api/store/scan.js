import { getUserFromRequest } from "@/lib/auth";
import { resolveJobPass, listMaterialRequestsForComplaint } from "@/lib/materialRequests";
import { getStoreJobByReference } from "@/lib/inventory";

const STORE_ROLES = new Set(["storekeeper", "admin", "superadmin", "manager"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });

  const actor = await getUserFromRequest(req);
  if (!actor || !STORE_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Store access required." });
  }

  try {
    const { complaint, workerId } = await resolveJobPass(req.body?.token);
    // One QR, two directions: items still waiting to be issued (requested
    // by admin at assignment, or by the worker), and items already issued
    // but not yet returned. Both can be non-empty at once — a worker might
    // still have parts to collect for other items while returning unused
    // ones from earlier in the same job.
    const [allRequests, storeJob] = await Promise.all([
      listMaterialRequestsForComplaint(complaint.id),
      getStoreJobByReference(complaint.id),
    ]);
    // Only requests still awaiting action — an already-fulfilled request
    // left in this list would re-populate at its original quantity and a
    // careless "Collect All" tap would issue that same quantity a second
    // time, double-deducting stock for something already handed over.
    const materialRequests = allRequests.filter((request) =>
      ["pending", "approved", "partially_issued"].includes(request.status)
    );
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
      returnableItems: storeJob.returnableItems,
    });
  } catch (err) {
    console.error("Scan job pass error:", err);
    return res.status(400).json({ success: false, message: err.message || "Invalid or expired store pass." });
  }
}
