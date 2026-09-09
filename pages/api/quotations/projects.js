import { getUserFromRequest } from "@/lib/auth";
import { listOngoingProjectsFromSheet } from "@/lib/googleSheets";
import { listOngoingProjects } from "@/lib/quotations";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  try {
    const [databaseResult, sheetResult] = await Promise.all([
      listOngoingProjects({
      actor,
      page: req.query.page,
      pageSize: req.query.pageSize,
      search: req.query.search || "",
      }),
      listOngoingProjectsFromSheet({ search: req.query.search || "" }).catch((error) => {
        console.error("Ongoing sheet read failed:", error);
        return [];
      }),
    ]);
    const seen = new Set(databaseResult.rows.map((project) => project.quotationNo).filter(Boolean));
    const sheetOnly = sheetResult.filter((project) => !project.quotationNo || !seen.has(project.quotationNo));
    const projects = [...databaseResult.rows, ...sheetOnly];
    return res.status(200).json({ success: true, projects, total: projects.length, page: databaseResult.page, pageSize: databaseResult.pageSize });
  } catch (err) {
    return res.status(403).json({ success: false, message: err.message || "Unauthorized." });
  }
}
