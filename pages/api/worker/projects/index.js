import { getUserFromRequest } from "@/lib/auth";
import { listProjectsForTechnician } from "@/lib/quotations";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  try {
    const projects = await listProjectsForTechnician(actor.id);
    return res.status(200).json({ success: true, projects });
  } catch (err) {
    console.error("Worker projects list error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to load your projects." });
  }
}
