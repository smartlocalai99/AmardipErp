import { query } from "./db.js";

// The 52-step installation sequence from the paper "Erection Sheet" form
// technicians fill out on site — grouped into the same real inspection
// stages the form itself marks out (STAGE ONE / STAGE TWO INSPECTION), plus
// the natural phases either side of them. This is a fixed, shared sequence
// (not per-project custom data), so it lives as a constant rather than rows
// staff could edit.
export const PROJECT_CHECKLIST_PHASES = [
  {
    phase: "Site & Template",
    items: [
      "SITE PREPARATION",
      "TEMPLATE PREPARATION",
      "HOLE MARKING FOR MOTOR CHANNELS",
      "TEMPLATE FIXING AT SITE",
      "TEMPLATE MEASUREMENTS",
      "STAGE ONE INSPECTION",
    ],
  },
  {
    phase: "Brackets & Rails",
    items: [
      "BRACKET MARKING",
      "BRACKET SETTING",
      "ANCHORING",
      "BRACKET FIXING",
      "RAIL LIFTING INTO SHAFT",
      "RAIL ALIGNMENT CAR",
      "RAIL ALIGNMENT COUNTER WEIGHT",
      "STAGE TWO INSPECTION",
    ],
  },
  {
    phase: "Shaft, Motor & Roping",
    items: [
      "HOLE PREPARATION",
      "CLEANING THE BRACKETS, MACHINE ROOM AND PIT",
      "DOOR FRAME FIXING",
      "SLING WORK",
      "COUNTER WEIGHT INTO SHAFT",
      "MOTOR ALIGNMENT",
      "WELDING WORK AT MOTOR BASE CHANNEL",
      "ROPE MEASUREMENT",
      "ROPE CUTTING",
      "ROPING AT SITE",
      "CONTROLLER AND ARD FIXING",
      "MACHINE ROOM WIRING",
      "LANDING WIRING",
    ],
  },
  {
    phase: "Doors, Platform & Cabin",
    items: [
      "MOVEMENT TAKING",
      "BUFFER SPRING MARKING",
      "BUFFER SPRING FIXING",
      "PLATFORM FIXING",
      "CLEANING THE SHAFT, MACHINE ROOM AND PIT",
      "LANDING DOORS FIXING",
      "GATE LOCK WIRING",
      "CABIN FIXING",
      "ADDING COUNTER WEIGHTS",
      "GROUND FLOOR LANDING / CAR DOOR FIXING",
      "CAM / UP / DOWN / LIMITS / RCR FIXING",
    ],
  },
  {
    phase: "Wiring & Controls",
    items: [
      "CAR TOP WIRING",
      "TRAVELLING CABLE MEASUREMENT",
      "TRAVELLING CABLE CUTTING",
      "TRAVELLING CABLE CONNECTIONS AT BOTH ENDS",
      "LOP MARKING HOLES AND FIXING",
      "COP FIXING",
      "DOOR SENSOR CONNECTIONS",
      "DOOR DRIVE CONNECTIONS",
      "CHECK ALL ELECTRICAL CONNECTIONS AS PER PROTOCOL",
    ],
  },
  {
    phase: "Final Commissioning",
    items: [
      "PREPARATION FOR NORMALLING, OIL CAN / MAGNETS/ CLEANING",
      "LIFT NORMAL",
      "FINAL INSPECTION",
      "STICKER REMOVING",
      "OSG FIXING/ROPE CUTTING/ROPE FIXING",
    ],
  },
];

export const PROJECT_CHECKLIST_ITEMS = PROJECT_CHECKLIST_PHASES.flatMap((p) => p.items);
const VALID_ITEMS = new Set(PROJECT_CHECKLIST_ITEMS);

export function isValidChecklistItem(itemKey) {
  return VALID_ITEMS.has(itemKey);
}

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
    "SELECT item_key, completed_at, completed_by_username FROM project_checklist_completions WHERE project_id = $1",
    [projectId]
  );
  return result.rows.map((row) => ({
    itemKey: row.item_key,
    completedAt: row.completed_at,
    completedByUsername: row.completed_by_username,
  }));
}

export async function getProjectChecklistCompletionsForMany(projectIds) {
  await ensureProjectChecklistTable();
  if (projectIds.length === 0) return new Map();
  const result = await query(
    "SELECT project_id, item_key, completed_at, completed_by_username FROM project_checklist_completions WHERE project_id = ANY($1)",
    [projectIds]
  );
  const byProject = new Map();
  for (const row of result.rows) {
    const list = byProject.get(row.project_id) || [];
    list.push({ itemKey: row.item_key, completedAt: row.completed_at, completedByUsername: row.completed_by_username });
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
