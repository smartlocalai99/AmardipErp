import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getUserFromRequest } from "@/lib/auth";

const EMPTY_FORM = { buildingName: "", contactNumber: "", location: "", issue: "", website: "" };

export async function getServerSideProps(context) {
  const user = await getUserFromRequest(context.req);
  if (!user) return { props: {} };

  const destinations = {
    customer: "/Customerdashboard",
    worker: "/Techniciandashboard",
    storekeeper: "/Storedashboard",
  };

  return {
    redirect: {
      destination: destinations[user.role] || "/Admindashboard",
      permanent: false,
    },
  };
}

function AlertIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 8v4.75" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 16.25h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M10.28 3.86 2.83 17.1A2 2 0 0 0 4.57 20h14.86a2 2 0 0 0 1.74-2.9L13.72 3.86a1.97 1.97 0 0 0-3.44 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden="true">
      <path d="m6.5 12.5 3.5 3.25 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmergencyModal({ open, onClose, returnFocusRef }) {
  const firstInputRef = useRef(null);
  const submittingRef = useRef(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const returnFocusElement = returnFocusRef.current;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => firstInputRef.current?.focus(), 80);

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submittingRef.current) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusElement?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/public/emergency-complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not send the emergency request.");
      setTicketNumber(data.complaintNo);
      setForm(EMPTY_FORM);
    } catch (submissionError) {
      setError(submissionError.message || "Could not send the emergency request.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function closeModal() {
    if (submitting) return;
    setError("");
    setTicketNumber("");
    setForm(EMPTY_FORM);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050a12]/75 px-0 pt-8 backdrop-blur-[3px] sm:items-center sm:px-4" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
      <section role="dialog" aria-modal="true" aria-labelledby="emergency-dialog-title" className="max-h-[94svh] w-full max-w-[430px] overflow-y-auto rounded-t-[30px] bg-[#f8fafc] shadow-[0_-24px_70px_rgba(0,0,0,0.28)] sm:rounded-[30px]">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200/80 bg-[#f8fafc]/95 px-5 pb-4 pt-5 backdrop-blur">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e43d32] text-white shadow-[0_8px_20px_rgba(228,61,50,0.25)]"><AlertIcon className="h-6 w-6" /></div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#c42f27]">Priority support</p>
              <h2 id="emergency-dialog-title" className="mt-0.5 text-[21px] font-black tracking-[-0.025em] text-[#101828]">Report an emergency</h2>
            </div>
          </div>
          <button type="button" onClick={closeModal} disabled={submitting} aria-label="Close emergency form" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition active:scale-95 disabled:opacity-50"><CloseIcon /></button>
        </div>

        {ticketNumber ? (
          <div className="px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-10 text-center" role="status">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckIcon /></div>
            <h3 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-900">Emergency sent</h3>
            <p className="mx-auto mt-2 max-w-[300px] text-sm font-medium leading-6 text-slate-600">Our service team received your complaint and will contact the number provided.</p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Emergency ticket</p>
              <p className="mt-1 text-xl font-black tracking-[0.04em] text-[#0a649d]">{ticketNumber}</p>
            </div>
            <button type="button" onClick={closeModal} className="mt-6 h-13 w-full rounded-2xl bg-[#0b2239] text-sm font-black text-white transition active:scale-[0.98]">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-5">
            <p className="rounded-2xl border border-[#f3c8c4] bg-[#fff2f1] px-4 py-3 text-xs font-semibold leading-5 text-[#8f241e]">Share the exact location and what happened. This will appear immediately in the emergency complaints queue.</p>
            <div className="hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" value={form.website} onChange={updateField} tabIndex="-1" autoComplete="off" /></div>

            <div>
              <label htmlFor="buildingName" className="mb-1.5 block text-xs font-extrabold text-slate-700">Building name</label>
              <input ref={firstInputRef} id="buildingName" name="buildingName" value={form.buildingName} onChange={updateField} required maxLength={120} autoComplete="organization" placeholder="e.g. Sunrise Residency" className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#0a649d] focus:ring-4 focus:ring-[#0a649d]/10" />
            </div>
            <div>
              <label htmlFor="contactNumber" className="mb-1.5 block text-xs font-extrabold text-slate-700">Contact number</label>
              <input id="contactNumber" name="contactNumber" value={form.contactNumber} onChange={updateField} required minLength={7} maxLength={20} type="tel" inputMode="tel" autoComplete="tel" placeholder="Mobile number" className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#0a649d] focus:ring-4 focus:ring-[#0a649d]/10" />
            </div>
            <div>
              <label htmlFor="location" className="mb-1.5 block text-xs font-extrabold text-slate-700">Location</label>
              <input id="location" name="location" value={form.location} onChange={updateField} required maxLength={240} autoComplete="street-address" placeholder="Area, landmark or full address" className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#0a649d] focus:ring-4 focus:ring-[#0a649d]/10" />
            </div>
            <div>
              <label htmlFor="issue" className="mb-1.5 block text-xs font-extrabold text-slate-700">What is the issue?</label>
              <textarea id="issue" name="issue" value={form.issue} onChange={updateField} required minLength={5} maxLength={1000} rows={4} placeholder="Tell us what happened and whether anyone is inside the lift" className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold leading-6 text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#0a649d] focus:ring-4 focus:ring-[#0a649d]/10" />
            </div>

            {error ? <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">{error}</p> : null}
            <button type="submit" disabled={submitting} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e43d32] text-[15px] font-black text-white shadow-[0_14px_30px_rgba(228,61,50,0.28)] transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-65">
              {submitting ? "Sending emergency..." : "Send emergency request"}{submitting ? null : <ArrowIcon />}
            </button>
            <p className="px-2 text-center text-[11px] font-medium leading-4 text-slate-500">If anyone is in immediate danger, contact your local emergency services first.</p>
          </form>
        )}
      </section>
    </div>
  );
}

