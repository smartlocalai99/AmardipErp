import { getUserFromRequest } from "@/lib/auth";
import {
  validateAudioUpload,
  transcribeAudio,
  translateTranscriptToEnglish,
  normalizeLanguageCode,
  buildCleanWorkNote,
} from "@/lib/voiceNotes";

// Allow up to 12 MB JSON body — base64 adds ~33 % overhead over 10 MB raw audio
export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { audioBase64, mimeType = "audio/webm", language = "auto" } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ success: false, message: "No audio provided." });
  }

  let audioBuffer;
  try {
    audioBuffer = Buffer.from(audioBase64, "base64");
  } catch {
    return res.status(400).json({ success: false, message: "Invalid audio encoding." });
  }

  try {
    validateAudioUpload({ sizeBytes: audioBuffer.length, mimeType });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const langCode = normalizeLanguageCode(language);

  // Provider errors are returned as success:false with a user-friendly message so
  // the frontend can display it and fall back to manual text entry — never crash.
  let originalTranscript, englishTranslation;
  try {
    originalTranscript = await transcribeAudio(audioBuffer, mimeType, langCode);
    englishTranslation = await translateTranscriptToEnglish(
      originalTranscript,
      langCode || language
    );
  } catch (err) {
    return res.status(200).json({
      success: false,
      message:
        err.message ||
        "Voice transcription failed. Please type the work note manually.",
    });
  }

  const workNote = buildCleanWorkNote(englishTranslation, originalTranscript);

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    success: true,
    detectedLanguage: langCode || "auto",
    originalTranscript,
    englishTranslation: workNote,
  });
}
