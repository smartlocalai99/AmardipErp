const OS_PATTERNS = [
  [/iPhone/i, "iPhone"],
  [/iPad/i, "iPad"],
  [/Android/i, "Android"],
  [/Windows/i, "Windows"],
  [/Macintosh|Mac OS X/i, "Mac"],
  [/Linux/i, "Linux"],
];

const BROWSER_PATTERNS = [
  [/EdgA?\//i, "Edge"],
  [/OPR\/|Opera/i, "Opera"],
  [/SamsungBrowser/i, "Samsung Internet"],
  [/CriOS|Chrome/i, "Chrome"],
  [/FxiOS|Firefox/i, "Firefox"],
  [/Safari/i, "Safari"],
];

export function describeDevice(userAgent) {
  const ua = String(userAgent || "").trim();
  if (!ua) return "Unknown device";

  const os = OS_PATTERNS.find(([pattern]) => pattern.test(ua))?.[1];
  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(ua))?.[1];

  if (os && browser) return `${os} · ${browser}`;
  return os || browser || "Unknown device";
}
