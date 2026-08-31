import { saveQuotation, generateBoqForQuotation } from "@/lib/quotations";
import { createAuditLog } from "@/lib/auditLog";

// Origins allowed to call this endpoint from a browser (the public marketing
// website). Kept as an explicit allowlist since this endpoint has no auth and
// writes into the real "Form Responses 1" business Google Sheet.
const ALLOWED_ORIGINS = [
  "https://www.amardipelevators.com",
  "https://amardipelevators.com",
];

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (error) {
    console.error("Public website quote audit log failed:", error);
  }
}

export const config = { api: { bodyParser: { sizeLimit: "20kb" } }, maxDuration: 15 };

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const publicActor = { id: null, username: "Website quote form", role: "public" };

  let quotation;
  try {
    quotation = await saveQuotation({ actor: publicActor, input: req.body || {} });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Please check your details and try again." });
  }

  await safeAudit({
    req,
    actor: publicActor,
    entityType: "QUOTATION",
    entityId: quotation.id,
    action: "WEBSITE_QUOTATION_CREATED",
    newValues: quotation,
    changedFields: ["quotation"],
  });

  try {
    const { quotation: priced } = await generateBoqForQuotation({ quotationId: quotation.id, actor: publicActor });
    return res.status(201).json({
      success: true,
      quotationNo: priced.quotationNo,
      finalPrice: priced.finalPrice,
    });
  } catch (err) {
    console.error("Website quote pricing error:", err);
    // The quotation record was already saved (DRAFT) even though pricing
    // failed, so the front office can still follow up with the customer.
    return res.status(202).json({
      success: true,
      quotationNo: quotation.quotationNo,
      finalPrice: null,
      message: "We've received your request. Our team will call you shortly with your quote.",
    });
  }
}
