export async function setAppBadgeCount(count) {
  if (typeof navigator === "undefined") return;
  const safeCount = Math.max(0, Number(count) || 0);

  try {
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
