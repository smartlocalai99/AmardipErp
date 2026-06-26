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

async function firstExistingCount(tableNames) {
  for (const tableName of tableNames) {
    const count = await safeCount(tableName);
    if (count > 0) return count;
  }

  return 0;
}

function state(enabled, count, activeReason, waitingReason) {
  return {
    enabled,
    count,
    reason: enabled ? activeReason : waitingReason,
  };
}

export async function getModuleAvailability() {
  const [
    customerCount,
    amcCount,
    serviceVisitCount,
    scheduleCount,
    activeServicePlanCustomerCount,
    inventoryCount,
    complaintCount,
    technicianCount,
    materialRequestCount,
    leadsCount,
  ] = await Promise.all([
    safeCount("elevator_service_customers"),
    safeCount("elevator_service_customers", "UPPER(TRIM(customer_status)) = $1", ["AMC"]),
    safeCount("elevator_service_visits"),
    safeCount("service_schedules"),
    safeCount(
      "elevator_service_customers",
      "UPPER(TRIM(customer_status)) IN ('AMC', 'EMC', 'WARRANTY')"
    ),
    safeCount("inventory_items"),
    safeCount("complaints"),
    safeCount("users", "role = $1 AND username <> $2", ["worker", "tech50"]),
    firstExistingCount(["material_requests", "inventory_requests", "store_material_requests"]),
    firstExistingCount(["leads", "inquiries", "customer_inquiries"]),
  ]);

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

    complaints: state(complaintCount > 0, complaintCount, "Complaint data available", "Waiting for client complaint data/module setup"),
    inventory: state(inventoryCount > 0, inventoryCount, "Inventory data available", "Waiting for client inventory data"),
    technicians: state(technicianCount > 0, technicianCount, "Technician data available", "Waiting for client staff/technician data"),
    store: state(storeCount > 0, storeCount, "Store inventory data available", "Waiting for inventory data"),
    materialRequests: state(materialRequestCount > 0, materialRequestCount, "Material request data available", "Waiting for inventory/staff data"),
    notifications: { enabled: false, count: 0, reason: "Notification data not configured yet" },
    leads: state(leadsCount > 0, leadsCount, "Leads/inquiries data available", "Waiting for leads/inquiries data"),
    customerPortal: { enabled: false, count: 0, reason: "Customer portal data is not linked yet" },
    technicianJobs: { enabled: false, count: 0, reason: "Technician jobs will appear after staff data is uploaded and assignments are enabled" },
  };
}
