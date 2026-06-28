// Voice note transcription and translation helper for Amardip Elevators.
//
// Transcription: handled in the browser via Web Speech API (free, no key needed).
//                Falls back gracefully if the browser doesn't support it.
//
// Translation:   controlled by VOICE_NOTES_PROVIDER env var.
//   'groq'       — Groq free tier, Llama 3.1 8B Instant. Get a free key at console.groq.com
//                  Requires: GROQ_API_KEY
//   'mymemory'   — MyMemory public API. Completely free, no key needed.
//                  Optional: MYMEMORY_EMAIL to raise the daily limit to 1000 words/IP.
//   'openai'     — OpenAI GPT-4o-mini. Paid. Requires: OPENAI_API_KEY
//   unset        — Uses MyMemory public API by default so Telugu/Hindi notes still translate.
//
// TODO: Add 'google' provider using Google Cloud Translation API
// TODO: Add 'libretranslate' provider for self-hosted open-source translation
// TODO: Add 'aws' provider using Amazon Translate

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB (for audio-upload fallback path)

// Maps app language names to BCP-47 locale codes used by speech providers.
export const LANGUAGE_CODE_MAP = {
  telugu: "te-IN",
  hindi: "hi-IN",
  english: "en-IN",
  auto: "en-IN", // Web Speech API defaults to Indian English for auto
};

// ISO-639-1 codes used by translation APIs (MyMemory, Groq prompt labels)
const TRANSLATE_LANG_LABEL = {
  telugu: "Telugu",
  hindi: "Hindi",
  "te-in": "Telugu",
  "hi-in": "Hindi",
};

const TRANSLATE_LANG_ISO = {
  telugu: "te",
  hindi: "hi",
  "te-in": "te",
  "hi-in": "hi",
};

export function normalizeLanguageCode(language) {
  if (!language) return null;
  return LANGUAGE_CODE_MAP[language.toLowerCase()] ?? null;
}

export function validateAudioUpload({ sizeBytes, mimeType }) {
  if (!sizeBytes || sizeBytes > MAX_AUDIO_BYTES) {
    throw new Error(
      "Audio file exceeds the 10 MB limit. Please shorten the recording."
    );
  }
  const base = ((mimeType || "").split(";")[0] || "").trim().toLowerCase();
  if (!base.startsWith("audio/")) {
    throw new Error("Only audio files are accepted.");
  }
}

// ─── Translation ─────────────────────────────────────────────────────────────
// Called with the raw speech-to-text transcript when language is Telugu or Hindi.
// Returns English text.  Always non-throwing — on failure, returns original text
// so the worker can still edit manually.

export async function translateTranscriptToEnglish(transcript, langCodeOrName) {
  return translateText(transcript, langCodeOrName);
}

export async function translateText(text, fromLanguage) {
  if (!text?.trim()) return "";

  const normalized = (fromLanguage || "").toLowerCase().replace(/-/, "");
  const isAlreadyEnglish =
    normalized === "english" || normalized === "enin" || normalized === "en";
  if (isAlreadyEnglish) return text;

  // auto with no recognisable language code → return as-is for manual edit
  if (normalized === "auto" || !normalized) return text;

  const provider = (process.env.VOICE_NOTES_PROVIDER || "mymemory").toLowerCase();

  try {
    if (provider === "groq") return await translateWithGroq(text, fromLanguage);
    if (provider === "mymemory") return await translateWithMyMemory(text, fromLanguage);
    if (provider === "openai") return await translateWithGPT(text, fromLanguage);
    // TODO: Add 'google' and 'libretranslate' cases here
  } catch {
    // Translation failure is non-fatal — caller will use original text
  }

  return text;
}

