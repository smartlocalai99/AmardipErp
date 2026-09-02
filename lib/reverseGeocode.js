// Reverse geocodes GPS coordinates into a human-readable address using
// OpenStreetMap's free Nominatim API (no API key needed — this codebase has
// no Google Maps key configured). Called once at job-completion time and the
// resulting address is stored, so viewers never see raw lat/long and no
// repeated geocoding happens on every page load.
export async function reverseGeocode(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=0`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires an identifying User-Agent.
        "User-Agent": "AmardipElevatorsERP/1.0",
        "Accept-Language": "en",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.display_name || null;
  } catch (error) {
    console.error("Reverse geocode failed, falling back to no address:", error);
    return null;
  }
}
