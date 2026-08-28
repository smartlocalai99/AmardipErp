import { createAuditLog } from "@/lib/auditLog";
import { createComplaint } from "@/lib/complaints";
import { safeSendPush } from "@/lib/pushNotifications";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const requestBuckets = global._publicEmergencyRateLimits || (global._publicEmergencyRateLimits = new Map());

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  for (const [key, bucket] of requestBuckets) {
    if (bucket.resetAt <= now) requestBuckets.delete(key);
  }

  const current = requestBuckets.get(ip);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validatePayload(body = {}) {
  const source = body && typeof body === "object" ? body : {};
  const buildingName = cleanText(source.buildingName, 120);
  const contactNumber = cleanText(source.contactNumber, 20);
  const location = cleanText(source.location, 240);
  const issue = cleanText(source.issue, 1000);
  const contactDigits = contactNumber.replace(/\D/g, "");

  if (source.website) return { spam: true };
  if (buildingName.length < 2) return { error: "Enter the building name." };
  if (!/^[+\d][\d\s()-]{6,19}$/.test(contactNumber) || contactDigits.length < 7 || contactDigits.length > 15) return { error: "Enter a valid contact number." };
  if (location.length < 3) return { error: "Enter the building location." };
  if (issue.length < 5) return { error: "Describe the lift issue." };
  return { buildingName, contactNumber, location, issue };
}

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (error) {
    console.error("Public emergency audit log failed:", error);
  }
}

export const config = { api: { bodyParser: { sizeLimit: "20kb" } }, maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  if (isRateLimited(req)) return res.status(429).json({ success: false, message: "Too many requests. Please call the service team directly." });

  const payload = validatePayload(req.body);
  if (payload.spam) return res.status(200).json({ success: true, complaintNo: "RECEIVED" });
  if (payload.error) return res.status(400).json({ success: false, message: payload.error });

  const publicActor = { id: null, username: "Public emergency form", role: "public" };

  try {
    const complaint = await createComplaint({
      actor: publicActor,
      input: {
        customerName: payload.buildingName,
        mobileNo: payload.contactNumber,
        address: payload.location,
        complaintType: "BREAKDOWN",
        priority: "EMERGENCY",
        description: payload.issue,
        customerNotes: `Public emergency form · Location: ${payload.location}`,
      },
    });

    await Promise.all([
      safeAudit({ req, actor: publicActor, entityType: "COMPLAINT", entityId: complaint.id, action: "PUBLIC_EMERGENCY_COMPLAINT_CREATED", newValues: complaint, changedFields: ["complaint"] }),
      safeSendPush(
        { roles: ["superadmin", "admin", "manager", "front_office"] },
        { title: "Emergency lift complaint", body: `${complaint.complaintNo} · ${complaint.customerName} · ${complaint.address}`, data: { url: "/Admindashboard?tab=complaints", complaintId: complaint.id } }
      ),
    ]);

    return res.status(201).json({ success: true, complaintNo: complaint.complaintNo, status: complaint.status });
  } catch (error) {
    console.error("Public emergency complaint error:", error);
    return res.status(500).json({ success: false, message: "Could not send the emergency request. Please try again." });
  }
}
