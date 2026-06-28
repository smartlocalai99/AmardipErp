import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { safeSendPush } from "@/lib/pushNotifications";

let tableReady = false;

async function ensureJobCompletionsTable() {
  if (tableReady) return;
  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS technician_job_completions (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      complaint_id              UUID NOT NULL,
      worker_user_id            INTEGER NOT NULL,
      problem_identified        TEXT,
      work_performed            TEXT,
      spare_parts_used          TEXT,
      status_resolution         TEXT,
      gps_checked_in            BOOLEAN DEFAULT false,
      checklist_data            JSONB,
      customer_rep_name         TEXT,
      completed_at              TIMESTAMPTZ DEFAULT NOW(),
      voice_language            TEXT,
      voice_original_transcript TEXT,
      voice_english_translation TEXT,
      voice_audio_url           TEXT,
      voice_processing_status   TEXT,
      voice_provider            TEXT,
      created_at                TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tjc_complaint
      ON technician_job_completions(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_tjc_worker
      ON technician_job_completions(worker_user_id);
  `);
  tableReady = true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const {
    jobDbId,
    problemIdentified,
    workPerformed,
    sparePartsUsed,
    statusResolution,
    gpsCheckedIn,
    checklistData,
    customerRepName,
    voiceLanguage,
    voiceOriginalTranscript,
    voiceEnglishTranslation,
    voiceProcessingStatus,
  } = req.body || {};

  if (!jobDbId) {
    return res.status(400).json({ success: false, message: "Job ID is required." });
  }

  try {
    await ensureJobCompletionsTable();

    // Confirm the complaint exists and is assigned to this worker
    const check = await query(
      `SELECT id, complaint_no, customer_name, customer_user_id, assigned_technician_user_id, status FROM complaints WHERE id = $1`,
      [jobDbId]
    );

    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    if (String(check.rows[0].assigned_technician_user_id) !== String(actor.id)) {
      return res
        .status(403)
        .json({ success: false, message: "This job is not assigned to you." });
    }

    if (["RESOLVED", "CLOSED", "CANCELLED"].includes(check.rows[0].status)) {
      return res
        .status(409)
        .json({ success: false, message: "This job is already resolved or closed." });
    }

    const provider = process.env.VOICE_NOTES_PROVIDER || null;

    await query(
      `INSERT INTO technician_job_completions (
        complaint_id, worker_user_id, problem_identified, work_performed,
        spare_parts_used, status_resolution, gps_checked_in, checklist_data,
        customer_rep_name, voice_language, voice_original_transcript,
        voice_english_translation, voice_processing_status, voice_provider
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        jobDbId,
        actor.id,
        problemIdentified || null,
        workPerformed || null,
        sparePartsUsed || null,
        statusResolution || null,
        gpsCheckedIn || false,
        JSON.stringify(checklistData || {}),
        customerRepName || null,
        voiceLanguage || null,
        voiceOriginalTranscript || null,
        voiceEnglishTranslation || null,
        voiceProcessingStatus || null,
        provider,
      ]
    );

    // Mark complaint RESOLVED and store work notes in office_notes for admin visibility
    await query(
      `UPDATE complaints
       SET status       = 'RESOLVED',
           resolved_at  = NOW(),
           updated_at   = NOW(),
           office_notes = COALESCE($2, office_notes)
       WHERE id = $1`,
      [jobDbId, workPerformed || null]
    );

    const complaint = check.rows[0];
    await safeSendPush(
      { roles: ["superadmin", "admin", "manager", "front_office"] },
      {
        title: "Worker completed job",
        body: `${complaint.complaint_no || "Ticket"} completed by ${actor.name || actor.username}.`,
        data: { url: "/Admindashboard?tab=complaints", complaintId: jobDbId },
      }
    );
    if (complaint.customer_user_id) {
      await safeSendPush(
        { userIds: [complaint.customer_user_id] },
        {
          title: "Service job completed",
          body: `${complaint.complaint_no || "Your ticket"} has been marked resolved.`,
          data: { url: "/Customerdashboard?tab=complaints", complaintId: jobDbId },
        }
      );
    }

    return res.status(200).json({ success: true, message: "Job completed and saved." });
  } catch (err) {
    console.error("complete-job error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Failed to save job completion." });
  }
}
