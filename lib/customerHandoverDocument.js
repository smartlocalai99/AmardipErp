import { parseCustomerDate } from "./customerDates.js";

function clean(value) {
  return String(value ?? "").trim();
}

export function addOneCalendarYear(date) {
  const year = date.getFullYear() + 1;
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

export function formatLetterDate(date) {
  return [String(date.getDate()).padStart(2, "0"), String(date.getMonth() + 1).padStart(2, "0"), date.getFullYear()].join("/");
}

export function buildHandoverLetterData(customer = {}) {
  const hoc = parseCustomerDate(customer.hoc_date);
  if (!hoc) return null;
  const customerName = clean(customer.customer_name) || "Customer";
  const city = clean(customer.city);
  const address = clean(customer.address);
  const location = clean(customer.location);
  const passengerCount = clean(customer.no_of_passenger);
  const elevatorType = clean(customer.elevator_type);
  const reference = clean(customer.customer_code) || clean(customer.record_no) || clean(customer.id);
  return { customerId: clean(customer.id), customerName, recipientLocation: (city || location || address).toUpperCase(), installationAddress: [address, city].filter(Boolean).join(", ") || location || "your premises", liftDescription: elevatorType || (passengerCount ? `${passengerCount} Passenger Lift` : "Passenger Lift"), reference, hocDate: formatLetterDate(hoc), dueDate: formatLetterDate(addOneCalendarYear(hoc)) };
}

export function buildHandoverDocumentDescriptor(customer = {}) {
  const letter = buildHandoverLetterData(customer);
  if (!letter) return null;
  const safeReference = letter.reference.replace(/[^a-z0-9_-]+/gi, "-");
  const passengerCount = clean(customer.no_of_passenger);
  return { id: `handover-${letter.customerId}`, customerId: letter.customerId, name: `Handing Over Letter - ${letter.reference}`, category: "Warranty & Handover", type: "PDF", date: letter.hocDate, liftLabel: clean(customer.elevator_type) || (passengerCount ? `${passengerCount} Passenger Lift` : "Passenger Lift"), downloadName: `handing-over-letter-${safeReference}.pdf` };
}

export function filterHandoverDocuments(customers = [], search = "") {
  const term = String(search).trim().toLowerCase();
  return customers
    .map(buildHandoverDocumentDescriptor)
    .filter(Boolean)
    .filter((document) => !term || [document.name, document.category, document.liftLabel]
      .some((value) => String(value).toLowerCase().includes(term)));
}
