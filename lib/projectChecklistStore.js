import { query } from "./db.js";
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
  // lib/reverseGeocode.js). project_site_checkins is each crew member's
  // one-time GPS check-in when they start work on the project — the
  // earliest one is when work on site actually began. One row per worker
  // per project; user_id has no FK so removing a user never erases the
  // site record.
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

    CREATE TABLE IF NOT EXISTS project_site_checkins (
      project_id UUID NOT NULL REFERENCES quotation_projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gps_latitude DOUBLE PRECISION,
      gps_longitude DOUBLE PRECISION,
      gps_accuracy_meters DOUBLE PRECISION,
      gps_address TEXT,
      PRIMARY KEY (project_id, user_id)
    );
  `);
  tableReady = true;
}

const COMPLETION_COLUMNS = `c.item_key, c.completed_at, c.completed_by_username, u.name AS completed_by_name,
       c.gps_latitude, c.gps_longitude, c.gps_address`;

function normalizeCompletion(row) {
  return {
    itemKey: row.item_key,
    completedAt: row.completed_at,
    completedByUsername: row.completed_by_username,
    completedByName: row.completed_by_name,
    gpsLatitude: row.gps_latitude ?? null,
    gpsLongitude: row.gps_longitude ?? null,
    gpsAddress: row.gps_address || null,
  };
}

function normalizeCheckIn(row) {
  return {
    userId: row.user_id,
    name: row.user_name,
    checkedInAt: row.checked_in_at,
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

export async function getProjectSiteCheckIns(projectId) {
  await ensureProjectChecklistTable();
  const result = await query(
    `SELECT user_id, user_name, checked_in_at, gps_latitude, gps_longitude, gps_address
     FROM project_site_checkins WHERE project_id = $1 ORDER BY checked_in_at`,
    [projectId]
  );
  return result.rows.map(normalizeCheckIn);
}

export async function getProjectSiteCheckInsForMany(projectIds) {
  await ensureProjectChecklistTable();
  if (projectIds.length === 0) return new Map();
  const result = await query(
    `SELECT project_id, user_id, user_name, checked_in_at, gps_latitude, gps_longitude, gps_address
     FROM project_site_checkins WHERE project_id = ANY($1) ORDER BY checked_in_at`,
    [projectIds]
  );
  const byProject = new Map();
  for (const row of result.rows) {
    const list = byProject.get(row.project_id) || [];
    list.push(normalizeCheckIn(row));
    byProject.set(row.project_id, list);
  }
  return byProject;
}

// A worker's one-time "started work at site" check-in. Repeat taps keep the
// first record. Returns whether this call created it, plus the project's
// check-ins.
export async function recordProjectSiteCheckIn({ projectId, actor, gps = {} }) {
  await ensureProjectChecklistTable();
  const inserted = await query(
    `INSERT INTO project_site_checkins (project_id, user_id, user_name, gps_latitude, gps_longitude, gps_accuracy_meters, gps_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (project_id, user_id) DO NOTHING
     RETURNING user_id`,
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
  return { inserted: inserted.rowCount > 0, siteCheckIns: await getProjectSiteCheckIns(projectId) };
}

export async function setProjectChecklistItem({ projectId, itemKey, completed, actor, gps = {} }) {
  await ensureProjectChecklistTable();
  if (!isValidChecklistItem(itemKey)) throw new Error("Unknown checklist item.");

  if (completed) {
    await query(
      `INSERT INTO project_checklist_completions
         (project_id, item_key, completed_by_user_id, completed_by_username, gps_latitude, gps_longitude, gps_accuracy_meters, gps_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id, item_key) DO NOTHING`,
      [
        projectId,
        itemKey,
        actor?.id || null,
        actor?.username || actor?.name || null,
        finiteOrNull(gps.latitude),
        finiteOrNull(gps.longitude),
        finiteOrNull(gps.accuracy),
        gps.address || null,
      ]
    );
  } else {
    await query("DELETE FROM project_checklist_completions WHERE project_id = $1 AND item_key = $2", [projectId, itemKey]);
  }

  return getProjectChecklistCompletions(projectId);
}
