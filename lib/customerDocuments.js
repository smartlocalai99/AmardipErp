import { buildHandoverDocumentDescriptor } from "./customerHandoverDocument.js";
import { buildWarrantyExpiryDescriptor } from "./customerWarrantyLetter.js";

// A customer's Documents list combines every document kind they're eligible
// for. Today that's the handing-over letter (present whenever HOC is valid)
// and the warranty-expiry notice (present only after it's actually been
// sent — see warranty_notice_sent, set by lib/warrantyExpiry.js).
export function buildCustomerDocuments(customer = {}) {
  const documents = [];

  const handover = buildHandoverDocumentDescriptor(customer);
  if (handover) documents.push({ ...handover, documentType: "handing-over" });

  if (customer.warranty_notice_sent) {
    const warranty = buildWarrantyExpiryDescriptor(customer);
    if (warranty) documents.push({ ...warranty, documentType: "warranty-expiry" });
  }

  return documents;
}

export function filterCustomerDocuments(customers = [], search = "") {
  const term = String(search).trim().toLowerCase();
  return customers
    .flatMap(buildCustomerDocuments)
    .filter((document) => !term || [document.name, document.category, document.liftLabel]
      .some((value) => String(value).toLowerCase().includes(term)));
}
