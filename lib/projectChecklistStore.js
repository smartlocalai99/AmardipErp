import { query, withTransaction } from "./db.js";
import { isValidChecklistItem } from "./projectChecklist.js";

// DB-backed reads/writes for the project checklist. Split out from
// lib/projectChecklist.js specifically so that file (imported by
// client-rendered pages for its constants) never pulls in lib/db.js's `pg`
// dependency — this file is server-only (lib/quotations.js and the
// checklist API routes), never imported by a page component directly.

let tableReady = false;

export async function ensureProjectChecklistTable() {
  if (tableReady) return;
  // gps_* on a completion is where the worker's phone was when they ticked
  // that step (gps_address is the short "Area, City" label from
  // lib/reverseGeocode.js).
  //
  // project_work_sessions is erection time, like a service visit: a worker's
  // GPS check-in at site starts a session; saving a step's progress slider
  // (0/50/100%) ends it, charging those minutes to that step and stopping the
  // worker's time until they check in again. One open session per worker per
  // project (partial unique index). user_id has no FK so removing a user
  // never erases site records. A step at 100% also gets its
  // project_checklist_completions row, which handover, crew status and the
  // handover PDF already count.
  await query(`
    CREATE TABLE IF NOT EXISTS project_checklist_completions (
      project_id UUID NOT NULL REFERENCES quotation_projects(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      completed_by_username TEXT,
      PRIMARY KEY (project_id, item_key)
    );
    CREATE INDEX IF NOT EXISTS idx_project_checklist_completions_project ON project_checklist_completions(project_id);
    ALTER TABLE project_checklist_completions ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION;
    ALTER TABLE project_checklist_completions ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION;
    ALTER TABLE project_checklist_completions ADD COLUMN IF NOT EXISTS gps_accuracy_meters DOUBLE PRECISION;
    ALTER TABLE project_checklist_completions ADD COLUMN IF NOT EXISTS gps_address TEXT;

    CREATE TABLE IF NOT EXISTS project_work_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES quotation_projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      start_latitude DOUBLE PRECISION,
      start_longitude DOUBLE PRECISION,
      start_accuracy_meters DOUBLE PRECISION,
      start_address TEXT,
      ended_at TIMESTAMPTZ,
      end_item_key TEXT,
      end_percent INTEGER CHECK (end_percent IN (0, 50, 100)),
      end_latitude DOUBLE PRECISION,
      end_longitude DOUBLE PRECISION,
      end_accuracy_meters DOUBLE PRECISION,
      end_address TEXT,
      minutes INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_project_work_sessions_project ON project_work_sessions(project_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_work_sessions_open
      ON project_work_sessions(project_id, user_id) WHERE ended_at IS NULL;
  `);
  tableReady = true;
}

const COMPLETION_COLUMNS = `c.item_key, c.completed_at, c.completed_by_user_id, c.completed_by_username, u.name AS completed_by_name,
       c.gps_latitude, c.gps_longitude, c.gps_address`;

function normalizeCompletion(row) {
  return {
    itemKey: row.item_key,
    completedAt: row.completed_at,
    completedByUserId: row.completed_by_user_id ?? null,
    completedByUsername: row.completed_by_username,
    completedByName: row.completed_by_name,
    gpsLatitude: row.gps_latitude ?? null,
    gpsLongitude: row.gps_longitude ?? null,
    gpsAddress: row.gps_address || null,
  };
}

function finiteOrNull(value) {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
}

export async function getProjectChecklistCompletions(projectId) {
  await ensureProjectChecklistTable();
  const result = await query(
    `SELECT ${COMPLETION_COLUMNS}
     FROM project_checklist_completions c
     LEFT JOIN users u ON u.id = c.completed_by_user_id
     WHERE c.project_id = $1`,
    [projectId]
  );
  return result.rows.map(normalizeCompletion);
}

export async function getProjectChecklistCompletionsForMany(projectIds) {
  await ensureProjectChecklistTable();
  if (projectIds.length === 0) return new Map();
  const result = await query(
    `SELECT c.project_id, ${COMPLETION_COLUMNS}
     FROM project_checklist_completions c
     LEFT JOIN users u ON u.id = c.completed_by_user_id
     WHERE c.project_id = ANY($1)`,
    [projectIds]
  );
  const byProject = new Map();
  for (const row of result.rows) {
    const list = byProject.get(row.project_id) || [];
    list.push(normalizeCompletion(row));
    byProject.set(row.project_id, list);
  }
  return byProject;
}

const IST_TODAY_START_SQL = "(date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')";

// GPS check-in at site: starts the worker's time on this project. A repeat
// tap while already checked in keeps the open session. firstToday tells the
// caller whether this is the worker's first check-in here today (IST) — the
// RETURNING subquery sees the table as it was before this insert.
export async function startProjectWorkSession({ projectId, actor, gps = {} }) {
  await ensureProjectChecklistTable();
  const inserted = await query(
    `INSERT INTO project_work_sessions
       (project_id, user_id, user_name, start_latitude, start_longitude, start_accuracy_meters, start_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (project_id, user_id) WHERE ended_at IS NULL DO NOTHING
     RETURNING started_at,
       (SELECT COUNT(*) = 0 FROM project_work_sessions s
         WHERE s.project_id = $1 AND s.user_id = $2 AND s.started_at >= ${IST_TODAY_START_SQL}) AS first_today`,
    [
      projectId,
      actor.id,
      actor.name || actor.username || null,
      finiteOrNull(gps.latitude),
      finiteOrNull(gps.longitude),
      finiteOrNull(gps.accuracy),
      gps.address || null,
    ]
  );
  const row = inserted.rows[0];
  return { started: Boolean(row), firstToday: Boolean(row?.first_today) };
}

