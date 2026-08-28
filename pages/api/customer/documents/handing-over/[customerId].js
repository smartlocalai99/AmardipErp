import { getUserFromRequest } from "@/lib/auth";
import { createCustomerHandoverHandler } from "@/lib/customerHandoverHandler";
import { generateCustomerHandoverPdf } from "@/lib/customerHandoverPdf";
import { query } from "@/lib/db";

export default createCustomerHandoverHandler({
  getUserFromRequest,
  query,
  generatePdf: generateCustomerHandoverPdf,
});
