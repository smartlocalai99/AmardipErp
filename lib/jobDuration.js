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

// Erection time for each worker starts when the admin assigns them to the
// project (project_assignees.assigned_at). Map of String(userId) -> that time.
export function crewAssignedAt(assignees = []) {
  return new Map((assignees || []).filter((a) => a?.assignedAt).map((a) => [String(a.id), a.assignedAt]));
}

// Minutes from a start time to `end` (default now), or null if unknown.
export function minutesBetween(start, end = Date.now()) {
  const from = start ? new Date(start).getTime() : NaN;
  const to = end instanceof Date || typeof end === "string" ? new Date(end).getTime() : Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return Math.round((to - from) / 60000);
}

// Erection steps are ticked one tap at a time, so a step's time is the gap
// since whatever came just before it: the previous ticked step on the
// project, or the moment the admin assigned the worker who ticked it if that
// was later (their first step). The project's start date is a fallback for a
// worker no longer on the crew. Returns Map(itemKey -> minutes, or null when
// nothing earlier is known).
export function erectionStepMinutes(completions = [], { assignedAtByUser = new Map(), projectStartAt = null } = {}) {
  const toMs = (value) => (value ? new Date(value).getTime() : NaN);
  const projectStart = toMs(projectStartAt);
  const ticks = (completions || [])
    .map((c) => ({ key: c?.itemKey, userId: c?.completedByUserId, at: toMs(c?.completedAt) }))
    .filter((c) => c.key && Number.isFinite(c.at))
    .sort((a, b) => a.at - b.at);

  const result = new Map();
  let previousTick = null;
  for (const tick of ticks) {
    const workerStart = tick.userId !== null && tick.userId !== undefined ? toMs(assignedAtByUser.get(String(tick.userId))) : NaN;
    const start = Number.isFinite(workerStart) ? workerStart : projectStart;
    const candidates = [previousTick, start].filter((at) => Number.isFinite(at) && at <= tick.at);
    const base = candidates.length ? Math.max(...candidates) : null;
    result.set(tick.key, base === null ? null : Math.round((tick.at - base) / 60000));
    previousTick = tick.at;
  }
  return result;
}
