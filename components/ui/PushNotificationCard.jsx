import { useState } from "react";
import { getPushSupportMessage, subscribeToPush } from "@/lib/pushClient";

export default function PushNotificationCard() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(() => getPushSupportMessage());
  const [permission, setPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  async function handleEnable() {
    setStatus("enabling");
    setMessage("");
    try {
      await subscribeToPush();
      setPermission("granted");
      setStatus("enabled");
      setMessage("Notifications enabled on this device.");
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Unable to enable notifications on this device.");
    }
  }

  async function handleTest() {
    setStatus("testing");
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Test notification failed.");
      }
      setStatus("enabled");
      setMessage(result.message || "Test notification sent.");
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Test notification failed.");
    }
  }

  const isBusy = status === "enabling" || status === "testing";
  const isGranted = permission === "granted" || status === "enabled";

  return (
    <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-[#0a649d] ring-1 ring-sky-100">
          <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Push Notifications</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
            Enable alerts on this device for tickets, assignments, and job completion updates.
          </p>
        </div>
      </div>

      {message && (
        <p className={`mt-4 rounded-2xl px-3 py-2 text-[11px] font-bold ${
          status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
        }`}>
          {message}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={isBusy || permission === "denied"}
          className="h-10 rounded-xl bg-[#0a649d] px-3 text-xs font-black text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "enabling" ? "Enabling..." : isGranted ? "Enabled" : "Enable"}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={isBusy || !isGranted}
          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "testing" ? "Sending..." : "Test"}
        </button>
      </div>

      {permission === "denied" && (
        <p className="mt-3 text-[10px] font-bold leading-relaxed text-red-600">
          Browser notification permission is blocked. Allow notifications from site settings, then open the app again.
        </p>
      )}
    </section>
  );
}
