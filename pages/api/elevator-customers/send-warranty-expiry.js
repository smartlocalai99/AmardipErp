import { getUserFromRequest } from "@/lib/auth";
import { sendWarrantyExpiryLetterToCustomer } from "@/lib/warrantyExpiry";
import { createAuditLog } from "@/lib/auditLog";

const ADMIN_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);

// Manual, per-customer send: the admin picks one expiring customer, enters
// the AMC renewal amount, and this fires once for that customer. There is
// no automated/scheduled trigger for this — sending always requires an
// admin-entered amount.
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
    const result = await sendWarrantyExpiryLetterToCustomer(customerId, amcAmount);

    await createAuditLog({
      req,
      actor,
      entityType: "WARRANTY_EXPIRY_NOTIFY",
      entityId: customerId,
      action: "WARRANTY_EXPIRY_LETTER_SENT",
      newValues: { customerId, amcAmount, notified: result.notified },
      changedFields: ["amcAmount"],
    }).catch((error) => console.error("Warranty-expiry audit failed:", error));

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to send warranty-expiry letter:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to send warranty-expiry letter" });
  }
}
