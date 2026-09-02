import { buildHandoverLetterData } from "./customerHandoverDocument.js";

function clean(value) {
  return String(value ?? "").trim();
}

// Same underlying fields as the handing-over letter (hoc_date -> +1 year is
// the warranty window), just relabeled for this letter's purpose.
export function buildWarrantyExpiryLetterData(customer = {}) {
  const letter = buildHandoverLetterData(customer);
  if (!letter) return null;
  return { ...letter, expiryDate: letter.dueDate };
}

export function buildWarrantyExpiryDescriptor(customer = {}) {
  const letter = buildWarrantyExpiryLetterData(customer);
  if (!letter) return null;
  const safeReference = letter.reference.replace(/[^a-z0-9_-]+/gi, "-");
  const passengerCount = clean(customer.no_of_passenger);
  return {
    id: `warranty-expiry-${letter.customerId}`,
    customerId: letter.customerId,
    name: `Warranty Expiry Notice - ${letter.reference}`,
    category: "Warranty & Handover",
    type: "PDF",
    date: letter.expiryDate,
    liftLabel: clean(customer.elevator_type) || (passengerCount ? `${passengerCount} Passenger Lift` : "Passenger Lift"),
    downloadName: `warranty-expiry-notice-${safeReference}.pdf`,
  };
}
