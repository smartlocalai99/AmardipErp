import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { getUserFromRequest } from "@/lib/auth";
import { getCustomerRecordsForUser, getCustomerServiceVisitsForUser } from "@/lib/customerAccounts";
import Image from "next/image";
import { subscribeToPush } from "@/lib/pushClient";
import { acknowledgeTicketNotification, clearAppBadgeCount } from "@/lib/appBadge";
import CustomerDocumentsPanel from "@/components/customer/CustomerDocumentsPanel";

const AMARDIP_SUPPORT_PHONE = "+918562359223";

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

    const [customerRecords, serviceVisits] = await Promise.all([
        getCustomerRecordsForUser(user.id),
        getCustomerServiceVisitsForUser(user.id, 20),
    ]);
    const requestedTab = Array.isArray(context.query.tab) ? context.query.tab[0] : context.query.tab;
    const normalizedTab = requestedTab === "support" ? "profile" : requestedTab;
    const initialTab = ["home", "complaints", "documents", "service", "profile"].includes(normalizedTab)
        ? normalizedTab
        : "home";
    const requestedSubTab = Array.isArray(context.query.subtab) ? context.query.subtab[0] : context.query.subtab;
    const initialComplaintSubTab = ["logs", "raise"].includes(requestedSubTab) ? requestedSubTab : "logs";

    return {
        props: {
            user,
            customerRecords,
            serviceVisits,
            initialTab,
            initialComplaintSubTab,
            contractEvaluationDate: new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).format(new Date()),
        },
    };
}

function parsePortalDate(value) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue || cleanValue === "Not available") return null;

    const isoMatch = cleanValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    const indianMatch = cleanValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    let year;
    let month;
    let day;

    if (isoMatch) {
        [, year, month, day] = isoMatch.map(Number);
    } else if (indianMatch) {
        [, day, month, year] = indianMatch.map(Number);
        if (year < 100) year += 2000;
    } else {
        return null;
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) {
        return null;
    }

    return parsed;
}

function formatPortalDate(value) {
    return formatPortalDateObj(parsePortalDate(value));
}

function formatPortalDateObj(date) {
    if (!date) return "Not recorded";

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

// Warranty runs exactly one year from HOC — used instead of the stored
// amc_warranty_due field so the customer's own dashboard can't drift from
// the same live rule the rest of the app uses.
function addOneYearUTC(date) {
    if (!date) return null;
    const year = date.getUTCFullYear() + 1;
    const month = date.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(date.getUTCDate(), lastDay);
    return new Date(Date.UTC(year, month, day));
}

// A "battery level" style indicator: N segments, filled left-to-right in
// proportion to how much of the contract's total span is still remaining.
function ContractProgressBar({ fraction, active }) {
    const segmentCount = 24;
    const filled = Math.round(Math.min(1, Math.max(0, fraction)) * segmentCount);

    return (
        <div className="flex items-center gap-0.75" role="img" aria-label={`${Math.round(fraction * 100)}% of contract period remaining`}>
            {Array.from({ length: segmentCount }, (_, index) => (
                <span
                    key={index}
                    className={`h-3.5 w-1 rounded-full ${
                        index < filled
                            ? (active ? "bg-emerald-500" : "bg-red-300")
                            : (active ? "bg-emerald-900/10" : "bg-white/25")
                    }`}
                />
            ))}
        </div>
    );
}

function formatGroupDate(dateStr) {
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
    } catch {
        return dateStr;
    }
}

