const CACHE_NAME = "amardip-pwa-v1";
const STATIC_ASSETS = [
  "/adlogo.png",
  "/adlogo-pwa.png",
  "/adlogo-pwa-192.png",
  "/adlogo-pwa-512.png",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ─── Push Notifications ──────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "Amardip Lifts", body: event.data.text() }; }

  event.waitUntil(
    incrementBadgeCount()
      .catch(() => 1)
      .then((badgeCount) =>
        self.registration.showNotification(payload.title || "Amardip Lifts", {
          body: payload.body || "",
          icon: payload.icon || "/adlogo-pwa-192.png",
          badge: payload.badge || "/adlogo-pwa-192.png",
          data: { ...(payload.data || {}), badgeCount },
          vibrate: [200, 100, 200],
          requireInteraction: true,
        })
      )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/Techniciandashboard";
  event.waitUntil(
    clearBadgeCount().then(() =>
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
        const existing = wins.find((w) => w.url.includes(url));
        if (existing) return existing.focus();
        return clients.openWindow(url);
      })
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_BADGE") return;
  event.waitUntil(clearBadgeCount());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

const BADGE_DB_NAME = "amardip-pwa-badge";
const BADGE_STORE_NAME = "badge";
const BADGE_COUNT_KEY = "count";

function openBadgeDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BADGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BADGE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBadgeCount() {
  const db = await openBadgeDb();
  return new Promise((resolve) => {
    const tx = db.transaction(BADGE_STORE_NAME, "readonly");
    const request = tx.objectStore(BADGE_STORE_NAME).get(BADGE_COUNT_KEY);
    request.onsuccess = () => resolve(Number(request.result) || 0);
    request.onerror = () => resolve(0);
    tx.oncomplete = () => db.close();
  });
}

async function writeBadgeCount(count) {
  const db = await openBadgeDb();
  return new Promise((resolve) => {
    const tx = db.transaction(BADGE_STORE_NAME, "readwrite");
    tx.objectStore(BADGE_STORE_NAME).put(count, BADGE_COUNT_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}

async function applyAppBadge(count) {
  try {
    if (count > 0 && self.navigator?.setAppBadge) {
      await self.navigator.setAppBadge(count);
    } else if (count > 0 && self.registration?.setAppBadge) {
      await self.registration.setAppBadge(count);
    } else if (self.navigator?.clearAppBadge) {
      await self.navigator.clearAppBadge();
    } else if (self.registration?.clearAppBadge) {
      await self.registration.clearAppBadge();
    }
  } catch {
    // Browser does not support app icon badges or the app is not installed.
  }
}

async function incrementBadgeCount() {
  const nextCount = (await readBadgeCount()) + 1;
  await writeBadgeCount(nextCount);
  await applyAppBadge(nextCount);
  return nextCount;
}

async function clearBadgeCount() {
  await writeBadgeCount(0);
  await applyAppBadge(0);
}
