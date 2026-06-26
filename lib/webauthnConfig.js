const isProduction = process.env.NODE_ENV === "production";

export const rpName = process.env.WEBAUTHN_RP_NAME || "Amardip Lifts ERP";
export const rpID = isProduction
  ? process.env.WEBAUTHN_RP_ID || "amardip-erp.vercel.app"
  : process.env.WEBAUTHN_RP_ID || "localhost";
export const origin = isProduction
  ? process.env.WEBAUTHN_ORIGIN || "https://amardip-erp.vercel.app"
  : process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export const passkeyConfigNotes = {
  productionRpName: "Amardip Lifts ERP",
  productionRpID: "amardip-erp.vercel.app",
  productionOrigin: "https://amardip-erp.vercel.app",
};
