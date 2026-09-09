import { getUserFromRequest } from "@/lib/auth";
import { isProjectAssignee } from "@/lib/quotations";
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
    // isProjectAssignee alone proves both that the project exists and that
    // this worker is on its crew (the FK guarantees the former) — skips a
    // whole extra getProjectById round trip (main row + assignees +
    // completions) just to check something this one query already answers.
    const onCrew = await isProjectAssignee(req.query.id, actor.id);
    if (!onCrew) {
      return res.status(403).json({ success: false, message: "You're not assigned to this project, or it doesn't exist." });
    }

    const checklistCompletions = await setProjectChecklistItem({
      projectId: req.query.id,
      itemKey,
      completed: Boolean(completed),
      actor,
    });
    // Only the checklist changed — the rest of the project (name, crew,
    // amounts) didn't, so the client merges this into what it already has
    // instead of us re-fetching and re-sending the whole project again.
    return res.status(200).json({ success: true, checklistCompletions });
  } catch (err) {
    console.error("Worker project checklist update error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to update checklist." });
  }
}
