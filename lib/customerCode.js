// Amardip's customer ID format, as used across the CUSTOMER_LIST sheet since
// 2014 (e.g. 2610AG2):
//   26 - year the project started (2 digits)
//   10 - the lift's number within that year (2 digits; pre-2020 rows used
//        1 digit for lifts 1-9, which this still reads)
//   A  - door: A auto, M manual/collapsible, S swing
//   G  - motor: G gearless, T traction (geared)
//   2  - floors above ground (G+2)
// No imports — safe for client bundles and tests.

const LIFT_CODE = /^(\d{2})(\d{1,3})([A-Z])([A-Z])(\d{1,2})$/;

// The ERP's door options → the sheet's door letter.
export function doorLetter(doorType) {
  const text = String(doorType || "").toUpperCase();
  if (text.includes("AUTO")) return "A";
  if (text.includes("SWING")) return "S";
  return "M"; // collapsible gates, manual telescopic
}

// The ERP's motor options → the sheet's motor letter.
export function motorLetter(motorType) {
  const text = String(motorType || "").toUpperCase().replace(/\s+/g, "");
  return text.includes("GEARLESS") ? "G" : "T";
}

// "G+5" → "5".
export function floorsNumber(noOfFloors) {
  const match = String(noOfFloors || "").toUpperCase().match(/G\s*\+\s*(\d{1,2})/);
  if (!match) throw new Error(`Can't read floors from "${noOfFloors}".`);
  return String(Number(match[1]));
}

// { year: "26", liftNo: 10 } for a code in this format, else null.
export function parseLiftCode(code) {
  const match = LIFT_CODE.exec(String(code || "").trim().toUpperCase());
  return match ? { year: match[1], liftNo: Number(match[2]) } : null;
}

// Highest lift number already used in a year across the given codes (0 if none).
export function highestLiftNumber(codes, year) {
  let highest = 0;
  for (const code of codes || []) {
    const parsed = parseLiftCode(code);
    if (parsed && parsed.year === year && parsed.liftNo > highest) highest = parsed.liftNo;
  }
  return highest;
}

// Two-digit year in India time.
export function istYearDigits(date = new Date()) {
  const year = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date(date));
  return String(year).slice(-2);
}

export function buildCustomerCode({ year, liftNo, doorType, motorType, noOfFloors }) {
  return `${year}${String(liftNo).padStart(2, "0")}${doorLetter(doorType)}${motorLetter(motorType)}${floorsNumber(noOfFloors)}`;
}