// Saving a step's slider: ends the worker's open session (charging its
// minutes to this step) and records the step at 0/50/100%. 100% adds the
// completion row; anything lower removes it. Throws 409 when the worker
// isn't checked in. newlyCompleted is true only when this save took the
// step to 100%.
export async function recordProjectStepProgress({ projectId, itemKey, percent, actor, gps = {} }) {
  await ensureProjectChecklistTable();
  if (!isValidChecklistItem(itemKey)) throw new Error("Unknown checklist item.");
  if (![0, 50, 100].includes(percent)) throw new Error("Progress must be 0%, 50% or 100%.");

  return withTransaction(async () => {
    const ended = await query(
      `UPDATE project_work_sessions
          SET ended_at = NOW(), end_item_key = $3, end_percent = $4,
              end_latitude = $5, end_longitude = $6, end_accuracy_meters = $7, end_address = $8,
              minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))::int
        WHERE project_id = $1 AND user_id = $2 AND ended_at IS NULL
        RETURNING minutes`,
      [projectId, actor.id, itemKey, percent, finiteOrNull(gps.latitude), finiteOrNull(gps.longitude), finiteOrNull(gps.accuracy), gps.address || null]
    );
    if (!ended.rowCount) {
      const error = new Error("Check in at site before saving progress.");
      error.statusCode = 409;
      throw error;
    }

    let newlyCompleted = false;
    if (percent === 100) {
      const inserted = await query(
        `INSERT INTO project_checklist_completions
           (project_id, item_key, completed_by_user_id, completed_by_username, gps_latitude, gps_longitude, gps_accuracy_meters, gps_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (project_id, item_key) DO NOTHING
         RETURNING item_key`,
        [projectId, itemKey, actor.id, actor.username || actor.name || null, finiteOrNull(gps.latitude), finiteOrNull(gps.longitude), finiteOrNull(gps.accuracy), gps.address || null]
      );
      newlyCompleted = inserted.rowCount > 0;
    } else {
      await query("DELETE FROM project_checklist_completions WHERE project_id = $1 AND item_key = $2", [projectId, itemKey]);
    }
    return { minutes: ended.rows[0].minutes, newlyCompleted };
  });
}

// Compact per-project time summary for the checklist screens — at most one
// row per step plus one per crew member, never the raw session log:
//   steps: latest saved percent, total minutes, who/when/where it was last saved
//   crew:  each worker's total minutes, and since when they're checked in now
export async function getProjectWorkSummaryForMany(projectIds) {
  await ensureProjectChecklistTable();
  const byProject = new Map();
  if (!projectIds.length) return byProject;
  const [steps, crew] = await Promise.all([
    query(
      `SELECT DISTINCT ON (project_id, end_item_key)
         project_id, end_item_key, end_percent, ended_at, user_name, end_address, end_latitude, end_longitude,
         SUM(minutes) OVER (PARTITION BY project_id, end_item_key)::int AS minutes
       FROM project_work_sessions
       WHERE project_id = ANY($1) AND ended_at IS NOT NULL AND end_item_key IS NOT NULL
       ORDER BY project_id, end_item_key, ended_at DESC`,
      [projectIds]
    ),
    query(
      `SELECT project_id, user_id, MAX(user_name) AS user_name,
         COALESCE(SUM(minutes) FILTER (WHERE ended_at IS NOT NULL), 0)::int AS minutes,
         MAX(started_at) FILTER (WHERE ended_at IS NULL) AS active_since,
         MAX(start_address) FILTER (WHERE ended_at IS NULL) AS active_address
       FROM project_work_sessions
       WHERE project_id = ANY($1)
       GROUP BY project_id, user_id
       ORDER BY MAX(user_name)`,
      [projectIds]
    ),
  ]);
  const entry = (projectId) => {
    if (!byProject.has(projectId)) byProject.set(projectId, { steps: [], crew: [] });
    return byProject.get(projectId);
  };
  for (const row of steps.rows) {
    entry(row.project_id).steps.push({
      itemKey: row.end_item_key,
      percent: row.end_percent,
      minutes: row.minutes,
      updatedAt: row.ended_at,
      updatedByName: row.user_name,
      gpsAddress: row.end_address || null,
      gpsLatitude: row.end_latitude ?? null,
      gpsLongitude: row.end_longitude ?? null,
    });
  }
  for (const row of crew.rows) {
    entry(row.project_id).crew.push({
      userId: row.user_id,
      name: row.user_name,
      minutes: row.minutes,
      activeSince: row.active_since || null,
      activeAddress: row.active_address || null,
    });
  }
  return byProject;
}

export async function getProjectWorkSummary(projectId) {
  const byProject = await getProjectWorkSummaryForMany([projectId]);
  return byProject.get(projectId) || { steps: [], crew: [] };
}
