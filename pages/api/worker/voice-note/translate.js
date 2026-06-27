import { getUserFromRequest } from "@/lib/auth";
import { translateText } from "@/lib/voiceNotes";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "worker") {
    return res.status(403).json({ success: false, message: "Worker access required." });
  }

  const { text, fromLanguage } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({ success: false, message: "No text provided." });
  }

  // Errors from the translation provider are surfaced as success:false so the
  // frontend can show the message and fall back to the original transcript.
  let translatedText;
  try {
    translatedText = await translateText(text, fromLanguage || "auto");
  } catch (err) {
    return res.status(200).json({
      success: false,
      message:
        err.message ||
        "Translation unavailable. The original transcript has been filled — please edit if needed.",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ success: true, translatedText });
}
