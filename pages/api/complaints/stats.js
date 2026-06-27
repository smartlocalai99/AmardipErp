import { getUserFromRequest } from "@/lib/auth";
import { getComplaintStats } from "@/lib/complaints";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || !ALLOWED_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Unauthorized." });
  }

  try {
    const stats = await getComplaintStats();
    return res.status(200).json({ success: true, ...stats });
  } catch (err) {
    console.error("Complaint stats error:", err);
    return res.status(500).json({ success: false, message: "Failed to load complaint stats." });
  }
}
