import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getUserFromRequest } from "@/lib/auth";
import Image from "next/image";
import { subscribeToPush } from "@/lib/pushClient";
import PushNotificationCard from "@/components/ui/PushNotificationCard";
import { clearAppBadgeCount } from "@/lib/appBadge";

const PRIMARY_COLOR = "#0a649d";

export async function getServerSideProps(context) {
    const user = await getUserFromRequest(context.req);

    if (!user) {
        return {
            redirect: {
                destination: "/Customerlogin",
                permanent: false,
            },
        };
    }

    if (user.role !== "customer") {
        return {
            redirect: {
                destination: "/Admindashboard",
                permanent: false,
            },
        };
    }

    return {
        props: {
            user,
        },
    };
}

// SVG Icons
function HomeIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
    );
}

function ComplaintIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    );
}

function DocumentIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );
}

function SupportIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    );
}

function ProfileIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );
}

function BellIcon({ className = "h-5 w-5" }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
    );
}

function CloseIcon({ className = "h-5 w-5" }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function PhoneIcon({ className = "h-4 w-4" }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.72.73.73 0 01-.02.43c-.45 1.29-.2 2.79.6 3.88.38.5.85 1.01 1.44 1.54M3 5a2 2 0 002 2h3.28a1 1 0 00.94-.72l.15-.45M17 19a2 2 0 012-2h3.28c.37 0 .7.21.82.56.45 1.29.2 2.79-.6 3.88-.38.5-.85 1.01-1.44 1.54M17 19a2 2 0 002 2h3.28a1 1 0 00.82-.56l.15-.45M3 10a11.95 11.95 0 009.58 9.58" />
        </svg>
    );
}

function SearchIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

