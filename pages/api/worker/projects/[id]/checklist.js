import { getUserFromRequest } from "@/lib/auth";
import { getProjectById, isProjectAssignee } from "@/lib/quotations";
import { isValidChecklistItem } from "@/lib/projectChecklist";
import { setProjectChecklistItem } from "@/lib/projectChecklistStore";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { itemKey, completed } = req.body || {};
  if (!isValidChecklistItem(itemKey)) {
    return res.status(400).json({ success: false, message: "Unknown checklist item." });
  }

  try {
    const project = await getProjectById({ id: req.query.id });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });

    const onCrew = await isProjectAssignee(project.id, actor.id);
    if (!onCrew) {
      return res.status(403).json({ success: false, message: "You're not assigned to this project." });
    }

    await setProjectChecklistItem({ projectId: req.query.id, itemKey, completed: Boolean(completed), actor });
    const updated = await getProjectById({ id: req.query.id });
    return res.status(200).json({ success: true, project: updated });
  } catch (err) {
    console.error("Worker project checklist update error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to update checklist." });
  }
}
