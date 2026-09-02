import { getUserFromRequest } from "@/lib/auth";
import { findExpiringWarrantyCandidates } from "@/lib/warrantyExpiry";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
  if (BLOCKED_ROLES.has(user.role)) return res.status(403).json({ success: false, message: "Not allowed" });

  try {
    const candidates = await findExpiringWarrantyCandidates(30);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(200).json({
      success: true,
      candidates: candidates.map((c) => ({
        id: c.id,
        customerCode: c.customer_code,
        customerName: c.customer_name,
        expiryDate: c.expiry_date,
        mobileNo: c.mobile_no,
        sentAt: c.sent_at,
        amcAmount: c.amc_amount,
      })),
    });
  } catch (error) {
    console.error("Failed to load expiring warranty candidates:", error);
    return res.status(500).json({ success: false, message: "Failed to load expiring warranty customers" });
  }
}