export default function Customerdashboard({ user }) {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState("home"); // home, complaints, documents, support, profile
    const [complaintSubTab, setComplaintSubTab] = useState("logs"); // logs, raise

    useEffect(() => {
        subscribeToPush().catch(() => {});
        if (router.isReady) {
            if (router.query.tab) {
                setActiveTab(router.query.tab);
            }
            if (router.query.subtab) {
                setComplaintSubTab(router.query.subtab);
            }
        }
    }, [router.isReady, router.query]);

    // Notifications Center
    const [showNotificationCenter, setShowNotificationCenter] = useState(false);
    const [notifications, setNotifications] = useState([
        { id: 1, category: "Portal Ready", message: "Real complaint tracking is now connected to the service office.", time: "Today", read: true }
    ]);

    // Lifts
    const [lifts, setLifts] = useState([
        { id: "LIFT-9821", name: "Passenger Cabin 1", building: "Grand Plaza, Block A", amcStatus: "Active", lastChecked: "2026-06-15" },
        { id: "LIFT-7652", name: "Service Elevator 2", building: "Grand Plaza, Block B", amcStatus: "Active", lastChecked: "2026-05-20" }
    ]);

    // AMC Details
    const [amcData] = useState({
        number: "AMC-29810",
        status: "Active",
        startDate: "2025-09-20",
        endDate: "2026-09-20",
        servicesRemaining: 4,
        contractSigned: "Amardip Elevators AMC Standard"
    });

    // Complaints
    const [complaints, setComplaints] = useState([]);
    const [complaintError, setComplaintError] = useState("");

    // Active Complaint Tracking Modal state
    const [selectedTrackComplaint, setSelectedTrackComplaint] = useState(null);

    // Raise Complaint Form State
    const [formLift, setFormLift] = useState(lifts[0]?.id || "");
    const [formCategory, setFormCategory] = useState("Lift Not Working");
    const [formDescription, setFormDescription] = useState("");
    const [formEmergency, setFormEmergency] = useState(false);
    const [photos, setPhotos] = useState([]);
    const [videos, setVideos] = useState([]);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [newCompId, setNewCompId] = useState("");

    // Documents
    const [documents] = useState([
        { id: "DOC-209", name: "Annual AMC Agreement", type: "PDF", size: "1.8 MB", date: "2025-09-20", category: "AMC Agreement" },
        { id: "DOC-102", name: "Warranty Certificate - Cabin", type: "PDF", size: "950 KB", date: "2024-05-15", category: "Warranty" },
        { id: "DOC-340", name: "June 2026 Monthly Service Report", type: "PDF", size: "1.2 MB", date: "2026-06-15", category: "Service Reports" },
        { id: "DOC-328", name: "May 2026 Monthly Service Report", type: "PDF", size: "1.1 MB", date: "2026-05-20", category: "Service Reports" },
        { id: "DOC-054", name: "Lift Installation Blueprint Map", type: "PDF", size: "4.5 MB", date: "2024-05-01", category: "Installation" }
    ]);
    const [docSearch, setDocSearch] = useState("");
    const [viewingDoc, setViewingDoc] = useState(null);
    const [viewingAmc, setViewingAmc] = useState(false);

    // Profile Settings State
    const [customerProfile, setCustomerProfile] = useState({
        name: "Apex Business Park (Client)",
        mobile: "+91 99999 88888",
        email: "facility@apexpark.com",
        building: "Apex Business Complex",
        address: "Phase 3, Sector 15, Near Metro Junction, Bangalore"
    });
    const [passwordVal, setPasswordVal] = useState("customer123");
    const [profileMessage, setProfileMessage] = useState("");
    const [profileErr, setProfileErr] = useState("");

    // Support Form State
    const [supportMsg, setSupportMsg] = useState("");
    const [supportSent, setSupportSent] = useState(false);

    const [materialRequests, setMaterialRequests] = useState([]);

    function mapComplaintForCustomer(c) {
        return {
            id: c.complaintNo,
            dbId: c.id,
            liftId: c.customerCode || "LIFT",
            date: c.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            category: c.complaintType?.replaceAll("_", " ") || "SERVICE REQUEST",
            description: c.description,
            status: c.status?.replaceAll("_", " ") || "UNASSIGNED",
            emergency: c.priority === "EMERGENCY",
            assignedTech: c.assignedTechnicianName || "",
            techPhone: "",
            eta: "",
            timeline: [`Raised - ${c.createdAt ? formatGroupDate(c.createdAt.slice(0, 10)) : "Just now"}`],
        };
    }

    async function fetchCustomerComplaints() {
        setComplaintError("");
        try {
            const res = await fetch("/api/customer/complaints?page=1&pageSize=50");
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to load complaints");
            setComplaints((data.complaints || []).map(mapComplaintForCustomer));
        } catch (err) {
            setComplaintError(err.message || "Failed to load complaints");
        }
    }

    useEffect(() => {
        fetchCustomerComplaints();

        const storedReqs = localStorage.getItem("amardip_material_requests");
        if (storedReqs) {
            try {
                setMaterialRequests(JSON.parse(storedReqs));
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    // Dynamic KPI Counts
    const activeAMC = lifts.filter(l => l.amcStatus === "Active").length;
    const openComplaints = complaints.filter(c => !["RESOLVED", "CLOSED", "Resolved", "Closed"].includes(c.status)).length;
    const upcomingChecks = 1;

    // Remaining days calculation
    const getRemainingDays = () => {
        const end = new Date(amcData.endDate);
        const today = new Date();
        const diff = end - today;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const remainingDays = getRemainingDays();

    // Handlers
    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/Customerlogin");
        } catch (e) {
            router.push("/Customerlogin");
        }
    };

    const handlePasswordChange = (e) => {
        e.preventDefault();
        setProfileErr("");
        setProfileMessage("");
        if (!passwordVal.trim()) {
            setProfileErr("Password cannot be empty.");
            return;
        }
        setProfileMessage("Password updated successfully!");
    };

    const handlePhotoUpload = (e) => {
        if (e.target.files) {
            const filesArr = Array.from(e.target.files).map(file => URL.createObjectURL(file));
            setPhotos(prev => [...prev, ...filesArr]);
        }
    };

    const handleVideoUpload = (e) => {
        if (e.target.files) {
            const filesArr = Array.from(e.target.files).map(file => URL.createObjectURL(file));
            setVideos(prev => [...prev, ...filesArr]);
        }
    };

    const handleSubmitComplaint = async (e) => {
        e.preventDefault();
        if (!formDescription.trim()) return;

        const typeMap = {
            "Lift Not Working": "BREAKDOWN",
            "Door Issue": "DOOR_ISSUE",
            "Noise Problem": "NOISE",
            "Power Failure": "BREAKDOWN",
            "Emergency Alarm": "BREAKDOWN",
            "Other Issue": "OTHER",
        };

        const res = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                complaintType: typeMap[formCategory] || "OTHER",
                priority: formEmergency ? "EMERGENCY" : "NORMAL",
                description: formDescription,
                customerNotes: `Lift: ${formLift}`,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            setComplaintError(data.message || "Failed to submit complaint");
            return;
        }

        // Add Notification
        const newNotif = {
            id: notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
            category: "Complaint Registered",
            message: `New ticket ${data.complaint.complaintNo} logged. We are assigning a technician.`,
            time: "Just now",
            read: false
        };
        setNotifications(prev => [newNotif, ...prev]);

        setNewCompId(data.complaint.complaintNo);
        setSubmitSuccess(true);
        setFormDescription("");
        setPhotos([]);
        setVideos([]);
        setFormEmergency(false);
        await fetchCustomerComplaints();
    };

    const triggerEmergencyRequest = async () => {
        const res = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                complaintType: "BREAKDOWN",
                priority: "EMERGENCY",
                description: "CRITICAL: Urgent breakdown safety alarm triggered via Support Portal.",
                customerNotes: `Lift: ${lifts[0]?.id || "LIFT"}`,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            setComplaintError(data.message || "Failed to create emergency complaint");
            return;
        }

        // Push to notification center
        const newNotif = {
            id: notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
            category: "Emergency Alarm",
            message: `CRITICAL breakdown response registered as ${data.complaint.complaintNo}.`,
            time: "Just now",
            read: false
        };
        setNotifications(prev => [newNotif, ...prev]);

        alert(`EMERGENCY TICKET ${data.complaint.complaintNo} CREATED. Technician dispatching has been fast-tracked!`);
        await fetchCustomerComplaints();
        setActiveTab("complaints");
        setComplaintSubTab("logs");
    };

    const handleMarkAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        clearAppBadgeCount();
    };

    const handleClearNotifications = () => {
        setNotifications([]);
        clearAppBadgeCount();
    };

    const formatGroupDate = (dateStr) => {
        if (!dateStr) return "";
        try {
            const today = new Date().toISOString().split("T")[0];
            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            const yesterday = yesterdayObj.toISOString().split("T")[0];

            if (dateStr === today) return "Today";
            if (dateStr === yesterday) return "Yesterday";

            return new Date(dateStr).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-900 sm:py-6 flex items-center justify-center font-sans antialiased">
            {/* Phone Bezel Simulator */}
            <div className="w-full sm:max-w-md h-[100dvh] sm:h-[840px] sm:min-h-[840px] sm:max-h-[840px] bg-[#f8fafc] text-[#0f172a] relative flex flex-col sm:shadow-2xl sm:rounded-[40px] sm:border-[10px] sm:border-slate-800 overflow-hidden select-none">

                {/* Phone Notch */}
                <div className="bg-[#0a649d] px-6 pt-3.5 pb-2.5 flex justify-between items-center text-[11px] font-bold text-white select-none shrink-0 sm:flex hidden">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5">
                        <span>5G</span>
                        <div className="w-5 h-2.5 border border-white rounded-sm p-0.5 flex items-center">
                            <div className="h-full w-3 bg-white rounded-2xs"></div>
                        </div>
                    </div>
                </div>

                {/* App Bar Header */}
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
                            <span className="text-base font-extrabold tracking-tight leading-normal">Apex Business Complex</span>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            clearAppBadgeCount();
                            setShowNotificationCenter(!showNotificationCenter);
                        }}
                        className="relative h-10 w-10 bg-white/10 hover:bg-white/18 active:scale-95 transition flex items-center justify-center rounded-full"
                    >
                        <BellIcon className="h-5.5 w-5.5 text-white" />
                        {notifications.filter(n => !n.read).length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 rounded-full bg-red-500 border-2 border-[#0a649d] flex items-center justify-center text-[9px] font-black text-white">
                                {notifications.filter(n => !n.read).length}
                            </span>
                        )}
                    </button>
                </header>

                {/* Notifications Center Overlay */}
                {showNotificationCenter && (
                    <div className="absolute top-16 left-0 right-0 z-40 mx-4 mt-2 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-top-3 duration-250 select-none">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</span>
                            <div className="flex gap-2">
                                <button onClick={handleMarkAllRead} className="text-[#0a649d] hover:text-[#085282] text-[10px] font-bold">Mark all read</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={handleClearNotifications} className="text-slate-400 hover:text-slate-600 text-[10px] font-bold">Clear</button>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <p className="p-5 text-center text-xs text-slate-400">No new alerts.</p>
                            ) : (
                                notifications.map(n => (
                                    <div key={n.id} className={`p-4 hover:bg-slate-50 transition text-xs ${!n.read ? "bg-blue-50/50" : ""}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-extrabold text-[#0a649d]">{n.category}</span>
                                            <span className="text-[10px] text-slate-400">{n.time}</span>
                                        </div>
                                        <p className="text-slate-600 font-semibold leading-relaxed">{n.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-3 bg-slate-50 text-center border-t border-slate-100">
                            <button onClick={() => setShowNotificationCenter(false)} className="text-xs font-bold text-slate-500 hover:text-slate-700">Dismiss</button>
                        </div>
                    </div>
                )}

                {/* Main Tab Content */}
                <main className="amardip-app-main flex-1 overflow-y-auto bg-[#f1f5f9]">

                    {/* VIEW: HOME TAB */}
                    {activeTab === "home" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            {/* AMC Badge / Highlight Banner */}
                            <button
                                type="button"
                                onClick={() => setViewingAmc(true)}
                                className="w-full rounded-3xl p-5 text-left text-white shadow-md relative overflow-hidden active:scale-[0.99] transition"
                                style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #1e4b7a 65%, #0e2a4a 100%)` }}
                            >
                                <div className="absolute top-0 right-0 h-28 w-28 bg-white/5 rounded-full -mr-8 -mt-8"></div>
                                <div className="absolute bottom-0 left-0 h-20 w-20 bg-white/5 rounded-full -ml-8 -mb-8"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] bg-white/20 border border-white/20 text-white font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                            Active AMC Contract
                                        </span>
                                        <h2 className="text-xl font-black mt-3 leading-tight">{amcData.number}</h2>
                                        <p className="text-[10.5px] text-white/80 font-semibold mt-1">Valid till {amcData.endDate} ({remainingDays} Days Left)</p>
                                    </div>
                                    <div className="h-10.5 w-10.5 rounded-xl bg-white text-[#0a649d] border border-white/70 flex items-center justify-center font-black text-sm">
                                        AMC
                                    </div>
                                </div>
                                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-white/70">Tap to view contract maintenance</p>
                            </button>

                            {/* KPI Grid */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">At A Glance</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm flex flex-col justify-between h-26 select-none">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Installed Lifts</span>
                                        <p className="text-2xl font-black text-slate-900 mt-2">{lifts.length}</p>
                                    </div>
                                    <div onClick={() => { setActiveTab("complaints"); setComplaintSubTab("logs"); }} className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm hover:shadow active:scale-98 transition flex flex-col justify-between h-26 cursor-pointer select-none">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Open Support Tickets</span>
                                        <p className={`text-2xl font-black mt-2 ${openComplaints > 0 ? "text-red-600" : "text-slate-900"}`}>{openComplaints}</p>
                                    </div>
                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm flex flex-col justify-between h-26 select-none">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Contract AMC Status</span>
                                        <span className="h-fit w-fit text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 mt-2">Active</span>
                                    </div>
                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm flex flex-col justify-between h-26 select-none">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Upcoming Maintenance</span>
                                        <p className="text-2xl font-black text-slate-900 mt-2">{upcomingChecks}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions Grid */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Quick Actions</h3>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <button
                                        onClick={() => { setActiveTab("complaints"); setComplaintSubTab("raise"); }}
                                        className="rounded-2xl bg-[#0a649d] hover:bg-[#085282] text-white p-3 shadow flex flex-col items-center text-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                                    >
                                        <ComplaintIcon className="h-5 w-5 text-[#0a649d]" />
                                        <span className="text-[9.5px] font-bold tracking-tight">Raise Ticket</span>
                                    </button>
                                    <button
                                        onClick={() => { setActiveTab("complaints"); setComplaintSubTab("logs"); }}
                                        className="rounded-2xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col items-center text-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                                    >
                                        <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                        <span className="text-[9.5px] font-bold text-slate-700 tracking-tight">Track Complaint</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("documents")}
                                        className="rounded-2xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col items-center text-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                                    >
                                        <DocumentIcon className="h-5 w-5 text-[#0a649d]" />
                                        <span className="text-[9.5px] font-bold text-slate-700 tracking-tight">Documents</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("support")}
                                        className="rounded-2xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col items-center text-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                                    >
                                        <SupportIcon className="h-5 w-5 text-[#0a649d]" />
                                        <span className="text-[9.5px] font-bold text-slate-700 tracking-tight">Support</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("profile")}
                                        className="rounded-2xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col items-center text-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                                    >
                                        <ProfileIcon className="h-5 w-5 text-[#0a649d]" />
                                        <span className="text-[9.5px] font-bold text-slate-700 tracking-tight">Account</span>
                                    </button>
                                    <button
                                        onClick={triggerEmergencyRequest}
                                        className="rounded-2xl bg-red-500 hover:bg-red-600 text-white p-3 shadow flex flex-col items-center text-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                                        <span className="text-[9.5px] font-black uppercase tracking-tight">Emergency</span>
                                    </button>
                                </div>
                            </div>

                            {/* Recent Activities Section */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Recent Activity Feed</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="text-center w-14 shrink-0">
                                            <p className="text-xs font-extrabold text-[#0a649d] leading-none">Today</p>
                                            <p className="text-[8.5px] font-bold text-slate-400 mt-1 uppercase tracking-wide">10:30 AM</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-extrabold text-slate-800 truncate">Complaint Tracking</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">Submitted complaints appear here after DB sync.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="text-center w-14 shrink-0">
                                            <p className="text-xs font-extrabold text-slate-500 leading-none">June 15</p>
                                            <p className="text-[8.5px] font-bold text-slate-400 mt-1 uppercase tracking-wide">Completed</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-extrabold text-slate-800 truncate">Routine Maintenance Visit</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">Monthly safety checklist signed off for LIFT-9821</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW: COMPLAINTS TAB */}
                    {activeTab === "complaints" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Support Tickets</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Report breakdown alerts and track technician status.</p>
                            </div>

                            {/* Inner sub-tabs */}
                            <div className="flex gap-1.5 p-1 bg-slate-200/50 rounded-xl">
                                <button
                                    onClick={() => { setComplaintSubTab("logs"); setSubmitSuccess(false); }}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${complaintSubTab === "logs" ? "bg-[#0a649d] text-white shadow-sm" : "text-slate-500"}`}
                                >
                                    Log Book
                                </button>
                                <button
                                    onClick={() => setComplaintSubTab("raise")}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${complaintSubTab === "raise" ? "bg-[#0a649d] text-white shadow-sm" : "text-slate-500"}`}
                                >
                                    File Complaint
                                </button>
                            </div>

                            {/* Sub-view: COMPLAINT LOGS */}
                            {complaintSubTab === "logs" && (
                                <div className="space-y-4">
                                    {complaintError && (
                                        <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{complaintError}</p>
                                    )}
                                    {complaints.length === 0 ? (
                                        <p className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-xs font-bold text-slate-400">No complaints submitted yet.</p>
                                    ) : complaints.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => setSelectedTrackComplaint(c)}
                                            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-slate-50 transition active:scale-[0.99]"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-900">{c.id}</span>
                                                        {c.emergency && (
                                                            <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded-sm bg-red-100 border border-red-200 text-red-700 animate-pulse uppercase">
                                                                Emergency
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{c.category} • {c.liftId}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-3 py-1 rounded-xl border ${c.status === "Completed" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                    c.status === "In Progress" ? "bg-blue-50 border-blue-100 text-blue-700" :
                                                        "bg-amber-50 border-amber-100 text-amber-700"
                                                    }`}>
                                                    {c.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 leading-normal line-clamp-2 pl-0.5">{c.description}</p>
                                            <div className="border-t border-slate-100/60 pt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold pl-0.5">
                                                <span>Log: {formatGroupDate(c.date)}</span>
                                                <span className="text-[#0a649d] font-bold">Tap to Track Status &rarr;</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Sub-view: RAISE COMPLAINT FORM */}
                            {complaintSubTab === "raise" && (
                                <div className="space-y-4">
                                    {submitSuccess ? (
                                        <div className="rounded-3xl bg-white border border-slate-200 p-6 text-center space-y-4 shadow-sm animate-in zoom-in-95 duration-250">
                                            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                                                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-base font-extrabold text-slate-800">Complaint Logged Successfully</h3>
                                                <p className="text-xs text-slate-400">Your Ticket Reference ID is <span className="font-extrabold text-slate-700">{newCompId}</span></p>
                                            </div>
                                            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                                                Our technician scheduler has been alerted. We will dispatch the nearest engineer and notify you once assigned.
                                            </p>
                                            <button
                                                onClick={() => { setComplaintSubTab("logs"); setSubmitSuccess(false); }}
                                                className="h-11 w-full bg-[#0a649d] hover:bg-[#085282] text-white rounded-xl font-bold text-xs tracking-wider transition active:scale-95"
                                            >
                                                VIEW LOG BOOK
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmitComplaint} className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">Select Lift Unit</label>
                                                <select
                                                    value={formLift}
                                                    onChange={(e) => setFormLift(e.target.value)}
                                                    className="h-11 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                                >
                                                    {lifts.map(l => (
                                                        <option key={l.id} value={l.id}>{l.id} - {l.name} ({l.building})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">Complaint Category</label>
                                                <select
                                                    value={formCategory}
                                                    onChange={(e) => setFormCategory(e.target.value)}
                                                    className="h-11 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                                >
                                                    <option>Lift Not Working</option>
                                                    <option>Door Issue</option>
                                                    <option>Noise Problem</option>
                                                    <option>Power Failure</option>
                                                    <option>Emergency Alarm</option>
                                                    <option>Other Issue</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">Problem Description</label>
                                                <textarea
                                                    required
                                                    rows={4}
                                                    placeholder="Detail the issue. (e.g. cabin stops before floor level, doors closing with high force, clicking sounds when descending)"
                                                    value={formDescription}
                                                    onChange={(e) => setFormDescription(e.target.value)}
                                                    className="w-full p-3.5 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition placeholder:text-slate-300 resize-none font-medium leading-relaxed"
                                                />
                                            </div>

                                            {/* Media Attachments */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">Upload Photo</label>
                                                    <label className="h-14 rounded-xl border border-dashed border-slate-300 hover:border-[#0a649d] flex items-center justify-center text-xs text-slate-400 font-bold bg-slate-50 cursor-pointer transition">
                                                        <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                                                        <span>+ Add Photo</span>
                                                    </label>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">Upload Video</label>
                                                    <label className="h-14 rounded-xl border border-dashed border-slate-300 hover:border-[#0a649d] flex items-center justify-center text-xs text-slate-400 font-bold bg-slate-50 cursor-pointer transition">
                                                        <input type="file" accept="video/*" multiple onChange={handleVideoUpload} className="hidden" />
                                                        <span>+ Add Video</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Media Previews */}
                                            {(photos.length > 0 || videos.length > 0) && (
                                                <div className="flex gap-2 flex-wrap pt-2">
                                                    {photos.map((src, i) => (
                                                        <div key={i} className="relative h-10 w-10 rounded-lg overflow-hidden border border-slate-200">
                                                            <img src={src} className="h-full w-full object-cover" />
                                                            <button type="button" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full h-4 w-4 flex items-center justify-center text-white text-[8px]">&times;</button>
                                                        </div>
                                                    ))}
                                                    {videos.map((src, i) => (
                                                        <div key={i} className="relative h-10 w-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
                                                            <span className="text-[8px] text-white font-bold font-mono">VID</span>
                                                            <button type="button" onClick={() => setVideos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full h-4 w-4 flex items-center justify-center text-white text-[8px]">&times;</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Emergency breakdown Toggle */}
                                            <div className="flex items-center justify-between p-3.5 bg-red-50/50 border border-red-100 rounded-2xl">
                                                <div>
                                                    <span className="block text-xs font-black text-red-800">Emergency Breakdown?</span>
                                                    <span className="text-[10px] text-slate-500 font-semibold leading-none">Fast-track crew dispatch immediately.</span>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={formEmergency}
                                                        onChange={() => setFormEmergency(!formEmergency)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                                                </label>
                                            </div>

                                            <button
                                                type="submit"
                                                className="h-12 w-full bg-[#0a649d] hover:bg-[#085282] text-white rounded-full font-bold shadow-md transition active:scale-98"
                                            >
                                                SUBMIT SUPPORT TICKET
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: DOCUMENTS TAB */}
                    {activeTab === "documents" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Documents</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Access warranty papers, invoices, and checklist reports.</p>
                            </div>

                            {/* Search bar */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search documents..."
                                    value={docSearch}
                                    onChange={(e) => setDocSearch(e.target.value)}
                                    className="h-11 w-full pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                    <SearchIcon className="h-4.5 w-4.5" />
                                </div>
                            </div>

                            {/* List */}
                            <div className="space-y-2.5">
                                {documents
                                    .filter(d => d.name.toLowerCase().includes(docSearch.toLowerCase()) || d.category.toLowerCase().includes(docSearch.toLowerCase()))
                                    .map(d => (
                                        <div
                                            key={d.id}
                                            onClick={() => setViewingDoc(d)}
                                            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition cursor-pointer flex justify-between items-center"
                                        >
                                            <div className="min-w-0 flex gap-3.5 items-center">
                                                <div className="h-10 w-10 bg-blue-50 text-[#0a649d] rounded-xl flex items-center justify-center shrink-0">
                                                    <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-extrabold text-slate-800 truncate leading-snug">{d.name}</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">{d.category} • {d.size}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-[#0a649d] font-bold shrink-0 pl-2">View &rarr;</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* VIEW: SUPPORT TAB */}
                    {activeTab === "support" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Support Desk</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Reach customer assistance, log breakdown alerts, or chat.</p>
                            </div>

                            {/* Support CTA Cards */}
                            <div className="space-y-2.5">
                                <a
                                    href="tel:+919999999999"
                                    className="rounded-3xl bg-white border border-slate-200 p-4.5 shadow-sm hover:shadow transition flex justify-between items-center"
                                >
                                    <div className="flex gap-4 items-center">
                                        <div className="h-10 w-10 bg-blue-50 text-[#0a649d] rounded-2xl flex items-center justify-center shrink-0">
                                            <PhoneIcon className="h-5.5 w-5.5" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-800">Phone Support Helpline</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Office Timings: 9:00 AM - 6:00 PM</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-[#0a649d] font-black uppercase tracking-wider pl-2">Call Now</span>
                                </a>

                                <a
                                    href="https://wa.me/919999999999"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-3xl bg-white border border-slate-200 p-4.5 shadow-sm hover:shadow transition flex justify-between items-center"
                                >
                                    <div className="flex gap-4 items-center">
                                        <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                            <svg viewBox="0 0 32 32" fill="currentColor" className="h-5.5 w-5.5"><path d="M16.04 3C9.46 3 4.1 8.26 4.1 14.74c0 2.08.56 4.12 1.62 5.9L4 29l8.56-1.68a12.1 12.1 0 0 0 3.48.51c6.58 0 11.94-5.26 11.94-11.74S22.62 3 16.04 3Zm0 22.77c-1.14 0-2.26-.18-3.32-.55l-.48-.16-5.08 1 1.02-4.9-.25-.5a9.71 9.71 0 0 1-1.36-4.92c0-5.34 4.25-9.68 9.47-9.68 5.22 0 9.47 4.34 9.47 9.68s-4.25 10.03-9.47 10.03Zm5.47-7.25c-.3-.15-1.78-.87-2.06-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.46-2.42-1.48-.9-.78-1.5-1.75-1.68-2.05-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.68-1.62-.93-2.22-.25-.58-.5-.5-.68-.51h-.58c-.2 0-.52.07-.8.37-.28.3-1.05 1.02-1.05 2.48s1.08 2.88 1.23 3.08c.15.2 2.13 3.23 5.16 4.52.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.72 2.03-1.42.25-.7.25-1.3.18-1.42-.08-.12-.28-.2-.58-.35Z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-800">WhatsApp Support </h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Fast text response assistance</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider pl-2">Open Chat</span>
                                </a>

                            </div>

                            {/* Message Desk */}
                            {supportSent ? (
                                <div className="rounded-3xl bg-white border border-slate-200 p-5 text-center shadow-sm space-y-3 animate-in zoom-in-95 duration-200">
                                    <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <h4 className="text-sm font-extrabold text-slate-800">Message Dispatched</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">We have received your enquiry. A staff member will revert back shortly.</p>
                                    <button onClick={() => setSupportSent(false)} className="text-xs font-bold text-[#0a649d] hover:underline pt-1 block mx-auto">Send another query</button>
                                </div>
                            ) : (
                                <form onSubmit={(e) => { e.preventDefault(); if (supportMsg.trim()) setSupportSent(true); setSupportMsg(""); }} className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1">Leave A Message</h3>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">Message Description</label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={supportMsg}
                                            onChange={(e) => setSupportMsg(e.target.value)}
                                            placeholder="Write your AMC enquiry, upgrade request, or checklist feedback here..."
                                            className="w-full p-3 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition resize-none font-medium leading-relaxed"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="h-11 w-full bg-[#0a649d] text-white rounded-xl font-bold text-xs tracking-wider transition hover:bg-[#085282]"
                                    >
                                        SEND MESSAGE
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {/* VIEW: PROFILE TAB */}
                    {activeTab === "profile" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Client Account</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Manage credentials and facility information.</p>
                            </div>

                            {/* Profile details */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-2xl bg-sky-50 text-[#0a649d] border border-slate-100 flex items-center justify-center font-extrabold text-sm uppercase">
                                        AP
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-800 leading-tight">{customerProfile.name}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Facility Contract Account</p>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-4 space-y-3.5 text-xs">
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Mobile Number</span>
                                        <span className="font-extrabold text-slate-700">{customerProfile.mobile}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Contact</span>
                                        <span className="font-extrabold text-slate-700">{customerProfile.email}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Site Location</span>
                                        <span className="font-extrabold text-slate-700">{customerProfile.building}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Billing Address</span>
                                        <span className="font-semibold text-slate-500 leading-relaxed block mt-0.5">{customerProfile.address}</span>
                                    </div>
                                </div>
                            </div>

                            <PushNotificationCard />

                            {/* Password change */}
                            <form onSubmit={handlePasswordChange} className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1">Security & Password</h3>

                                {profileErr && <p className="text-[11px] font-bold text-red-600 pl-1">{profileErr}</p>}
                                {profileMessage && <p className="text-[11px] font-bold text-emerald-600 pl-1">{profileMessage}</p>}

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 pl-1">Password</label>
                                    <input
                                        type="text"
                                        required
                                        value={passwordVal}
                                        onChange={(e) => setPasswordVal(e.target.value)}
                                        className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition font-medium"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="h-11 w-full bg-[#0a649d] text-white rounded-xl font-bold text-xs tracking-wider transition hover:bg-[#085282]"
                                >
                                    UPDATE PASSWORD
                                </button>
                            </form>

                            {/* Logout */}
                            <div className="pt-2">
                                <button
                                    onClick={handleLogout}
                                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                                >
                                    <LogoutIcon className="h-4.5 w-4.5" />
                                    <span>LOG OUT SYSTEM</span>
                                </button>
                            </div>
                        </div>
                    )}

                </main>

                {/* MODAL: TRACK SUPPORT COMPLAINT TIMELINE */}
                {selectedTrackComplaint && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-5 py-4.5 bg-[#0a649d] text-white flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-bold">Track Ticket Progress</h2>
                                    <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">{selectedTrackComplaint.id}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedTrackComplaint(null)}
                                    className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                                >
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lift Unit & Site</span>
                                    <p className="text-xs font-extrabold text-slate-800">{selectedTrackComplaint.liftId} • Grand Plaza Complex</p>
                                </div>

                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</span>
                                    <p className="text-xs font-bold text-slate-700">{selectedTrackComplaint.category}</p>
                                </div>

                                <hr className="border-slate-100" />

                                {/* Progress timeline */}
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Ticket Status History</span>
                                    <div className="space-y-3.5 pl-1.5">
                                        {selectedTrackComplaint.timeline.map((step, idx) => (
                                            <div key={idx} className="flex gap-3 relative">
                                                {idx < selectedTrackComplaint.timeline.length - 1 && (
                                                    <div className="absolute left-[5.5px] top-[14px] bottom-[-16px] w-[2px] bg-emerald-500"></div>
                                                )}
                                                <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm mt-1 shrink-0 z-10"></div>
                                                <span className="text-xs text-slate-700 font-semibold">{step}</span>
                                            </div>
                                        ))}
                                        {selectedTrackComplaint.status !== "Completed" && (
                                            <div className="flex gap-3">
                                                <div className="h-3 w-3 rounded-full bg-slate-300 border-2 border-white shadow-sm mt-1 shrink-0 z-10 animate-pulse"></div>
                                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                                    {selectedTrackComplaint.status === "In Progress" ? "Repair Work In Progress..." : "Assigning Technician..."}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedTrackComplaint.assignedTech && (
                                    <>
                                        <hr className="border-slate-100" />
                                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-extrabold text-[#0a649d] text-sm">
                                                    {selectedTrackComplaint.assignedTech.slice(0, 2)}
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Assigned Engineer</span>
                                                    <span className="text-xs font-extrabold text-slate-800 leading-normal block mt-0.5">{selectedTrackComplaint.assignedTech}</span>
                                                    {selectedTrackComplaint.eta && <span className="text-[10px] text-emerald-600 font-bold">ETA: {selectedTrackComplaint.eta}</span>}
                                                </div>
                                            </div>
                                            <a
                                                href={`tel:${selectedTrackComplaint.techPhone}`}
                                                className="h-8.5 w-8.5 rounded-full bg-[#0a649d] text-white flex items-center justify-center hover:bg-[#085282] transition active:scale-95 shadow-sm"
                                            >
                                                <PhoneIcon className="h-4.5 w-4.5" />
                                            </a>
                                        </div>
                                    </>
                                )}

                                {/* Admin Pre-allocated Spare Parts */}
                                {selectedTrackComplaint.allocatedParts && selectedTrackComplaint.allocatedParts.length > 0 && (
                                    <>
                                        <hr className="border-slate-100" />
                                        <div>
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pre-allocated Spares (Admin)</span>
                                            <div className="space-y-2">
                                                {selectedTrackComplaint.allocatedParts.map((p, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                                                        <span className="font-extrabold text-slate-800">{p.partName}</span>
                                                        <span className="font-black text-slate-500">Qty: {p.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-1">
                                                {selectedTrackComplaint.allocatedPartsIssued ? (
                                                    <span className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase">
                                                        ✅ Issued to Technician
                                                    </span>
                                                ) : (
                                                    <span className="text-[9.5px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase">
                                                        ⏳ Awaiting Depot Pickup
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Technician Raised Spare Parts */}
                                {materialRequests.filter(r => r.jobNumber === selectedTrackComplaint.id).length > 0 && (
                                    <>
                                        <hr className="border-slate-100" />
                                        <div>
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">On-Site Spares Requested (Tech)</span>
                                            <div className="space-y-2">
                                                {materialRequests
                                                    .filter(r => r.jobNumber === selectedTrackComplaint.id)
                                                    .map((r, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                                                            <div>
                                                                <span className="font-extrabold text-slate-800">{r.partName}</span>
                                                                <span className="block text-[9.5px] text-slate-400 font-semibold mt-0.5">Qty: {r.quantity}</span>
                                                            </div>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                                                r.status === "Issued" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                                (r.status === "Approved" ? "bg-sky-50 text-[#0a649d] border border-sky-100" :
                                                                 (r.status === "Rejected" ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"))
                                                            }`}>
                                                                {r.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Active Job Checklist Progress */}
                                {selectedTrackComplaint.checklist && (
                                    <>
                                        <hr className="border-slate-100" />
                                        <div>
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Inspection Checklist Progress</span>
                                            <p className="text-xs font-bold text-slate-800">
                                                {Object.values(selectedTrackComplaint.checklist).filter(Boolean).length}/8 Checkpoints Completed
                                            </p>
                                        </div>
                                    </>
                                )}

                                {/* Resolution Details */}
                                {selectedTrackComplaint.status === "Completed" && selectedTrackComplaint.workReport && (
                                    <>
                                        <hr className="border-slate-100" />
                                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3.5 space-y-2.5 text-xs text-emerald-900 leading-normal">
                                            <span className="block text-[9.5px] font-bold text-emerald-800 uppercase tracking-wider leading-none">Job Completion Report</span>
                                            
                                            <div>
                                                <span className="block text-[9px] font-semibold text-slate-400 uppercase">Problem Identified</span>
                                                <p className="font-extrabold text-slate-800">{selectedTrackComplaint.workReport.problem || "N/A"}</p>
                                            </div>
                                            
                                            <div>
                                                <span className="block text-[9px] font-semibold text-slate-400 uppercase">Action Taken</span>
                                                <p className="font-extrabold text-slate-800">{selectedTrackComplaint.workReport.workPerformed || "N/A"}</p>
                                            </div>

                                            {selectedTrackComplaint.workReport.sparePartsUsed && (
                                                <div>
                                                    <span className="block text-[9px] font-semibold text-slate-400 uppercase">Spare Parts Replaced</span>
                                                    <p className="font-extrabold text-slate-800">{selectedTrackComplaint.workReport.sparePartsUsed}</p>
                                                </div>
                                            )}

                                            {selectedTrackComplaint.signature && (
                                                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-700 font-extrabold">
                                                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span>Verified & Signed by customer</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                <button
                                    onClick={() => setSelectedTrackComplaint(null)}
                                    className="h-10 w-full border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                                >
                                    Dismiss Tracking
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL: VIEW DOCUMENT PREVIEW */}
                {viewingDoc && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-5 py-4 bg-[#0a649d] text-white flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-bold truncate max-w-[200px]">{viewingDoc.name}</h2>
                                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">{viewingDoc.id} • {viewingDoc.type}</p>
                                </div>
                                <button
                                    onClick={() => setViewingDoc(null)}
                                    className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                                >
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="relative h-11 w-11 rounded-2xl bg-white">
                                            <Image src="/adlogo.png" alt="Amardip Lifts" fill className="object-contain" sizes="44px" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[#0a649d]">Amardip Lifts</p>
                                            <p className="text-[9px] font-bold text-slate-400">{viewingDoc.category}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <h3 className="text-sm font-black text-slate-900">{viewingDoc.name}</h3>
                                        <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                                            This branded template preview represents the document available to the customer portal.
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
                                            <p className="rounded-xl bg-slate-50 p-2">Customer<br /><span className="text-slate-900">{customerProfile.name}</span></p>
                                            <p className="rounded-xl bg-slate-50 p-2">Document ID<br /><span className="text-slate-900">{viewingDoc.id}</span></p>
                                            <p className="rounded-xl bg-slate-50 p-2">AMC No<br /><span className="text-slate-900">{amcData.number}</span></p>
                                            <p className="rounded-xl bg-slate-50 p-2">Date<br /><span className="text-slate-900">{viewingDoc.date}</span></p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3.5 text-xs">
                                    <div className="flex justify-between pl-1">
                                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">File Size</span>
                                        <span className="font-extrabold text-slate-700">{viewingDoc.size}</span>
                                    </div>
                                    <div className="flex justify-between pl-1">
                                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Category Group</span>
                                        <span className="font-extrabold text-slate-700">{viewingDoc.category}</span>
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setViewingDoc(null)}
                                        className="h-10.5 flex-1 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            alert(`"${viewingDoc.name}" download started! Check notifications.`);
                                            setViewingDoc(null);
                                        }}
                                        className="h-10.5 flex-1 bg-[#0a649d] text-white rounded-xl text-xs font-bold hover:bg-[#085282] transition"
                                    >
                                        Download File
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewingAmc && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                            <div className="bg-[#0a649d] px-5 py-4 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-11 w-11 overflow-hidden rounded-2xl bg-white">
                                            <Image src="/adlogo.png" alt="Amardip Lifts" fill className="object-contain p-1" sizes="44px" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Contract Maintenance</p>
                                            <h2 className="text-base font-black">AMC Summary</h2>
                                        </div>
                                    </div>
                                    <button onClick={() => setViewingAmc(false)} className="h-8 w-8 rounded-full bg-white/10">
                                        <CloseIcon className="mx-auto h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Active Contract</p>
                                    <p className="mt-1 text-xl font-black text-slate-900">{amcData.number}</p>
                                    <p className="mt-1 text-xs font-bold text-slate-500">{amcData.startDate} to {amcData.endDate}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                                    <p className="rounded-2xl bg-slate-50 p-3">Status<br /><span className="text-emerald-700">{amcData.status}</span></p>
                                    <p className="rounded-2xl bg-slate-50 p-3">Remaining<br /><span className="text-[#0a649d]">{remainingDays} days</span></p>
                                    <p className="rounded-2xl bg-slate-50 p-3">Lifts Covered<br /><span className="text-slate-900">{lifts.length}</span></p>
                                    <p className="rounded-2xl bg-slate-50 p-3">Next Check<br /><span className="text-slate-900">{upcomingChecks}</span></p>
                                </div>
                                <button onClick={() => { setViewingAmc(false); setActiveTab("documents"); }} className="h-11 w-full rounded-2xl bg-[#0a649d] text-xs font-black text-white">
                                    View Agreement Documents
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom Navigation Menu */}
                <nav className="amardip-bottom-nav absolute bottom-0 left-0 right-0 bg-[#0a1f35]/95 backdrop-blur-xl border-t border-white/8 text-white flex justify-around items-start z-50 px-1 pt-2 select-none">
                    <button
                        onClick={() => setActiveTab("home")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "home" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <HomeIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Home</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab("complaints"); setComplaintSubTab("raise"); }}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "complaints" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <ComplaintIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Tickets</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("documents")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "documents" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <DocumentIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Documents</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("support")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "support" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <SupportIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Support</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "profile" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <ProfileIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Profile</span>
                    </button>
                </nav>

            </div>
        </div>
    );
}
