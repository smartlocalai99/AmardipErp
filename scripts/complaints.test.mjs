import assert from "node:assert/strict";
import {
  buildComplaintNo,
  normalizeComplaintInput,
  normalizeComplaintRow,
} from "../lib/complaints.js";

assert.equal(buildComplaintNo({ yearMonth: "202606", sequence: 1 }), "CMP-202606-0001");
assert.equal(buildComplaintNo({ yearMonth: "202606", sequence: 42 }), "CMP-202606-0042");

assert.deepEqual(
  normalizeComplaintInput({
    complaint_type: "door issue",
    priority: "",
    description: "  Door not closing  ",
    customer_notes: "  urgent  ",
  }),
  {
    complaintType: "DOOR_ISSUE",
    priority: "NORMAL",
    description: "Door not closing",
    customerNotes: "urgent",
    officeNotes: null,
    adminNotes: null,
  }
);

assert.throws(
  () => normalizeComplaintInput({ complaint_type: "bad", description: "Door stuck" }),
  /Invalid complaint type/
);

assert.throws(
  () => normalizeComplaintInput({ complaint_type: "BREAKDOWN", priority: "bad", description: "Door stuck" }),
  /Invalid priority/
);

assert.throws(
  () => normalizeComplaintInput({ complaint_type: "BREAKDOWN", description: " " }),
  /Description is required/
);

assert.deepEqual(
  normalizeComplaintRow({
    id: "c1",
    complaint_no: "CMP-202606-0001",
    customer_name: "Test Customer",
    assigned_technician_user_id: 7,
    assigned_technician_name: "RANJITH",
    created_at: "2026-06-27T10:00:00.000Z",
  }),
  {
    id: "c1",
    complaintNo: "CMP-202606-0001",
    customerName: "Test Customer",
    mobileNo: null,
    city: null,
    address: null,
    customerCode: null,
    customerId: null,
    customerUserId: null,
    complaintType: null,
    priority: null,
    status: null,
    description: null,
    customerNotes: null,
    officeNotes: null,
    adminNotes: null,
    assignedTechnicianUserId: 7,
    assignedTechnicianName: "RANJITH",
    assignedByUsername: null,
    assignedAt: null,
    raisedByUsername: null,
    raisedByRole: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: "2026-06-27T10:00:00.000Z",
    updatedAt: null,
  }
);

console.log("complaints tests passed");
