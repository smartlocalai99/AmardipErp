import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { updateProjectDetails } from "@/lib/quotations";
import { updateOngoingSheetRow } from "@/lib/googleSheets";

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Project edit audit failed:", err);
  }
}

// Best-effort, same reasoning as every other sheet sync in this app — a
// Sheets hiccup must not fail an edit already committed to Postgres.
async function safeSyncOngoingSheet(project) {
  if (!project.googleSheetRow) return;
  try {
    await updateOngoingSheetRow(project.googleSheetRow, {
      customerName: project.customerName,
      address: project.address,
      city: project.city,
      mobileNo: project.mobileNo,
    });
  } catch (err) {
    console.error("Failed to sync edited project to ONGOING sheet:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const hasPermission = await isBoqAdmin(actor);
  if (!canGenerateBoq(actor, hasPermission)) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can edit a project." });
  }

  try {
    const project = await updateProjectDetails({
      projectId: req.query.id,
      customerName: req.body?.customerName,
      mobileNo: req.body?.mobileNo,
      address: req.body?.address,
      city: req.body?.city,
      agreedAmount: req.body?.agreedAmount,
      advanceAmount: req.body?.advanceAmount,
      actor,
    });

    await safeSyncOngoingSheet(project);

    await safeAudit({
      req,
      actor,
      entityType: "QUOTATION_PROJECT",
      entityId: project.id,
      action: "PROJECT_EDITED",
      newValues: { project },
      changedFields: ["customer_name", "mobile_no", "address", "city", "agreed_amount", "advance_amount"],
    });

    return res.status(200).json({ success: true, project });
  } catch (err) {
    console.error("Edit project error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to update this project." });
  }
}
