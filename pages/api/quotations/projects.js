import { getUserFromRequest } from "@/lib/auth";
import { listOngoingProjects } from "@/lib/quotations";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  try {
    const result = await listOngoingProjects({
      actor,
      page: req.query.page,
      pageSize: req.query.pageSize,
      search: req.query.search || "",
    });
    return res.status(200).json({ success: true, projects: result.rows, ...result });
  } catch (err) {
    return res.status(403).json({ success: false, message: err.message || "Unauthorized." });
  }
}
