import assert from "node:assert/strict";
import {
  buildQuotationNo,
  calculateQuotationCost,
  normalizeQuotationInput,
  QUOTATION_STATUSES,
} from "../lib/quotations.js";
import {
  canViewQuotation,
  canGenerateBoq,
  canEditBoq,
  isPermissionManageRole,
} from "../lib/quotationPermissions.js";

assert.equal(buildQuotationNo({ yearMonth: "202606", sequence: 1 }), "QTN-202606-0001");
assert.equal(buildQuotationNo({ yearMonth: "202606", sequence: 27 }), "QTN-202606-0027");
assert.ok(QUOTATION_STATUSES.includes("BOQ_GENERATED"));

const normalized = normalizeQuotationInput({
  serialNo: "  12 ",
  name: "  Amardip Client ",
  address: " Hyderabad ",
  mobileNo: " 9999999999 ",
  wellWidth: " 5.5 ",
  wellDepth: "6",
  noOfFloors: "G+3",
  noOfPassenger: "8",
  doorType: "MS FRAME COLLAPSIBLE GATE",
  cabinType: "SS CABIN",
  motorType: "GEARED MOTOR",
  headRoom: "MACHINE ROOM",
  doorOpening: "800MM",
});

assert.equal(normalized.customerName, "Amardip Client");
assert.equal(normalized.wellWidth, 5.5);
assert.equal(normalized.noOfPassenger, 8);

assert.throws(
  () => normalizeQuotationInput({ ...normalized, noOfFloors: "G+9" }),
  /Invalid No. of Floors/
);

assert.throws(
  () => normalizeQuotationInput({ ...normalized, mobileNo: "" }),
  /Mobile No is required/
);

assert.deepEqual(
  calculateQuotationCost({
    commonMaterial: 100,
    doorMaterial: 200,
    cabinMaterial: 300,
    motorMaterial: 400,
    ropeCost: 50,
    railCost: 60,
    additionalLfCost: 70,
    labourTransport: 75,
    taxPercent: 18,
    marginPercent: 15,
    discountAmount: 25,
  }),
  {
    commonMaterial: 100,
    doorMaterial: 200,
    cabinMaterial: 300,
    motorMaterial: 400,
    ropeCost: 50,
    railCost: 60,
    additionalLfCost: 70,
    totalMaterialCost: 1180,
    labourTransport: 75,
    taxPercent: 18,
    taxAmount: 212.4,
    projectCost: 1467.4,
    marginPercent: 15,
    marginAmount: 220.11,
    discountAmount: 25,
    customerPrice: 1687.51,
    finalPrice: 1662.51,
  }
);

assert.equal(canGenerateBoq({ role: "superadmin" }), true);
assert.equal(canEditBoq({ role: "front_office" }, true), false);
assert.equal(canGenerateBoq({ role: "admin" }, true), true);
assert.equal(canViewQuotation({ role: "front_office" }, "DRAFT"), false);
assert.equal(canViewQuotation({ role: "front_office" }, "BOQ_GENERATED"), true);
assert.equal(isPermissionManageRole({ role: "superadmin" }), true);
assert.equal(isPermissionManageRole({ role: "admin" }), false);

console.log("quotations tests passed");
