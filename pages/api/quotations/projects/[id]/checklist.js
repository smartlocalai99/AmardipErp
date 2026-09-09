import { getUserFromRequest } from "@/lib/auth";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { getProjectById } from "@/lib/quotations";
import { setProjectChecklistItem, isValidChecklistItem } from "@/lib/projectChecklist";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can update a project's checklist." });
  }

  const { itemKey, completed } = req.body || {};
  if (!isValidChecklistItem(itemKey)) {
    return res.status(400).json({ success: false, message: "Unknown checklist item." });
  }

  try {
    const project = await getProjectById({ id: req.query.id });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    if (!project.startedAt) {
      return res.status(400).json({ success: false, message: "Start the project and assign a crew before tracking progress." });
    }

    await setProjectChecklistItem({ projectId: req.query.id, itemKey, completed: Boolean(completed), actor });
    const updated = await getProjectById({ id: req.query.id });
    return res.status(200).json({ success: true, project: updated });
  } catch (err) {
    console.error("Project checklist update error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to update checklist." });
  }
}
