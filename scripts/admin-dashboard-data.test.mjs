import assert from "node:assert/strict";
import {
  buildAdminKpiCounts,
  buildStaffFromUsers,
  buildTechniciansFromUsers,
  buildUpcomingActivities,
  buildUpcomingVisits,
  formatUserRole,
} from "../lib/adminDashboardData.js";

assert.equal(formatUserRole("front_office"), "Front Office");

const users = [
  { id: 1, username: "ranjith_singh", name: "RANJITH SINGH", role: "worker", designation: "SR ELECTRICIAN" },
  { id: 2, username: "afreen", name: "AFREEN", role: "front_office", designation: "FRONT OFFICE" },
];

const technicians = buildTechniciansFromUsers(users);
assert.equal(technicians.length, 1);
assert.equal(technicians[0].name, "RANJITH SINGH");
assert.equal(technicians[0].role, "SR ELECTRICIAN");

const staff = buildStaffFromUsers(users);
assert.deepEqual(staff, [
  { id: 2, name: "AFREEN", role: "FRONT OFFICE", email: "@afreen", phone: "-" },
]);

assert.deepEqual(
  buildAdminKpiCounts({
    customerStats: { totalCustomers: 308, activeAmc: 113 },
    serviceStats: { scheduledUpcomingServices: 1, upcomingServicesTotal: 68 },
    technicians,
  }),
  {
    totalCustomers: 308,
    activeAMC: 113,
    todayService: 1,
    openComplaints: 0,
    pendingInstallations: 0,
    upcomingMaintenance: 68,
    availTechnicians: 1,
    totalTechnicians: 1,
  }
);

const upcomingPreview = {
  rows: [
    {
      rowType: "TO_BE_SCHEDULED",
      customerId: "c1",
      customerName: "HYDERR HOSPITALS",
      city: "NANDYAL",
      customerStatus: "AMC",
      scheduleMonth: "2026-06-01",
      scheduleStatus: "TO_BE_SCHEDULED",
      mobileNo: "9849596986",
    },
  ],
};

assert.equal(buildUpcomingActivities(upcomingPreview)[0].site, "HYDERR HOSPITALS");
assert.equal(buildUpcomingVisits(upcomingPreview)[0].phone, "9849596986");

console.log("admin-dashboard-data tests passed");