function formatNotificationTime(isoString) {
    if (!isoString) return "";
    const then = new Date(isoString).getTime();
    if (Number.isNaN(then)) return "";
    const diffMinutes = Math.round((Date.now() - then) / 60000);
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function mapComplaintForCustomer(complaint) {
    return {
        id: complaint.complaintNo,
        dbId: complaint.id,
        liftId: complaint.customerCode || "LIFT",
        date: complaint.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        category: complaint.complaintType?.replaceAll("_", " ") || "SERVICE REQUEST",
        description: complaint.description,
        status: complaint.status?.replaceAll("_", " ") || "UNASSIGNED",
        emergency: complaint.priority === "EMERGENCY",
        assignedTech: complaint.assignedTechnicianName || "",
        techPhone: "",
        eta: "",
        timeline: [`Raised - ${complaint.createdAt ? formatGroupDate(complaint.createdAt.slice(0, 10)) : "Just now"}`],
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

function ServiceIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17 20.75a2.12 2.12 0 0 0 3-3l-5.58-5.58M14.5 6.5l3-3m-1.5 0 1.5 1.5M4.5 20.5l6.75-6.75M9 5.25A4.25 4.25 0 0 0 3.5 10.7l3.05-3.05 2.8 2.8-3.05 3.05A4.25 4.25 0 0 0 11.75 8" />
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

function LogoutIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    );
}

export default function Customerdashboard({
    user,
    customerRecords = [],
    serviceVisits = [],
    initialTab = "home",
    initialComplaintSubTab = "logs",
    contractEvaluationDate,
}) {
    const router = useRouter();

    const primaryCustomer = customerRecords[0] || null;
    const initialLifts = customerRecords.map((record) => ({
        customerId: record.id,
        id: record.customer_code || `LIFT-${record.record_no || "NA"}`,
        name: record.elevator_type || record.no_of_passenger || "Elevator",
        building: record.location || record.customer_name || "Customer site",
        amcStatus: record.customer_status || "Not available",
        lastChecked: String(record.hoc_date || "").slice(0, 10) || "Not available",
    }));

    const [activeTab, setActiveTab] = useState(initialTab); // home, complaints, documents, service, profile
    const [complaintSubTab, setComplaintSubTab] = useState(initialComplaintSubTab); // logs, raise

    useEffect(() => {
        subscribeToPush().catch(() => {});
    }, []);

    // Notifications Center
    const [showNotificationCenter, setShowNotificationCenter] = useState(false);
    const [notifications, setNotifications] = useState([
        { id: 1, category: "Portal Ready", message: "Real complaint tracking is now connected to the service office.", time: "Today", read: true }
    ]);

    // Lifts
    const [lifts] = useState(initialLifts);

    // AMC Details
    const [amcData] = useState({
        number: primaryCustomer?.customer_code || `AMC-${primaryCustomer?.record_no || "NA"}`,
        status: primaryCustomer?.customer_status || "Not available",
        startDate: String(primaryCustomer?.amc_starting_date || "").slice(0, 10) || "Not available",
        endDate: String(primaryCustomer?.amc_ending_date || primaryCustomer?.amc_warranty_due || "").slice(0, 10) || "Not available",
        servicesRemaining: 0,
        contractSigned: "Amardip Elevators Service Contract"
    });

    // Complaints
    const [complaints, setComplaints] = useState([]);
    const [complaintError, setComplaintError] = useState("");

    // Active Complaint Tracking Modal state
    const [selectedTrackComplaint, setSelectedTrackComplaint] = useState(null);

    // Raise Complaint Form State
    const [formLift, setFormLift] = useState(lifts[0]?.customerId || "");
    const [formCategory, setFormCategory] = useState("Lift Not Working");
    const [formDescription, setFormDescription] = useState("");
    const [formEmergency, setFormEmergency] = useState(false);
    const [photos, setPhotos] = useState([]);
    const [videos, setVideos] = useState([]);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [newCompId, setNewCompId] = useState("");

    const [viewingAmc, setViewingAmc] = useState(false);

    // Profile Settings State
    const [customerProfile] = useState({
        name: primaryCustomer?.customer_name || user.name || "Customer",
        mobile: primaryCustomer?.mobile_no || user.username || "Not available",
        email: "Not available",
        building: primaryCustomer?.location || primaryCustomer?.customer_name || "Not available",
        address: [primaryCustomer?.address, primaryCustomer?.city].filter(Boolean).join(", ") || "Not available"
    });

    const [materialRequests, setMaterialRequests] = useState([]);

    const fetchCustomerComplaints = useCallback(async () => {
        try {
            const res = await fetch("/api/customer/complaints?page=1&pageSize=50");
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to load complaints");
            setComplaintError("");
            setComplaints((data.complaints || []).map(mapComplaintForCustomer));
        } catch (err) {
            setComplaintError(err.message || "Failed to load complaints");
        }
    }, []);

    // AMC renewal reminders (and anything else sent from the admin side) land
    // here — persisted server-side so they're waiting in the bell icon the
    // next time the customer opens the app, not just a push banner they
    // might have missed.
    const fetchCustomerNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/customer/notifications");
            const data = await res.json();
            if (!res.ok || !data.success) return;
            if ((data.notifications || []).length === 0) return;
            setNotifications(data.notifications.map((n) => ({
                id: n.id,
                category: n.category,
                message: n.message,
                time: formatNotificationTime(n.createdAt),
                read: n.read,
                type: n.data?.type || null,
            })));
        } catch {
            // Keep the local placeholder list if the fetch fails.
        }
    }, []);

    useEffect(() => {
        const initialLoad = window.setTimeout(() => {
            fetchCustomerComplaints();
            fetchCustomerNotifications();

            const storedReqs = localStorage.getItem("amardip_material_requests");
            if (storedReqs) {
                try {
                    setMaterialRequests(JSON.parse(storedReqs));
                } catch (e) {
                    console.error(e);
                }
            }
        }, 0);

        return () => window.clearTimeout(initialLoad);
    }, [fetchCustomerComplaints, fetchCustomerNotifications]);

    const contractStatus = String(amcData.status || "").trim().toUpperCase();
    // "1M"/"2M" are short informal AMC arrangements — AMC in substance, same
    // as the admin dashboard's warranty/AMC bucketing.
    const CONTRACT_LABELS = { AMC: "AMC", "1M": "AMC", "2M": "AMC", EMC: "EMC", WARRANTY: "Warranty" };
    const contractLabel = CONTRACT_LABELS[contractStatus] || "Expired";
    const isWarrantyStatus = contractStatus === "WARRANTY";

    const hocDate = parsePortalDate(primaryCustomer?.hoc_date);
    // Warranty's end date is always computed live (HOC + 1 year), not the
    // possibly-stale stored field; AMC/EMC keep the business-set contract
    // dates since those aren't derivable from HOC.
    const contractStartDate = isWarrantyStatus ? hocDate : parsePortalDate(amcData.startDate);
    const contractEndDate = isWarrantyStatus ? addOneYearUTC(hocDate) : parsePortalDate(amcData.endDate);

    const isEligibleContractStatus = Boolean(CONTRACT_LABELS[contractStatus]);
    const contractEndTime = contractEndDate ? contractEndDate.getTime() + (24 * 60 * 60 * 1000) - 1 : null;
    const contractEvaluationTime = parsePortalDate(contractEvaluationDate)?.getTime() || 0;
    const amcIsActive = isEligibleContractStatus && (contractEndTime === null || contractEndTime >= contractEvaluationTime);

    const remainingDays = amcIsActive && contractEndTime !== null
        ? Math.max(0, Math.ceil((contractEndTime - contractEvaluationTime) / (1000 * 60 * 60 * 24)))
        : 0;

    const contractStartTime = contractStartDate ? contractStartDate.getTime() : null;
    const contractTotalDays = (contractStartTime !== null && contractEndTime !== null)
        ? Math.max(1, Math.round((contractEndTime - contractStartTime) / (1000 * 60 * 60 * 24)))
        : 365;
    const contractProgressFraction = amcIsActive ? Math.min(1, Math.max(0, remainingDays / contractTotalDays)) : 0;

    const latestServiceVisit = serviceVisits[0] || null;
    const latestVisitByCustomer = new Map();
    serviceVisits.forEach((visit) => {
        if (visit.customer_id && !latestVisitByCustomer.has(visit.customer_id)) {
            latestVisitByCustomer.set(visit.customer_id, visit);
        }
    });
    const liftServiceSummaries = lifts.map((lift) => ({
        ...lift,
        latestVisit: latestVisitByCustomer.get(lift.customerId) || null,
    }));

    // Dynamic KPI Counts
    const openComplaints = complaints.filter(c => !["RESOLVED", "CLOSED", "Resolved", "Closed"].includes(c.status)).length;

    // Handlers
    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/Customerlogin");
        } catch (e) {
            router.push("/Customerlogin");
        }
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

        const selectedLift = lifts.find((lift) => lift.customerId === formLift);
        const res = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                complaintType: typeMap[formCategory] || "OTHER",
                priority: formEmergency ? "EMERGENCY" : "NORMAL",
                description: formDescription,
                customerId: selectedLift?.customerId,
                customerNotes: `Lift: ${selectedLift?.id || "LIFT"}`,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            setComplaintError(data.message || "Failed to submit complaint");
            return;
        }

        // Add Notification
        const newNotif = {
            id: `local-${Date.now()}`, // server-fetched notifications use UUID ids, so this can't rely on numeric max+1
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
                customerId: lifts[0]?.customerId,
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
            id: `local-${Date.now()}`, // server-fetched notifications use UUID ids, so this can't rely on numeric max+1
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
        fetch("/api/customer/notifications", { method: "PATCH" }).catch(() => {});
    };

    const handleClearNotifications = () => {
        setNotifications([]);
        clearAppBadgeCount();
        fetch("/api/customer/notifications", { method: "DELETE" }).catch(() => {});
    };

    const openComplaintDetails = (complaint) => {
        acknowledgeTicketNotification(complaint?.id);
        setSelectedTrackComplaint(complaint);
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
                        <div className="min-w-0">
                            <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest leading-none block">
                                {primaryCustomer?.customer_code ? `Customer ID ${primaryCustomer.customer_code}` : "Customer Portal"}
                            </span>
                            <span
                                className="block max-w-[220px] truncate text-base font-extrabold leading-normal tracking-tight"
                                title={customerProfile.name}
                            >
                                {customerProfile.name}
                            </span>
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
                                        {String(n.type || "").startsWith("AMC_") && (
                                            <a
                                                href={`tel:${AMARDIP_SUPPORT_PHONE}`}
                                                className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold text-white active:scale-95 transition"
                                                style={{ background: "linear-gradient(135deg, #073354, #0a649d)" }}
                                            >
                                                <PhoneIcon className="h-3.5 w-3.5" />
                                                Call Amardip
                                            </a>
                                        )}
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
                                className={`w-full rounded-3xl border p-5 text-left shadow-md relative overflow-hidden active:scale-[0.99] transition ${amcIsActive
                                    ? "border-emerald-200 bg-gradient-to-br from-emerald-50 via-green-100 to-emerald-200 text-emerald-950"
                                    : "border-red-500 bg-gradient-to-br from-red-600 via-red-700 to-rose-900 text-white"
                                    }`}
                            >
                                <div className={`absolute top-0 right-0 h-28 w-28 rounded-full -mr-8 -mt-8 ${amcIsActive ? "bg-emerald-900/5" : "bg-white/5"}`}></div>
                                <div className={`absolute bottom-0 left-0 h-20 w-20 rounded-full -ml-8 -mb-8 ${amcIsActive ? "bg-emerald-900/5" : "bg-white/5"}`}></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`text-[10px] border font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${amcIsActive
                                            ? "border-emerald-300 bg-white/65 text-emerald-800"
                                            : "border-white/25 bg-white/15 text-white"
                                            }`}>
                                            {amcIsActive ? `Active ${contractLabel}` : `${contractLabel === "Expired" ? "Expired" : `${contractLabel} Expired`}`}
                                        </span>
                                        <h2 className="text-xl font-black mt-3 leading-tight">{amcData.number}</h2>
                                        <p className={`text-[10.5px] font-semibold mt-1 ${amcIsActive ? "text-emerald-800" : "text-white/85"}`}>
                                            {amcIsActive
                                                ? `${contractEndDate ? `Valid until ${formatPortalDateObj(contractEndDate)} (${remainingDays} days left)` : "Valid contract"}`
                                                : `${contractEndDate ? `Expired on ${formatPortalDateObj(contractEndDate)}` : "No active contract on file"}`}
                                        </p>
                                    </div>
                                    <div className={`h-10.5 w-10.5 shrink-0 rounded-xl bg-white border flex items-center justify-center font-black text-[11px] text-center leading-none ${amcIsActive ? "border-emerald-200 text-emerald-700" : "border-white/70 text-red-700"}`}>
                                        {contractLabel}
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <ContractProgressBar fraction={contractProgressFraction} active={amcIsActive} />
                                </div>
                                <p className={`mt-3 text-[10px] font-black uppercase tracking-widest ${amcIsActive ? "text-emerald-700/80" : "text-white/70"}`}>Tap to view contract maintenance</p>
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
                                    <div className={`rounded-3xl border p-4 shadow-sm flex flex-col justify-between h-26 select-none ${amcIsActive ? "border-emerald-200 bg-emerald-50" : "border-red-500 bg-red-600"}`}>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${amcIsActive ? "text-emerald-700" : "text-white/80"}`}>Contract Status</span>
                                        <span className={`h-fit w-fit text-[9px] font-black px-2 py-0.5 rounded mt-2 ${amcIsActive ? "bg-emerald-200 text-emerald-900" : "bg-white/20 text-white"}`}>
                                            {amcIsActive ? `${contractLabel} Active` : "Expired"}
                                        </span>
                                    </div>
                                    <button type="button" onClick={() => setActiveTab("service")} className="rounded-3xl bg-white border border-slate-200/60 p-4 text-left shadow-sm flex flex-col justify-between h-26 select-none active:scale-[0.98] transition">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Last Service</span>
                                        <p className="text-[13px] font-black text-slate-900 mt-2">{latestServiceVisit ? formatPortalDate(latestServiceVisit.service_date) : "Not recorded"}</p>
                                    </button>
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
                                        <ComplaintIcon className="h-5 w-5 text-white" />
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
                                        onClick={() => setActiveTab("profile")}
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
                                        className="rounded-2xl bg-amber-400 hover:bg-amber-500 text-amber-950 p-3 shadow flex flex-col items-center text-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-950 animate-ping"></span>
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
                                    {latestServiceVisit && (
                                        <button type="button" onClick={() => setActiveTab("service")} className="flex w-full gap-4 text-left">
                                            <div className="w-20 shrink-0 text-left">
                                                <p className="text-[10px] font-extrabold text-[#0a649d] leading-tight">{formatPortalDate(latestServiceVisit.service_date)}</p>
                                                <p className="text-[8.5px] font-bold text-emerald-600 mt-1 uppercase tracking-wide">Completed</p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-extrabold text-slate-800 truncate">{String(latestServiceVisit.service_type || "Routine service").replaceAll("_", " ")}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Serviced {latestServiceVisit.customer_code || "your elevator"}</p>
                                            </div>
                                        </button>
                                    )}
                                    {complaints[0] && (
                                        <button type="button" onClick={() => { setActiveTab("complaints"); setComplaintSubTab("logs"); }} className="flex w-full gap-4 text-left">
                                            <div className="w-20 shrink-0 text-left">
                                                <p className="text-[10px] font-extrabold text-slate-500 leading-tight">{formatPortalDate(complaints[0].date)}</p>
                                                <p className="text-[8.5px] font-bold text-slate-400 mt-1 uppercase tracking-wide">Ticket</p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-extrabold text-slate-800 truncate">{complaints[0].category}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{complaints[0].id} • {complaints[0].status}</p>
                                            </div>
                                        </button>
                                    )}
                                    {!latestServiceVisit && !complaints[0] && (
                                        <p className="text-xs font-semibold text-slate-400">No service or ticket activity recorded yet.</p>
                                    )}
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
                                            onClick={() => openComplaintDetails(c)}
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
                                                        <option key={l.customerId} value={l.customerId}>{l.id} - {l.name} ({l.building})</option>
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
                                                            <Image src={src} alt="Uploaded complaint evidence" fill unoptimized sizes="40px" className="object-cover" />
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
                        <CustomerDocumentsPanel customerRecords={customerRecords} />
                    )}

                    {/* VIEW: SERVICE TAB */}
                    {activeTab === "service" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Service</h1>
                                <p className="text-xs text-slate-500 mt-0.5">See when each lift was last serviced and review completed visits.</p>
                            </div>

                            {latestServiceVisit ? (
                                <>
                                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#073354] via-[#0a649d] to-[#1687bd] p-5 text-white shadow-md">
                                        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
                                        <div className="relative flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Last serviced</p>
                                                <p className="mt-2 text-2xl font-black">{formatPortalDate(latestServiceVisit.service_date)}</p>
                                                <p className="mt-1 text-xs font-bold text-white/80">
                                                    {latestServiceVisit.customer_code || "Elevator"} • {String(latestServiceVisit.service_type || "Routine service").replaceAll("_", " ")}
                                                </p>
                                            </div>
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                                                <ServiceIcon className="h-6 w-6" />
                                            </div>
                                        </div>
                                    </div>

                                    <section>
                                        <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Your lifts</h2>
                                        <div className="space-y-2.5">
                                            {liftServiceSummaries.map((lift) => (
                                                <div key={lift.customerId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-slate-900">{lift.id}</p>
                                                            <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{lift.building}</p>
                                                        </div>
                                                        <div className={`shrink-0 rounded-xl px-3 py-2 text-right ${lift.latestVisit ? "bg-emerald-50" : "bg-slate-100"}`}>
                                                            <p className={`text-[8px] font-black uppercase tracking-wider ${lift.latestVisit ? "text-emerald-600" : "text-slate-400"}`}>Last service</p>
                                                            <p className={`mt-0.5 text-[11px] font-black ${lift.latestVisit ? "text-emerald-900" : "text-slate-500"}`}>
                                                                {lift.latestVisit ? formatPortalDate(lift.latestVisit.service_date) : "Not recorded"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Recent service history</h2>
                                        <div className="space-y-2.5">
                                            {serviceVisits.map((visit) => {
                                                const technicians = [visit.technician_1, visit.technician_2].filter(Boolean).join(" & ");
                                                return (
                                                    <article key={visit.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-[#0a649d]">
                                                                <ServiceIcon className="h-5 w-5" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-black text-slate-900">{visit.customer_code || "Elevator service"}</p>
                                                                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                                            {String(visit.service_type || "Routine service").replaceAll("_", " ")}
                                                                        </p>
                                                                    </div>
                                                                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-800">Completed</span>
                                                                </div>
                                                                <p className="mt-3 text-xs font-black text-[#0a649d]">{formatPortalDate(visit.service_date)}</p>
                                                                {technicians && <p className="mt-1 text-[10px] font-semibold text-slate-500">Technician: {technicians}</p>}
                                                                {visit.remarks && <p className="mt-2 text-[10px] font-medium leading-relaxed text-slate-500">{visit.remarks}</p>}
                                                            </div>
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </>
                            ) : (
                                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-[#0a649d]">
                                        <ServiceIcon className="h-7 w-7" />
                                    </div>
                                    <h2 className="mt-4 text-sm font-black text-slate-900">No service visit recorded yet</h2>
                                    <p className="mx-auto mt-2 max-w-xs text-xs font-medium leading-relaxed text-slate-500">
                                        Completed lift service visits will appear here automatically after the service team records them.
                                    </p>
                                    {liftServiceSummaries.length > 0 && (
                                        <div className="mt-5 space-y-2 text-left">
                                            {liftServiceSummaries.map((lift) => (
                                                <div key={lift.customerId} className="rounded-2xl bg-slate-50 px-4 py-3">
                                                    <p className="text-xs font-black text-slate-800">{lift.id}</p>
                                                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Last service: Not recorded</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: PROFILE TAB */}
                    {activeTab === "profile" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Client Account</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Manage credentials, facility information, and support.</p>
                            </div>

                            {/* Profile details */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-2xl bg-sky-50 text-[#0a649d] border border-slate-100 flex items-center justify-center font-extrabold text-sm uppercase">
                                        {customerProfile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
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

                            {/* Support moved into Profile */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-3 px-1">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-[#0a649d]">
                                        <SupportIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-slate-900">Support Desk</h2>
                                        <p className="text-[10px] font-semibold text-slate-500">Call or WhatsApp our support team.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    <a
                                        href={`tel:${AMARDIP_SUPPORT_PHONE}`}
                                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.98]"
                                    >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-50 text-[#0a649d]">
                                            <PhoneIcon className="h-5 w-5" />
                                        </div>
                                        <p className="mt-3 text-xs font-black text-slate-800">Call Support</p>
                                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">9 AM – 6 PM</p>
                                    </a>
                                    <a
                                        href="https://wa.me/919999999999"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.98]"
                                    >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                                            <svg viewBox="0 0 32 32" fill="currentColor" className="h-5 w-5"><path d="M16.04 3C9.46 3 4.1 8.26 4.1 14.74c0 2.08.56 4.12 1.62 5.9L4 29l8.56-1.68a12.1 12.1 0 0 0 3.48.51c6.58 0 11.94-5.26 11.94-11.74S22.62 3 16.04 3Zm0 22.77c-1.14 0-2.26-.18-3.32-.55l-.48-.16-5.08 1 1.02-4.9-.25-.5a9.71 9.71 0 0 1-1.36-4.92c0-5.34 4.25-9.68 9.47-9.68 5.22 0 9.47 4.34 9.47 9.68s-4.25 10.03-9.47 10.03Zm5.47-7.25c-.3-.15-1.78-.87-2.06-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.46-2.42-1.48-.9-.78-1.5-1.75-1.68-2.05-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.68-1.62-.93-2.22-.25-.58-.5-.5-.68-.51h-.58c-.2 0-.52.07-.8.37-.28.3-1.05 1.02-1.05 2.48s1.08 2.88 1.23 3.08c.15.2 2.13 3.23 5.16 4.52.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.72 2.03-1.42.25-.7.25-1.3.18-1.42-.08-.12-.28-.2-.58-.35Z" /></svg>
                                        </div>
                                        <p className="mt-3 text-xs font-black text-slate-800">WhatsApp</p>
                                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-emerald-600">Open chat</p>
                                    </a>
                                </div>

                            </section>

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
                                            <h2 className="text-base font-black">{contractLabel} Summary</h2>
                                        </div>
                                    </div>
                                    <button onClick={() => setViewingAmc(false)} className="h-8 w-8 rounded-full bg-white/10">
                                        <CloseIcon className="mx-auto h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className={`rounded-2xl border p-4 ${amcIsActive ? "border-emerald-200 bg-emerald-50" : "border-red-500 bg-red-600 text-white"}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${amcIsActive ? "text-emerald-700" : "text-white/80"}`}>
                                        {amcIsActive ? `Active ${contractLabel}` : `${contractLabel} Expired`}
                                    </p>
                                    <p className={`mt-1 text-xl font-black ${amcIsActive ? "text-slate-900" : "text-white"}`}>{amcData.number}</p>
                                    <p className={`mt-1 text-xs font-bold ${amcIsActive ? "text-slate-500" : "text-white/80"}`}>
                                        {formatPortalDateObj(contractStartDate)} to {formatPortalDateObj(contractEndDate)}
                                    </p>
                                    <div className="mt-3">
                                        <ContractProgressBar fraction={contractProgressFraction} active={amcIsActive} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                                    <p className={`rounded-2xl p-3 ${amcIsActive ? "bg-emerald-50 text-slate-700" : "bg-red-50 text-slate-700"}`}>Status<br /><span className={amcIsActive ? "text-emerald-700" : "text-red-700"}>{amcIsActive ? contractLabel : "Expired"}</span></p>
                                    <p className="rounded-2xl bg-slate-50 p-3">Remaining<br /><span className={amcIsActive ? "text-[#0a649d]" : "text-red-700"}>{amcIsActive ? `${remainingDays} days` : "Expired"}</span></p>
                                    <p className="rounded-2xl bg-slate-50 p-3">Lifts Covered<br /><span className="text-slate-900">{lifts.length}</span></p>
                                    <p className="rounded-2xl bg-slate-50 p-3">Last Service<br /><span className="text-slate-900">{latestServiceVisit ? formatPortalDate(latestServiceVisit.service_date) : "Not recorded"}</span></p>
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
                        onClick={() => setActiveTab("service")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "service" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <ServiceIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Service</span>
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
