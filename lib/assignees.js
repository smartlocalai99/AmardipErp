import { query } from "./db.js";
import { PROJECT_CHECKLIST_ITEMS } from "./projectChecklist.js";
import { ensureProjectChecklistTable } from "./projectChecklistStore.js";

let readyPromise = null;

// Additive join tables: each keeps the existing single
// assigned_technician_user_id/assigned_technician_name columns on
// complaints/service_schedules as the "primary" assignee (everything that
// already reads those columns — worker permission checks, push targeting,
// status-change rules — keeps working unchanged), while these tables hold
// the full set of assigned workers for multi-assignment.
export async function ensureAssigneeTables() {
  if (readyPromise) return readyPromise;
  readyPromise = query(`
    CREATE TABLE IF NOT EXISTS complaint_assignees (
      complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (complaint_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_complaint_assignees_user ON complaint_assignees(user_id);

    CREATE TABLE IF NOT EXISTS service_schedule_assignees (
      schedule_id UUID NOT NULL REFERENCES service_schedules(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (schedule_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_service_schedule_assignees_user ON service_schedule_assignees(user_id);

    CREATE TABLE IF NOT EXISTS project_assignees (
      project_id UUID NOT NULL REFERENCES quotation_projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_assignees_user ON project_assignees(user_id);
  `).catch((error) => {
    readyPromise = null;
    throw error;
  });
  return readyPromise;
}

async function replaceAssignees(table, idColumn, entityId, userIds) {
  await ensureAssigneeTables();
  const uniqueIds = [...new Set(userIds.map(Number).filter(Boolean))];
  // Keep unchanged assignments (and their original assigned_at values).
  // One statement also prevents a failed insert leaving a job unassigned.
  await query(`
    WITH removed AS (
      DELETE FROM ${table}
      WHERE ${idColumn} = $1 AND NOT (user_id = ANY($2::int[]))
    )
    INSERT INTO ${table} (${idColumn}, user_id)
    SELECT $1, requested.user_id
    FROM unnest($2::int[]) AS requested(user_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM ${table} existing
      WHERE existing.${idColumn} = $1 AND existing.user_id = requested.user_id
    )
    ON CONFLICT DO NOTHING
  `, [entityId, uniqueIds]);
  return uniqueIds;
}

async function listAssignees(table, idColumn, entityId) {
  await ensureAssigneeTables();
  const result = await query(
    `SELECT u.id, u.name, u.phone FROM ${table} t JOIN users u ON u.id = t.user_id WHERE t.${idColumn} = $1 ORDER BY u.name`,
    [entityId],
  );
  return result.rows;
}

async function listAssigneesForMany(table, idColumn, entityIds) {
  await ensureAssigneeTables();
  if (entityIds.length === 0) return new Map();
  const result = await query(
    `SELECT t.${idColumn} AS entity_id, u.id, u.name, u.phone FROM ${table} t JOIN users u ON u.id = t.user_id WHERE t.${idColumn} = ANY($1) ORDER BY u.name`,
    [entityIds],
  );
  const byEntity = new Map();
  for (const row of result.rows) {
    const list = byEntity.get(row.entity_id) || [];
    list.push({ id: row.id, name: row.name, phone: row.phone });
    byEntity.set(row.entity_id, list);
  }
  return byEntity;
}

export const setComplaintAssignees = (complaintId, userIds) => replaceAssignees("complaint_assignees", "complaint_id", complaintId, userIds);
export const getComplaintAssignees = (complaintId) => listAssignees("complaint_assignees", "complaint_id", complaintId);
export const getComplaintAssigneesForMany = (complaintIds) => listAssigneesForMany("complaint_assignees", "complaint_id", complaintIds);
export const isComplaintAssignee = async (complaintId, userId) => {
  await ensureAssigneeTables();
  const result = await query("SELECT 1 FROM complaint_assignees WHERE complaint_id = $1 AND user_id = $2 LIMIT 1", [complaintId, userId]);
  return result.rowCount > 0;
};

