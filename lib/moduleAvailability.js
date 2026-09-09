import { query } from "@/lib/db";

function quoteIdentifier(name) {
  return String(name)
    .split(".")
    .map((part) => `"${part.replaceAll('"', '""')}"`)
    .join(".");
}

export async function tableExists(tableName) {
  const result = await query("SELECT to_regclass($1) AS table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

export async function safeCount(tableName, whereClause = "", params = []) {
  const exists = await tableExists(tableName);
  if (!exists) return 0;

  const whereSql = whereClause ? ` WHERE ${whereClause}` : "";
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)}${whereSql}`,
    params
  );

  return result.rows[0]?.count || 0;
}

function state(enabled, count, activeReason, waitingReason) {
  return {
    enabled,
    count,
    reason: enabled ? activeReason : waitingReason,
  };
}

export async function getModuleAvailability() {
  const tableNames = [
    "elevator_service_customers", "elevator_service_visits", "service_schedules",
    "inventory_items", "complaints", "users", "quotation_requests",
  ];
  // Discover optional modules in one round trip, then avoid referencing any
  // missing relation in the totals query. Customer counts share one scan.
  const tables = await query(`
    SELECT table_name, to_regclass(table_name)::text AS relation
    FROM unnest($1::text[]) AS requested(table_name)
  `, [tableNames]);
  const existing = new Set(tables.rows.filter((row) => row.relation).map((row) => row.table_name));
  const countSql = (tableName, whereSql = "") => existing.has(tableName)
    ? `(SELECT COUNT(*)::int FROM ${quoteIdentifier(tableName)}${whereSql ? ` WHERE ${whereSql}` : ""})`
    : "0::int";
  const customerSql = existing.has("elevator_service_customers")
    ? `SELECT COUNT(*)::int AS customer_count,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) = 'AMC')::int AS amc_count,
        COUNT(*) FILTER (WHERE UPPER(TRIM(customer_status)) IN ('AMC', 'EMC', 'WARRANTY'))::int AS active_service_plan_customer_count
       FROM elevator_service_customers`
    : "SELECT 0::int AS customer_count, 0::int AS amc_count, 0::int AS active_service_plan_customer_count";
  const result = await query(`
    WITH customer_counts AS (${customerSql})
    SELECT customer_counts.*,
      ${countSql("elevator_service_visits")} AS service_visit_count,
      ${countSql("service_schedules")} AS schedule_count,
      ${countSql("inventory_items")} AS inventory_count,
      ${countSql("complaints")} AS complaint_count,
      ${countSql("users", "role = 'worker'")} AS technician_count,
      ${countSql("quotation_requests")} AS quotation_count
    FROM customer_counts
  `);
  const row = result.rows[0] || {};
  const customerCount = row.customer_count || 0;
  const amcCount = row.amc_count || 0;
  const serviceVisitCount = row.service_visit_count || 0;
  const scheduleCount = row.schedule_count || 0;
  const activeServicePlanCustomerCount = row.active_service_plan_customer_count || 0;
  const inventoryCount = row.inventory_count || 0;
  const complaintCount = row.complaint_count || 0;
  const technicianCount = row.technician_count || 0;
  const quotationCount = row.quotation_count || 0;

  const servicePlannerCount = scheduleCount + activeServicePlanCustomerCount;
  const reportsCount = customerCount + serviceVisitCount;
  const storeCount = inventoryCount;

  return {
    dashboard: { enabled: true, count: 1, reason: "Dashboard available" },
    customers: state(customerCount > 0, customerCount, "Customer data available", "Waiting for client customer data"),
    amc: state(amcCount > 0, amcCount, "AMC customers available", "Waiting for AMC customer data"),
    serviceVisits: state(serviceVisitCount > 0, serviceVisitCount, "Service history available", "Waiting for service history data"),
    servicePlanner: state(servicePlannerCount > 0, servicePlannerCount, "Monthly service planning available", "Waiting for service planning data"),
    reports: state(reportsCount > 0, reportsCount, "Reports available from customer/service data", "Waiting for report source data"),
    profile: { enabled: true, count: 1, reason: "Profile available" },
    faceLock: { enabled: true, count: 1, reason: "Face Lock available" },
    users: { enabled: true, count: 1, reason: "User management available" },

    complaints: { enabled: true, count: complaintCount, reason: "DB-backed complaint flow available" },
    quotations: { enabled: true, count: quotationCount, reason: "Quotation and BOQ module available" },
    inventory: state(inventoryCount > 0, inventoryCount, "Inventory data available", "Waiting for client inventory data"),
    technicians: state(technicianCount > 0, technicianCount, "Technician data available", "Waiting for client staff/technician data"),
    store: state(storeCount > 0, storeCount, "Store inventory data available", "Waiting for inventory data"),
    notifications: { enabled: false, count: 0, reason: "Notification data not configured yet" },
    leads: { enabled: false, count: 0, reason: "Leads hidden; quotations are the active sales module" },
    customerPortal: { enabled: false, count: 0, reason: "Customer portal data is not linked yet" },
    technicianJobs: { enabled: true, count: complaintCount, reason: "Worker assigned complaints available" },
  };
}
