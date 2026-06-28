export async function setAppBadgeCount(count) {
  if (typeof navigator === "undefined") return;
  const safeCount = Math.max(0, Number(count) || 0);

  try {
    if (safeCount === 0) {
      await notifyServiceWorkerBadgeClear();
    }
    if (safeCount === 0 && "clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
      return;
    }
    if ("setAppBadge" in navigator) {
      await navigator.setAppBadge(safeCount);
    }
  } catch {
    // Badge support varies by browser/device. Never block the ERP UI.
  }
}

export async function clearAppBadgeCount() {
  await setAppBadgeCount(0);
}

async function notifyServiceWorkerBadgeClear() {
  try {
    const registration = await navigator.serviceWorker?.ready;
    registration?.active?.postMessage({ type: "CLEAR_BADGE" });
  } catch {
    // Service worker may not be active yet.
  }
}
