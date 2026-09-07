import { getUserFromRequest } from "@/lib/auth";
import { sendOutOfWarrantyLetterToCustomer } from "@/lib/outOfWarrantyNotice";
import { createAuditLog } from "@/lib/auditLog";

const ADMIN_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);

// Manual, per-customer send, same as the warranty-expiry letter — the admin
// picks one out-of-warranty customer and sends; there is no automated or
// bulk send. Once sent, that customer's row in warranty_expiry_notices makes
// them permanently ineligible for either letter again.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Not authenticated" });
  if (!ADMIN_ROLES.has(actor.role)) return res.status(403).json({ success: false, message: "Not allowed" });

  const customerId = String(req.body?.customerId || "").trim();
  const amcAmount = req.body?.amcAmount;
  if (!customerId) {
    return res.status(400).json({ success: false, message: "customerId is required." });
  }

  try {
    const result = await sendOutOfWarrantyLetterToCustomer(customerId, amcAmount);

    await createAuditLog({
      req,
      actor,
      entityType: "OUT_OF_WARRANTY_NOTIFY",
      entityId: customerId,
      action: "OUT_OF_WARRANTY_LETTER_SENT",
      newValues: { customerId, amcAmount, notified: result.notified },
      changedFields: ["amcAmount"],
    }).catch((error) => console.error("Out-of-warranty audit failed:", error));

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to send out-of-warranty letter:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to send out-of-warranty letter" });
  }
}