export default function IndexPage() {
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const emergencyButtonRef = useRef(null);
  const closeEmergency = useCallback(() => setEmergencyOpen(false), []);

  return (
    <>
      <Head>
        <title>Emergency Support | Amardip Elevators</title>
        <meta name="description" content="Report an elevator emergency or sign in to the Amardip Elevators customer portal." />
      </Head>

      <main className="relative min-h-[100svh] overflow-hidden bg-[#07111f] sm:grid sm:place-items-center sm:px-5 sm:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
          <div className="absolute left-[calc(50%-210px)] top-0 h-full w-px bg-white/5" />
          <div className="absolute right-[calc(50%-210px)] top-0 h-full w-px bg-white/5" />
        </div>

        <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f7f9fc] shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:min-h-[760px] sm:rounded-[36px]">
          <header className="relative overflow-hidden bg-[#081827] px-6 pb-13 pt-[max(24px,env(safe-area-inset-top))] text-white">
            <div className="absolute inset-y-0 left-[29%] w-px bg-white/[0.07]" />
            <div className="absolute inset-y-0 right-[29%] w-px bg-white/[0.07]" />
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border-[36px] border-[#59e0ff]/[0.06]" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-14 overflow-hidden rounded-xl bg-white"><Image src="/logo.png" alt="Amardip Elevators" fill priority sizes="56px" className="object-contain p-1" /></div>
                <div><p className="text-sm font-black tracking-[-0.01em]">Amardip Elevators</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-sky-200/70">Service assistance</p></div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />Online</div>
            </div>

            <div className="relative mt-12">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#59e0ff]">24/7 response desk</p>
              <h1 className="mt-3 max-w-[330px] text-[36px] font-black leading-[1.04] tracking-[-0.045em]">Lift problem?<br />We’re ready to help.</h1>
              <p className="mt-4 max-w-[330px] text-sm font-medium leading-6 text-slate-300">Report an urgent lift issue without signing in, or continue to your customer account.</p>
            </div>
          </header>

          <section className="relative -mt-5 flex flex-1 flex-col rounded-t-[28px] bg-[#f7f9fc] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-7">
            <p className="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Choose an option</p>
            <button ref={emergencyButtonRef} type="button" onClick={() => setEmergencyOpen(true)} className="group mt-3 w-full rounded-[24px] bg-[#e43d32] p-5 text-left text-white shadow-[0_18px_38px_rgba(228,61,50,0.24)] transition active:scale-[0.985]">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><AlertIcon className="h-7 w-7" /></div>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#d7342a] transition group-active:translate-x-1"><ArrowIcon /></div>
              </div>
              <h2 className="mt-7 text-[22px] font-black tracking-[-0.025em]">Emergency contact</h2>
              <p className="mt-1.5 max-w-[290px] text-sm font-medium leading-5 text-white/80">Lift stopped, person trapped, door issue or urgent breakdown.</p>
            </button>

            <div className="my-5 flex items-center gap-3 px-1" aria-hidden="true"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">or</span><div className="h-px flex-1 bg-slate-200" /></div>

            <Link href="/Customerlogin" className="group flex min-h-[92px] items-center gap-4 rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition active:scale-[0.985]">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e9f4fb] text-[#0a649d]"><UserIcon className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1"><h2 className="text-base font-black text-slate-900">Customer login</h2><p className="mt-1 text-xs font-semibold leading-4 text-slate-500">View complaints, service history and account details.</p></div>
              <ArrowIcon className="h-5 w-5 shrink-0 text-[#0a649d] transition group-active:translate-x-1" />
            </Link>

            <p className="mt-auto pt-8 text-center text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Amardip Elevators · Service you can trust</p>
          </section>
        </div>
      </main>

      <EmergencyModal open={emergencyOpen} onClose={closeEmergency} returnFocusRef={emergencyButtonRef} />
    </>
  );
}
