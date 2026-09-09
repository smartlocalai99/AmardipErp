import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { startProject } from "@/lib/quotations";
import { safeSendPush } from "@/lib/pushNotifications";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Project start audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can start a project." });
  }

  try {
    const { project, alreadyStarted } = await startProject({
      projectId: req.query.id,
      technicianUserIds: req.body?.technicianUserIds,
      actor,
    });

    await safeAudit({
      req,
      actor,
      entityType: "QUOTATION_PROJECT",
      entityId: project.id,
      action: alreadyStarted ? "PROJECT_CREW_REASSIGNED" : "PROJECT_STARTED",
      newValues: { project },
      changedFields: ["started_at", "assignees"],
    });

    const crewUserIds = (project.assignees || []).map((a) => a.id);
    if (crewUserIds.length > 0) {
      await safeSendPush(
        { userIds: crewUserIds },
        {
          title: alreadyStarted ? "Project crew updated" : "New project started",
          body: `${project.customerName} (${project.quotationNo}) — you're on the crew for this installation.`,
          data: { url: "/Techniciandashboard", projectId: project.id },
        }
      );
    }

    return res.status(200).json({ success: true, project });
  } catch (err) {
    console.error("Start project error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to start project." });
  }
}
