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
    incrementBadgeCount(payload.data || {})
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
    acknowledgeBadgeItem(event.notification.data || {}).then(() =>
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
        const target = new URL(url, self.location.origin);
        const existing = wins.find((win) => {
          const openUrl = new URL(win.url);
          return openUrl.origin === target.origin && openUrl.pathname === target.pathname;
        });
        if (existing) {
          return existing.navigate(target.href).then((win) => win?.focus());
        }
        return clients.openWindow(url);
      })
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    event.waitUntil(clearBadgeCount());
    return;
  }
  if (event.data?.type === "ACK_BADGE_ITEM") {
    event.waitUntil(acknowledgeBadgeItem(event.data));
  }
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
const BADGE_PENDING_KEY = "pending";
const BADGE_LEGACY_ACK_KEY = "legacy-acknowledged";

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

async function readBadgeValue(key, fallback) {
  const db = await openBadgeDb();
  return new Promise((resolve) => {
    const tx = db.transaction(BADGE_STORE_NAME, "readonly");
    const request = tx.objectStore(BADGE_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ?? fallback);
    request.onerror = () => resolve(fallback);
    tx.oncomplete = () => db.close();
  });
}

async function writeBadgeValue(key, value) {
  const db = await openBadgeDb();
  return new Promise((resolve) => {
    const tx = db.transaction(BADGE_STORE_NAME, "readwrite");
    tx.objectStore(BADGE_STORE_NAME).put(value, key);
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

async function readBadgeCount() {
  return Number(await readBadgeValue(BADGE_COUNT_KEY, 0)) || 0;
}

async function writeBadgeCount(count) {
  await writeBadgeValue(BADGE_COUNT_KEY, Math.max(0, Number(count) || 0));
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

async function incrementBadgeCount(data = {}) {
  const nextCount = (await readBadgeCount()) + 1;
  const complaintId = data.complaintId ? String(data.complaintId) : "";
  if (complaintId) {
    const pending = await readBadgeValue(BADGE_PENDING_KEY, []);
    pending.push({
      id: data.notificationKey || `${complaintId}:${Date.now()}:${Math.random()}`,
      complaintId,
    });
    await writeBadgeValue(BADGE_PENDING_KEY, pending);

    const legacyAcknowledged = await readBadgeValue(BADGE_LEGACY_ACK_KEY, []);
    await writeBadgeValue(
      BADGE_LEGACY_ACK_KEY,
      legacyAcknowledged.filter((id) => id !== complaintId)
    );
  }
  await writeBadgeCount(nextCount);
  await applyAppBadge(nextCount);
  return nextCount;
}

async function clearBadgeCount() {
  await writeBadgeCount(0);
  await writeBadgeValue(BADGE_PENDING_KEY, []);
  await writeBadgeValue(BADGE_LEGACY_ACK_KEY, []);
  await applyAppBadge(0);
}

async function acknowledgeBadgeItem(data = {}) {
  const complaintId = data.complaintId ? String(data.complaintId) : "";
  const notificationKey = data.notificationKey ? String(data.notificationKey) : "";
  const currentCount = await readBadgeCount();
  const pending = await readBadgeValue(BADGE_PENDING_KEY, []);
  const matches = pending.filter((item) =>
    (complaintId && item.complaintId === complaintId) ||
    (notificationKey && item.id === notificationKey)
  );

  let decrementBy = matches.length;
  if (matches.length) {
    const matchedIds = new Set(matches.map((item) => item.id));
    await writeBadgeValue(BADGE_PENDING_KEY, pending.filter((item) => !matchedIds.has(item.id)));
  } else if (complaintId && currentCount > 0) {
    const legacyAcknowledged = await readBadgeValue(BADGE_LEGACY_ACK_KEY, []);
    if (!legacyAcknowledged.includes(complaintId)) {
      decrementBy = 1;
      await writeBadgeValue(BADGE_LEGACY_ACK_KEY, [...legacyAcknowledged, complaintId]);
    }
  } else if (!complaintId && !notificationKey && currentCount > 0) {
    decrementBy = 1;
  }

  const nextCount = Math.max(0, currentCount - decrementBy);
  await writeBadgeCount(nextCount);
  await applyAppBadge(nextCount);

  const openNotifications = await self.registration.getNotifications();
  openNotifications.forEach((notification) => {
    const notificationData = notification.data || {};
    if (
      (complaintId && String(notificationData.complaintId || "") === complaintId) ||
      (notificationKey && String(notificationData.notificationKey || "") === notificationKey)
    ) {
      notification.close();
    }
  });
}
