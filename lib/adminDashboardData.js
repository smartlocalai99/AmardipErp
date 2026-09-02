export function formatUserRole(role) {
  if (role === "front_office") return "Front Office";
  return String(role || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function userToCrewMember(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.designation || formatUserRole(user.role),
    phone: user.phone || "",
  };
}

export function buildTechniciansFromUsers(users = []) {
  return users.filter((item) => item.role === "worker").map(userToCrewMember);
}

export function buildStaffFromUsers(users = []) {
  return users
    .filter((item) => ["superadmin", "admin", "manager", "front_office"].includes(item.role))
    .map((item) => ({
      id: item.id,
      name: item.name,
      role: item.designation || formatUserRole(item.role),
      email: `@${item.username}`,
      phone: item.phone || "-",
    }));
}

export function buildAdminKpiCounts({ customerStats, serviceStats, technicians = [] } = {}) {
  return {
    totalCustomers: customerStats?.totalCustomers || 0,
    activeAMC: customerStats?.activeAmc || 0,
    todayService: serviceStats?.scheduledUpcomingServices || 0,
    openComplaints: 0,
    pendingInstallations: 0,
    upcomingMaintenance: serviceStats?.upcomingServicesTotal || 0,
    totalTechnicians: technicians.length,
  };
}

export function buildUpcomingActivities(upcomingPreview) {
  const rows = upcomingPreview?.rows || [];

  return rows.slice(0, 5).map((row, index) => ({
    id: row.scheduleId || row.customerId || index,
    type: row.rowType === "SCHEDULED" ? row.serviceType || "Scheduled Service" : "Monthly Service Due",
    site: row.customerName || row.customerCode || "Customer",
    time: row.scheduledDate ? "Scheduled" : "Pending",
    status: row.scheduleStatus || row.rowType,
    color: row.rowType === "SCHEDULED" ? "bg-[#0a649d] text-white" : "bg-amber-500 text-white",
  }));
}

export function buildUpcomingVisits(upcomingPreview) {
  const rows = upcomingPreview?.rows || [];

  return rows.slice(0, 5).map((row, index) => ({
    id: row.scheduleId || row.customerId || index,
    customer: row.customerName || row.customerCode || "Customer",
    building: [row.city, row.customerStatus].filter(Boolean).join(" · ") || row.address || "Service customer",
    dueDate: row.scheduledDate || row.scheduleMonth || "To be scheduled",
    phone: row.mobileNo || "",
  }));
}
