// Turns OpenStreetMap reverse-geocode results into a short "Area, City"
// label staff can read at a glance. No imports — safe for client bundles.

// OSM tags Indian towns with generic "<Town> Urban"/"<Town> Rural" blocks
// and numbered route codes (MDR0380, NH40, SH-31) that mean nothing to a
// reader, so they're never used as the area name.
const GENERIC_AREA = /\b(urban|rural)$/i;
const ROAD_CODE = /^(?:[A-Z]{1,4}[- ]?\d+[A-Z]?|[\d\-/]+[A-Z]?)$/i;
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;
const ADMIN_SUFFIX = /\b(mandal|district|taluk|taluka|tehsil|division|sub-district)$/i;
const POSTCODE = /^\d{5,6}$/;
const INDIAN_STATES = new Set([
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana",
  "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur",
  "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana",
  "tripura", "uttar pradesh", "uttarakhand", "west bengal", "andaman and nicobar islands", "chandigarh",
  "dadra and nagar haveli and daman and diu", "delhi", "jammu and kashmir", "ladakh", "lakshadweep", "puducherry",
]);

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function joinUnique(parts) {
  const out = [];
  for (const part of parts) {
    if (part && !out.some((p) => p.toLowerCase() === part.toLowerCase())) out.push(part);
  }
  return out.join(", ") || null;
}

// From Nominatim's `address` object (addressdetails=1).
export function areaLabelFromAddress(address = {}) {
  const pick = (...keys) =>
    keys.map((key) => clean(address?.[key])).find((value) => value && !GENERIC_AREA.test(value)) || null;
  const area = pick("neighbourhood", "quarter", "suburb", "residential", "hamlet", "city_district");
  const city = pick("city", "town", "village", "municipality", "state_district", "county");
  const road = clean(address?.road);
  const namedRoad = road && !ROAD_CODE.test(road) ? road : null;
  return joinUnique([area || namedRoad, city]);
}

// For display: shortens a full OSM display_name saved before this label
// existed ("MDR0380, Kadapa Urban, Nagarajupeta, Kadapa, Kadapa Mandal, YSR
// Kadapa, Andhra Pradesh, 516003, India" -> "Nagarajupeta, Kadapa"). Short
// labels (three parts or fewer) come back unchanged.
export function readableLocation(text) {
  const raw = clean(text);
  if (!raw) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 3) return parts.join(", ");

  const stateIndex = parts.findIndex((p) => INDIAN_STATES.has(p.toLowerCase()));
  const kept = [];
  parts.forEach((part, index) => {
    if (stateIndex !== -1 && index >= stateIndex) return; // state, PIN, country
    if (part.toLowerCase() === "india" || POSTCODE.test(part) || PLUS_CODE.test(part)) return;
    if (ADMIN_SUFFIX.test(part) || GENERIC_AREA.test(part) || ROAD_CODE.test(part)) return;
    kept.push({ part, index });
  });
  // The part just before the state is the district ("YSR Kadapa") — drop it
  // when there's still an area and a city left to show.
  if (stateIndex > 0 && kept.length >= 3 && kept[kept.length - 1].index === stateIndex - 1) kept.pop();
  if (kept.length === 0) return parts.slice(0, 2).join(", ");
  return joinUnique(kept.slice(-2).map((k) => k.part));
}
