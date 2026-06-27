import { query } from "./db.js";

export const COMPLAINT_STATUSES = ["UNASSIGNED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];
export const COMPLAINT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "EMERGENCY"];
export const COMPLAINT_TYPES = [
  "BREAKDOWN",
  "DOOR_ISSUE",
  "MOTOR_ISSUE",
  "NOISE",
  "SERVICE_REQUEST",
  "AMC_QUERY",
  "PAYMENT_QUERY",
  "OTHER",
];

let complaintsTableReady = false;

function trimToNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeEnum(value, allowed, fallback, label) {
  const normalized = trimToNull(value)?.toUpperCase().replace(/[\s-]+/g, "_") || fallback;
  if (!allowed.includes(normalized)) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

export function buildComplaintNo({ yearMonth, sequence }) {
  return `CMP-${yearMonth}-${String(sequence).padStart(4, "0")}`;
}

export function normalizeComplaintInput(input = {}) {
  const complaintType = normalizeEnum(input.complaintType ?? input.complaint_type, COMPLAINT_TYPES, null, "complaint type");
  const priority = normalizeEnum(input.priority, COMPLAINT_PRIORITIES, "NORMAL", "priority");
  const description = trimToNull(input.description);

  if (!description) {
    throw new Error("Description is required.");
  }

  return {
    complaintType,
    priority,
    description,
    customerNotes: trimToNull(input.customerNotes ?? input.customer_notes),
    officeNotes: trimToNull(input.officeNotes ?? input.office_notes),
    adminNotes: trimToNull(input.adminNotes ?? input.admin_notes),
  };
}

export function normalizeComplaintRow(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    complaintNo: row.complaint_no,
    customerName: row.customer_name,
    mobileNo: row.mobile_no || null,
    city: row.city || null,
    address: row.address || null,
    customerCode: row.customer_code || null,
    customerId: row.customer_id || null,
    customerUserId: row.customer_user_id || null,
    complaintType: row.complaint_type || null,
    priority: row.priority || null,
    status: row.status || null,
    description: row.description || null,
    customerNotes: row.customer_notes || null,
    officeNotes: row.office_notes || null,
    adminNotes: row.admin_notes || null,
    assignedTechnicianUserId: row.assigned_technician_user_id || null,
    assignedTechnicianName: row.assigned_technician_name || null,
    assignedByUsername: row.assigned_by_username || null,
    assignedAt: row.assigned_at || null,
    raisedByUsername: row.raised_by_username || null,
    raisedByRole: row.raised_by_role || null,
    resolvedAt: row.resolved_at || null,
    closedAt: row.closed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function ensureComplaintsTable() {
  if (complaintsTableReady) return;

  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS complaints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      complaint_no TEXT UNIQUE NOT NULL,
      customer_id UUID REFERENCES elevator_service_customers(id) ON DELETE SET NULL,
      customer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_code TEXT,
      customer_name TEXT NOT NULL,
      mobile_no TEXT,
      city TEXT,
      address TEXT,
      complaint_type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      status TEXT NOT NULL DEFAULT 'UNASSIGNED',
      description TEXT NOT NULL,
      customer_notes TEXT,
      office_notes TEXT,
      admin_notes TEXT,
      assigned_technician_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_technician_name TEXT,
      assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_by_username TEXT,
      assigned_at TIMESTAMPTZ,
      raised_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      raised_by_username TEXT,
      raised_by_role TEXT,
      resolved_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_complaints_customer_id ON complaints(customer_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_customer_user_id ON complaints(customer_user_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
    CREATE INDEX IF NOT EXISTS idx_complaints_type ON complaints(complaint_type);
    CREATE INDEX IF NOT EXISTS idx_complaints_assigned_worker ON complaints(assigned_technician_user_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);
  `);

  complaintsTableReady = true;
}

export async function generateComplaintNo(now = new Date()) {
  await ensureComplaintsTable();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = await query(
    `
    SELECT complaint_no
    FROM complaints
    WHERE complaint_no LIKE $1
    ORDER BY complaint_no DESC
    LIMIT 1
    `,
    [`CMP-${yearMonth}-%`]
  );
  const last = result.rows[0]?.complaint_no;
  const nextSequence = last ? Number(last.split("-").pop()) + 1 : 1;
  return buildComplaintNo({ yearMonth, sequence: nextSequence });
}

async function getCustomerSnapshot({ customerId, actor, manual = {} }) {
  if (customerId) {
    const customerResult = await query(
      `
      SELECT id, customer_code, customer_name, mobile_no, city, address
      FROM elevator_service_customers
      WHERE id = $1
      LIMIT 1
      `,
      [customerId]
    );
    const customer = customerResult.rows[0];
    if (!customer) throw new Error("Customer not found.");
    return {
      customerId: customer.id,
      customerUserId: actor?.role === "customer" ? actor.id : null,
      customerCode: customer.customer_code || null,
      customerName: customer.customer_name,
      mobileNo: customer.mobile_no || null,
      city: customer.city || null,
      address: customer.address || null,
    };
  }

  if (actor?.role === "customer") {
    // TODO: replace this fallback with an explicit users-to-elevator-customers mapping table.
    const phone = trimToNull(actor.username) || trimToNull(actor.phone);
    if (phone) {
      const match = await query(
        `
        SELECT id, customer_code, customer_name, mobile_no, city, address
        FROM elevator_service_customers
        WHERE regexp_replace(COALESCE(mobile_no, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
        ORDER BY customer_name
        LIMIT 1
        `,
        [phone]
      );
      const customer = match.rows[0];
      if (customer) {
        return {
          customerId: customer.id,
          customerUserId: actor.id,
          customerCode: customer.customer_code || null,
          customerName: customer.customer_name,
          mobileNo: customer.mobile_no || null,
          city: customer.city || null,
          address: customer.address || null,
        };
      }
    }
  }

  const customerName = trimToNull(manual.customerName ?? manual.customer_name) || actor?.name || actor?.username;
  if (!customerName) throw new Error("Customer name is required.");
  return {
    customerId: null,
    customerUserId: actor?.role === "customer" ? actor.id : null,
    customerCode: trimToNull(manual.customerCode ?? manual.customer_code),
    customerName,
    mobileNo: trimToNull(manual.mobileNo ?? manual.mobile_no ?? actor?.phone),
    city: trimToNull(manual.city),
    address: trimToNull(manual.address),
  };
}

export async function createComplaint({ actor, input }) {
  await ensureComplaintsTable();
  const normalized = normalizeComplaintInput(input);
  const snapshot = await getCustomerSnapshot({
    customerId: trimToNull(input.customerId ?? input.customer_id),
    actor,
    manual: input,
  });
  const complaintNo = await generateComplaintNo();

  const result = await query(
    `
    INSERT INTO complaints (
      complaint_no, customer_id, customer_user_id, customer_code, customer_name, mobile_no, city, address,
      complaint_type, priority, status, description, customer_notes, office_notes, admin_notes,
      raised_by_user_id, raised_by_username, raised_by_role
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'UNASSIGNED', $11, $12, $13, $14, $15, $16, $17)
    RETURNING *
    `,
    [
      complaintNo,
      snapshot.customerId,
      snapshot.customerUserId,
      snapshot.customerCode,
      snapshot.customerName,
      snapshot.mobileNo,
      snapshot.city,
      snapshot.address,
      normalized.complaintType,
      normalized.priority,
      normalized.description,
      normalized.customerNotes,
      normalized.officeNotes,
      normalized.adminNotes,
      actor?.id || null,
      actor?.username || actor?.name || null,
      actor?.role || null,
    ]
  );

  return normalizeComplaintRow(result.rows[0]);
}

export function buildComplaintWhere({ actor, filters = {}, workerOnly = false, customerOnly = false }) {
  const clauses = [];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (workerOnly) {
    clauses.push(`assigned_technician_user_id = ${add(actor.id)}`);
  }

  if (customerOnly) {
    clauses.push(`(customer_user_id = ${add(actor.id)} OR regexp_replace(COALESCE(mobile_no, ''), '\\D', '', 'g') = regexp_replace(${add(actor.username || "")}, '\\D', '', 'g'))`);
  }

  if (filters.status) clauses.push(`status = ${add(normalizeEnum(filters.status, COMPLAINT_STATUSES, null, "status"))}`);
  if (filters.priority) clauses.push(`priority = ${add(normalizeEnum(filters.priority, COMPLAINT_PRIORITIES, null, "priority"))}`);
  if (filters.complaintType) clauses.push(`complaint_type = ${add(normalizeEnum(filters.complaintType, COMPLAINT_TYPES, null, "complaint type"))}`);
  if (filters.assignedTechnicianUserId) clauses.push(`assigned_technician_user_id = ${add(Number(filters.assignedTechnicianUserId))}`);
  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    clauses.push(`(
      complaint_no ILIKE ${add(term)} OR
      customer_name ILIKE ${add(term)} OR
      COALESCE(mobile_no, '') ILIKE ${add(term)} OR
      COALESCE(city, '') ILIKE ${add(term)} OR
      description ILIKE ${add(term)}
    )`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function listComplaints({ actor, filters = {}, page = 1, pageSize = 25, workerOnly = false, customerOnly = false }) {
  await ensureComplaintsTable();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const { whereSql, params } = buildComplaintWhere({ actor, filters, workerOnly, customerOnly });
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM complaints ${whereSql}`, params);
  const dataParams = [...params, safePageSize, (safePage - 1) * safePageSize];
  const dataResult = await query(
    `
    SELECT *
    FROM complaints
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `,
    dataParams
  );

  return {
    rows: dataResult.rows.map(normalizeComplaintRow),
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getComplaintStats() {
  await ensureComplaintsTable();
  const result = await query(`
    SELECT
      COUNT(*)::int AS total_complaints,
      COUNT(*) FILTER (WHERE status = 'UNASSIGNED')::int AS unassigned_complaints,
      COUNT(*) FILTER (WHERE status = 'ASSIGNED')::int AS assigned_complaints,
      COUNT(*) FILTER (WHERE priority = 'EMERGENCY')::int AS emergency_complaints,
      COUNT(*) FILTER (WHERE status IN ('UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS'))::int AS open_complaints,
      COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED'))::int AS resolved_complaints,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today_complaints
    FROM complaints
  `);
  const row = result.rows[0] || {};
  return {
    totalComplaints: row.total_complaints || 0,
    unassignedComplaints: row.unassigned_complaints || 0,
    assignedComplaints: row.assigned_complaints || 0,
    emergencyComplaints: row.emergency_complaints || 0,
    openComplaints: row.open_complaints || 0,
    resolvedComplaints: row.resolved_complaints || 0,
    todayComplaints: row.today_complaints || 0,
  };
}

export async function getComplaintById(id) {
  await ensureComplaintsTable();
  const result = await query("SELECT * FROM complaints WHERE id = $1 LIMIT 1", [id]);
  return normalizeComplaintRow(result.rows[0]);
}

export function canViewComplaint(actor, complaint) {
  if (!actor || !complaint) return false;
  if (["superadmin", "admin", "manager", "front_office"].includes(actor.role)) return true;
  if (actor.role === "worker") return Number(complaint.assignedTechnicianUserId) === Number(actor.id);
  if (actor.role === "customer") {
    return Number(complaint.customerUserId) === Number(actor.id) || complaint.mobileNo === actor.username;
  }
  return false;
}

export async function assignComplaintToWorker({ complaintId, workerUserId, actor, assignmentNotes = null }) {
  await ensureComplaintsTable();
  const workerResult = await query("SELECT id, username, name, role FROM users WHERE id = $1 AND role = 'worker' LIMIT 1", [workerUserId]);
  const worker = workerResult.rows[0];
  if (!worker) throw new Error("Worker not found.");

  const result = await query(
    `
    UPDATE complaints
    SET assigned_technician_user_id = $1,
        assigned_technician_name = $2,
        assigned_by_user_id = $3,
        assigned_by_username = $4,
        assigned_at = NOW(),
        status = 'ASSIGNED',
        admin_notes = COALESCE($5, admin_notes),
        updated_at = NOW()
    WHERE id = $6
    RETURNING *
    `,
    [
      worker.id,
      worker.name || worker.username,
      actor?.id || null,
      actor?.username || actor?.name || null,
      trimToNull(assignmentNotes),
      complaintId,
    ]
  );
  if (!result.rows[0]) throw new Error("Complaint not found.");
  return normalizeComplaintRow(result.rows[0]);
}

export async function updateComplaintStatus({ complaintId, status, actor, notes = null }) {
  await ensureComplaintsTable();
  const normalizedStatus = normalizeEnum(status, COMPLAINT_STATUSES, null, "status");
  const result = await query(
    `
    UPDATE complaints
    SET status = $1,
        admin_notes = CASE WHEN $2::text IS NULL THEN admin_notes ELSE $2 END,
        resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW() ELSE resolved_at END,
        closed_at = CASE WHEN $1 = 'CLOSED' THEN NOW() ELSE closed_at END,
        updated_at = NOW()
    WHERE id = $3
      AND (
        $4::text IN ('superadmin', 'admin', 'manager', 'front_office')
        OR ($4::text = 'worker' AND assigned_technician_user_id = $5 AND $1 IN ('IN_PROGRESS', 'RESOLVED'))
      )
    RETURNING *
    `,
    [normalizedStatus, trimToNull(notes), complaintId, actor?.role || "", actor?.id || null]
  );
  if (!result.rows[0]) throw new Error("Complaint not found or update not allowed.");
  return normalizeComplaintRow(result.rows[0]);
}
