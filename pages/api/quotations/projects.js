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
    const seenByQuotationNo = new Set(databaseResult.rows.map((project) => project.quotationNo).filter(Boolean));
    // A legacy sheet row that's been adopted into a real project has no
    // quotationNo (there was never a quotation) — it's tied back to its
    // sheet row instead, so dedup needs both keys.
    const seenBySheetRow = new Set(databaseResult.rows.map((project) => project.googleSheetRow).filter(Boolean));
    const sheetOnly = sheetResult.filter((project) => {
      if (project.quotationNo && seenByQuotationNo.has(project.quotationNo)) return false;
      if (project.googleSheetRow && seenBySheetRow.has(project.googleSheetRow)) return false;
      return true;
    });
    const projects = [...databaseResult.rows, ...sheetOnly];
    return res.status(200).json({ success: true, projects, total: projects.length, page: databaseResult.page, pageSize: databaseResult.pageSize });
  } catch (err) {
    return res.status(403).json({ success: false, message: err.message || "Unauthorized." });
  }
}