async function translateWithGroq(text, fromLanguage) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured.");

  const langLabel =
    TRANSLATE_LANG_LABEL[(fromLanguage || "").toLowerCase()] || "the original language";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant", // free-tier model on Groq
      messages: [
        {
          role: "system",
          content: `You are a translator for elevator service reports. The speaker is a field technician. Translate the following ${langLabel} speech-to-text transcript into concise, professional English work notes. Keep all technical details. Return only the translated text, nothing else.`,
        },
        { role: "user", content: text },
      ],
      max_tokens: 400,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Groq translation failed: ${err}`);
  }

  const result = await response.json();
  return (result.choices?.[0]?.message?.content || "").trim() || text;
}

async function translateWithMyMemory(text, fromLanguage) {
  const iso =
    TRANSLATE_LANG_ISO[(fromLanguage || "").toLowerCase()] || null;
  if (!iso) return text;

  const email = process.env.MYMEMORY_EMAIL || "";
  const params = new URLSearchParams({
    q: text,
    langpair: `${iso}|en`,
    ...(email ? { de: email } : {}),
  });

  const response = await fetch(
    `https://api.mymemory.translated.net/get?${params.toString()}`
  );
  if (!response.ok) throw new Error("MyMemory request failed.");

  const result = await response.json();
  const translated = result?.responseData?.translatedText;
  // MyMemory echoes the source when it can't translate
  if (!translated || translated.toUpperCase() === text.toUpperCase()) return text;
  return translated;
}

async function translateWithGPT(transcript, langCodeOrName) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return transcript;

  const langLabel =
    TRANSLATE_LANG_LABEL[(langCodeOrName || "").toLowerCase()] || "the original language";

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a technical translator for elevator service reports. The speaker is an elevator maintenance technician. Translate the ${langLabel} speech-to-text transcript into concise, professional English work notes. Preserve all technical details. Return only the translated text.`,
          },
          { role: "user", content: transcript },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });
  } catch {
    return transcript;
  }

  if (!response.ok) return transcript;
  const result = await response.json();
  return (result.choices?.[0]?.message?.content || "").trim() || transcript;
}

// ─── Audio transcription (optional fallback path — not used when Web Speech API is available) ───
export async function transcribeAudio(audioBuffer, mimeType, langCode) {
  const provider = (process.env.VOICE_NOTES_PROVIDER || "").toLowerCase();

  if (!provider) {
    throw new Error(
      "Voice notes are not configured yet. Please type the work note manually."
    );
  }

  if (provider === "openai") return transcribeWithOpenAI(audioBuffer, mimeType, langCode);
  if (provider === "groq") return transcribeWithGroq(audioBuffer, mimeType, langCode);
  // TODO: Add 'google' and 'aws' audio transcription providers here

  throw new Error(
    `Unknown voice provider '${provider}'. Set VOICE_NOTES_PROVIDER to 'groq', 'mymemory', or 'openai'.`
  );
}

async function transcribeWithOpenAI(audioBuffer, mimeType, langCode) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured.");

  const ext = mimeTypeToExt(mimeType);
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "json");
  if (langCode) formData.append("language", langCode.split("-")[0]);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "unknown error");
    throw new Error(`OpenAI transcription failed: ${err}`);
  }
  return ((await response.json()).text || "").trim();
}

async function transcribeWithGroq(audioBuffer, mimeType, langCode) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured.");

  const ext = mimeTypeToExt(mimeType);
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
  formData.append("model", "whisper-large-v3-turbo"); // free tier on Groq
  formData.append("response_format", "json");
  if (langCode) formData.append("language", langCode.split("-")[0]);

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "unknown error");
    throw new Error(`Groq transcription failed: ${err}`);
  }
  return ((await response.json()).text || "").trim();
}

function mimeTypeToExt(mimeType) {
  const base = ((mimeType || "audio/webm").split(";")[0] || "").trim();
  const map = {
    "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4",
    "audio/mpeg": "mp3", "audio/wav": "wav", "audio/flac": "flac", "audio/x-m4a": "m4a",
  };
  return map[base] || "webm";
}

// Returns the best available text for the Work Performed field.
export function buildCleanWorkNote(englishTranslation, originalTranscript) {
  return (englishTranslation || originalTranscript || "").trim();
}