export const setScheduleAssignees = (scheduleId, userIds) => replaceAssignees("service_schedule_assignees", "schedule_id", scheduleId, userIds);
export const getScheduleAssignees = (scheduleId) => listAssignees("service_schedule_assignees", "schedule_id", scheduleId);
export const getScheduleAssigneesForMany = (scheduleIds) => listAssigneesForMany("service_schedule_assignees", "schedule_id", scheduleIds);

export const setProjectAssignees = (projectId, userIds) => replaceAssignees("project_assignees", "project_id", projectId, userIds);
export const getProjectAssignees = (projectId) => listAssignees("project_assignees", "project_id", projectId);
export const getProjectAssigneesForMany = (projectIds) => listAssigneesForMany("project_assignees", "project_id", projectIds);

// What every technician is actually doing right now, for the Service Crew
// list — one query per work type (projects, service visits, breakdowns),
// each covering every worker at once rather than per-technician round
// trips. Picks the most relevant single item per technician: prefer
// whatever's still active; if nothing's active, fall back to their most
// recently touched assignment of any kind, labeled as their last one.
export async function getAllTechnicianCurrentWork() {
  await Promise.all([ensureAssigneeTables(), ensureProjectChecklistTable()]);
  const totalSteps = PROJECT_CHECKLIST_ITEMS.length;

  const [projectRows, serviceRows, complaintRows] = await Promise.all([
    query(`
      SELECT pa.user_id AS technician_id, c.customer_name, p.started_at,
        COUNT(pcc.item_key)::int AS completed_steps, p.updated_at
      FROM project_assignees pa
      JOIN users u ON u.id = pa.user_id AND u.role = 'worker'
      JOIN quotation_projects p ON p.id = pa.project_id
      JOIN elevator_service_customers c ON c.id = p.customer_id
      LEFT JOIN project_checklist_completions pcc ON pcc.project_id = p.id
      GROUP BY pa.user_id, c.customer_name, p.started_at, p.updated_at
    `),
    query(`
      SELECT sa.user_id AS technician_id, c.customer_name, s.status, s.updated_at
      FROM service_schedule_assignees sa
      JOIN users u ON u.id = sa.user_id AND u.role = 'worker'
      JOIN service_schedules s ON s.id = sa.schedule_id
      JOIN elevator_service_customers c ON c.id = s.customer_id
    `),
    query(`
      SELECT ca.user_id AS technician_id, co.customer_name, co.status, co.complaint_type, co.updated_at
      FROM complaint_assignees ca
      JOIN users u ON u.id = ca.user_id AND u.role = 'worker'
      JOIN complaints co ON co.id = ca.complaint_id
    `),
  ]);

  const items = [];
  for (const row of projectRows.rows) {
    items.push({
      technicianId: row.technician_id,
      type: "project",
      label: `Installing at ${row.customer_name}`,
      isActive: Boolean(row.started_at) && Number(row.completed_steps) < totalSteps,
      activityAt: row.updated_at,
    });
  }
  for (const row of serviceRows.rows) {
    items.push({
      technicianId: row.technician_id,
      type: "service",
      label: `Service visit at ${row.customer_name}`,
      isActive: !["COMPLETED", "CANCELLED"].includes(row.status),
      activityAt: row.updated_at,
    });
  }
  for (const row of complaintRows.rows) {
    const isService = row.complaint_type === "SERVICE_REQUEST";
    items.push({
      technicianId: row.technician_id,
      type: isService ? "service" : "breakdown",
      label: `${isService ? "Service visit" : "Breakdown"} at ${row.customer_name}`,
      isActive: !["RESOLVED", "CLOSED", "CANCELLED"].includes(row.status),
      activityAt: row.updated_at,
    });
  }

  const byTechnician = new Map();
  for (const item of items) {
    const current = byTechnician.get(item.technicianId);
    if (!current) {
      byTechnician.set(item.technicianId, item);
      continue;
    }
    const better =
      (item.isActive && !current.isActive) ||
      (item.isActive === current.isActive && new Date(item.activityAt) > new Date(current.activityAt));
    if (better) byTechnician.set(item.technicianId, item);
  }
  return byTechnician;
}
