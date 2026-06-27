import { getUserFromRequest } from "@/lib/auth";
import DashboardKpiGrid from "@/components/admin/dashboard/DashboardKpiGrid";
import { AdminAppDataProvider, useAdminAppData } from "@/components/admin/AdminAppDataProvider";
import AdminCustomersTable from "@/components/admin/customers/AdminCustomersTable";
import AdminAmcTable from "@/components/admin/amc/AdminAmcTable";
import ServiceVisitsTable from "@/components/admin/service/ServiceVisitsTable";
import { clearSessionCache } from "@/lib/adminCache";
import { MetricSkeletonGrid } from "@/components/ui/SkeletonLoaders";
import ModuleComingSoon from "@/components/ui/ModuleComingSoon";
import {
    buildAdminKpiCounts,
    buildStaffFromUsers,
    buildTechniciansFromUsers,
    buildUpcomingActivities,
    buildUpcomingVisits,
    formatUserRole,
} from "@/lib/adminDashboardData";
import { browserSupportsPasskeys, startPasskeyRegistration } from "@/lib/passkeyClient";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";

export async function getServerSideProps(context) {
    const user = await getUserFromRequest(context.req);

    if (!user) {
        return {
            redirect: {
                destination: "/Adminlogin",
                permanent: false,
            },
        };
    }

    if (user.role === "customer") {
        return {
            redirect: {
                destination: "/Customerdashboard",
                permanent: false,
            },
        };
    }

    if (user.role === "worker") {
        return {
            redirect: {
                destination: "/Techniciandashboard",
                permanent: false,
            },
        };
    }

    if (user.role === "storekeeper") {
        return {
            redirect: {
                destination: "/Storedashboard",
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

export default function Admindashboard({ user }) {
    return (
        <AdminAppDataProvider user={user}>
            <AdmindashboardShell user={user} />
        </AdminAppDataProvider>
    );
}

// SVGs for modern Material Design look
function OverviewIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
    );
}


function CustomersIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    );
}

function ServiceIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function TechniciansIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <circle cx="12" cy="7" r="4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 21a8.5 8.5 0 0 1 13 0M16 11l2 2 4-4" />
        </svg>
    );
}

function MoreIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
        </svg>
    );
}

function BellIcon({ className = "h-6 w-6" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
    );
}

function ChevronRightIcon({ className = "h-4 w-4" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    );
}

function PhoneIcon({ className = "h-4 w-4" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function KeyIcon({ className = "h-4 w-4" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
    );
}

function CloseIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function OnboardingIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
    );
}

function AlertIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    );
}

function LogoutIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    );
}

function PlusIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
    );
}

