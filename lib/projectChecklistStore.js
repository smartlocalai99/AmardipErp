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
  `);
  tableReady = true;
}

export async function getProjectChecklistCompletions(projectId) {
  await ensureProjectChecklistTable();
  const result = await query(
    `SELECT c.item_key, c.completed_at, c.completed_by_username, u.name AS completed_by_name
     FROM project_checklist_completions c
     LEFT JOIN users u ON u.id = c.completed_by_user_id
     WHERE c.project_id = $1`,
    [projectId]
  );
  return result.rows.map((row) => ({
    itemKey: row.item_key,
    completedAt: row.completed_at,
    completedByUsername: row.completed_by_username,
    completedByName: row.completed_by_name,
  }));
}

export async function getProjectChecklistCompletionsForMany(projectIds) {
  await ensureProjectChecklistTable();
  if (projectIds.length === 0) return new Map();
  const result = await query(
    `SELECT c.project_id, c.item_key, c.completed_at, c.completed_by_username, u.name AS completed_by_name
     FROM project_checklist_completions c
     LEFT JOIN users u ON u.id = c.completed_by_user_id
     WHERE c.project_id = ANY($1)`,
    [projectIds]
  );
  const byProject = new Map();
  for (const row of result.rows) {
    const list = byProject.get(row.project_id) || [];
    list.push({
      itemKey: row.item_key,
      completedAt: row.completed_at,
      completedByUsername: row.completed_by_username,
      completedByName: row.completed_by_name,
    });
    byProject.set(row.project_id, list);
  }
  return byProject;
}

export async function setProjectChecklistItem({ projectId, itemKey, completed, actor }) {
  await ensureProjectChecklistTable();
  if (!isValidChecklistItem(itemKey)) throw new Error("Unknown checklist item.");

  if (completed) {
    await query(
      `INSERT INTO project_checklist_completions (project_id, item_key, completed_by_user_id, completed_by_username)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, item_key) DO NOTHING`,
      [projectId, itemKey, actor?.id || null, actor?.username || actor?.name || null]
    );
  } else {
    await query("DELETE FROM project_checklist_completions WHERE project_id = $1 AND item_key = $2", [projectId, itemKey]);
  }

  return getProjectChecklistCompletions(projectId);
}
