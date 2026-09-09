import { useState, useEffect, useRef } from "react";
import { subscribeToPush } from "@/lib/pushClient";
import { useRouter } from "next/router";
import Head from "next/head";
import { getUserFromRequest } from "@/lib/auth";
import { getStaffProfile } from "@/lib/staffProfile";
import Image from "next/image";
import QRCode from "qrcode";
import PushNotificationCard from "@/components/ui/PushNotificationCard";
import { acknowledgeTicketNotification } from "@/lib/appBadge";
import { PROJECT_CHECKLIST_PHASES, PROJECT_CHECKLIST_ITEMS, PHASE_ICON_KEYS } from "@/lib/projectChecklist";
import PhaseIcon from "@/components/PhaseIcon";
import Swal from "sweetalert2";

// The 11-item lift inspection checklist a technician fills in on-site,
// matching CHECK POINTS.pdf exactly. Keys match the elevator_service_visits
// condition columns (camelCased) so the server can write them straight
// through — see pages/api/worker/complete-job.js.
const CHECKLIST_ITEMS = [
    { key: "ard", label: "ARD Condition", options: ["NORMAL", "ABNORMAL", "NOT FIXING"] },
    { key: "motor", label: "Motor Condition", options: ["NORMAL", "ABNORMAL"] },
    { key: "gearOil", label: "Gear Oil Condition", options: ["NORMAL", "ABNORMAL"] },
    { key: "brake", label: "Brake Condition", options: ["NORMAL", "ABNORMAL"] },
    { key: "rope", label: "Rope Condition", options: ["NORMAL", "ABNORMAL"] },
    { key: "railClips", label: "Rail Clips Condition", options: ["NORMAL", "ABNORMAL"] },
    { key: "limitSwitch", label: "Limit Switch Condition", options: ["NORMAL", "ABNORMAL"] },
    { key: "gateLocks", label: "Gate Locks", options: ["NORMAL", "ABNORMAL"] },
    { key: "rcr", label: "RCR Condition", options: ["NORMAL", "ABNORMAL"] },
    { key: "sensors", label: "Sensors", options: ["NORMAL", "ABNORMAL"] },
    { key: "osg", label: "OSG Condition", options: ["NORMAL", "ABNORMAL", "NOT FIXING"] },
];

const PRIMARY_COLOR = "#0a649d";

export async function getServerSideProps(context) {
    const user = await getUserFromRequest(context.req);

    if (!user) {
        return {
            redirect: {
                destination: "/Technicianlogin",
                permanent: false,
            },
        };
    }

    if (user.role !== "worker") {
        return {
            redirect: {
                destination: user.role === "customer" ? "/Customerdashboard" : "/Admindashboard",
                permanent: false,
            },
        };
    }

    const profile = await getStaffProfile(user.id);

    return {
        props: {
            user: { ...user, phone: profile.phone, designation: profile.designation },
        },
    };
}

// Icons
function DashboardIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
        </svg>
    );
}

function JobsIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
    );
}

function InventoryIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
    );
}

// A shaft with floor dividers and the car — matches the same elevator
// motif used elsewhere for this feature, not a generic icon.
function ProjectsIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <rect x="6" y="3" width="12" height="18" rx="1.5" />
            <path strokeLinecap="round" d="M6 9h12M6 15h12" />
            <rect x="10" y="10.5" width="4" height="3" rx="0.5" fill="currentColor" stroke="none" />
        </svg>
    );
}

// "1h 24m" / "45m" — how long the technician was actually on site.
function formatJobDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
}

function ProfileIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );
}

function PhoneIcon({ className = "h-4.5 w-4.5" }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.72.73.73 0 01-.02.43c-.45 1.29-.2 2.79.6 3.88.38.5.85 1.01 1.44 1.54M3 5a2 2 0 002 2h3.28a1 1 0 00.94-.72l.15-.45M17 19a2 2 0 012-2h3.28c.37 0 .7.21.82.56.45 1.29.2 2.79-.6 3.88-.38.5-.85 1.01-1.44 1.54M17 19a2 2 0 002 2h3.28a1 1 0 00.82-.56l.15-.45M3 10a11.95 11.95 0 009.58 9.58" />
        </svg>
    );
}

function MapIcon({ className = "h-4.5 w-4.5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function CloseIcon({ className = "h-5 w-5" }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function ScanIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-16v3m9 1h-1.5M4 16h2v4m12 0h2v-4m-16 0V9m3-5H4v4m12 0h4V4M9 9h6v6H9V9z" />
        </svg>
    );
}

function LogoutIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    );
}

function BackIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
    );
}