function AmcStatStrip({ stats, loading }) {
    const cards = [
        {
            label: "This Month",
            value: stats?.dueThisMonth ?? "—",
            sub: "AMC due this month",
            color: "bg-amber-50 border-amber-100 text-amber-700",
            dot: "bg-amber-400",
        },
        {
            label: "Next 30 Days",
            value: stats?.dueIn30 ?? "—",
            sub: "Expiring soon",
            color: "bg-sky-50 border-sky-100 text-sky-700",
            dot: "bg-sky-400",
        },
        {
            label: "Expired",
            value: stats?.expired ?? "—",
            sub: "Past due date",
            color: "bg-red-50 border-red-100 text-red-700",
            dot: "bg-red-400",
        },
        {
            label: "Active AMC",
            value: stats?.statusAmc ?? "—",
            sub: "Status = AMC",
            color: "bg-emerald-50 border-emerald-100 text-emerald-700",
            dot: "bg-emerald-400",
        },
    ];
    return (
        <div className="grid grid-cols-2 gap-2">
            {cards.map((c) => (
                <div key={c.label} className={`rounded-2xl border p-3.5 ${c.color}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
                        <span className="text-[9px] font-black uppercase tracking-wider opacity-70">{c.label}</span>
                    </div>
                    <p className="text-2xl font-black leading-none">
                        {loading ? <span className="block h-7 w-10 animate-pulse rounded-lg bg-current opacity-15" /> : c.value}
                    </p>
                    <p className="text-[9px] font-semibold mt-1 opacity-60">{c.sub}</p>
                </div>
            ))}
        </div>
    );
}

function formatGroupDate(dateStr) {
    if (!dateStr || dateStr === "Unknown Date") return "No Scheduled Date";
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];

        const date = new Date(dateStr);
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        const formatted = date.toLocaleDateString('en-US', options);

        if (dateStr === todayStr) return `Today — ${formatted}`;
        if (dateStr === yesterdayStr) return `Yesterday — ${formatted}`;
        if (dateStr === tomorrowStr) return `Tomorrow — ${formatted}`;
        return formatted;
    } catch (e) {
        return dateStr;
    }
}

function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
}

function formatDeviceDate(value) {
    if (!value) return "Not used yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

const COMPLAINT_TYPE_OPTIONS = [
    ["BREAKDOWN", "Breakdown"],
    ["DOOR_ISSUE", "Door Issue"],
    ["MOTOR_ISSUE", "Motor Issue"],
    ["NOISE", "Noise"],
    ["SERVICE_REQUEST", "Service Request"],
    ["AMC_QUERY", "AMC Query"],
    ["PAYMENT_QUERY", "Payment Query"],
    ["OTHER", "Other"],
];

const COMPLAINT_PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "EMERGENCY"];
const COMPLAINT_STATUS_OPTIONS = ["UNASSIGNED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];

function complaintStatusClass(status) {
    if (status === "UNASSIGNED") return "bg-amber-50 border-amber-100 text-amber-700";
    if (status === "ASSIGNED") return "bg-blue-50 border-blue-100 text-blue-700";
    if (status === "IN_PROGRESS") return "bg-purple-50 border-purple-100 text-purple-700";
    if (status === "RESOLVED") return "bg-emerald-50 border-emerald-100 text-emerald-700";
    if (status === "CANCELLED") return "bg-red-50 border-red-100 text-red-700";
    return "bg-slate-50 border-slate-100 text-slate-700";
}

function formatComplaintDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}


function AdmindashboardShell({ user }) {
    const router = useRouter();
    const adminAppData = useAdminAppData();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("dashboard"); // bottom tabs: dashboard, customers, service, technicians, more

    // Modals
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showNotificationCenter, setShowNotificationCenter] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [showAddComplaintModal, setShowAddComplaintModal] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [materialRequests, setMaterialRequests] = useState([]);
    const [modalTech, setModalTech] = useState("");
    const [modalStatus, setModalStatus] = useState("");
    const [assignmentNotes, setAssignmentNotes] = useState("");
    const [complaintsLoading, setComplaintsLoading] = useState(false);
    const [complaintError, setComplaintError] = useState("");
    const [complaintStats, setComplaintStats] = useState(null);
    const [quotationStats, setQuotationStats] = useState(null);
    const [hasBoqPermission, setHasBoqPermission] = useState(false);
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [complaintTypeFilter, setComplaintTypeFilter] = useState("all");
    const [newComplaintData, setNewComplaintData] = useState({
        customerName: "",
        mobileNo: "",
        city: "",
        address: "",
        complaintType: "BREAKDOWN",
        priority: "NORMAL",
        description: "",
        officeNotes: "",
    });

    // Parts allocation states
    const [allocatedParts, setAllocatedParts] = useState([]);
    const [tempPartName, setTempPartName] = useState("Door Roller Assembly");
    const [tempPartQty, setTempPartQty] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedComplaint) {
                setAllocatedParts(selectedComplaint.allocatedParts || []);
            } else {
                setAllocatedParts([]);
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [selectedComplaint]);

    const handleAddPart = () => {
        if (tempPartQty <= 0) return;
        setAllocatedParts(prev => {
            const exists = prev.find(p => p.partName === tempPartName);
            if (exists) {
                return prev.map(p => p.partName === tempPartName ? { ...p, quantity: p.quantity + tempPartQty } : p);
            }
            return [...prev, { partName: tempPartName, quantity: tempPartQty }];
        });
        setTempPartQty(1);
    };

    const handleRemovePart = (partName) => {
        setAllocatedParts(prev => prev.filter(p => p.partName !== partName));
    };

    // Filter and search states
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [moreSubTab, setMoreSubTab] = useState(null);

    // Interactive directories
    const [inquiries, setInquiries] = useState([]);

    const [schedules, setSchedules] = useState([]);
    const [schedulesLoading, setSchedulesLoading] = useState(false);
    const [scheduleCustomers, setScheduleCustomers] = useState([]);
    const [amcStats, setAmcStats] = useState(null);
    const [amcStatsLoading, setAmcStatsLoading] = useState(false);

    // Form inputs for new Schedule
    const [newSchedule, setNewSchedule] = useState({
        customerId: "",
        customerName: "",
        scheduledDate: "",
        technician: "",
        technicianId: "",
        notes: "",
    });

    // Database user directory states
    const [usersList, setUsersList] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [onboardBusy, setOnboardBusy] = useState(false);
    const [onboardSuccess, setOnboardSuccess] = useState("");
    const [onboardError, setOnboardError] = useState("");

    // Reset password states
    const [selectedResetUser, setSelectedResetUser] = useState(null);
    const [resetPasswordValue, setResetPasswordValue] = useState("");
    const [resetBusy, setResetBusy] = useState(false);
    const [resetSuccess, setResetSuccess] = useState("");
    const [resetError, setResetError] = useState("");
    const [passkeyDeviceName, setPasskeyDeviceName] = useState("");
    const [passkeyBusy, setPasskeyBusy] = useState(false);
    const [passkeyMessage, setPasskeyMessage] = useState("");
    const [passkeyError, setPasskeyError] = useState("");
    const [faceLockDevices, setFaceLockDevices] = useState([]);
    const [faceLockDevicesLoading, setFaceLockDevicesLoading] = useState(false);
    const [faceLockRemovingId, setFaceLockRemovingId] = useState(null);

    // Onboarding form states
    const [newUserData, setNewUserData] = useState({
        username: "",
        password: "",
        name: "",
        role: "worker",
        phone: "",
    });

    const [kpiCounts, setKpiCounts] = useState({
        totalCustomers: 0,
        activeAMC: 0,
        todayService: 0,
        openComplaints: 0,
        pendingInstallations: 0,
        upcomingMaintenance: 0,
        availTechnicians: 0,
        totalTechnicians: 0
    });

    const fallbackCustomerStats = {
        totalCustomers: 0,
        activeAmc: 0,
        activeEmc: 0,
        warrantyCount: 0,
        outOfWarrantyCount: 0,
        missingMobileCount: 0,
    };
    const fallbackServiceStats = {
        totalServiceVisits: 0,
        linkedServiceVisits: 0,
        unlinkedServiceVisits: 0,
        scheduledUpcomingServices: 0,
        toBeScheduledServices: 0,
        upcomingServicesTotal: 0,
    };
    const customerStats = adminAppData.customerStats || fallbackCustomerStats;
    const serviceStats = adminAppData.serviceStats || fallbackServiceStats;
    const dashboardStatsLoading = adminAppData.loading && !adminAppData.customerStats && !adminAppData.serviceStats;
    const moduleAvailability = adminAppData.moduleAvailability || {};
    const moduleIsLive = (key) => moduleAvailability?.[key]?.enabled !== false;
    const waitingModule = (title, key, fallbackReason) => (
        <ModuleComingSoon
            title={title}
            reason={moduleAvailability?.[key]?.reason || fallbackReason}
        />
    );

    function openTab(tab) {
        setActiveTab(tab);
        if (tab !== "more") setMoreSubTab(null);
        setSearchQuery("");
        setStatusFilter("all");
        const query = tab === "dashboard" ? {} : { tab };
        router.replace({ pathname: "/Admindashboard", query }, undefined, { shallow: true });
    }

    function openMoreSubTab(tab) {
        setActiveTab("more");
        setMoreSubTab(tab);
        setSearchQuery("");
        setStatusFilter("all");
        if (tab === "profile") loadFaceLockDevices();
        const query = tab ? { tab: "more", subtab: tab } : { tab: "more" };
        router.replace({ pathname: "/Admindashboard", query }, undefined, { shallow: true });
    }

    useEffect(() => {
        if (!router.isReady) return;

        const VALID_TABS = ["dashboard", "complaints", "service", "technicians", "more"];
        const tab = typeof router.query.tab === "string" ? router.query.tab : "dashboard";
        const subtab = typeof router.query.subtab === "string" ? router.query.subtab : "";

        const timer = setTimeout(() => {
            if (VALID_TABS.includes(tab)) {
                setActiveTab(tab);
            }
            if (tab === "more") {
                setMoreSubTab(subtab || null);
                if (subtab === "profile") loadFaceLockDevices();
            } else {
                setMoreSubTab(null);
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [router.isReady, router.query.tab, router.query.subtab]);


    // Today's Activities
    const activities = useMemo(
        () => buildUpcomingActivities(adminAppData.upcomingPreview),
        [adminAppData.upcomingPreview]
    );

    // Recent Complaints
    const [complaints, setComplaints] = useState([]);

    async function fetchComplaints() {
        if (!["superadmin", "admin", "manager", "front_office"].includes(user?.role)) return;
        setComplaintsLoading(true);
        setComplaintError("");
        try {
            const params = new URLSearchParams({
                page: "1",
                pageSize: "50",
            });
            if (searchQuery.trim()) params.set("search", searchQuery.trim());
            if (statusFilter !== "all") params.set("status", statusFilter);
            if (priorityFilter !== "all") params.set("priority", priorityFilter);
            if (complaintTypeFilter !== "all") params.set("complaintType", complaintTypeFilter);

            const [listRes, statsRes] = await Promise.all([
                fetch(`/api/complaints?${params.toString()}`),
                fetch("/api/complaints/stats"),
            ]);
            const listData = await listRes.json();
            const statsData = await statsRes.json();
            if (!listRes.ok || !listData.success) throw new Error(listData.message || "Failed to load complaints");
            setComplaints(listData.complaints || []);
            if (statsRes.ok && statsData.success) setComplaintStats(statsData);
        } catch (err) {
            setComplaintError(err.message || "Failed to load complaints");
        } finally {
            setComplaintsLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab !== "complaints" && activeTab !== "dashboard") return;
        const timer = setTimeout(() => fetchComplaints(), 250);
        return () => clearTimeout(timer);
    }, [activeTab, searchQuery, statusFilter, priorityFilter, complaintTypeFilter, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchQuotationDashboardData() {
        if (["customer", "worker", "storekeeper"].includes(user?.role)) return;
        try {
            const [statsRes, listRes] = await Promise.all([
                fetch("/api/quotations/stats"),
                fetch("/api/quotations?page=1&pageSize=1"),
            ]);
            const statsData = await statsRes.json();
            const listData = await listRes.json();
            if (statsRes.ok && statsData.success) setQuotationStats(statsData);
            if (listRes.ok && listData.success) setHasBoqPermission(Boolean(listData.canGenerate));
        } catch (err) {
            console.error("Failed to load quotation dashboard data:", err);
        }
    }

    useEffect(() => {
        if (activeTab !== "dashboard") return;
        const timer = setTimeout(() => fetchQuotationDashboardData(), 0);
        return () => clearTimeout(timer);
    }, [activeTab, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchServiceSchedules() {
        setSchedulesLoading(true);
        try {
            const res = await fetch("/api/service-schedules?pageSize=100");
            const data = await res.json();
            if (data.success) setSchedules(data.schedules || []);
        } catch {}
        finally { setSchedulesLoading(false); }
    }

    async function fetchAmcStats() {
        if (amcStats) return; // already loaded
        setAmcStatsLoading(true);
        try {
            const res = await fetch("/api/elevator-customers/amc-stats");
            const data = await res.json();
            if (data.success) setAmcStats(data.stats);
        } catch {}
        finally { setAmcStatsLoading(false); }
    }

    useEffect(() => {
        if (activeTab !== "service") return;
        fetchServiceSchedules();
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (activeTab !== "more") return;
        if (moreSubTab === "customers" || moreSubTab === "amc") fetchAmcStats();
    }, [activeTab, moreSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleCreateComplaint(e) {
        e.preventDefault();
        setComplaintError("");
        try {
            const res = await fetch("/api/complaints", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newComplaintData),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to create complaint");
            setShowAddComplaintModal(false);
            setNewComplaintData({
                customerName: "",
                mobileNo: "",
                city: "",
                address: "",
                complaintType: "BREAKDOWN",
                priority: "NORMAL",
                description: "",
                officeNotes: "",
            });
            await fetchComplaints();
        } catch (err) {
            setComplaintError(err.message || "Failed to create complaint");
        }
    }

    async function assignSelectedComplaint() {
        if (!selectedComplaint || !modalTech) return;
        setComplaintError("");
        try {
            const res = await fetch(`/api/complaints/${selectedComplaint.id}/assign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assignedTechnicianUserId: Number(modalTech),
                    assignmentNotes,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to assign complaint");
            setSelectedComplaint(null);
            setModalTech("");
            setAssignmentNotes("");
            await fetchComplaints();
        } catch (err) {
            setComplaintError(err.message || "Failed to assign complaint");
        }
    }

    async function updateSelectedComplaintStatus(nextStatus) {
        if (!selectedComplaint) return;
        setModalStatus(nextStatus);
        try {
            const res = await fetch(`/api/complaints/${selectedComplaint.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to update complaint");
            setSelectedComplaint(data.complaint);
            await fetchComplaints();
        } catch (err) {
            setComplaintError(err.message || "Failed to update complaint");
        }
    }

    const updateMaterialRequestsState = (newRequests) => {
        setMaterialRequests(newRequests);
    };

    // Upcoming AMC Visits
    const amcVisits = useMemo(
        () => buildUpcomingVisits(adminAppData.upcomingPreview),
        [adminAppData.upcomingPreview]
    );

    // Technician availability list
    const [technicians, setTechnicians] = useState([]);

    // Inventory and Staff States
    const [inventory, setInventory] = useState([]);

    const [staff, setStaff] = useState([]);

    const allocatableTasks = activities.map((activity) => `${activity.type}: ${activity.site}`);
    const liveKpiCounts = useMemo(
        () => ({
            ...buildAdminKpiCounts({ customerStats, serviceStats, technicians }),
            openComplaints: complaintStats?.openComplaints || 0,
        }),
        [customerStats, serviceStats, technicians, complaintStats]
    );

    // Recent Notifications
    const [notifications, setNotifications] = useState([]);

    // Fetch database users directory
    async function fetchUsers() {
        if (!["superadmin", "admin", "manager", "front_office"].includes(user?.role)) return;
        setUsersLoading(true);
        try {
            const res = await fetch("/api/users");
            const data = await res.json();
            if (data.success) {
                setUsersList(data.users);
                setTechnicians(buildTechniciansFromUsers(data.users));
                setStaff(buildStaffFromUsers(data.users));
            }
        } catch (err) {
            console.error("Failed to load user directory:", err);
        } finally {
            setUsersLoading(false);
        }
    }

    useEffect(() => {
        if (["dashboard", "more", "technicians", "staff"].includes(activeTab)) {
            const timer = setTimeout(() => fetchUsers(), 0);
            return () => clearTimeout(timer);
        }
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleLogout() {
        setLoading(true);
        try {
            clearSessionCache("amardip_admin_cache");
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/Adminlogin");
        } catch (err) {
            console.error("Logout failed", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleOnboardUser(e) {
        e.preventDefault();
        setOnboardError("");
        setOnboardSuccess("");
        setOnboardBusy(true);

        try {
            const res = await fetch("/api/users/onboard", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newUserData),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to onboard user");
            }

                                setOnboardSuccess(`Successfully created ${formatUserRole(newUserData.role)} account!`);
            fetchUsers();

            setNewUserData({
                username: "",
                password: "",
                name: "",
                role: "worker",
                phone: "",
            });

            setTimeout(() => {
                setShowOnboardModal(false);
                setOnboardSuccess("");
            }, 1500);

        } catch (err) {
            setOnboardError(err.message);
        } finally {
            setOnboardBusy(false);
        }
    }

    async function handleResetPassword(e) {
        e.preventDefault();
        setResetError("");
        setResetSuccess("");
        setResetBusy(true);

        try {
            const res = await fetch("/api/users/update-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: selectedResetUser.id,
                    newPassword: resetPasswordValue
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to update password");
            }

            setResetSuccess("Password updated successfully!");
            setResetPasswordValue("");

            setTimeout(() => {
                setShowResetModal(false);
                setSelectedResetUser(null);
                setResetSuccess("");
            }, 1500);

        } catch (err) {
            setResetError(err.message);
        } finally {
            setResetBusy(false);
        }
    }

    async function loadFaceLockDevices({ showMessage = false } = {}) {
        setPasskeyError("");
        if (showMessage) setPasskeyMessage("");
        setFaceLockDevicesLoading(true);

        try {
            const response = await fetch("/api/auth/passkey/list");
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to load Face Lock devices");
            }

            setFaceLockDevices(data.devices || []);
            if (showMessage) {
                setPasskeyMessage("Face Lock devices refreshed.");
            }
        } catch (err) {
            console.error("Face Lock device load failed:", err);
            setPasskeyError(err.message || "Failed to load Face Lock devices.");
        } finally {
            setFaceLockDevicesLoading(false);
        }
    }

    async function handleRemoveFaceLockDevice(id) {
        setPasskeyError("");
        setPasskeyMessage("");
        setFaceLockRemovingId(id);

        try {
            const response = await fetch("/api/auth/passkey/remove", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to remove Face Lock");
            }

            setPasskeyMessage(data.message || "Face Lock removed successfully.");
            setFaceLockDevices((devices) => devices.filter((device) => device.id !== id));
        } catch (err) {
            console.error("Face Lock remove failed:", err);
            setPasskeyError(err.message || "Failed to remove Face Lock.");
        } finally {
            setFaceLockRemovingId(null);
        }
    }

    async function handleSetupPasskey() {
        setPasskeyError("");
        setPasskeyMessage("");

        if (!browserSupportsPasskeys()) {
            setPasskeyError("Face Lock is not supported on this browser. Use password login.");
            return;
        }

        setPasskeyBusy(true);

        try {
            const optionsResponse = await fetch("/api/auth/passkey/register-options", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            const optionsData = await optionsResponse.json();

            if (!optionsResponse.ok || !optionsData.success) {
                throw new Error(optionsData.message || "Failed to start Face Lock setup");
            }

            const credential = await startPasskeyRegistration(optionsData.options);

            const verifyResponse = await fetch("/api/auth/passkey/register-verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    flowId: optionsData.flowId,
                    credential,
                    deviceName: passkeyDeviceName,
                }),
            });
            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
                throw new Error(verifyData.message || "Failed to save Face Lock");
            }

            setPasskeyMessage("Face Lock enabled successfully.");
            setPasskeyDeviceName("");
            await loadFaceLockDevices();
        } catch (err) {
            console.error("Face Lock setup failed:", err);
            setPasskeyError(err.message || "Face Lock setup failed or was cancelled.");
        } finally {
            setPasskeyBusy(false);
        }
    }

    // Interactive updates
    function toggleTechnicianStatus(id) {
        setTechnicians(prev =>
            prev.map(t => {
                if (t.id === id) {
                    const statuses = ["Available", "On Duty", "Busy", "Offline"];
                    const currIndex = statuses.indexOf(t.status);
                    const nextStatus = statuses[(currIndex + 1) % statuses.length];

                    // Update KPI counts if availability changes
                    let availChange = 0;
                    if (t.status === "Available" && nextStatus !== "Available") availChange = -1;
                    if (t.status !== "Available" && nextStatus === "Available") availChange = 1;

                    if (availChange !== 0) {
                        setKpiCounts(k => ({ ...k, availTechnicians: Math.max(0, k.availTechnicians + availChange) }));
                    }

                    return { ...t, status: nextStatus };
                }
                return t;
            })
        );
    }

    function toggleComplaintStatus(id) {
        setComplaints(prev =>
            prev.map(c => {
                if (c.id === id) {
                    let nextStatus = c.status === "Open" ? "In Progress" : c.status === "In Progress" ? "Resolved" : "Open";
                    let color = nextStatus === "In Progress" ? "text-red-600 bg-red-50 border-red-100" :
                        nextStatus === "Open" ? "text-amber-600 bg-amber-50 border-amber-100" :
                            "text-emerald-600 bg-emerald-50 border-emerald-100";

                    // Update complaints count
                    if (nextStatus === "Resolved") {
                        setKpiCounts(k => ({ ...k, openComplaints: Math.max(0, k.openComplaints - 1) }));
                    } else if (c.status === "Resolved") {
                        setKpiCounts(k => ({ ...k, openComplaints: k.openComplaints + 1 }));
                    }

                    return { ...c, status: nextStatus, color };
                }
                return c;
            })
        );
    }

    function handleAssignComplaint(complaintId, techName) {
        setComplaints(prev =>
            prev.map(c => {
                if (c.id === complaintId) {
                    let nextStatus = c.status;
                    let color = c.color;
                    if (techName && c.status === "Open") {
                        nextStatus = "In Progress";
                        color = "text-red-600 bg-red-50 border-red-100";
                    }
                    return { 
                        ...c, 
                        assignedTech: techName, 
                        status: nextStatus, 
                        color,
                        allocatedParts: allocatedParts,
                        allocatedPartsQr: allocatedParts.length > 0 ? `QR-${complaintId}-ALLOCATED` : null,
                        allocatedPartsIssued: false
                    };
                }
                return c;
            })
        );

        if (techName) {
            setTechnicians(prev =>
                prev.map(t => {
                    if (t.name === techName) {
                        const hadTask = !!t.allocatedTask;
                        let newWorkload = t.workload;
                        if (!hadTask) {
                            const parts = t.workload.split("/");
                            const current = parseInt(parts[0]) + 1;
                            newWorkload = `${current}/${parts[1]}`;
                        }

                        // Add notification log
                        const newNotif = {
                            id: notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
                            category: "Task Allocated",
                            message: `Assigned complaint "${complaintId}" to technician ${t.name}`,
                            time: "Just now"
                        };
                        setNotifications(n => [newNotif, ...n]);

                        return { ...t, allocatedTask: `Complaint: ${complaintId}`, workload: newWorkload };
                    }
                    return t;
                })
            );
        }

        setSelectedComplaint(null);
        setAllocatedParts([]);
    }

    function handleUpdateComplaintStatus(complaintId, newStatus) {
        setComplaints(prev =>
            prev.map(c => {
                if (c.id === complaintId) {
                    if (c.status === newStatus) return c;

                    let color = newStatus === "In Progress" ? "text-red-600 bg-red-50 border-red-100" :
                        newStatus === "Open" ? "text-amber-600 bg-amber-50 border-amber-100" :
                            "text-emerald-600 bg-emerald-50 border-emerald-100";

                    // Update open complaints count KPI
                    if (newStatus === "Resolved" && c.status !== "Resolved") {
                        setKpiCounts(k => ({ ...k, openComplaints: Math.max(0, k.openComplaints - 1) }));
                    } else if (c.status === "Resolved" && newStatus !== "Resolved") {
                        setKpiCounts(k => ({ ...k, openComplaints: k.openComplaints + 1 }));
                    }

                    return { ...c, status: newStatus, color };
                }
                return c;
            })
        );
    }

    async function handleAddSchedule(e) {
        e.preventDefault();
        if (!newSchedule.customerId) return;

        try {
            const res = await fetch("/api/service-schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId: newSchedule.customerId,
                    scheduledDate: newSchedule.scheduledDate || null,
                    assignedTechnicianName: newSchedule.technician || null,
                    assignedTechnicianUserId: newSchedule.technicianId || null,
                    priority: "NORMAL",
                    notes: newSchedule.notes || null,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to schedule");

            // Reload from DB
            await fetchServiceSchedules();

            // Send push notification to the assigned worker (non-blocking)
            if (newSchedule.technician) {
                fetch("/api/push/notify-worker", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        workerName: newSchedule.technician,
                        title: "New Service Assigned",
                        body: `Service at ${newSchedule.customerName} scheduled for ${newSchedule.scheduledDate || "soon"}`,
                        data: { url: "/Techniciandashboard" },
                    }),
                }).catch(() => {});
            }
        } catch {}

        setNewSchedule({ customerId: "", customerName: "", scheduledDate: "", technician: "", technicianId: "", notes: "" });
        setShowScheduleModal(false);
    }

    function handleCompleteSchedule(id) {
        let completedLoc = "";
        setSchedules(prev =>
            prev.map(sch => {
                if (sch.id === id) {
                    completedLoc = sch.location;
                    const updated = { ...sch, status: "Completed" };
                    if (selectedSchedule && selectedSchedule.id === id) {
                        setSelectedSchedule(updated);
                    }
                    return updated;
                }
                return sch;
            })
        );

        // Update KPIs
        setKpiCounts(k => ({
            ...k,
            todayService: Math.max(0, k.todayService - 1),
            upcomingMaintenance: Math.max(0, k.upcomingMaintenance - 1)
        }));

        // Add notification
        if (completedLoc) {
            const newNotif = {
                id: notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
                category: "Service Completed",
                message: `Maintenance checklist completed for ${completedLoc}`,
                time: "Just now"
            };
            setNotifications(prev => [newNotif, ...prev]);
        }
    }

    function handleAllocateTask(techId, taskName) {
        if (!taskName) return;

        setTechnicians(prev =>
            prev.map(t => {
                if (t.id === techId) {
                    const hadTask = !!t.allocatedTask;
                    let newWorkload = t.workload;
                    if (!hadTask) {
                        const parts = t.workload.split("/");
                        const current = parseInt(parts[0]) + 1;
                        newWorkload = `${current}/${parts[1]}`;
                    }

                    // Add notification log
                    const newNotif = {
                        id: notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
                        category: "Task Allocated",
                        message: `Assigned task "${taskName}" to technician ${t.name}`,
                        time: "Just now"
                    };
                    setNotifications(n => [newNotif, ...n]);

                    return { ...t, allocatedTask: taskName, workload: newWorkload };
                }
                return t;
            })
        );
    }

    function handleClearAllocation(techId) {
        setTechnicians(prev =>
            prev.map(t => {
                if (t.id === techId && t.allocatedTask) {
                    const parts = t.workload.split("/");
                    const current = Math.max(0, parseInt(parts[0]) - 1);
                    const newWorkload = `${current}/${parts[1]}`;

                    return { ...t, allocatedTask: "", workload: newWorkload };
                }
                return t;
            })
        );
    }

    return (
        <div className="min-h-[100dvh] bg-slate-900 sm:py-6 flex items-center justify-center font-sans antialiased">
            {/* Phone Bezel Simulator */}
            <div className="w-full sm:max-w-md h-[100dvh] sm:h-[840px] sm:min-h-[840px] sm:max-h-[840px] bg-[#f8fafc] text-[#0f172a] relative flex flex-col sm:shadow-2xl sm:rounded-[40px] sm:border-[10px] sm:border-slate-800 overflow-hidden">

                {/* Phone Top Notch Status Bar */}
                <div className="bg-[#0a649d] px-6 pt-3.5 pb-2.5 flex justify-between items-center text-[11px] font-bold text-white select-none shrink-0 sm:flex hidden">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5">
                        <span>5G</span>
                        <div className="w-5 h-2.5 border border-white rounded-sm p-0.5 flex items-center">
                            <div className="h-full w-3 bg-white rounded-2xs"></div>
                        </div>
                    </div>
                </div>

                {/* APP BAR HEADER */}
                <header
                    className="sticky top-0 z-30 text-white px-5 py-4 flex items-center justify-between shrink-0"
                    style={{ background: "linear-gradient(135deg, #04182b 0%, #073354 45%, #0a4f7a 100%)", boxShadow: "0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.3)" }}
                >
                    <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_8px_24px_rgba(2,6,23,0.18)] shrink-0">
                            <Image
                                src="/adlogo.png"
                                alt="Amardip Lifts"
                                fill
                                sizes="40px"
                                className="object-contain p-1"
                                priority
                            />
                        </div>
                        <div>
                            <span className="text-[10px] text-white/50 font-medium tracking-widest leading-none block uppercase">
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                            </span>
                            <span className="text-[15px] font-bold tracking-tight leading-snug">{getTimeGreeting()}, {(user?.name || "Admin").split(" ")[0]}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                            className="relative h-9 w-9 bg-white/10 active:bg-white/20 active:scale-90 transition-all flex items-center justify-center rounded-xl"
                        >
                            <BellIcon className="h-5 w-5 text-white" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 border-[1.5px] border-[#073354] flex items-center justify-center text-[8px] font-black text-white">
                                    {notifications.length}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                {/* NOTIFICATION CENTER DROPDOWN */}
                {showNotificationCenter && (
                    <div className="absolute top-[68px] left-0 right-0 z-40 mx-3 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_40px_rgba(4,24,43,0.18)] overflow-hidden animate-in slide-in-from-top-2 duration-200 select-none">
                        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-900">Notifications</span>
                            <button onClick={() => setShowNotificationCenter(false)} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">Clear all</button>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto">
                            {notifications.map(n => (
                                <div key={n.id} className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors">
                                    <div className="flex justify-between items-baseline gap-2">
                                        <span className="text-[11px] font-bold text-[#0a649d]">{n.category}</span>
                                        <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                                    </div>
                                    <p className="mt-0.5 text-[12px] text-slate-600 font-medium leading-relaxed">{n.message}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MAIN CONTENT AREA */}
                <main className="amardip-app-main flex-1 overflow-y-auto bg-[#eef2f7]">

                    <>
                    {/* TAB: DASHBOARD */}
                    {activeTab === "dashboard" && (
                        <div className="p-4 space-y-3 animate-in fade-in duration-200">

                            <DashboardKpiGrid
                                kpiCounts={liveKpiCounts}
                                customerStats={customerStats}
                                serviceStats={serviceStats}
                                statsLoading={dashboardStatsLoading}
                                setActiveTab={openTab}
                                setMoreSubTab={openMoreSubTab}
                                moduleAvailability={moduleAvailability}
                                user={user}
                                quotationStats={quotationStats}
                                hasBoqPermission={hasBoqPermission}
                            />

                            {/* Section 1: Today's Activities */}
                            {moduleIsLive("servicePlanner") ? (
                            <div className="rounded-[22px] bg-white p-5 space-y-4" style={{ boxShadow: "0 2px 12px rgba(15,23,42,0.07), 0 0 0 1px rgba(15,23,42,0.04)" }}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[13px] font-bold text-slate-900">Today&apos;s Activities</h3>
                                    <span className="text-[10px] font-medium text-slate-400">{activities.length} events</span>
                                </div>
                                <div className="space-y-4">
                                    {activities.map(a => (
                                        <div key={a.id} className="flex gap-3.5 items-start">
                                            <div className="text-center w-16 shrink-0 pt-0.5">
                                                <p className="text-[11px] font-bold text-[#0a649d] leading-none tabular-nums">{a.time}</p>
                                                <p className="text-[9px] font-medium text-slate-400 mt-0.5 uppercase">Service</p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-semibold text-slate-800 truncate">{a.type}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{a.site}</p>
                                            </div>
                                            <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-lg ${a.status === "In Progress" ? "bg-red-50 text-red-700" : a.status === "Scheduled" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>
                                                {a.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            ) : (
                                waitingModule("Today's Activities", "servicePlanner", "Waiting for service planning data")
                            )}

                            {/* Section 2: Recent Complaints */}
                            <div className="rounded-[22px] bg-white p-5 space-y-3" style={{ boxShadow: "0 2px 12px rgba(15,23,42,0.07), 0 0 0 1px rgba(15,23,42,0.04)" }}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[13px] font-bold text-slate-900">Recent Complaints</h3>
                                    <button onClick={() => openTab("complaints")} className="text-[10px] font-semibold text-[#0a649d]">View all</button>
                                </div>
                                <div className="space-y-2">
                                    {complaintsLoading && complaints.length === 0 ? (
                                        <p className="text-center text-xs text-slate-400 py-5">Loading complaints...</p>
                                    ) : complaints.slice(0, 3).length === 0 ? (
                                        <p className="text-center text-xs text-slate-400 py-5">No real complaints yet.</p>
                                    ) : complaints.slice(0, 3).map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedComplaint(c);
                                                setModalTech(c.assignedTechnicianUserId || "");
                                                setModalStatus(c.status || "UNASSIGNED");
                                            }}
                                            className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 active:scale-[0.98] transition-transform cursor-pointer"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] font-bold text-slate-900">{c.complaintNo}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${c.priority === "EMERGENCY" ? "bg-red-50 border-red-100 text-red-700" : "bg-slate-50 border-slate-100 text-slate-600"}`}>{c.priority}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.customerName}</p>
                                            </div>
                                            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-xl border ${complaintStatusClass(c.status)}`}>
                                                {c.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3: Upcoming AMC Visits */}
                            <div className="rounded-[22px] bg-white p-5 space-y-4" style={{ boxShadow: "0 2px 12px rgba(15,23,42,0.07), 0 0 0 1px rgba(15,23,42,0.04)" }}>
                                <h3 className="text-[13px] font-bold text-slate-900">Upcoming AMC Visits</h3>
                                <div className="space-y-4">
                                    {amcVisits.map(v => (
                                        <div key={v.id} className="flex justify-between items-center gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-semibold text-slate-800 truncate">{v.customer}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{v.building}</p>
                                                <p className="text-[10px] font-medium text-slate-500 mt-1">Due <span className="text-slate-700">{v.dueDate}</span></p>
                                            </div>
                                            {v.phone ? (
                                                <a href={`tel:${v.phone.replace(/\D/g, "").length === 10 ? "+91" + v.phone.replace(/\D/g, "") : v.phone}`} className="h-9 px-3.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-90 transition-transform text-[11px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #073354, #0a649d)" }}>
                                                    <PhoneIcon className="h-3.5 w-3.5" />
                                                    Call
                                                </a>
                                            ) : (
                                                <span className="h-9 px-3.5 rounded-xl flex items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-100 shrink-0">No number</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4: Technician Status */}
                            <div className="rounded-[22px] bg-white p-5 space-y-4" style={{ boxShadow: "0 2px 12px rgba(15,23,42,0.07), 0 0 0 1px rgba(15,23,42,0.04)" }}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[13px] font-bold text-slate-900">Technician Status</h3>
                                    <span className="text-[10px] font-medium text-slate-400">Tap to toggle</span>
                                </div>
                                <div className="space-y-3">
                                    {technicians.map(t => (
                                        <div key={t.id} className="flex justify-between items-center">
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-semibold text-slate-800">{t.name}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{t.role} · {t.workload}</p>
                                            </div>
                                            <button
                                                onClick={() => toggleTechnicianStatus(t.id)}
                                                className={`text-[10px] font-semibold px-3 py-1.5 rounded-xl active:scale-95 transition-transform ${
                                                    t.status === "Available" ? "bg-emerald-50 text-emerald-700" :
                                                    t.status === "On Duty" ? "bg-blue-50 text-blue-700" :
                                                    t.status === "Busy" ? "bg-amber-50 text-amber-700" :
                                                    "bg-slate-100 text-slate-500"
                                                }`}
                                            >
                                                {t.status}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* TAB: COMPLAINTS */}
                    {activeTab === "complaints" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-slate-900">Service Complaints</h1>
                                    <p className="text-xs text-slate-500 mt-0.5">Real complaint tickets and worker assignment.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAddComplaintModal(true)}
                                    className="h-10 px-4 rounded-2xl bg-[#0a649d] text-white text-xs font-black shadow-sm active:scale-95"
                                >
                                    Add
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search complaints..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="amardip-search-field w-full"
                                    />
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                </div>

                                <div className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-200/50 p-1.5">
                                    {["all", ...COMPLAINT_STATUS_OPTIONS].map(status => (
                                        <button
                                            key={status}
                                            onClick={() => setStatusFilter(status)}
                                            className={`amardip-filter-chip shrink-0 ${statusFilter === status ? "bg-[#0a649d] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600"}`}
                                        >
                                            {status === "all" ? "All" : status.replaceAll("_", " ")}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="amardip-field">
                                        <option value="all">All priorities</option>
                                        {COMPLAINT_PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                                    </select>
                                    <select value={complaintTypeFilter} onChange={(e) => setComplaintTypeFilter(e.target.value)} className="amardip-field">
                                        <option value="all">All types</option>
                                        {COMPLAINT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {complaintError && (
                                <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{complaintError}</p>
                            )}

                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    ["Open", complaintStats?.openComplaints || 0],
                                    ["Unassigned", complaintStats?.unassignedComplaints || 0],
                                    ["Emergency", complaintStats?.emergencyComplaints || 0],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                        <p className="text-lg font-black text-slate-900">{value}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {complaintsLoading && complaints.length === 0 ? (
                                    <p className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-xs font-bold text-slate-400">Loading real complaints...</p>
                                ) : complaints.length === 0 ? (
                                    <p className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-xs font-bold text-slate-400">No complaints found. Use Add to create the first DB-backed ticket.</p>
                                ) : complaints.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedComplaint(c);
                                            setModalTech(c.assignedTechnicianUserId || "");
                                            setModalStatus(c.status || "UNASSIGNED");
                                        }}
                                        className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99]"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-black text-slate-900">{c.complaintNo}</span>
                                                    <span className={`rounded border px-2 py-0.5 text-[9px] font-black ${c.priority === "EMERGENCY" ? "bg-red-50 border-red-100 text-red-700" : "bg-slate-50 border-slate-100 text-slate-600"}`}>{c.priority}</span>
                                                </div>
                                                <p className="mt-1 text-xs font-bold text-slate-700">{c.customerName}</p>
                                                <p className="mt-0.5 text-[10px] text-slate-400">{c.mobileNo || "-"} · {c.city || "-"}</p>
                                            </div>
                                            <span className={`rounded-xl border px-2.5 py-1 text-[10px] font-black ${complaintStatusClass(c.status)}`}>{c.status?.replaceAll("_", " ")}</span>
                                        </div>
                                        <p className="mt-3 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">{c.description}</p>
                                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-400">
                                            <span>{formatComplaintDate(c.createdAt)}</span>
                                            <span>{c.assignedTechnicianName ? `Worker: ${c.assignedTechnicianName}` : "Unassigned"}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB: SERVICE */}
                    {activeTab === "service" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-slate-900">Maintenance & Service</h1>
                                    <p className="text-xs text-slate-500 mt-0.5">Manage AMC visits and checkoff reports.</p>
                                </div>
                                <button
                                    onClick={async () => {
                        setShowScheduleModal(true);
                        fetchUsers();
                        try {
                            const r = await fetch("/api/elevator-customers?pageSize=100");
                            const d = await r.json();
                            if (d.customers) setScheduleCustomers(d.customers);
                        } catch {}
                    }}
                                    className="h-9 w-9 rounded-xl bg-[#0a649d] text-white flex items-center justify-center shadow-md active:scale-95 transition"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Service schedules */}
                            <div className="space-y-6">
                                {schedulesLoading ? (
                                    <p className="text-center text-xs text-slate-400 py-6">Loading…</p>
                                ) : (() => {
                                    const grouped = schedules.reduce((groups, item) => {
                                        const date = item.scheduled_date
                                            ? item.scheduled_date.split("T")[0]
                                            : "Unscheduled";
                                        if (!groups[date]) groups[date] = [];
                                        groups[date].push(item);
                                        return groups;
                                    }, {});

                                    const sortedDates = Object.keys(grouped).sort((a, b) => {
                                        if (a === "Unscheduled") return 1;
                                        if (b === "Unscheduled") return -1;
                                        return new Date(a) - new Date(b);
                                    });

                                    if (sortedDates.length === 0) {
                                        return (
                                            <div className="text-center py-10">
                                                <p className="text-sm font-bold text-slate-400">No services scheduled</p>
                                                <p className="text-xs text-slate-300 mt-1">Tap + to schedule a visit</p>
                                            </div>
                                        );
                                    }

                                    const statusBadge = (s) => {
                                        if (s === "COMPLETED") return "bg-emerald-100 text-emerald-800";
                                        if (s === "IN_PROGRESS") return "bg-amber-100 text-amber-800";
                                        if (s === "CANCELLED") return "bg-red-100 text-red-800";
                                        if (s === "ASSIGNED") return "bg-sky-100 text-sky-800";
                                        return "bg-blue-100 text-blue-800";
                                    };

                                    return sortedDates.map(date => (
                                        <div key={date} className="space-y-2">
                                            <div className="flex items-center gap-2 px-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#0a649d]"></span>
                                                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                                    {date === "Unscheduled" ? "Date TBD" : formatGroupDate(date)}
                                                </h4>
                                            </div>
                                            <div className="space-y-3">
                                                {grouped[date].map(sch => (
                                                    <div
                                                        key={sch.id}
                                                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="min-w-0">
                                                                <h3 className="text-sm font-extrabold text-slate-900 truncate">{sch.customer_name || "—"}</h3>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                                    Engineer: <span className="font-semibold text-slate-600">{sch.assigned_technician_name || "Unassigned"}</span>
                                                                </p>
                                                                {sch.city && <p className="text-[10px] text-slate-400">{sch.city}</p>}
                                                            </div>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded shrink-0 ${statusBadge(sch.status)}`}>
                                                                {sch.status?.replace("_", " ")}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                                            <span className="text-slate-400 font-semibold">
                                                                {sch.scheduled_date
                                                                    ? new Date(sch.scheduled_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                                                                    : "Date TBD"}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {sch.status !== "COMPLETED" && sch.status !== "CANCELLED" && (
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            await fetch(`/api/service-schedules/${sch.id}`, {
                                                                                method: "PATCH",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({ status: "COMPLETED" }),
                                                                            });
                                                                            fetchServiceSchedules();
                                                                        }}
                                                                        className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-3 py-1 rounded-lg font-bold transition cursor-pointer"
                                                                    >
                                                                        Mark Done
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (!confirm("Remove this schedule?")) return;
                                                                        await fetch(`/api/service-schedules/${sch.id}`, { method: "DELETE" });
                                                                        fetchServiceSchedules();
                                                                    }}
                                                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 border border-red-100 text-red-500 hover:bg-red-100 transition cursor-pointer"
                                                                    title="Delete"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {/* TAB: TECHNICIANS */}
                    {activeTab === "technicians" && !moduleIsLive("technicians") && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Service Crew Status</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Field staff and assignment readiness.</p>
                            </div>
                            {waitingModule("Technicians", "technicians", "Waiting for client staff/technician data")}
                        </div>
                    )}

                    {activeTab === "technicians" && moduleIsLive("technicians") && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Service Crew Status</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Allocate assignments and technician availability status.</p>
                            </div>

                            <div className="space-y-5">
                                {technicians.map(t => (
                                    <div key={t.id} className="rounded-3xl border border-slate-200 bg-white px-6 py-5.5 shadow-md flex flex-col justify-between transition-all hover:shadow-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-base font-black text-slate-900 leading-tight">{t.name}</h3>
                                                <p className="text-[11px] text-[#0a649d] font-bold mt-0.5">{t.role}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-[10px] font-semibold text-slate-400">Workload:</span>
                                                    <span className="text-[10px] font-extrabold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">{t.workload}</span>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-2xs select-none ${t.status === "Available" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                t.status === "On Duty" ? "bg-blue-50 border-blue-100 text-blue-700" :
                                                    t.status === "Busy" ? "bg-amber-50 border-amber-100 text-amber-700" :
                                                        "bg-slate-100 border-slate-200 text-slate-600"
                                                }`}>
                                                {t.status}
                                            </span>
                                        </div>

                                        {/* Allocate Task Dropdown */}
                                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Allocate Job Task</span>
                                                {t.allocatedTask && (
                                                    <button
                                                        onClick={() => handleClearAllocation(t.id)}
                                                        className="text-[9px] font-bold text-red-500 hover:text-red-750 active:scale-95 transition"
                                                    >
                                                        Clear Task
                                                    </button>
                                                )}
                                            </div>

                                            {!t.allocatedTask ? (
                                                <select
                                                    value=""
                                                    onChange={(e) => handleAllocateTask(t.id, e.target.value)}
                                                    className="w-full h-9.5 px-3 border border-slate-200 rounded-xl text-xs outline-none bg-white font-semibold text-slate-700 cursor-pointer focus:border-[#0a649d]"
                                                >
                                                    <option value="" disabled>-- Select Task to Assign --</option>
                                                    {allocatableTasks.map((task, idx) => (
                                                        <option key={idx} value={task}>{task}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="flex items-center gap-2.5 p-2.5 bg-sky-50 border border-sky-100 rounded-xl">
                                                    <div className="h-6.5 w-6.5 rounded-lg bg-[#0a649d] text-white flex items-center justify-center shrink-0">
                                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Assigned Job</p>
                                                        <p className="text-xs font-extrabold text-[#0a649d] truncate mt-0.5">{t.allocatedTask}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-3">
                                            <a
                                                href={`tel:${t.phone || "+919999999999"}`}
                                                className="flex-1 h-9 rounded-xl bg-[#0a649d] hover:bg-[#085282] text-white flex items-center justify-center gap-1.5 active:scale-95 transition text-[10px] sm:text-xs font-black shadow-sm"
                                            >
                                                <PhoneIcon className="h-3.5 w-3.5" />
                                                <span>Call Now</span>
                                            </a>
                                            <select
                                                value={t.status}
                                                onChange={(e) => toggleTechnicianStatus(t.id)}
                                                className="flex-1 h-9 px-2 border border-slate-200 rounded-xl text-[10px] sm:text-xs outline-none bg-white font-bold text-slate-700 cursor-pointer focus:border-[#0a649d] text-center"
                                            >
                                                <option value="Available">Available</option>
                                                <option value="On Duty">On Duty</option>
                                                <option value="Busy">Busy</option>
                                                <option value="Offline">Offline</option>
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB: MORE (SUPERADMIN CONTROLS & DATABASE USERS) */}
                    {activeTab === "more" && (
                        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100dvh-140px)] pb-10 animate-in fade-in duration-200">
                            {moreSubTab === "customers" ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Customers</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Real customer service records.</p>
                                        </div>
                                    </div>

                                    <AmcStatStrip stats={amcStats} loading={amcStatsLoading} />

                                    <AdminCustomersTable
                                        user={user}
                                        embedded
                                        returnTo="/Admindashboard?tab=more&subtab=customers"
                                    />
                                </div>
                            ) : moreSubTab === "amc" ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Active AMCs</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Real AMC customer records.</p>
                                        </div>
                                    </div>

                                    <AmcStatStrip stats={amcStats} loading={amcStatsLoading} />

                                    <AdminAmcTable
                                        user={user}
                                        embedded
                                        returnTo="/Admindashboard?tab=more&subtab=amc"
                                    />
                                </div>
                            ) : moreSubTab === "serviceVisits" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Service Visits</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Real service ledger and visit history.</p>
                                        </div>
                                    </div>

                                    <ServiceVisitsTable
                                        user={user}
                                        embedded
                                        returnTo="/Admindashboard?tab=more&subtab=serviceVisits"
                                    />
                                </div>
                            ) : moreSubTab === "inventory" && !moduleIsLive("inventory") ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Inventory Stock</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Elevator spare parts and warehouse counts.</p>
                                        </div>
                                    </div>
                                    {waitingModule("Inventory Stock", "inventory", "Waiting for client inventory data")}
                                </div>
                            ) : moreSubTab === "inventory" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Inventory Stock</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Spare parts list and warehouse stock levels.</p>
                                        </div>
                                    </div>

                                    {/* Search box */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search parts..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="amardip-search-field w-full"
                                        />
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                    </div>

                                    {/* Inventory list */}
                                    <div className="space-y-3">
                                        {inventory
                                            .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .map(item => (
                                                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
                                                    <div className="min-w-0">
                                                        <h3 className="text-xs font-extrabold text-slate-800 truncate">{item.name}</h3>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Category: {item.category} • Code: {item.code}</p>
                                                        <p className="text-[11px] font-black text-slate-800 mt-1">Quantity: <span className="text-[#0a649d]">{item.qty} {item.unit}</span></p>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.status === "In Stock" ? "bg-emerald-100 text-emerald-800" :
                                                        item.status === "Low Stock" ? "bg-amber-100 text-amber-800" :
                                                            "bg-red-100 text-red-800"
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ) : moreSubTab === "staff" && !moduleIsLive("technicians") ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Staff Directory</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Real staff and technician data.</p>
                                        </div>
                                    </div>
                                    {waitingModule("Staff Directory", "technicians", "Waiting for client staff/technician data")}
                                </div>
                            ) : moreSubTab === "staff" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Staff Directory</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Operations team and office contact list.</p>
                                        </div>
                                    </div>

                                    {/* Search box */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search staff..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="amardip-search-field w-full"
                                        />
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                    </div>

                                    {/* Staff list */}
                                    <div className="space-y-3">
                                        {staff
                                            .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.role.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .map(s => (
                                                <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
                                                    <div className="min-w-0">
                                                        <h3 className="text-xs font-extrabold text-slate-800 truncate">{s.name}</h3>
                                                        <p className="text-[10px] text-[#0a649d] font-bold capitalize mt-0.5">{s.role}</p>
                                                        <p className="text-[9px] text-slate-400 mt-1">{s.email}</p>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <a
                                                            href={`tel:${s.phone}`}
                                                            className="px-3 h-8.5 rounded-xl bg-[#0a649d] hover:bg-[#085282] text-white flex items-center justify-center gap-1.5 active:scale-95 transition text-[10px] font-black shadow-sm"
                                                        >
                                                            <PhoneIcon className="h-3.5 w-3.5" />
                                                            <span>Call Now</span>
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ) : moreSubTab === "reports" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Reports & Analytics</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Elevator performance and operational statistics.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Complaints Analytics */}
                                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Service Complaints Report</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Resolution rates and ticket load</p>
                                                </div>
                                                <span className="text-xs font-black text-[#0a649d]">88% Resolved</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#0a649d] rounded-full" style={{ width: '88%' }}></div>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-500 font-semibold pt-1">
                                                <span>Total: {complaints.length} Tickets</span>
                                                <span>Resolved: {complaints.filter(c => c.status === "Resolved").length}</span>
                                                <span>Open: {complaints.filter(c => c.status === "Open").length}</span>
                                            </div>
                                            <button
                                                onClick={() => alert("Report downloaded successfully!")}
                                                className="w-full h-9 rounded-xl bg-[#0a649d] hover:bg-[#085282] text-white text-xs font-bold flex items-center justify-center gap-2 mt-2 active:scale-98 transition"
                                            >
                                                Download PDF Report
                                            </button>
                                        </div>

                                        {/* AMC & Service Analytics */}
                                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">AMC Maintenance Report</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Recurring contract visits</p>
                                                </div>
                                                <span className="text-xs font-black text-amber-600">3 Upcoming Checks</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-semibold space-y-1.5 pt-1">
                                                <div className="flex justify-between">
                                                    <span>Active Contracts:</span>
                                                    <span className="font-extrabold text-slate-800">{liveKpiCounts.activeAMC}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Completed This Month:</span>
                                                    <span className="font-extrabold text-emerald-600">14 visits</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => alert("Excel sheet exported successfully!")}
                                                className="w-full h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 mt-2 active:scale-98 transition"
                                            >
                                                Export Excel (.xlsx)
                                            </button>
                                        </div>

                                        {/* Technician Activity Summary */}
                                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Technician Workload Analysis</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Duty status and task allocation</p>
                                                </div>
                                                <span className="text-xs font-black text-emerald-600">{technicians.filter(t => t.status === "Available").length} Available</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-slate-500 font-semibold">
                                                <div className="p-2 bg-slate-50 rounded-xl">
                                                    <p className="text-slate-400">Total Crew</p>
                                                    <p className="text-sm font-black text-slate-800 mt-0.5">{technicians.length}</p>
                                                </div>
                                                <div className="p-2 bg-slate-50 rounded-xl">
                                                    <p className="text-slate-400">Avg Job Load</p>
                                                    <p className="text-sm font-black text-slate-800 mt-0.5">1.8 / tech</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => alert("Technician report generated!")}
                                                className="w-full h-9 rounded-xl bg-[#0a649d] hover:bg-[#085282] text-white text-xs font-bold flex items-center justify-center gap-2 mt-1 active:scale-98 transition"
                                            >
                                                Generate Custom Summary
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : moreSubTab === "profile" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">My Profile</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Your user account information and settings.</p>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                                        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                                            <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[#0a649d]/15 bg-white shadow-sm">
                                                <Image
                                                    src="/adlogo.png"
                                                    alt="Amardip Lifts"
                                                    fill
                                                    sizes="56px"
                                                    className="object-contain p-1.5"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-extrabold text-slate-900">{user?.name || "Admin User"}</h3>
                                                <p className="text-[10px] text-slate-400 capitalize mt-0.5">{user?.role || "Super Administrator"}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-slate-400 font-semibold">Username:</span>
                                                <span className="font-extrabold text-slate-700">@{user?.username || "superadmin"}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-slate-400 font-semibold">Phone:</span>
                                                <span className="font-extrabold text-slate-700">{user?.phone || "+91 99999 99999"}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-50 pb-2">
                                                <span className="text-slate-400 font-semibold">Status:</span>
                                                <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                                                    Active
                                                </span>
                                            </div>
                                            <div className="flex justify-between pb-2">
                                                <span className="text-slate-400 font-semibold">Joined:</span>
                                                <span className="font-extrabold text-slate-700">Jan 10, 2026</span>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedResetUser(user);
                                                    setResetPasswordValue("");
                                                    setShowResetModal(true);
                                                }}
                                                className="w-full h-10 border border-[#cbd5e1] hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 active:scale-98 transition"
                                            >
                                                <KeyIcon className="h-4 w-4 text-slate-500" />
                                                Change Password
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900">Face Lock</h3>
                                            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                                                Use your phone or laptop face/fingerprint unlock for faster login.
                                            </p>
                                        </div>

                                        <input
                                            type="text"
                                            value={passkeyDeviceName}
                                            onChange={(event) => setPasskeyDeviceName(event.target.value)}
                                            placeholder="Device name optional"
                                            className="amardip-field w-full"
                                        />

                                        {passkeyMessage && (
                                            <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                                                {passkeyMessage}
                                            </p>
                                        )}

                                        {passkeyError && (
                                            <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
                                                {passkeyError}
                                            </p>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleSetupPasskey}
                                            disabled={passkeyBusy}
                                            className="h-11 w-full rounded-2xl bg-[#0a649d] text-xs font-black text-white shadow-sm active:scale-95 disabled:opacity-60"
                                        >
                                            {passkeyBusy ? "Setting up Face Lock..." : "Setup Face Lock"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => loadFaceLockDevices({ showMessage: true })}
                                            disabled={faceLockDevicesLoading}
                                            className="h-11 w-full rounded-2xl border border-[#bae6fd] bg-[#f0f9ff] text-xs font-black text-[#0a649d] shadow-sm active:scale-95 disabled:opacity-60"
                                        >
                                            {faceLockDevicesLoading ? "Refreshing Devices..." : "Refresh Devices"}
                                        </button>

                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">
                                                    Face Lock Devices
                                                </h4>
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                                                    {faceLockDevices.length}
                                                </span>
                                            </div>

                                            {faceLockDevicesLoading ? (
                                                <div className="space-y-2">
                                                    {[0, 1].map((item) => (
                                                        <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                                                    ))}
                                                </div>
                                            ) : faceLockDevices.length === 0 ? (
                                                <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-500">
                                                    Face Lock is not enabled yet.
                                                </p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {faceLockDevices.map((device) => (
                                                        <div key={device.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-black text-slate-900">
                                                                        {device.deviceName || "Face Lock Device"}
                                                                    </p>
                                                                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                                                                        Created {formatDeviceDate(device.createdAt)}
                                                                    </p>
                                                                    <p className="text-[11px] font-bold text-slate-500">
                                                                        Last used {formatDeviceDate(device.lastUsedAt)}
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveFaceLockDevice(device.id)}
                                                                    disabled={faceLockRemovingId === device.id}
                                                                    className="shrink-0 rounded-xl border border-red-100 bg-white px-3 py-2 text-[11px] font-black text-red-600 shadow-sm active:scale-95 disabled:opacity-60"
                                                                >
                                                                    {faceLockRemovingId === device.id ? "Removing..." : "Remove Face Lock"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : moreSubTab === "notifications" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Alert Notifications</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">System status updates and alerts.</p>
                                        </div>
                                    </div>
                                    {waitingModule("Alert Notifications", "notifications", "Notification data not configured yet")}
                                </div>
                            ) : false ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => openTab("dashboard")}
                                                className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                            >
                                                <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                            </button>
                                            <div>
                                                <h1 className="text-xl font-black tracking-tight text-slate-900">Alert Notifications</h1>
                                                <p className="text-[10px] text-slate-500 mt-0.5">System status updates and alerts.</p>
                                            </div>
                                        </div>
                                        {notifications.length > 0 && (
                                            <button
                                                onClick={() => setNotifications([])}
                                                className="text-[10px] text-slate-400 hover:text-red-500 font-extrabold uppercase transition"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    {notifications.length === 0 ? (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
                                            <BellIcon className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                                            <p className="text-xs font-bold">No active notifications</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">You are all caught up!</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {notifications.map(n => (
                                                <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs space-y-1.5 hover:shadow transition">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-extrabold text-[#0a649d] uppercase text-[9px] tracking-wider bg-sky-50 px-1.5 py-0.5 rounded-sm">{n.category}</span>
                                                        <span className="text-[9px] text-slate-400">{n.time}</span>
                                                    </div>
                                                    <p className="text-slate-700 font-semibold leading-relaxed">{n.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : moreSubTab === "approvals" && !moduleIsLive("materialRequests") ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Spare Parts Approvals</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Material requests from field service technicians.</p>
                                        </div>
                                    </div>
                                    {waitingModule("Spare Parts Approvals", "materialRequests", "Waiting for inventory/staff data")}
                                </div>
                            ) : moreSubTab === "approvals" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openTab("dashboard")}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Spare Parts Approvals</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Approve or reject material requests from field service technicians.</p>
                                        </div>
                                    </div>

                                    {/* Search box or filters */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search parts requested..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="amardip-search-field w-full"
                                        />
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                    </div>

                                    {/* Requests Cards */}
                                    <div className="space-y-4">
                                        {materialRequests.length === 0 ? (
                                            <p className="text-center text-xs text-slate-400 py-6">No material requests logged.</p>
                                        ) : (
                                            materialRequests
                                                .filter(r => r.partName.toLowerCase().includes(searchQuery.toLowerCase()) || (r.technicianName || r.technician || "Technician").toLowerCase().includes(searchQuery.toLowerCase()))
                                                .map(r => (
                                                    <div key={r.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
                                                        <div className="flex justify-between items-start">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{r.id}</span>
                                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                                                        r.urgency === "High" || r.priority === "High" ? "bg-red-50 text-red-700 border-red-100" :
                                                                        r.urgency === "Medium" || r.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                                        "bg-slate-50 text-slate-700 border-slate-100"
                                                                    }`}>
                                                                        {r.urgency || r.priority || "Medium"}
                                                                    </span>
                                                                </div>
                                                                <h3 className="text-sm font-extrabold text-slate-900 mt-1 truncate">{r.partName} x {r.quantity}</h3>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">Technician: <span className="font-semibold text-slate-600">{r.technicianName || r.technician || "Technician"}</span></p>
                                                            </div>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                                                                r.status === "Approved" ? "bg-emerald-100 text-emerald-800" :
                                                                r.status === "Rejected" ? "bg-red-100 text-red-800" :
                                                                r.status === "Issued" ? "bg-slate-100 text-slate-650" :
                                                                "bg-amber-100 text-amber-800"
                                                            }`}>
                                                                {r.status}
                                                            </span>
                                                        </div>

                                                        {r.reason && (
                                                            <p className="text-[10px] text-slate-500 font-semibold bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-3">
                                                                <span className="block text-[8px] font-extrabold text-slate-400 uppercase mb-0.5">Reason for Request</span>
                                                                {r.reason}
                                                            </p>
                                                        )}

                                                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                                                            <span>Date: {r.requestDate || r.date || "Today"}</span>
                                                            {r.status === "Pending" && (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = materialRequests.map(item => {
                                                                                if (item.id === r.id) {
                                                                                    return { ...item, status: "Approved", qrCode: "INVENTORY_PASS_" + item.id };
                                                                                }
                                                                                return item;
                                                                            });
                                                                            updateMaterialRequestsState(updated);
                                                                        }}
                                                                        className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = materialRequests.map(item => {
                                                                                if (item.id === r.id) {
                                                                                    return { ...item, status: "Rejected" };
                                                                                }
                                                                                return item;
                                                                            });
                                                                            updateMaterialRequestsState(updated);
                                                                        }}
                                                                        className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 active:scale-95 transition cursor-pointer"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {r.status === "Approved" && r.qrCode && (
                                                                <span className="text-[9px] text-[#0a649d] font-extrabold">PASS GENERATED</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h1 className="text-2xl font-black tracking-tight text-slate-900">More Tools</h1>
                                        <p className="text-xs text-slate-500 mt-0.5">Directory list and system settings.</p>
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                        {/* Upcoming Services Button */}
                                        <button
                                            onClick={() => router.push("/admin/upcoming-services")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Upcoming Services</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">Plan monthly AMC, EMC, and warranty visits</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

                                        {/* Inventory Stock Button */}
                                        <button
                                            onClick={() => openMoreSubTab("inventory")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Inventory Stock</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">Elevator spare parts and warehouse counts</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

                                        {/* Staff Directory Button */}
                                        <button
                                            onClick={() => openMoreSubTab("staff")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Staff Directory</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">Contact list of office and operations team</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

                                        {/* System Reports Button */}
                                        <button
                                            onClick={() => router.push("/admin/reports")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">System Reports</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">AMC, service and data quality reports</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

                                        {/* My Profile Button */}
                                        <button
                                            onClick={() => openMoreSubTab("profile")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">My Profile</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">View your account status and change password</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

                                        {/* Alert Notifications Button */}
                                        <button
                                            onClick={() => openMoreSubTab("notifications")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Alert Notifications</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">Check recent system updates and notification logs</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

                                        {/* Spare Parts Approvals Button */}
                                        <button
                                            onClick={() => openMoreSubTab("approvals")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Spare Parts Approvals</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">Approve technician material requests for store pickups</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

                                        {/* Superadmin actions */}
                                        {user?.role === "superadmin" && (
                                            <button
                                                onClick={() => setShowOnboardModal(true)}
                                                className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                        <OnboardingIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800">Onboard New Account</p>
                                                        <p className="text-[9px] text-slate-400 mt-0.5">Register Admins, Managers, and Workers</p>
                                                    </div>
                                                </div>
                                                <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Database Directory List */}
                                    {user?.role === "superadmin" && (
                                        <div>
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">DB Users Directory</h3>
                                            {usersLoading ? (
                                                <div className="space-y-2">
                                                    {[1,2,3].map(i => (
                                                        <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center justify-between animate-pulse">
                                                            <div className="space-y-1.5">
                                                                <div className="h-3 w-28 bg-slate-200 rounded-full" />
                                                                <div className="h-2.5 w-36 bg-slate-100 rounded-full" />
                                                            </div>
                                                            <div className="h-8.5 w-8.5 rounded-lg bg-slate-100" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {usersList.map(u => (
                                                        <div key={u.id} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center justify-between">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-extrabold text-slate-800 truncate">{u.name}</p>
                                                                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">@{u.username} • <span className="text-[#0a649d]">{u.designation || formatUserRole(u.role)}</span></p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => { setSelectedResetUser(u); setShowResetModal(true); }}
                                                                    className="h-8.5 w-8.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 active:scale-95 transition"
                                                                    title="Reset Password"
                                                                >
                                                                    <KeyIcon className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* System Logout Button */}
                                    <div className="pt-4">
                                        <button
                                            onClick={handleLogout}
                                            disabled={loading}
                                            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition"
                                        >
                                            <LogoutIcon className="h-4.5 w-4.5" />
                                            {loading ? "LOGGING OUT..." : "LOG OUT SYSTEM"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    </>

                </main>

                {/* BOTTOM NAVIGATION BAR */}
                <div className="amardip-bottom-nav absolute bottom-0 left-0 right-0 bg-[#0a1f35]/95 backdrop-blur-xl border-t border-white/8 text-white flex justify-around items-start z-50 px-1 pt-2">
                    {[
                        { tab: "dashboard", label: "Dashboard", Icon: OverviewIcon, badge: null },
                        { tab: "complaints", label: "Complaints", Icon: AlertIcon, badge: liveKpiCounts.openComplaints > 0 ? liveKpiCounts.openComplaints : null, badgeColor: "bg-red-500 text-white" },
                        { tab: "service", label: "Service", Icon: ServiceIcon, badge: liveKpiCounts.todayService > 0 ? liveKpiCounts.todayService : null, badgeColor: "bg-[#59e0ff] text-[#0a1f35]" },
                        { tab: "technicians", label: "Techs", Icon: TechniciansIcon, badge: null },
                        { tab: "more", label: "More", Icon: MoreIcon, badge: null },
                    ].map(({ tab, label, Icon, badge, badgeColor }) => {
                        const active = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => openTab(tab)}
                                className="relative flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 active:scale-90 transition-transform duration-100"
                            >
                                <div className={`flex items-center justify-center rounded-xl px-3 py-1 transition-all duration-200 ${active ? "bg-[#59e0ff]/15" : ""}`}>
                                    <Icon className={`h-5 w-5 transition-colors duration-200 ${active ? "text-[#59e0ff]" : "text-slate-400"}`} />
                                </div>
                                <span className={`text-[9.5px] font-semibold tracking-tight transition-colors duration-200 ${active ? "text-[#59e0ff]" : "text-slate-500"}`}>
                                    {label}
                                </span>
                                {badge !== null && (
                                    <span className={`absolute top-0.5 right-1 sm:right-3 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[8px] font-black rounded-full ${badgeColor}`}>
                                        {badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

            </div>

            {/* MODAL: ONBOARD USER (SUPERADMIN ONLY) */}
            {showOnboardModal && user?.role === "superadmin" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4.5 bg-[#0a649d] text-white flex items-center justify-between shrink-0">
                            <h2 className="text-base font-bold">Onboard New Member</h2>
                            <button
                                onClick={() => { setShowOnboardModal(false); setOnboardError(""); setOnboardSuccess(""); }}
                                className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleOnboardUser} className="p-5 space-y-4">
                            {onboardError && (
                                <div className="p-3 bg-red-50 border border-red-100 text-xs font-semibold text-red-755 rounded-xl">
                                    {onboardError}
                                </div>
                            )}

                            {onboardSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-800 rounded-xl">
                                    {onboardSuccess}
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserData.name}
                                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                                    placeholder="Enter full name"
                                    className="h-10.5 w-full px-4 rounded-xl border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserData.username}
                                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value.replace(/\s+/g, "").toLowerCase() })}
                                    placeholder="e.g. rajesh.k"
                                    className="h-10.5 w-full px-4 rounded-xl border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={newUserData.password}
                                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                        placeholder="Password"
                                        className="h-10.5 w-full px-4 rounded-xl border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Phone Number</label>
                                    <input
                                        type="text"
                                        value={newUserData.phone}
                                        onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                                        placeholder="Phone"
                                        className="h-10.5 w-full px-4 rounded-xl border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assigned Role</label>
                                <select
                                    value={newUserData.role}
                                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="manager">Manager</option>
                                    <option value="worker">Worker</option>
                                    <option value="front_office">Front Office</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-2.5 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => { setShowOnboardModal(false); setOnboardError(""); setOnboardSuccess(""); }}
                                    className="h-10 px-4.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={onboardBusy}
                                    className="h-10 px-4.5 bg-[#0a649d] text-white rounded-xl text-xs font-semibold hover:bg-[#085282] disabled:opacity-50 transition"
                                >
                                    {onboardBusy ? "Onboarding..." : "Onboard"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: RESET USER PASSWORD (SUPERADMIN ONLY) */}
            {showResetModal && user?.role === "superadmin" && selectedResetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4.5 bg-[#0a649d] text-white flex items-center justify-between">
                            <h2 className="text-base font-bold">Reset Password</h2>
                            <button
                                onClick={() => { setShowResetModal(false); setSelectedResetUser(null); setResetError(""); setResetSuccess(""); }}
                                className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleResetPassword} className="p-5 space-y-4">
                            {resetError && (
                                <div className="p-3 bg-red-50 border border-red-100 text-xs font-semibold text-red-700 rounded-xl">
                                    {resetError}
                                </div>
                            )}

                            {resetSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-800 rounded-xl">
                                    {resetSuccess}
                                </div>
                            )}

                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">User Profile</span>
                                <p className="text-sm font-extrabold text-slate-800">{selectedResetUser.name}</p>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">@{selectedResetUser.username} • {selectedResetUser.role}</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={resetPasswordValue}
                                    onChange={(e) => setResetPasswordValue(e.target.value)}
                                    placeholder="Enter new password"
                                    className="h-10.5 w-full px-4 rounded-xl border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                />
                            </div>

                            <div className="pt-4 flex gap-2.5 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => { setShowResetModal(false); setSelectedResetUser(null); setResetError(""); setResetSuccess(""); }}
                                    className="h-10 px-4.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetBusy}
                                    className="h-10 px-4.5 bg-[#0a649d] text-white rounded-xl text-xs font-semibold hover:bg-[#085282] disabled:opacity-50 transition"
                                >
                                    {resetBusy ? "Updating..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CREATE SERVICE CALL/SCHEDULE */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4.5 bg-[#0a649d] text-white flex items-center justify-between">
                            <h2 className="text-base font-bold">Schedule Service Call</h2>
                            <button
                                onClick={() => setShowScheduleModal(false)}
                                className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddSchedule} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Customer / Site</label>
                                <select
                                    required
                                    value={newSchedule.customerId}
                                    onChange={(e) => {
                                        const sel = scheduleCustomers.find(c => String(c.id) === e.target.value);
                                        setNewSchedule({ ...newSchedule, customerId: e.target.value, customerName: sel?.customer_name || sel?.customerName || "" });
                                    }}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    <option value="">Select customer…</option>
                                    {scheduleCustomers.map(c => (
                                        <option key={c.id} value={c.id}>{c.customer_name || c.customerName} — {c.city || ""}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Scheduled Date</label>
                                <input
                                    type="date"
                                    value={newSchedule.scheduledDate}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assign Technician</label>
                                <select
                                    value={newSchedule.technician}
                                    onChange={(e) => {
                                        const sel = technicians.find(t => t.name === e.target.value);
                                        setNewSchedule({ ...newSchedule, technician: e.target.value, technicianId: sel?.id || "" });
                                    }}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    <option value="">Select technician…</option>
                                    {usersLoading && <option disabled>Loading…</option>}
                                    {!usersLoading && technicians.length === 0 && <option disabled>No technicians found</option>}
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={newSchedule.notes}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })}
                                    placeholder="Any special instructions…"
                                    className="h-10.5 w-full px-4 rounded-xl border border-slate-200 text-base outline-none focus:border-[#0a649d] transition"
                                />
                            </div>

                            <div className="pt-4 flex gap-2.5 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowScheduleModal(false)}
                                    className="h-10 px-4.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="h-10 px-4.5 bg-[#0a649d] text-white rounded-xl text-xs font-semibold hover:bg-[#085282] transition"
                                >
                                    Schedule Visit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ADD COMPLAINT */}
            {showAddComplaintModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-center justify-between bg-[#0a649d] px-5 py-4.5 text-white">
                            <div>
                                <h2 className="text-base font-bold">Add Complaint</h2>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Office / admin ticket</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddComplaintModal(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateComplaint} className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
                            <input
                                value={newComplaintData.customerName}
                                onChange={(e) => setNewComplaintData({ ...newComplaintData, customerName: e.target.value })}
                                placeholder="Customer name"
                                required
                                className="amardip-field w-full"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    value={newComplaintData.mobileNo}
                                    onChange={(e) => setNewComplaintData({ ...newComplaintData, mobileNo: e.target.value })}
                                    placeholder="Mobile"
                                    className="amardip-field w-full"
                                />
                                <input
                                    value={newComplaintData.city}
                                    onChange={(e) => setNewComplaintData({ ...newComplaintData, city: e.target.value })}
                                    placeholder="City"
                                    className="amardip-field w-full"
                                />
                            </div>
                            <input
                                value={newComplaintData.address}
                                onChange={(e) => setNewComplaintData({ ...newComplaintData, address: e.target.value })}
                                placeholder="Address"
                                className="amardip-field w-full"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newComplaintData.complaintType}
                                    onChange={(e) => setNewComplaintData({ ...newComplaintData, complaintType: e.target.value })}
                                    className="amardip-field"
                                >
                                    {COMPLAINT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                                <select
                                    value={newComplaintData.priority}
                                    onChange={(e) => setNewComplaintData({ ...newComplaintData, priority: e.target.value })}
                                    className="amardip-field"
                                >
                                    {COMPLAINT_PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                                </select>
                            </div>
                            <textarea
                                value={newComplaintData.description}
                                onChange={(e) => setNewComplaintData({ ...newComplaintData, description: e.target.value })}
                                rows={4}
                                required
                                placeholder="Complaint description"
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0a649d]"
                            />
                            <textarea
                                value={newComplaintData.officeNotes}
                                onChange={(e) => setNewComplaintData({ ...newComplaintData, officeNotes: e.target.value })}
                                rows={3}
                                placeholder="Office notes optional"
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0a649d]"
                            />
                            <div className="flex gap-2 border-t border-slate-100 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddComplaintModal(false)}
                                    className="h-10 flex-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="h-10 flex-1 rounded-xl bg-[#0a649d] text-xs font-bold text-white"
                                >
                                    Save Complaint
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: COMPLAINT DETAILS & ASSIGNMENT */}
            {selectedComplaint && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4.5 bg-[#0a649d] text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold">Complaint Ticket</h2>
                                <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">{selectedComplaint.complaintNo}</p>
                            </div>
                            <button
                                onClick={() => setSelectedComplaint(null)}
                                className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer / Site</span>
                                <p className="text-sm font-extrabold text-slate-800">{selectedComplaint.customerName}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{selectedComplaint.mobileNo || "-"} · {selectedComplaint.city || "-"}</p>
                                {selectedComplaint.address && <p className="mt-1 text-xs text-slate-400">{selectedComplaint.address}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged Date</span>
                                    <p className="text-xs font-bold text-slate-700">{formatComplaintDate(selectedComplaint.createdAt)}</p>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</span>
                                    <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded border mt-1 ${selectedComplaint.priority === "EMERGENCY" ? "bg-red-50 border-red-100 text-red-700" : "bg-slate-50 border-slate-100 text-slate-700"}`}>
                                        {selectedComplaint.priority}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issue Description</span>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 border border-slate-100 p-3 rounded-xl mt-1">
                                    {selectedComplaint.description || "No description provided."}
                                </p>
                            </div>

                            <hr className="border-slate-100" />

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ticket Status</label>
                                <select
                                    value={modalStatus}
                                    onChange={(e) => updateSelectedComplaintStatus(e.target.value)}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    {COMPLAINT_STATUS_OPTIONS.map(status => (
                                        <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assign Worker</label>
                                <select
                                    value={modalTech}
                                    onChange={(e) => setModalTech(e.target.value)}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assignment Notes</label>
                                <textarea
                                    value={assignmentNotes}
                                    onChange={(e) => setAssignmentNotes(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0a649d]"
                                    placeholder="Optional note for assignment"
                                />
                            </div>

                            <div className="pt-4 flex gap-2.5 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedComplaint(null)}
                                    className="h-10 px-4.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={assignSelectedComplaint}
                                    className="h-10 px-4.5 bg-[#0a649d] text-white rounded-xl text-xs font-semibold hover:bg-[#085282] transition"
                                >
                                    Save Assignment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: SERVICE SCHEDULE DETAILS */}
            {selectedSchedule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4.5 bg-[#0a649d] text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold">Service Details</h2>
                                <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Schedule #{selectedSchedule.id}</p>
                            </div>
                            <button
                                onClick={() => setSelectedSchedule(null)}
                                className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Detail items */}
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location / Site</span>
                                <p className="text-sm font-extrabold text-slate-800">{selectedSchedule.location}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technician</span>
                                    <p className="text-xs font-bold text-slate-700">{selectedSchedule.technician}</p>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded ${selectedSchedule.status === "Overdue" ? "bg-red-100 text-red-800" :
                                        selectedSchedule.status === "Upcoming" ? "bg-amber-100 text-amber-800" :
                                            selectedSchedule.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                                                "bg-blue-100 text-blue-800"
                                    }`}>
                                        {selectedSchedule.status}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</span>
                                    <p className="text-xs font-bold text-slate-650">{selectedSchedule.nextService}</p>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Serviced</span>
                                    <p className="text-xs font-bold text-slate-650">{selectedSchedule.lastService}</p>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Checklist Progress */}
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Checklist Progress</span>
                                <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5 pb-1.5 border-b border-slate-200/60">
                                        <span>Checklist Tasks</span>
                                        <span className={selectedSchedule.status === "Completed" ? "text-emerald-600" : "text-slate-500"}>
                                            {selectedSchedule.status === "Completed" ? "8 / 8 Complete" : "0 / 8 Complete"}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 text-[11px] font-semibold text-slate-600">
                                        {[
                                            "Main Traction Motor & Gearbox Check",
                                            "Brake Clearance & Lining Inspection",
                                            "Hoistway & Pit Safety Switches Check",
                                            "Steel Wire Ropes Tension & Wear",
                                            "Automatic Cabin Door Slider & Alignment",
                                            "Controller Panel & Diagnostics Run",
                                            "Emergency Car Alarm & Intercom Test",
                                            "Leveling & Cabin Lighting Check"
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                {selectedSchedule.status === "Completed" ? (
                                                    <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                ) : (
                                                    <div className="h-3.5 w-3.5 border-2 border-slate-300 rounded-full shrink-0"></div>
                                                )}
                                                <span className={selectedSchedule.status === "Completed" ? "line-through text-slate-400" : ""}>{item}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* GPS Geofence details */}
                                    <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-400 uppercase tracking-wider">GPS Geofence</span>
                                        <span className={selectedSchedule.status === "Completed" ? "text-emerald-600" : "text-amber-600"}>
                                            {selectedSchedule.status === "Completed" ? "Verified Check-In" : "Pending Check-In"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Service Images */}
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Service Evidence Images</span>
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
                                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                                        No service evidence has been uploaded for this record.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-2.5 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedSchedule(null)}
                                    className="h-10 px-4.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Close
                                </button>
                                {selectedSchedule.status !== "Completed" && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleCompleteSchedule(selectedSchedule.id);
                                        }}
                                        className="h-10 px-4.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                                    >
                                        Mark Completed
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
