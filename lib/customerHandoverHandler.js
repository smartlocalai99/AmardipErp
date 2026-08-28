import { buildHandoverLetterData } from "./customerHandoverDocument.js";

export function createCustomerHandoverHandler({ getUserFromRequest, query, generatePdf }) {
  return async function customerHandoverHandler(req, res) {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (user.role !== "customer") return res.status(403).json({ success: false, message: "Not allowed" });

    const customerId = String(req.query.customerId || "").trim();
    if (!customerId) return res.status(404).json({ success: false, message: "Document not found" });

    try {
      const result = await query(
        `SELECT c.id, c.record_no, c.customer_code, c.customer_name,
                c.address, c.city, c.location, c.hoc_date,
                c.no_of_passenger, c.elevator_type
           FROM customer_user_links cul
           JOIN elevator_service_customers c ON c.id = cul.customer_id
          WHERE cul.user_id = $1 AND c.id = $2
          LIMIT 1`,
        [user.id, customerId],
      );

      const letter = buildHandoverLetterData(result.rows[0]);
      if (!letter) return res.status(404).json({ success: false, message: "Document not found" });

      const safeReference = letter.reference.replace(/[^a-z0-9_-]+/gi, "-");
      const pdf = generatePdf(letter);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="handing-over-letter-${safeReference}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return res.status(200).send(pdf);
    } catch (error) {
      console.error("Customer handing-over PDF error:", error);
      return res.status(500).json({ success: false, message: "Failed to generate document" });
    }
  };
}
