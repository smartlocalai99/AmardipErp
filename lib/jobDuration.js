// Shared duration helpers for the admin, technician and customer dashboards
// and the erection checklist. No imports — safe for client bundles.

// Under a day reads in hours ("45m", "5h", "5h 20m"); a day or more reads in
// days and hours ("1d", "2d 3h") so long jobs stay readable at a glance.
export function formatJobDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const total = Math.round(minutes);
  if (total < 24 * 60) {
    const hrs = Math.floor(total / 60);
    const mins = total % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }
  const days = Math.floor(total / (24 * 60));
  const hrs = Math.floor((total % (24 * 60)) / 60);
  return hrs === 0 ? `${days}d` : `${days}d ${hrs}h`;
}

// Minutes from a start time to `end` (default now), or null if unknown.
export function minutesBetween(start, end = Date.now()) {
  const from = start ? new Date(start).getTime() : NaN;
  const to = end instanceof Date || typeof end === "string" ? new Date(end).getTime() : Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return Math.round((to - from) / 60000);
}
