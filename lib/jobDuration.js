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

// Erection steps are ticked one tap at a time, so a step's time is the gap
// since whatever came just before it on that project: the previous ticked
// step, or the crew's site check-in if that happened later (the first step
// after work starts). Returns Map(itemKey -> minutes, or null when nothing
// earlier is known).
export function erectionStepMinutes(completions = [], projectStartAt = null) {
  const start = projectStartAt ? new Date(projectStartAt).getTime() : NaN;
  const ticks = (completions || [])
    .map((c) => ({ key: c?.itemKey, at: c?.completedAt ? new Date(c.completedAt).getTime() : NaN }))
    .filter((c) => c.key && Number.isFinite(c.at))
    .sort((a, b) => a.at - b.at);

  const result = new Map();
  let previousTick = null;
  for (const tick of ticks) {
    const candidates = [previousTick, Number.isFinite(start) ? start : null].filter((at) => at !== null && at <= tick.at);
    const base = candidates.length ? Math.max(...candidates) : null;
    result.set(tick.key, base === null ? null : Math.round((tick.at - base) / 60000));
    previousTick = tick.at;
  }
  return result;
}