// The technician-side counterpart to the admin installation checklist —
// same 52 steps, same phase grouping, but a project list first (a worker
// can be crewed on more than one at once) and larger touch targets since
// this gets used on site, often one-handed.
function TechnicianProjectsView({ projects, loading, checklistProject, onOpenProject, onBack, onProjectUpdated }) {
    const [pendingKey, setPendingKey] = useState("");
    const [error, setError] = useState("");

    if (checklistProject) {
        const completions = checklistProject.checklistCompletions || [];
        const completedByKey = new Map(completions.map((c) => [c.itemKey, c]));
        const completedKeys = completedByKey;
        const completedCount = completedByKey.size;
        const totalSteps = PROJECT_CHECKLIST_ITEMS.length;
        const percent = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0;
        const nextItemKey = PROJECT_CHECKLIST_ITEMS.find((item) => !completedKeys.has(item)) || null;
        const isComplete = completedCount >= totalSteps;

        async function toggle(itemKey, nextCompleted) {
            setPendingKey(itemKey);
            setError("");
            try {
                const res = await fetch(`/api/worker/projects/${checklistProject.id}/checklist`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ itemKey, completed: nextCompleted }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || "Failed to update step");
                onProjectUpdated({ ...checklistProject, checklistCompletions: data.checklistCompletions });
            } catch (err) {
                setError(err.message);
            } finally {
                setPendingKey("");
            }
        }

        return (
            <div className="p-4 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                    >
                        <BackIcon className="h-4.5 w-4.5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-black tracking-tight text-slate-900">{checklistProject.customerName}</h1>
                        <p className="text-xs text-slate-500">{checklistProject.quotationNo}</p>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-black ${isComplete ? "text-emerald-700" : "text-[#0a649d]"}`}>
                            {isComplete ? "All steps complete" : `${completedCount}/${totalSteps} steps done`}
                        </span>
                        <span className="text-xs font-black text-slate-500">{percent}%</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-[#0a649d]"}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>

                {error && <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

                {PROJECT_CHECKLIST_PHASES.map((phase, phaseIndex) => {
                    const phaseDone = phase.items.filter((item) => completedKeys.has(item)).length;
                    const phaseState = phaseDone >= phase.items.length ? "done" : phase.items.includes(nextItemKey) ? "active" : "locked";
                    return (
                        <div key={phase.phase}>
                            <div className="mb-2 flex items-center gap-3 px-1">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                                    phaseState === "done" ? "bg-emerald-50" : phaseState === "active" ? "bg-sky-50" : "bg-slate-50"
                                }`}>
                                    <PhaseIcon phase={PHASE_ICON_KEYS[phaseIndex]} state={phaseState} size={40} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-xs font-black text-slate-700">{phase.phase}</h3>
                                    <p className="text-[10px] font-bold text-slate-400">{phaseDone}/{phase.items.length} steps</p>
                                </div>
                                {phaseState === "active" && (
                                    <span className="shrink-0 rounded-lg bg-[#0a649d] px-2 py-0.5 text-[9px] font-black uppercase text-white">
                                        Next
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                {phase.items.map((item) => {
                                    const completion = completedByKey.get(item);
                                    const checked = Boolean(completion);
                                    const isNext = item === nextItemKey;
                                    return (
                                        <label
                                            key={item}
                                            className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3.5 transition ${
                                                checked
                                                    ? "border-emerald-100 bg-emerald-50/60"
                                                    : isNext
                                                    ? "border-[#0a649d] bg-sky-50/60"
                                                    : "border-slate-100 bg-white"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={pendingKey === item}
                                                onChange={() => toggle(item, !checked)}
                                                className="mt-0.5 h-5 w-5 shrink-0 accent-[#0a649d] disabled:opacity-50"
                                            />
                                            <span className="min-w-0 flex-1 text-xs font-bold leading-snug">
                                                <span className={checked ? "text-emerald-800" : "text-slate-700"}>{item}</span>
                                                {checked && (
                                                    <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                                                        {completion.completedByName || (completion.completedByUsername ? `@${completion.completedByUsername}` : "Technician")}
                                                        {completion.completedAt && ` · ${new Date(completion.completedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}`}
                                                    </span>
                                                )}
                                            </span>
                                            {isNext && !checked && (
                                                <span className="shrink-0 rounded-lg bg-[#0a649d] px-2 py-0.5 text-[9px] font-black uppercase text-white">
                                                    Next
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 animate-in fade-in duration-200">
            <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">My Projects</h1>
                <p className="text-xs text-slate-500 mt-0.5">Installations you're crewed on — track your own progress on site.</p>
            </div>

            {loading ? (
                <p className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-xs font-bold text-slate-400">Loading your projects...</p>
            ) : projects.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <p className="text-sm font-black text-slate-700">No projects assigned yet</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">The office will assign you here once you're put on an installation crew.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {projects.map((project) => {
                        const completedKeys = new Set((project.checklistCompletions || []).map((c) => c.itemKey));
                        const completedCount = completedKeys.size;
                        const totalSteps = PROJECT_CHECKLIST_ITEMS.length;
                        const percent = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0;
                        const isComplete = completedCount >= totalSteps;
                        const crewNames = (project.assignees || []).map((a) => a.name).join(" & ");
                        const activePhaseIndex = PROJECT_CHECKLIST_PHASES.findIndex((phase) => !phase.items.every((item) => completedKeys.has(item)));
                        const currentPhase = PROJECT_CHECKLIST_PHASES[activePhaseIndex === -1 ? PROJECT_CHECKLIST_PHASES.length - 1 : activePhaseIndex];
                        const currentPhaseIconKey = PHASE_ICON_KEYS[activePhaseIndex === -1 ? PHASE_ICON_KEYS.length - 1 : activePhaseIndex];
                        return (
                            <button
                                key={project.id}
                                onClick={() => onOpenProject(project)}
                                className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] transition"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${isComplete ? "bg-emerald-50" : "bg-sky-50"}`}>
                                        <PhaseIcon phase={currentPhaseIconKey} state={isComplete ? "done" : "active"} size={56} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="truncate text-sm font-black text-slate-900">{project.customerName}</p>
                                            <span className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black whitespace-nowrap ${isComplete ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-[#0a649d]"}`}>
                                                {isComplete ? "COMPLETE" : `${percent}%`}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">
                                            {isComplete ? "All phases complete" : currentPhase.phase}
                                        </p>
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-[#0a649d]"}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-2 text-[10px] font-bold text-slate-400">{completedCount}/{totalSteps} steps done</p>

                                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-[10.5px] font-semibold text-slate-500">
                                    <p className="truncate"><span className="text-slate-400">Site:</span> {project.address || project.city || "Not listed"}</p>
                                    <p className="truncate"><span className="text-slate-400">Mobile:</span> {project.mobileNo || "Not listed"}</p>
                                    <p className="col-span-2 truncate"><span className="text-slate-400">Crew:</span> {crewNames || "—"}</p>
                                    <p className="col-span-2"><span className="text-slate-400">Started:</span> {project.startedAt ? new Date(project.startedAt).toLocaleDateString("en-IN") : "—"}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function Techniciandashboard({ user }) {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, jobs, inventory, projects, profile
    const [activeJob, setActiveJob] = useState(null); // active job workspace
    const [jobsFilter, setJobsFilter] = useState("assigned"); // assigned, completed

    // Dashboard "Return Materials" list — every job the worker has ever had
    // materials issued for, so they can jump straight to that job's Store
    // Pass QR without opening the full job workspace first.
    const [showReturnMaterials, setShowReturnMaterials] = useState(false);

    // Installation projects this technician is crewed on — fetched once the
    // Projects tab is opened.
    const [myProjects, setMyProjects] = useState([]);
    const [myProjectsLoading, setMyProjectsLoading] = useState(true);
    const [checklistProject, setChecklistProject] = useState(null);

    // Every tab/filter switch and job open reuses the same scrollable <main>
    // — without this its scroll position carries over from whatever was
    // scrolled before, so a new view can silently open mid-scroll. Keyed on
    // activeJob's id, not the activeJob object itself — every checklist tap,
    // GPS check-in, and keystroke in the completion form replaces that
    // object wholesale (same job, new reference), which previously reran
    // this effect and yanked the page back to the top on every interaction.
    const mainScrollRef = useRef(null);
    useEffect(() => {
        mainScrollRef.current?.scrollTo(0, 0);
    }, [activeTab, activeJob?.id, jobsFilter, showReturnMaterials, checklistProject?.id]);

    // Signature Canvas Refs & States
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureCaptured, setSignatureCaptured] = useState(false);
    const [sigCustomerName, setSigCustomerName] = useState("");
    const [sigConsentChecked, setSigConsentChecked] = useState(false);

    const [checkingIn, setCheckingIn] = useState(false);
    const [gpsCoords, setGpsCoords] = useState(null); // { latitude, longitude, accuracy }
    const [gpsError, setGpsError] = useState("");

    // Requesting materials without a QR — for a job the worker already knows
    // needs a part, or one they didn't collect in person.
    const [materialRequestQuery, setMaterialRequestQuery] = useState("");
    const [materialRequestResults, setMaterialRequestResults] = useState([]);
    const [materialRequestQuantity, setMaterialRequestQuantity] = useState(1);
    const [materialRequestCart, setMaterialRequestCart] = useState([]);
    const [submittingMaterialRequest, setSubmittingMaterialRequest] = useState(false);
    const [materialRequestFeedback, setMaterialRequestFeedback] = useState("");

    useEffect(() => {
        const q = materialRequestQuery.trim();
        if (!q) {
            const timer = setTimeout(() => setMaterialRequestResults([]), 0);
            return () => clearTimeout(timer);
        }
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/inventory?search=${encodeURIComponent(q)}`, { signal: controller.signal });
                const data = await res.json();
                if (!controller.signal.aborted && data.success) setMaterialRequestResults(data.items);
            } catch {
                if (!controller.signal.aborted) setMaterialRequestResults([]);
            }
        }, 300);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [materialRequestQuery]);

    useEffect(() => {
        if (activeTab !== "projects") return;
        let active = true;
        (async () => {
            try {
                const res = await fetch("/api/worker/projects");
                const data = await res.json();
                if (active && data.success) setMyProjects(data.projects || []);
            } catch {
                // Leave whatever was last loaded — the card just won't update this pass.
            } finally {
                if (active) setMyProjectsLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [activeTab]);

    function addToMaterialRequestCart(item) {
        setMaterialRequestCart(prev => {
            const exists = prev.find(p => p.itemId === item.id);
            if (exists) {
                return prev.map(p => p.itemId === item.id ? { ...p, quantity: p.quantity + materialRequestQuantity } : p);
            }
            return [...prev, { itemId: item.id, name: item.name, unit: item.unit, quantity: materialRequestQuantity }];
        });
        setMaterialRequestQuery("");
        setMaterialRequestResults([]);
        setMaterialRequestQuantity(1);
    }

    function removeFromMaterialRequestCart(itemId) {
        setMaterialRequestCart(prev => prev.filter(p => p.itemId !== itemId));
    }

    async function submitMaterialRequest() {
        if (!activeJob || materialRequestCart.length === 0) return;
        setSubmittingMaterialRequest(true);
        setMaterialRequestFeedback("");
        try {
            const res = await fetch("/api/worker/request-materials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobDbId: activeJob.dbId,
                    items: materialRequestCart.map(item => ({ itemId: item.itemId, quantity: item.quantity })),
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Failed to send request");
            setMaterialRequestCart([]);
            setMaterialRequestFeedback("Request sent to the store.");
        } catch (err) {
            setMaterialRequestFeedback(err.message || "Failed to send request");
        } finally {
            setSubmittingMaterialRequest(false);
        }
    }

    // Store Material Pass (real QR job-pass image) states
    const [jobPassJob, setJobPassJob] = useState(null);
    const [showJobPassModal, setShowJobPassModal] = useState(false);
    const [jobPassLoading, setJobPassLoading] = useState(false);
    const [jobPassImage, setJobPassImage] = useState(null);

    const [jobs, setJobs] = useState([]);
    const [jobsError, setJobsError] = useState("");

    // Voice note states for the job completion form
    const [voiceLanguage, setVoiceLanguage] = useState("auto");
    const [isRecording, setIsRecording] = useState(false);
    const [voiceProcessing, setVoiceProcessing] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState("");
    const [voiceEnglishNote, setVoiceEnglishNote] = useState("");
    const [voiceError, setVoiceError] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef("");
    const [submittingJob, setSubmittingJob] = useState(false);

    function mapAssignedComplaintToJob(c) {
        // Only the primary (senior) technician submits the job report — a
        // junior assignee still gets the notification and can see the job,
        // but the checklist/GPS/signature workflow is gated off for them.
        const isPrimary = Number(c.assignedTechnicianUserId) === Number(user.id);
        const seniorName = (c.assignees || []).find((a) => Number(a.id) === Number(c.assignedTechnicianUserId))?.name
            || c.assignedTechnicianName;
        const isService = c.complaintType === "SERVICE_REQUEST";

        // Reopening a job (assigned or already completed) must show what was
        // actually saved, not a blank form — otherwise it looks empty/broken
        // both for a fresh open and for browsing completed history.
        const jc = c.jobCompletion || null;
        const hasGps = jc && Number.isFinite(Number(jc.gpsLatitude)) && Number.isFinite(Number(jc.gpsLongitude));

        return {
            id: c.complaintNo,
            dbId: c.id,
            customerName: c.customerName,
            isPrimary,
            seniorName,
            buildingName: c.city || "Customer site",
            address: c.address || "-",
            phone: c.mobileNo || "-",
            liftId: c.customerCode || "LIFT",
            liftType: "Elevator complaint",
            floors: "-",
            capacity: "-",
            type: c.complaintType?.replaceAll("_", " ") || "Service Request",
            category: c.complaintType?.replaceAll("_", " ") || "Service Request",
            description: c.description || "No description provided.",
            priority: c.priority === "EMERGENCY" ? "Emergency" : c.priority || "NORMAL",
            assignedTime: c.assignedAt ? new Date(c.assignedAt).toLocaleString("en-IN") : "Assigned",
            assignedBy: c.assignedByUsername || "Office/Admin",
            status: ["RESOLVED", "CLOSED"].includes(c.status) ? "Completed" : c.status?.replaceAll("_", " ") || "ASSIGNED",
            // Scheduled monthly service visits go through the full 11-point
            // checklist; ad-hoc breakdown tickets skip it for a simple
            // comments + resolved field instead.
            isService,
            checklist: jc?.checklist && Object.keys(jc.checklist).length
                ? { ...Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, null])), ...jc.checklist }
                : Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, null])),
            workReport: {
                problem: (isService && jc?.problemIdentified) || "",
                workPerformed: (isService && jc?.workPerformed) || "",
                sparePartsUsed: jc?.sparePartsUsed || "",
                remarks: "",
                status: jc?.statusResolution || "Completed",
            },
            comments: (!isService && (jc?.workPerformed || jc?.problemIdentified)) || "",
            resolved: jc ? jc.statusResolution !== "Not Resolved" : true,
            // checkedInAt reaches the server the moment the worker taps
            // "Check In" (lib/complaints.js normalizeComplaintRow) — well
            // before job completion, so reopening the app after closing it
            // mid-job still shows "already on site" instead of asking the
            // worker to check in again.
            gpsCheckedIn: Boolean(c.checkedInAt) || Boolean(jc),
            checkInTime: c.checkedInAt
                ? new Date(c.checkedInAt).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, day: "numeric", month: "short" })
                : (jc?.completedAt ? new Date(jc.completedAt).toLocaleString("en-IN") : null),
            gpsCoords: Number.isFinite(Number(c.checkInLatitude)) && Number.isFinite(Number(c.checkInLongitude))
                ? { latitude: Number(c.checkInLatitude), longitude: Number(c.checkInLongitude), accuracy: c.checkInAccuracyMeters }
                : (hasGps ? { latitude: Number(jc.gpsLatitude), longitude: Number(jc.gpsLongitude), accuracy: jc.gpsAccuracyMeters } : null),
            signature: jc?.customerRepName ? { customerName: jc.customerRepName, image: jc.signatureImage || null } : null,
            gpsAddress: c.checkInAddress || jc?.gpsAddress || null,
            completeTime: jc?.completedAt ? new Date(jc.completedAt).toLocaleString("en-IN") : null,
            materials: c.materials || [],
            durationMinutes: jc?.durationMinutes ?? null,
        };
    }

    async function fetchAssignedComplaints() {
        setJobsError("");
        try {
            const res = await fetch("/api/worker/assigned-complaints?page=1&pageSize=50");
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to load assigned complaints");
            const mapped = (data.complaints || []).map(mapAssignedComplaintToJob);
            setJobs(mapped);
        } catch (err) {
            setJobsError(err.message || "Failed to load assigned complaints");
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => fetchAssignedComplaints(), 0);
        // Subscribe to push notifications (non-blocking — worker can still decline)
        subscribeToPush().catch(() => {});
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!router.isReady) return;
        const tab = typeof router.query.tab === "string" ? router.query.tab : "";
        if (!["dashboard", "jobs", "projects", "profile"].includes(tab)) return;
        const timer = setTimeout(() => {
            setActiveTab(tab);
            setActiveJob(null);
            if (tab === "jobs") setJobsFilter("assigned");
        }, 0);
        return () => clearTimeout(timer);
    }, [router.isReady, router.query.tab]);

    // Track active job timeline and checklists
    const updateJobStatus = (jobId, nextStatus) => {
        setJobs(prev => prev.map(job => {
            if (job.id === jobId) {
                return { ...job, status: nextStatus };
            }
            return job;
        }));
        if (activeJob && activeJob.id === jobId) {
            setActiveJob(prev => ({ ...prev, status: nextStatus }));
        }
    };

    // Tab navigations
    const handleTabChange = (tabName) => {
        setActiveTab(tabName);
        setActiveJob(null);
    };

    const openJobDetails = (job) => {
        acknowledgeTicketNotification(job?.dbId);
        setActiveJob(job);
        setSigCustomerName(job?.signature?.customerName || job?.customerName || "");
        setActiveTab("jobs");
    };

    // Start Journey
    const handleStartJourney = (job) => {
        updateJobStatus(job.id, "En Route");
    };

    // GPS Arrival Verification — reads the device's real coordinates via the
    // browser Geolocation API (no fake/simulated location).
    // One tap: browser prompts for location permission (native popup, no
    // custom confirm screen), captures a fresh fix (maximumAge: 0, never
    // cached), and immediately unlocks the rest of the job form — no extra
    // "confirm arrival" step or success dialog in between.
    const triggerGPSCheckIn = async () => {
        setCheckingIn(true);
        setGpsError("");

        if (!navigator.geolocation) {
            setGpsError("This device/browser doesn't support location. Check-in requires GPS.");
            setCheckingIn(false);
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                });
            });
            const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
            };
            const timeNow = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
            setGpsCoords(coords);
            setJobs(prev => prev.map(job => job.id === activeJob.id
                ? { ...job, gpsCheckedIn: true, checkInTime: timeNow, gpsCoords: coords, status: "Arrived" }
                : job));
            setActiveJob(prev => ({ ...prev, gpsCheckedIn: true, checkInTime: timeNow, gpsCoords: coords, status: "Arrived" }));

            // Tells the server the moment arrival actually happens — previously
            // this was purely local state and the backend never learned about
            // it until the whole job was completed, so admin had no arrival
            // notification and there was no timestamp to measure visit duration from.
            await fetch("/api/worker/check-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobDbId: activeJob.dbId,
                    gpsLatitude: coords.latitude,
                    gpsLongitude: coords.longitude,
                    gpsAccuracyMeters: coords.accuracy,
                }),
            });
        } catch (err) {
            setGpsError(
                err.code === 1
                    ? "Location permission denied. Enable location access for this site and try again."
                    : "Couldn't get a GPS fix. Move to an open area and try again."
            );
        } finally {
            setCheckingIn(false);
        }
    };

    // Checklist toggles
    const handleChecklistSelect = (itemKey, value) => {
        if (!activeJob) return;
        const updatedChecklist = {
            ...activeJob.checklist,
            [itemKey]: value
        };

        setJobs(prev => prev.map(j => {
            if (j.id === activeJob.id) {
                return { ...j, checklist: updatedChecklist };
            }
            return j;
        }));

        setActiveJob(prev => ({ ...prev, checklist: updatedChecklist }));
    };

    // Drawing Canvas events
    const startDrawingSig = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#000";

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const drawSig = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();

        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawingSig = () => {
        setIsDrawing(false);
        setSignatureCaptured(true);
    };

    const clearSignaturePad = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureCaptured(false);
    };

    // Spare parts dropdown logger
    const handleAddSparePartToReport = (part) => {
        if (!activeJob) return;
        const partsList = activeJob.workReport.sparePartsUsed 
            ? `${activeJob.workReport.sparePartsUsed}, ${part}`
            : part;

        setJobs(prev => prev.map(j => {
            if (j.id === activeJob.id) {
                return {
                    ...j,
                    workReport: { ...j.workReport, sparePartsUsed: partsList }
                };
            }
            return j;
        }));

        setActiveJob(prev => ({
            ...prev,
            workReport: { ...prev.workReport, sparePartsUsed: partsList }
        }));
    };

    // Report field changes
    const handleReportFieldChange = (field, val) => {
        if (!activeJob) return;
        
        setJobs(prev => prev.map(j => {
            if (j.id === activeJob.id) {
                return {
                    ...j,
                    workReport: { ...j.workReport, [field]: val }
                };
            }
            return j;
        }));

        setActiveJob(prev => ({
            ...prev,
            workReport: { ...prev.workReport, [field]: val }
        }));
    };

    // Submit / Complete Job
    const handleCompleteJob = async (e) => {
        e.preventDefault();

        // GPS Check-in validation
        if (!activeJob.gpsCheckedIn) {
            Swal.fire({ icon: "warning", title: "Location required", text: "Please complete the GPS location check-in first.", confirmButtonColor: "#0a649d" });
            return;
        }

        // Service visits: the 11-point checklist is mandatory. Breakdown
        // tickets: a short comment on what was found/done is mandatory
        // instead — no checklist for an ad-hoc repair.
        if (activeJob.isService) {
            const pendingItems = Object.entries(activeJob.checklist).filter(([_, val]) => !val);
            if (pendingItems.length > 0) {
                Swal.fire({ icon: "warning", title: "Checklist incomplete", text: `You must complete all ${CHECKLIST_ITEMS.length} checklist checkpoints before closing.`, confirmButtonColor: "#0a649d" });
                return;
            }
        } else if (!activeJob.comments.trim()) {
            Swal.fire({ icon: "warning", title: "Details required", text: "Please add a comment describing what was found and done.", confirmButtonColor: "#0a649d" });
            return;
        }

        // Customer Signature checks
        if (!signatureCaptured || !sigCustomerName.trim() || !sigConsentChecked) {
            Swal.fire({ icon: "warning", title: "Signature required", text: "Customer signature drawing, name, and consent are mandatory.", confirmButtonColor: "#0a649d" });
            return;
        }

        if (!activeJob.dbId) {
            Swal.fire({ icon: "error", title: "Cannot save", text: "This job has no server record — please reopen it from the job list and try again.", confirmButtonColor: "#0a649d" });
            return;
        }

        setSubmittingJob(true);

        // Persist to DB. Unlike a push notification, this write is not
        // optional — if it fails, the job must NOT be shown as completed,
        // otherwise the local UI silently drifts from the real status and
        // the job never shows in history because the server never saw it.
        let saved = false;
        try {
            const res = await fetch("/api/worker/complete-job", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobDbId: activeJob.dbId,
                    problemIdentified: activeJob.isService ? activeJob.workReport.problem : activeJob.comments,
                    workPerformed: activeJob.isService ? activeJob.workReport.workPerformed : activeJob.comments,
                    sparePartsUsed: activeJob.workReport.sparePartsUsed,
                    statusResolution: activeJob.isService ? activeJob.workReport.status : (activeJob.resolved ? "Resolved" : "Not Resolved"),
                    gpsCheckedIn: activeJob.gpsCheckedIn,
                    gpsLatitude: activeJob.gpsCoords?.latitude ?? null,
                    gpsLongitude: activeJob.gpsCoords?.longitude ?? null,
                    gpsAccuracyMeters: activeJob.gpsCoords?.accuracy ?? null,
                    checklistData: activeJob.isService ? activeJob.checklist : {},
                    customerRepName: sigCustomerName,
                    signatureImage: canvasRef.current ? canvasRef.current.toDataURL("image/png") : null,
                    voiceLanguage: voiceLanguage !== "auto" ? voiceLanguage : null,
                    voiceOriginalTranscript: voiceTranscript || null,
                    voiceEnglishTranslation: voiceEnglishNote || null,
                    voiceProcessingStatus: voiceTranscript ? "DONE" : null,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to save the job completion.");
            saved = true;
        } catch (err) {
            setSubmittingJob(false);
            Swal.fire({ icon: "error", title: "Could not complete job", text: err.message || "Something went wrong saving this job — please try again.", confirmButtonColor: "#0a649d" });
            return;
        }

        if (!saved) {
            setSubmittingJob(false);
            return;
        }

        // Reset workspace states
        setSigCustomerName("");
        setSigConsentChecked(false);
        setSignatureCaptured(false);
        resetVoiceNote();
        setSubmittingJob(false);

        Swal.fire({
            icon: "success",
            title: "Job completed",
            html: `Ticket <strong>${activeJob.id}</strong> has been resolved.<br/>The office and the customer have both been notified.`,
            confirmButtonColor: "#0a649d",
        });

        setActiveJob(null);
        setActiveTab("dashboard");

        // Refetch from the server rather than mutating local state, so the
        // job's status/history reflects what's actually persisted.
        fetchAssignedComplaints();
    };

    // Voice note recording using the browser's built-in Web Speech API (free, no API key).
    // Transcription runs locally in the browser. Only translation (Telugu/Hindi → English)
    // hits the backend, and that only needs a free Groq or MyMemory key.
    const startVoiceRecording = () => {
        setVoiceError("");
        setVoiceTranscript("");
        setVoiceEnglishNote("");
        setInterimTranscript("");
        finalTranscriptRef.current = "";

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceError("Voice recognition requires Chrome or Edge. Please type the note manually.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        const langMap = { auto: "en-IN", telugu: "te-IN", hindi: "hi-IN", english: "en-IN" };
        const capturedLang = voiceLanguage;
        recognition.lang = langMap[capturedLang] || "en-IN";
        recognition.continuous = true;   // keep listening until worker taps Stop
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsRecording(true);

        recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + text;
                    setVoiceTranscript(finalTranscriptRef.current.trim());
                } else {
                    interim += text;
                }
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event) => {
            setIsRecording(false);
            setInterimTranscript("");
            const msgs = {
                "not-allowed": "Microphone access denied. Please allow microphone access and try again.",
                "no-speech": "No speech detected. Tap the mic and speak clearly.",
                "network": "Network error during recognition. Please check your connection.",
            };
            setVoiceError(msgs[event.error] || "Voice recognition failed. Please type the note manually.");
        };

        recognition.onend = () => {
            setIsRecording(false);
            setInterimTranscript("");
            const transcript = finalTranscriptRef.current.trim();
            if (!transcript) return;
            // Telugu and Hindi need English translation; English/auto are already in English
            if (capturedLang === "telugu" || capturedLang === "hindi") {
                translateVoiceTranscript(transcript, capturedLang);
            } else {
                // English or auto — no translation needed, fill directly
                handleReportFieldChange("workPerformed", transcript);
            }
        };

        recognition.start();
    };

    const stopVoiceRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsRecording(false);
    };

    const translateVoiceTranscript = async (text, lang) => {
        setVoiceProcessing(true);
        try {
            const res = await fetch("/api/worker/voice-note/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, fromLanguage: lang }),
            });
            const data = await res.json();
            if (data.success) {
                setVoiceEnglishNote(data.translatedText || "");
                handleReportFieldChange("workPerformed", data.translatedText || text);
            } else {
                // Translation failed — fill with original so worker can edit manually
                setVoiceEnglishNote(text);
                handleReportFieldChange("workPerformed", text);
                if (data.message) setVoiceError(data.message);
            }
        } catch {
            setVoiceEnglishNote(text);
            handleReportFieldChange("workPerformed", text);
            setVoiceError("Translation unavailable. Original transcript filled — please edit if needed.");
        } finally {
            setVoiceProcessing(false);
        }
    };

    const resetVoiceNote = () => {
        setVoiceTranscript("");
        setVoiceEnglishNote("");
        setVoiceError("");
        setInterimTranscript("");
        setIsRecording(false);
        setVoiceProcessing(false);
        finalTranscriptRef.current = "";
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch {}
            recognitionRef.current = null;
        }
    };

    // Generate a real, camera-scannable Store Material Pass QR for a job
    const openJobPass = async (job) => {
        if (!job?.dbId) return;
        setJobPassJob(job);
        setShowJobPassModal(true);
        setJobPassLoading(true);
        setJobPassImage(null);
        try {
            const res = await fetch(`/api/worker/job-qr?complaintId=${job.dbId}`);
            const data = await res.json();
            if (!data.success) {
                Swal.fire({ icon: "error", title: "Couldn't generate pass", text: data.message || "Failed to generate store pass.", confirmButtonColor: "#0a649d" });
                setShowJobPassModal(false);
                return;
            }
            const dataUrl = await QRCode.toDataURL(data.token, { width: 320, margin: 2 });
            setJobPassImage(dataUrl);
        } catch (err) {
            Swal.fire({ icon: "error", title: "Couldn't generate pass", text: "Failed to generate store pass.", confirmButtonColor: "#0a649d" });
            setShowJobPassModal(false);
        } finally {
            setJobPassLoading(false);
        }
    };

    // Closing the pass modal is also the natural moment to refresh — the
    // store may have scanned and reconciled it while it was open, and the
    // Return Materials list should reflect that as soon as the worker is
    // back looking at it, not just on the next full page load.
    const closeJobPassModal = () => {
        setShowJobPassModal(false);
        fetchAssignedComplaints();
    };

    // Logout
    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/Technicianlogin");
        } catch (e) {
            router.push("/Technicianlogin");
        }
    };

    // Dynamic counts
    const todayJobsCount = jobs.filter(j => j.status !== "Completed").length;
    const completedJobsCount = jobs.filter(j => j.status === "Completed").length;
    const emergencyJobsCount = jobs.filter(j => j.status !== "Completed" && j.priority === "Emergency").length;

    // Every job that's ever had materials issued against it — stays listed
    // even after the store fully reconciles it, so "used/returned" numbers
    // remain visible instead of disappearing the moment nothing's owed.
    const jobsWithMaterials = jobs.filter(j => (j.materials || []).length > 0);
    const pendingReturnJobsCount = jobsWithMaterials.filter(j => (j.materials || []).some(m => m.outstandingQuantity > 0)).length;

    return (
        <>
        <Head>
            <link key="manifest" rel="manifest" href="/manifest-technician.webmanifest" />
        </Head>
        <div className="min-h-[100dvh] bg-slate-900 sm:py-6 flex items-center justify-center font-sans antialiased">
            {/* Phone Bezel Simulator */}
            <div className="w-full sm:max-w-md h-[100dvh] sm:h-[840px] sm:min-h-[840px] sm:max-h-[840px] bg-[#f8fafc] text-[#0f172a] relative flex flex-col sm:shadow-2xl sm:rounded-[40px] sm:border-[10px] sm:border-slate-800 overflow-hidden select-none">

                {/* Status Bar */}
                <div className="bg-[#0a649d] px-6 pt-3.5 pb-2.5 flex justify-between items-center text-[11px] font-bold text-white select-none shrink-0 sm:flex hidden">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5">
                        <span>5G</span>
                        <div className="w-5 h-2.5 border border-white rounded-sm p-0.5 flex items-center">
                            <div className="h-full w-3 bg-white rounded-2xs"></div>
                        </div>
                    </div>
                </div>

                {/* Navigation Header */}
                <header className="sticky top-0 z-30 text-white px-5 py-4 flex items-center justify-between shrink-0"
                    style={{ background: "linear-gradient(135deg, #04182b 0%, #073354 45%, #0a4f7a 100%)", boxShadow: "0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.3)" }}>
                    <div className="flex items-center gap-3">
                        <div className="relative h-10.5 w-10.5 overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_8px_24px_rgba(2,6,23,0.18)] shrink-0">
                            <Image
                                src="/adlogo.png"
                                alt="Amardip Lifts"
                                fill
                                sizes="42px"
                                className="object-contain p-1"
                                priority
                            />
                        </div>
                        <div>
                            <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest leading-none block">
                                Amardip Lifts
                            </span>
                            <span className="text-base font-extrabold tracking-tight leading-normal">
                                {user?.name}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => { setActiveTab("projects"); setActiveJob(null); }}
                        className="relative h-10 w-10 bg-white/10 hover:bg-white/18 active:scale-95 transition flex items-center justify-center rounded-full"
                    >
                        <ProjectsIcon className="h-5.5 w-5.5 text-white" />
                    </button>
                </header>

                {/* Main Workspace content */}
                <main ref={mainScrollRef} className="amardip-app-main flex-1 overflow-y-auto bg-[#f1f5f9]">

                    {/* VIEW: DASHBOARD TAB */}
                    {activeTab === "dashboard" && !activeJob && showReturnMaterials && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowReturnMaterials(false)}
                                    className="h-9.5 w-9.5 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                                >
                                    &larr;
                                </button>
                                <div>
                                    <h1 className="text-lg font-black tracking-tight text-slate-900">Return Materials</h1>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Show your Store Pass QR to hand back or close out parts</p>
                                </div>
                            </div>

                            {jobsWithMaterials.length === 0 ? (
                                <p className="p-8 text-center text-xs text-slate-400 font-bold bg-white rounded-3xl border border-slate-100">No materials issued to you yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {jobsWithMaterials.map((job) => {
                                        const pending = (job.materials || []).some((m) => m.outstandingQuantity > 0);
                                        return (
                                            <div
                                                key={job.id}
                                                onClick={() => openJobPass(job)}
                                                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 cursor-pointer active:scale-[0.99] transition"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900">{job.id}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{job.customerName}</p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${pending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                                                        {pending ? "Pending Return" : "Reconciled"}
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {job.materials.map((m) => (
                                                        <div key={m.itemId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                                            <span className="font-bold text-slate-700 text-[11px]">{m.name}</span>
                                                            <span className="text-[10px] font-semibold text-slate-500">
                                                                Issued {m.issuedQuantity} {m.unit} · Used {m.usedQuantity} {m.unit} · Returned {m.returnedQuantity} {m.unit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="w-full bg-[#0a649d] rounded-xl py-2.5 text-center text-xs font-black text-white flex items-center justify-center gap-1.5">
                                                    <ScanIcon className="h-3.5 w-3.5" />
                                                    Show Store Pass QR
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "dashboard" && !activeJob && !showReturnMaterials && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">

                            {/* Greeting card */}
                            <div className="rounded-3xl p-5 text-white shadow-md relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #1e4b7a 65%, #0e2a4a 100%)` }}>
                                <div className="absolute top-0 right-0 h-28 w-28 bg-white/5 rounded-full -mr-8 -mt-8"></div>
                                <span className="text-[10px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                                    Duty Status: Active
                                </span>
                                <h2 className="text-xl font-black mt-3 leading-tight">Welcome, {user?.name}</h2>
                                <p className="text-[10.5px] text-white/80 font-semibold mt-1">
                                    @{user?.username}{user?.designation ? ` · ${user.designation}` : ""}
                                </p>
                            </div>

                            {/* KPI Grid */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Field Metrics</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div 
                                        onClick={() => { setActiveTab("jobs"); setJobsFilter("assigned"); }}
                                        className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm hover:shadow active:scale-98 transition flex flex-col justify-between h-26 cursor-pointer select-none"
                                    >
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Today&apos;s Active Jobs</span>
                                        <p className="text-2xl font-black text-slate-900 mt-2">{todayJobsCount}</p>
                                    </div>
                                    <div
                                        onClick={() => setShowReturnMaterials(true)}
                                        className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm hover:shadow active:scale-98 transition flex flex-col justify-between h-26 cursor-pointer select-none"
                                    >
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Return Materials</span>
                                        <p className="text-2xl font-black text-slate-900 mt-2">{pendingReturnJobsCount}</p>
                                    </div>
                                    <div 
                                        onClick={() => { setActiveTab("jobs"); setJobsFilter("completed"); }}
                                        className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm hover:shadow active:scale-98 transition flex flex-col justify-between h-26 cursor-pointer select-none"
                                    >
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Completed Today</span>
                                        <p className="text-2xl font-black text-slate-900 mt-2">{completedJobsCount}</p>
                                    </div>
                                    <div 
                                        onClick={() => { setActiveTab("jobs"); setJobsFilter("assigned"); }}
                                        className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm hover:shadow active:scale-98 transition flex flex-col justify-between h-26 cursor-pointer select-none"
                                    >
                                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider leading-tight font-black">Emergency Tickets</span>
                                        <p className={`text-2xl font-black mt-2 ${emergencyJobsCount > 0 ? "text-red-600 animate-pulse" : "text-slate-900"}`}>{emergencyJobsCount}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Today's schedule summary */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-55">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Breakdown Schedule</h3>
                                </div>
                                <div className="space-y-3">
                                    {jobs.map(job => (
                                        <div 
                                            key={job.id} 
                                            onClick={() => openJobDetails(job)}
                                            className="p-3 border border-slate-100 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50 transition active:scale-98"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-extrabold text-slate-800">{job.id}</span>
                                                    {job.priority === "Emergency" && (
                                                        <span className="text-[7.5px] font-black px-1 rounded bg-red-100 text-red-700 uppercase tracking-wide">Emergency</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{job.customerName} • {job.phone} • Lift {job.liftId}</span>
                                            </div>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                                job.status === "Completed" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                job.status === "En Route" || job.status === "Arrived" ? "bg-blue-50 border-blue-100 text-blue-700" :
                                                "bg-amber-50 border-amber-100 text-amber-700"
                                            }`}>
                                                {job.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW: JOBS WORKSPACE */}
                    {activeTab === "jobs" && (
                        <div className="animate-in fade-in duration-200">
                            
                            {/* Sub-view: JOB LISTINGS */}
                            {!activeJob && (
                                <div className="p-4 space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h1 className="text-2xl font-black tracking-tight text-slate-900">Job Board</h1>
                                            <p className="text-xs text-slate-500 mt-0.5">Assigned breakdowns and routine services.</p>
                                        </div>
                                    </div>

                                    {/* Tab toggle */}
                                    <div className="flex gap-1.5 p-1 bg-slate-200/50 rounded-xl">
                                        <button
                                            onClick={() => setJobsFilter("assigned")}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${jobsFilter === "assigned" ? "bg-[#0a649d] text-white shadow-sm" : "text-slate-500"}`}
                                        >
                                            Active Assignments ({jobs.filter(j => j.status !== "Completed").length})
                                        </button>
                                        <button
                                            onClick={() => setJobsFilter("completed")}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${jobsFilter === "completed" ? "bg-[#0a649d] text-white shadow-sm" : "text-slate-500"}`}
                                        >
                                            Completed History ({jobs.filter(j => j.status === "Completed").length})
                                        </button>
                                    </div>

                                    {/* Job cards log */}
                                    <div className="space-y-4">
                                        {jobsError && (
                                            <p className="p-3 text-center text-xs font-bold text-red-700 bg-red-50 rounded-2xl border border-red-100">{jobsError}</p>
                                        )}
                                        {jobs.filter(j => jobsFilter === "completed" ? j.status === "Completed" : j.status !== "Completed").length === 0 ? (
                                            <p className="p-8 text-center text-xs text-slate-400 font-bold bg-white rounded-3xl border border-slate-100">No jobs listed in this filter.</p>
                                        ) : (
                                            jobs
                                                .filter(j => jobsFilter === "completed" ? j.status === "Completed" : j.status !== "Completed")
                                                .map(job => (
                                                    <div 
                                                        key={job.id}
                                                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-4"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-black text-slate-900">{job.id}</span>
                                                                    {job.priority === "Emergency" && (
                                                                        <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded-sm bg-red-100 border border-red-200 text-red-700 animate-pulse uppercase">
                                                                            Emergency
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{job.category} • Lift {job.liftId}</p>
                                                            </div>
                                                            <span className={`text-[10px] font-black px-3 py-1 rounded-xl border ${
                                                                job.status === "Completed" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                                job.status === "En Route" || job.status === "Arrived" ? "bg-blue-50 border-blue-100 text-blue-700" :
                                                                "bg-amber-50 border-amber-100 text-amber-700"
                                                            }`}>
                                                                {job.status}
                                                            </span>
                                                        </div>

                                                        {/* Brief address details */}
                                                        <div className="text-xs text-slate-500 font-medium leading-relaxed space-y-1 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100">
                                                            <p><strong className="text-slate-700">Client:</strong> {job.customerName}</p>
                                                            <p><strong className="text-slate-700">Number:</strong> {job.phone}</p>
                                                            <p><strong className="text-slate-700">Site:</strong> {job.buildingName}</p>
                                                            <p><strong className="text-slate-700">Assigned:</strong> {job.assignedTime}</p>
                                                            {job.checkInTime && (
                                                                <p><strong className="text-slate-700">Checked in:</strong> {job.checkInTime}</p>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex gap-2 pt-1.5">
                                                            {job.status === "IN PROGRESS" && (
                                                                    <button
                                                                        onClick={() => handleStartJourney(job)}
                                                                        className="h-9.5 flex-1 bg-[#0a649d] hover:bg-[#085282] text-white rounded-full text-xs font-extrabold tracking-wide transition active:scale-95 cursor-pointer"
                                                                    >
                                                                        START JOURNEY
                                                                    </button>
                                                            )}
                                                            <button
                                                                onClick={() => openJobDetails(job)}
                                                                className="h-9.5 flex-1 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full text-xs font-extrabold tracking-wide transition active:scale-95 cursor-pointer"
                                                            >
                                                                VIEW DETAILS
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Sub-view: ACTIVE JOB WORKSPACE FOR COMPLETE CLOSURE */}
                            {activeJob && (
                                <div className="p-4 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setActiveJob(null)}
                                            className="h-9.5 w-9.5 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                                        >
                                            &larr;
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-black text-slate-900">{activeJob.id} Workspace</h2>
                                                {activeJob.priority === "Emergency" && (
                                                    <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700 uppercase">Emergency</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lift Unit {activeJob.liftId}</p>
                                        </div>
                                    </div>

                                    {activeJob.status === "Completed" && (
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5 flex items-center gap-2.5">
                                            <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <div>
                                                <p className="text-xs font-black text-emerald-800">Job completed{activeJob.completeTime ? ` — ${activeJob.completeTime}` : ""}</p>
                                                <p className="text-[10px] font-semibold text-emerald-700">
                                                    Showing what was submitted. This job is closed.
                                                    {formatJobDuration(activeJob.durationMinutes) ? ` Time on site: ${formatJobDuration(activeJob.durationMinutes)}.` : ""}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 1: CUSTOMER & LIFT INFO */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Site & Asset Details</h3>
                                        <div className="space-y-3.5 text-xs">
                                            <div className="space-y-1">
                                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Customer / Building</span>
                                                <p className="font-extrabold text-slate-800">{activeJob.customerName}</p>
                                                {activeJob.checkInTime && (
                                                    <p className="text-[10px] font-bold text-emerald-600">Technician arrived {activeJob.checkInTime}</p>
                                                )}
                                                <p className="text-slate-500 font-medium leading-relaxed">{activeJob.address}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3.5 pt-1">
                                                <div>
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Lift Type</span>
                                                    <p className="font-extrabold text-slate-800 mt-1">{activeJob.liftType}</p>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Capacity / Floors</span>
                                                    <p className="font-extrabold text-slate-800 mt-1">{activeJob.capacity} • {activeJob.floors} Floors</p>
                                                </div>
                                            </div>
                                            <div className="space-y-1 pt-1">
                                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Complaint Description</span>
                                                <p className="text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">{activeJob.description}</p>
                                            </div>
                                        </div>

                                        {/* Contact / Maps Routing */}
                                        <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                                            <a 
                                                href={`tel:${activeJob.phone}`}
                                                className="h-10 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold transition active:scale-95"
                                            >
                                                <PhoneIcon className="h-4.5 w-4.5 text-slate-400" />
                                                Call Customer
                                            </a>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeJob.address || activeJob.buildingName || "")}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="h-10 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold transition active:scale-95"
                                            >
                                                <MapIcon className="h-4.5 w-4.5 text-slate-400" />
                                                Open Maps
                                            </a>
                                        </div>
                                    </div>

                                    {/* SECTION 1B: STORE MATERIAL PASS */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Store Material Pass</h3>
                                        <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                                            Show this QR to the storekeeper — before the job to collect parts, or after to return any unused ones. Same QR works both times.
                                        </p>
                                        <button
                                            onClick={() => openJobPass(activeJob)}
                                            className="h-10.5 w-full bg-[#0a649d] text-white hover:bg-[#085282] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm cursor-pointer"
                                        >
                                            <ScanIcon className="h-4.5 w-4.5" />
                                            Generate Store Pass QR
                                        </button>
                                        {activeJob.materials?.length > 0 && (
                                            <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                                                <span className="block text-[9px] font-bold text-amber-700 uppercase tracking-wider">Materials Used</span>
                                                {activeJob.materials.map((m) => (
                                                    <div key={m.itemId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                                        <span className="font-bold text-slate-700 text-[11px]">{m.name}</span>
                                                        <span className="text-[10px] font-semibold text-slate-500">
                                                            Issued {m.issuedQuantity} {m.unit} · Used {m.usedQuantity} {m.unit} · Returned {m.returnedQuantity} {m.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 1C: REQUEST MATERIALS (no QR needed) */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Request Materials</h3>
                                        <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                                            Know what this job needs already? Request it here — the store sees it and issues it, no QR needed.
                                        </p>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={materialRequestQuery}
                                                onChange={(e) => setMaterialRequestQuery(e.target.value)}
                                                placeholder="Search inventory item..."
                                                className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-[#0a649d] transition"
                                            />
                                            {materialRequestResults.length > 0 && (
                                                <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                                    {materialRequestResults.map(item => (
                                                        <button
                                                            type="button"
                                                            key={item.id}
                                                            onClick={() => addToMaterialRequestCart(item)}
                                                            className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                                                        >
                                                            {item.name} <span className="text-slate-400">({item.stockQuantity} {item.unit} in stock)</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-[auto_5rem_1fr] items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Qty</span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={materialRequestQuantity}
                                                onChange={(e) => setMaterialRequestQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="h-9 w-20 px-2 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#0a649d]"
                                            />
                                            <span className="min-w-0 text-[10px] leading-snug text-slate-400">Search and tap an item above to add it at this quantity.</span>
                                        </div>
                                        {materialRequestCart.length > 0 && (
                                            <div className="space-y-1.5">
                                                {materialRequestCart.map(item => (
                                                    <div key={item.itemId} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5">
                                                        <span className="min-w-0 break-words text-xs font-semibold text-slate-700">{item.name} × {item.quantity} {item.unit}</span>
                                                        <button type="button" onClick={() => removeFromMaterialRequestCart(item.itemId)} className="shrink-0 text-red-500 text-xs font-bold">Remove</button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    disabled={submittingMaterialRequest}
                                                    onClick={submitMaterialRequest}
                                                    className="h-10.5 w-full bg-[#0a649d] text-white hover:bg-[#085282] rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-98 shadow-sm disabled:opacity-50"
                                                >
                                                    {submittingMaterialRequest ? "Sending…" : "Send Request to Store"}
                                                </button>
                                            </div>
                                        )}
                                        {materialRequestFeedback && (
                                            <p className="text-[11px] font-bold text-emerald-600">{materialRequestFeedback}</p>
                                        )}
                                    </div>

                                    {/* SECTION 2: GPS SITE CHECK-IN */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Location Check-In</h3>

                                        {!activeJob.isPrimary && (
                                            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3.5 text-[11px] font-semibold text-amber-800 leading-relaxed">
                                                You are assisting on this job. {activeJob.seniorName ? `${activeJob.seniorName} is` : "The senior technician is"} the one who checks in and submits the report.
                                            </div>
                                        )}

                                        {!activeJob.gpsCheckedIn ? (
                                            <div className="space-y-4">
                                                <button
                                                    onClick={triggerGPSCheckIn}
                                                    disabled={checkingIn || activeJob.status === "Assigned" || !activeJob.isPrimary}
                                                    className="h-12 w-full bg-[#0a649d] text-white hover:bg-[#085282] disabled:opacity-40 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-98 shadow-sm cursor-pointer"
                                                >
                                                    {checkingIn ? (
                                                        <span>VERIFYING SATELLITE LOC...</span>
                                                    ) : (
                                                        <>
                                                            <svg className="h-4.5 w-4.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="12" r="3" /></svg>
                                                            <span>Capture GPS Location</span>
                                                        </>
                                                    )}
                                                </button>
                                                {gpsError && (
                                                    <p className="text-[10px] font-bold text-red-600 text-center">{gpsError}</p>
                                                )}

                                                {activeJob.status === "Assigned" && (
                                                    <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-wider">⚠️ Please accept the job to unlock GPS arrival check-in.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2 text-xs text-emerald-800">
                                                <div className="flex justify-between items-center pl-0.5">
                                                    <span className="font-bold">Check-in Status</span>
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                                                </div>
                                                <hr className="border-emerald-100/50" />
                                                <div className="space-y-1 pl-0.5">
                                                    <p><strong className="text-emerald-950">Arrival Timestamp:</strong> {activeJob.checkInTime}</p>
                                                    <p>
                                                        <strong className="text-emerald-950">Location:</strong>{" "}
                                                        {activeJob.gpsAddress
                                                            ? activeJob.gpsAddress
                                                            : activeJob.gpsCoords
                                                                ? "Captured — address will show once saved"
                                                                : "Not captured"}
                                                    </p>
                                                    <p><strong className="text-emerald-950">Verification:</strong> Location captured and saved in service ledger</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 3: SERVICE CHECKLIST (SERVICE VISITS ONLY, ONLY IF ARRIVED) */}
                                    {activeJob.gpsCheckedIn && activeJob.isService && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4 animate-in slide-in-from-bottom-3">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d]">Lift Inspection Checklist</h3>
                                                <span className="text-[10px] font-black text-slate-400">
                                                    {Object.values(activeJob.checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} DONE
                                                </span>
                                            </div>

                                            <div className="space-y-2.5">
                                                {CHECKLIST_ITEMS.map((item) => {
                                                    const value = activeJob.checklist[item.key];
                                                    return (
                                                        <div key={item.key} className="rounded-xl border border-slate-100 p-2.5">
                                                            <span className="block text-xs font-semibold text-slate-700 mb-1.5">{item.label}</span>
                                                            <div className={`grid gap-1.5 ${item.options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                                                                {item.options.map((option) => {
                                                                    const selected = value === option;
                                                                    const tone = option === "NORMAL"
                                                                        ? (selected ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700")
                                                                        : option === "ABNORMAL"
                                                                        ? (selected ? "bg-red-600 text-white" : "bg-red-50 text-red-700")
                                                                        : (selected ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700");
                                                                    return (
                                                                        <button
                                                                            key={option}
                                                                            type="button"
                                                                            disabled={activeJob.status === "Completed"}
                                                                            onClick={() => handleChecklistSelect(item.key, option)}
                                                                            className={`h-8 rounded-lg text-[9.5px] font-black uppercase tracking-wide transition active:scale-95 disabled:active:scale-100 disabled:cursor-default ${tone}`}
                                                                        >
                                                                            {option}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 4: BREAKDOWN DETAILS (BREAKDOWN TICKETS ONLY, ONLY IF ARRIVED) */}
                                    {activeJob.gpsCheckedIn && !activeJob.isService && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4 animate-in slide-in-from-bottom-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Details</h3>
                                            <div className="space-y-4 text-xs">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Details / Comments</label>
                                                    <textarea
                                                        required
                                                        rows={4}
                                                        disabled={activeJob.status === "Completed"}
                                                        value={activeJob.comments}
                                                        onChange={(e) => setActiveJob(prev => ({ ...prev, comments: e.target.value }))}
                                                        placeholder="What was the issue, and what did you do about it?"
                                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d] resize-none leading-relaxed font-semibold disabled:bg-slate-50 disabled:text-slate-600"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Status</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={activeJob.status === "Completed"}
                                                            onClick={() => setActiveJob(prev => ({ ...prev, resolved: true }))}
                                                            className={`h-11 rounded-xl text-xs font-black uppercase tracking-wide transition active:scale-95 disabled:active:scale-100 ${activeJob.resolved ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}
                                                        >
                                                            Resolved
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={activeJob.status === "Completed"}
                                                            onClick={() => setActiveJob(prev => ({ ...prev, resolved: false }))}
                                                            className={`h-11 rounded-xl text-xs font-black uppercase tracking-wide transition active:scale-95 disabled:active:scale-100 ${!activeJob.resolved ? "bg-red-600 text-white" : "bg-red-50 text-red-700"}`}
                                                        >
                                                            Not Resolved
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 5: WORK REPORT REMARKS (SERVICE VISITS ONLY) */}
                                    {activeJob.gpsCheckedIn && activeJob.isService && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Technical Work Report</h3>

                                            <div className="space-y-4 text-xs">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Problem Identified (optional)</label>
                                                    <textarea
                                                        rows={2}
                                                        value={activeJob.workReport.problem}
                                                        onChange={(e) => handleReportFieldChange("problem", e.target.value)}
                                                        placeholder="Describe issue (e.g. door slider roller track jammed)"
                                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d] resize-none leading-relaxed font-semibold"
                                                    />
                                                </div>

                                                {/* ── Voice Note Panel (Web Speech API — free, no API key needed) ── */}
                                                <div className="rounded-2xl border border-[#0a649d]/20 bg-[#f0f7fd] p-3.5 space-y-3">
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-lg bg-[#0a649d]/15 flex items-center justify-center shrink-0">
                                                                <svg className="h-3 w-3 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3z" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-[#0a649d] uppercase tracking-wider">Speak Work Note</p>
                                                        </div>
                                                        <p className="text-[8.5px] text-slate-400 font-medium">Voice used only for this note</p>
                                                    </div>

                                                    {/* Language selector */}
                                                    <div className="flex gap-1.5">
                                                        {[
                                                            { key: "auto", label: "Auto" },
                                                            { key: "telugu", label: "Telugu" },
                                                            { key: "hindi", label: "Hindi" },
                                                            { key: "english", label: "English" },
                                                        ].map(({ key, label }) => (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                disabled={isRecording || voiceProcessing}
                                                                onClick={() => setVoiceLanguage(key)}
                                                                className={`flex-1 h-7 rounded-xl text-[9px] font-black uppercase tracking-wide transition-colors ${
                                                                    voiceLanguage === key
                                                                        ? "bg-[#0a649d] text-white shadow-sm"
                                                                        : "bg-white text-slate-500 border border-slate-200"
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Idle: show mic button */}
                                                    {!isRecording && !voiceProcessing && !voiceTranscript && !voiceError && (
                                                        <div className="flex flex-col items-center gap-1.5 py-1">
                                                            <button
                                                                type="button"
                                                                onClick={startVoiceRecording}
                                                                className="h-14 w-14 rounded-full bg-[#0a649d] flex items-center justify-center shadow-md active:scale-95 transition-transform"
                                                            >
                                                                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3z" />
                                                                </svg>
                                                            </button>
                                                            <p className="text-[9px] text-slate-400">Tap to record · auto-fills Work Performed</p>
                                                        </div>
                                                    )}

                                                    {/* Recording: stop button + live interim text */}
                                                    {isRecording && (
                                                        <div className="space-y-2">
                                                            <div className="flex flex-col items-center gap-1.5 py-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={stopVoiceRecording}
                                                                    className="relative h-14 w-14 rounded-full bg-red-500 flex items-center justify-center shadow-md active:scale-95 transition-transform"
                                                                >
                                                                    <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-50" />
                                                                    <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                                        <rect x="6" y="6" width="12" height="12" rx="1.5" />
                                                                    </svg>
                                                                </button>
                                                                <p className="text-[9px] font-semibold text-red-500 animate-pulse">Listening… tap to stop</p>
                                                            </div>
                                                            {/* Real-time interim transcript */}
                                                            <div className="rounded-xl bg-white/80 border border-red-100 px-3 py-2 min-h-[34px]">
                                                                <p className="text-[11px] text-slate-500 italic leading-relaxed">
                                                                    {interimTranscript || "Speak now…"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Translating spinner */}
                                                    {voiceProcessing && !isRecording && (
                                                        <div className="flex items-center justify-center gap-2 py-2">
                                                            <div className="h-4 w-4 rounded-full border-2 border-[#0a649d] border-t-transparent animate-spin" />
                                                            <p className="text-[11px] font-semibold text-[#0a649d]">Translating to English…</p>
                                                        </div>
                                                    )}

                                                    {/* Error */}
                                                    {voiceError && !isRecording && (
                                                        <div className="rounded-xl bg-red-50 border border-red-200 p-2.5">
                                                            <p className="text-[10px] font-bold text-red-600">{voiceError}</p>
                                                            <p className="text-[9px] text-red-400 mt-0.5">Type the note in Work Performed below.</p>
                                                        </div>
                                                    )}

                                                    {/* Original transcript preview */}
                                                    {voiceTranscript && !isRecording && !voiceProcessing && (
                                                        <div className="rounded-xl bg-white border border-slate-200 p-2.5 space-y-1">
                                                            <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">
                                                                Original · {voiceLanguage === "auto" ? "auto-detected" : voiceLanguage}
                                                            </p>
                                                            <p className="text-[11px] text-slate-600 leading-relaxed">{voiceTranscript}</p>
                                                        </div>
                                                    )}

                                                    {/* Record again */}
                                                    {(voiceTranscript || voiceError) && !isRecording && !voiceProcessing && (
                                                        <button
                                                            type="button"
                                                            onClick={resetVoiceNote}
                                                            className="text-[9.5px] font-bold text-[#0a649d] underline underline-offset-2"
                                                        >
                                                            Record again
                                                        </button>
                                                    )}
                                                </div>
                                                {/* ─────────────────────────────────────────────────────────────── */}

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Work Performed (optional)</label>
                                                    <textarea
                                                        rows={2}
                                                        value={activeJob.workReport.workPerformed}
                                                        onChange={(e) => handleReportFieldChange("workPerformed", e.target.value)}
                                                        placeholder="Describe resolution (e.g. replaced worn roller assembly and reset limit switches)"
                                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d] resize-none leading-relaxed font-semibold"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Log Spare Parts Replaced</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleAddSparePartToReport("24V Relay")}
                                                            className="h-8.5 rounded-lg border border-slate-200 bg-slate-50 text-[10.5px] font-bold text-slate-700 active:bg-slate-100 cursor-pointer"
                                                        >
                                                            + Replaced 24V Relay
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleAddSparePartToReport("Door Roller")}
                                                            className="h-8.5 rounded-lg border border-slate-200 bg-slate-50 text-[10.5px] font-bold text-slate-700 active:bg-slate-100 cursor-pointer"
                                                        >
                                                            + Replaced Door Roller
                                                        </button>
                                                    </div>
                                                    <input 
                                                        type="text"
                                                        readOnly
                                                        value={activeJob.workReport.sparePartsUsed}
                                                        placeholder="Burnt relay, Guide rollers, etc."
                                                        className="w-full px-3.5 h-11 rounded-xl border border-slate-200 outline-none text-xs bg-slate-55 mt-2 font-bold text-slate-505"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Status Resolution</label>
                                                    <select
                                                        value={activeJob.workReport.status}
                                                        onChange={(e) => handleReportFieldChange("status", e.target.value)}
                                                        className="h-11 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                                    >
                                                        <option value="Completed">Completed & Fixed</option>
                                                        <option value="Need Spare Parts">Need Spare Parts Order</option>
                                                        <option value="Revisit Required">Revisit Required</option>
                                                        <option value="Escalated">Escalated to Supervisor</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 6: CUSTOMER DIGITAL SIGNATURE */}
                                    {activeJob.gpsCheckedIn && activeJob.status === "Completed" && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Customer Sign-Off</h3>
                                            <p className="text-xs font-semibold text-slate-600">
                                                Signed by <span className="font-black text-slate-800">{activeJob.signature?.customerName || sigCustomerName || "—"}</span>
                                            </p>
                                            {activeJob.signature?.image && (
                                                <img src={activeJob.signature.image} alt="Customer signature" className="h-24 rounded-xl border border-slate-100 bg-slate-50" />
                                            )}
                                        </div>
                                    )}

                                    {activeJob.gpsCheckedIn && activeJob.status !== "Completed" && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Customer Sign-Off</h3>

                                            <div className="space-y-4 text-xs">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Customer Representative Name</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Enter client rep's name"
                                                        value={sigCustomerName}
                                                        onChange={(e) => setSigCustomerName(e.target.value)}
                                                        className="h-11 w-full px-3.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d] font-semibold"
                                                    />
                                                </div>

                                                {/* Canvas Drawing Board */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center px-0.5">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Draw Signature</label>
                                                        <button
                                                            type="button"
                                                            onClick={clearSignaturePad}
                                                            className="text-[9.5px] font-black text-red-500 hover:underline bg-transparent border-0 cursor-pointer"
                                                        >
                                                            CLEAR PAD
                                                        </button>
                                                    </div>

                                                    <div className="h-32 w-full border border-slate-200 bg-slate-50/50 rounded-2xl overflow-hidden relative shadow-inner">
                                                        <canvas
                                                            ref={canvasRef}
                                                            height={128}
                                                            width={360}
                                                            onMouseDown={startDrawingSig}
                                                            onMouseMove={drawSig}
                                                            onMouseUp={stopDrawingSig}
                                                            onMouseLeave={stopDrawingSig}
                                                            onTouchStart={startDrawingSig}
                                                            onTouchMove={(e) => { e.preventDefault(); drawSig(e); }}
                                                            onTouchEnd={stopDrawingSig}
                                                            className="h-full w-full block touch-none cursor-crosshair"
                                                        />
                                                        {!signatureCaptured && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[10.5px] text-slate-350 font-bold uppercase tracking-wider select-none">
                                                                Sign inside this area
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Consent */}
                                                <label className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={sigConsentChecked}
                                                        onChange={() => setSigConsentChecked(!sigConsentChecked)}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d] mt-0.5 shrink-0"
                                                    />
                                                    <span className="text-[10px] text-slate-500 font-bold leading-normal">
                                                        I confirm that the service work has been completed to our satisfaction.
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 7: SUBMIT BUTTON */}
                                    {activeJob.gpsCheckedIn && activeJob.status !== "Completed" && (
                                        <button
                                            type="button"
                                            onClick={handleCompleteJob}
                                            disabled={submittingJob}
                                            className={`h-13 w-full text-white rounded-full text-xs font-black uppercase tracking-widest transition shadow-md ${
                                                submittingJob
                                                    ? "bg-emerald-400 cursor-not-allowed"
                                                    : "bg-emerald-600 active:scale-98 cursor-pointer"
                                            }`}
                                        >
                                            {submittingJob ? "Saving…" : "Complete & Close Job"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: PROJECTS TAB */}
                    {activeTab === "projects" && (
                        <TechnicianProjectsView
                            projects={myProjects}
                            loading={myProjectsLoading}
                            checklistProject={checklistProject}
                            onOpenProject={setChecklistProject}
                            onBack={() => setChecklistProject(null)}
                            onProjectUpdated={(updated) => {
                                setMyProjects((current) => current.map((p) => (p.id === updated.id ? updated : p)));
                                setChecklistProject(updated);
                            }}
                        />
                    )}

                    {/* VIEW: PROFILE TAB */}
                    {activeTab === "profile" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Technician Profile</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Manage credentials and verify designation.</p>
                            </div>

                            {/* Profile details */}
                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-center space-y-4">
                                <div className="h-16 w-16 bg-[#0a649d]/10 text-[#0a649d] border border-[#0a649d]/20 rounded-full flex items-center justify-center font-black text-xl mx-auto shadow-inner">
                                    {(user?.name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">{user?.name}</h2>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{user?.designation || "Technician"}</span>
                                </div>

                                <hr className="border-slate-100" />

                                <div className="text-left text-xs text-slate-650 space-y-2 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                                    <p><strong className="text-slate-800">Employee Code:</strong> @{user?.username}</p>
                                    <p><strong className="text-slate-800">Mobile No:</strong> {user?.phone || "Not on file"}</p>
                                    <p><strong className="text-slate-800">Designation:</strong> {user?.designation || "Not set"}</p>
                                </div>
                            </div>

                            <PushNotificationCard />

                            {/* Logout */}
                            <div className="pt-2">
                                <button
                                    onClick={handleLogout}
                                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                                >
                                    <LogoutIcon className="h-4.5 w-4.5" />
                                    LOG OUT SYSTEM
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                {/* MODAL: Store Material Pass (real QR image) */}
                {showJobPassModal && jobPassJob && (
                    <div className="amardip-modal-layer absolute inset-0 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 select-none">
                            <div className="px-5 py-4 bg-[#0a649d] text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-sm font-bold truncate">Store Material Pass</h2>
                                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">{jobPassJob.id}</p>
                                </div>
                                <button onClick={closeJobPassModal} className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 text-center space-y-6">
                                <div className="h-64 w-64 rounded-2xl border border-slate-200 bg-white flex items-center justify-center mx-auto shadow-inner p-3">
                                    {jobPassLoading ? (
                                        <span className="text-xs text-slate-400 font-bold">Generating pass...</span>
                                    ) : jobPassImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={jobPassImage} alt="Store pass QR" className="h-full w-full object-contain" />
                                    ) : (
                                        <span className="text-xs text-red-500 font-bold">Failed to generate pass.</span>
                                    )}
                                </div>

                                <div className="space-y-1.5 text-xs text-slate-650 leading-relaxed font-semibold">
                                    <p className="text-slate-800 font-extrabold">{jobPassJob.customerName}</p>
                                    <p className="text-[10px] text-slate-400">Show this to the storekeeper. Valid until this job is closed.</p>
                                </div>

                                <button
                                    onClick={closeJobPassModal}
                                    className="h-10.5 w-full border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom Navigation Tabs */}
                <nav className="amardip-bottom-nav absolute bottom-0 left-0 right-0 bg-[#0a1f35]/95 backdrop-blur-xl border-t border-white/8 text-white flex justify-around items-start z-50 px-1 pt-2 select-none">
                    <button
                        onClick={() => handleTabChange("dashboard")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "dashboard" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <DashboardIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Dashboard</span>
                    </button>

                    <button
                        onClick={() => handleTabChange("jobs")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "jobs" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <JobsIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Jobs</span>
                    </button>

                    <button
                        onClick={() => handleTabChange("projects")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "projects" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <ProjectsIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Projects</span>
                    </button>

                    <button
                        onClick={() => handleTabChange("profile")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "profile" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <ProfileIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Profile</span>
                    </button>
                </nav>

            </div>
        </div>
        </>
    );
}
