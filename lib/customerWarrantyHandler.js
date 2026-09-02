import { buildWarrantyExpiryLetterData } from "./customerWarrantyLetter.js";

export function createWarrantyExpiryHandler({ getUserFromRequest, query, generatePdf }) {
  return async function warrantyExpiryHandler(req, res) {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (user.role !== "customer") return res.status(403).json({ success: false, message: "Not allowed" });

    const customerId = String(req.query.customerId || "").trim();
    if (!customerId) return res.status(404).json({ success: false, message: "Document not found" });

    try {
      // Only served once a warranty_expiry_notices row exists — i.e. after
      // the admin has actually sent it for this customer. The AMC amount
      // shown was fixed at send time, not recomputed later.
      const result = await query(
        `SELECT c.id, c.record_no, c.customer_code, c.customer_name,
                c.address, c.city, c.location, c.hoc_date,
                c.no_of_passenger, c.elevator_type,
                w.amc_amount, w.hoc_date_text, w.warranty_due_date_text
           FROM customer_user_links cul
           JOIN elevator_service_customers c ON c.id = cul.customer_id
           JOIN warranty_expiry_notices w ON w.customer_id = c.id
          WHERE cul.user_id = $1 AND c.id = $2
          LIMIT 1`,
        [user.id, customerId],
      );

      const letter = buildWarrantyExpiryLetterData(result.rows[0]);
      if (!letter) return res.status(404).json({ success: false, message: "Document not found" });
      letter.amcAmount = result.rows[0].amc_amount;
      // Dates shown are exactly what was fetched from the source sheet (or
      // the DB as fallback) at send time — never recomputed on later views.
      if (result.rows[0].hoc_date_text) letter.hocDate = result.rows[0].hoc_date_text;
      if (result.rows[0].warranty_due_date_text) letter.expiryDate = result.rows[0].warranty_due_date_text;

      const safeReference = letter.reference.replace(/[^a-z0-9_-]+/gi, "-");
      const pdf = generatePdf(letter);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="warranty-expiry-notice-${safeReference}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return res.status(200).send(pdf);
    } catch (error) {
      console.error("Customer warranty-expiry PDF error:", error);
      return res.status(500).json({ success: false, message: "Failed to generate document" });
    }
  };
}
