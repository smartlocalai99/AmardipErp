import { getUserFromRequest } from "@/lib/auth";
import { getAllTechnicianCurrentWork } from "@/lib/assignees";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed." });

  const requester = await getUserFromRequest(req);
  const allowedRoles = new Set(["superadmin", "admin", "manager", "front_office"]);
  if (!requester || !allowedRoles.has(requester.role)) {
    return res.status(403).json({ success: false, message: "Unauthorized. Admin role required." });
  }

  try {
    const workByTechnician = await getAllTechnicianCurrentWork();
    return res.status(200).json({ success: true, work: Object.fromEntries(workByTechnician) });
  } catch (err) {
    console.error("Fetch technician current work error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}
