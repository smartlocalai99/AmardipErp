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
      `SELECT
         co.id, co.complaint_no, co.customer_name, co.customer_user_id,
         co.assigned_technician_user_id, co.status, co.complaint_type,
         co.customer_id, co.customer_code, co.mobile_no, co.city, co.address,
         cust.customer_status AS customer_status_snapshot,
         cust.amc_warranty_due AS amc_warranty_due_snapshot
       FROM complaints co
       LEFT JOIN elevator_service_customers cust ON cust.id = co.customer_id
       WHERE co.id = $1`,
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

    const complaint = check.rows[0];
    const provider = process.env.VOICE_NOTES_PROVIDER || null;

    // Was this job dispatched from the AMC/EMC/Warranty monthly service planner
    // (Upcoming Services -> Schedule Service)? If so, closing it out here needs
    // to also close the loop back to that plan and into real service history —
    // otherwise the planner keeps showing it as pending and it never counts
    // toward "last service date" / "completed this month" reporting.
    const linkedScheduleResult = await query(
      `SELECT id FROM service_schedules WHERE linked_complaint_id = $1 LIMIT 1`,
      [jobDbId]
    );
    const linkedSchedule = linkedScheduleResult.rows[0] || null;

    await query("BEGIN");
    try {
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

      if (linkedSchedule && complaint.customer_id) {
        const visitResult = await query(
          `INSERT INTO elevator_service_visits (
             customer_id, source_row_no, source_sheet, service_date,
             customer_code, customer_name_snapshot, address_snapshot,
             city_snapshot, mobile_no_snapshot, customer_status_snapshot,
             amc_warranty_due_snapshot, remarks, service_type, technician_1
           ) VALUES ($1, 0, 'App - Technician Completion', CURRENT_DATE,
             $2, $3, $4, $5, $6, $7, $8, $9, 'MONTHLY_SERVICE', $10)
           RETURNING id`,
          [
            complaint.customer_id,
            complaint.customer_code,
            complaint.customer_name,
            complaint.address,
            complaint.city,
            complaint.mobile_no,
            complaint.customer_status_snapshot,
            complaint.amc_warranty_due_snapshot,
            workPerformed || problemIdentified || null,
            actor.name || actor.username,
          ]
        );

        await query(
          `UPDATE service_schedules
           SET status = 'COMPLETED', completed_service_visit_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [visitResult.rows[0].id, linkedSchedule.id]
        );
      }

      await query("COMMIT");
    } catch (err) {
      await query("ROLLBACK");
      throw err;
    }
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
