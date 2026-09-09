import { query } from "./db.js";

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
