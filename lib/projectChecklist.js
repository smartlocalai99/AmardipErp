// The 52-step installation sequence from the paper "Erection Sheet" form
// technicians fill out on site — grouped into the same real inspection
// stages the form itself marks out (STAGE ONE / STAGE TWO INSPECTION), plus
// the natural phases either side of them. This is a fixed, shared sequence
// (not per-project custom data), so it lives as a constant rather than rows
// staff could edit.
//
// Deliberately has NO import of lib/db.js (or anything that pulls in `pg`)
// — this file is imported directly by client-rendered components
// (pages/admin/quotations.jsx, pages/Techniciandashboard.jsx) for the
// constants below, and `pg` uses Node-only built-ins (net, tls) that break
// the browser bundle if dragged in transitively. DB-backed reads/writes for
// this checklist live in lib/projectChecklistStore.js instead.
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
