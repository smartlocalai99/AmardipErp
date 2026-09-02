import { getUserFromRequest } from "@/lib/auth";
import { createWarrantyExpiryHandler } from "@/lib/customerWarrantyHandler";
import { generateWarrantyExpiryPdf } from "@/lib/customerWarrantyPdf";
import { query } from "@/lib/db";

export default createWarrantyExpiryHandler({
  getUserFromRequest,
  query,
  generatePdf: generateWarrantyExpiryPdf,
});
