// Browser-side push subscription helper.
// Push permission is most reliable when called from a real button tap.

import { getPortalScope } from "./pwaScope.js";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush({ renew = false } = {}) {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) throw new Error("Notifications are not supported on this browser.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported on this browser.");
  }
  if (!VAPID_PUBLIC_KEY) throw new Error("Push notification key is missing. Redeploy after setting NEXT_PUBLIC_VAPID_PUBLIC_KEY.");

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission was not allowed.");

    const registration = await ensureServiceWorkerRegistration();
    let existing = await registration.pushManager.getSubscription();
    if (existing && renew) {
      await existing.unsubscribe();
      existing = null;
    }
    if (existing) {
      // Re-register to ensure our server has it
      await sendSubscriptionToServer(existing);
      return existing;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await sendSubscriptionToServer(subscription);
    return subscription;
  } catch (err) {
    console.warn("Push subscription failed:", err.message);
    throw err;
  }
}

export function getPushSupportMessage() {
  if (typeof window === "undefined") return "Checking notification support...";
  if (!("Notification" in window)) return "This browser does not support notifications.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "This browser does not support web push notifications.";
  }
  if (!VAPID_PUBLIC_KEY) return "Push key missing. Redeploy after setting production VAPID env.";
  return "";
}

async function ensureServiceWorkerRegistration() {
  // Registered per-portal (scope "/Customer", "/Technician", "/Store", or
  // "/" for admin) so each portal is a separate installable app on Android
  // instead of four manifests competing over one shared root-scoped worker.
  const scope = getPortalScope(window.location.pathname);
  const existing = await navigator.serviceWorker.getRegistration(scope);
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope });
  return navigator.serviceWorker.ready;
}

async function sendSubscriptionToServer(subscription) {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to save this device for notifications.");
  }
}
