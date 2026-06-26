import { getUserFromRequest } from "@/lib/auth";
import DashboardKpiGrid from "@/components/admin/dashboard/DashboardKpiGrid";
import { AdminAppDataProvider, useAdminAppData } from "@/components/admin/AdminAppDataProvider";
import AdminCustomersTable from "@/components/admin/customers/AdminCustomersTable";
import AdminAmcTable from "@/components/admin/amc/AdminAmcTable";
import ServiceVisitsTable from "@/components/admin/service/ServiceVisitsTable";
import { clearSessionCache } from "@/lib/adminCache";
import { DataListSkeleton, MetricSkeletonGrid } from "@/components/ui/SkeletonLoaders";
import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
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

function formatGroupDate(dateStr) {
    if (!dateStr || dateStr === "Unknown Date") return "No Scheduled Date";
    try {
        const today = new Date("2026-06-20");
        const date = new Date(dateStr);

        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        const formatted = date.toLocaleDateString('en-US', options);

        if (dateStr === "2026-06-20") {
            return `Today - ${formatted}`;
        } else if (dateStr === "2026-06-19") {
            return `Yesterday - ${formatted}`;
        } else if (dateStr === "2026-06-21") {
            return `Tomorrow - ${formatted}`;
        }
        return formatted;
    } catch (e) {
        return dateStr;
    }
}

function ModuleOpenSkeleton() {
    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-150">
            <MetricSkeletonGrid count={4} />
            <DataListSkeleton columns={6} rows={5} minWidth="980px" />
        </div>
    );
}

function AdmindashboardShell({ user }) {
    const router = useRouter();
    const adminAppData = useAdminAppData();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("dashboard"); // bottom tabs: dashboard, customers, service, technicians, more
    const [moduleOpening, setModuleOpening] = useState(false);
    const moduleOpeningTimer = useRef(null);

    // Modals
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showNotificationCenter, setShowNotificationCenter] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [materialRequests, setMaterialRequests] = useState([]);
    const [modalTech, setModalTech] = useState("");
    const [modalStatus, setModalStatus] = useState("");

    // Parts allocation states
    const [allocatedParts, setAllocatedParts] = useState([]);
    const [tempPartName, setTempPartName] = useState("Door Roller Assembly");
    const [tempPartQty, setTempPartQty] = useState(1);

    const isFirstMount = useRef(true);

    useEffect(() => {
        if (selectedComplaint) {
            setAllocatedParts(selectedComplaint.allocatedParts || []);
        } else {
            setAllocatedParts([]);
        }
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
    const [inquiries, setInquiries] = useState([
        { id: 1, name: "Rajesh Kumar", company: "Skyline Residency", elevatorType: "Passenger Lift (10 Pax)", phone: "+91 98765 43210" },
        { id: 2, name: "Sneha Patel", company: "Grand Plaza Mall", elevatorType: "Freight Elevator (2 Ton)", phone: "+91 91234 56789" },
        { id: 3, name: "Dr. Amit Verma", company: "Care Hospital", elevatorType: "Stretcher Lift", phone: "+91 93456 78901" },
        { id: 4, name: "Vikram Singh", company: "Apex Corporate Park", elevatorType: "Capsule Glass Lift", phone: "+91 95678 12345" }
    ]);

    const [schedules, setSchedules] = useState([
        { id: 1, location: "Grand Plaza, Block A", technician: "Vijay K.", status: "Upcoming", lastService: "2026-05-20", nextService: "2026-06-22" },
        { id: 2, location: "Skyline Residency Lift 2", technician: "Suresh R.", status: "Scheduled", lastService: "2026-05-18", nextService: "2026-06-20" },
        { id: 3, location: "Care Hospital (Stretcher Lift)", technician: "Ramesh M.", status: "Overdue", lastService: "2026-04-15", nextService: "2026-05-15" }
    ]);

    // Form inputs for new Schedule
    const [newSchedule, setNewSchedule] = useState({
        location: "",
        lastService: "",
        nextService: "",
        technician: "Suresh R.",
        status: "Scheduled"
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

    // Onboarding form states
    const [newUserData, setNewUserData] = useState({
        username: "",
        password: "",
        name: "",
        role: "worker",
        phone: "",
    });

    // Mock KPI & CRM Lift ERP Data
    const [kpiCounts, setKpiCounts] = useState({
        totalCustomers: 342,
        activeAMC: 124,
        todayService: 8,
        openComplaints: 5,
        pendingInstallations: 12,
        upcomingMaintenance: 15,
        availTechnicians: 3,
        totalTechnicians: 4
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

    function showModuleSkeleton() {
        if (moduleOpeningTimer.current) {
            clearTimeout(moduleOpeningTimer.current);
        }
        setModuleOpening(true);
        moduleOpeningTimer.current = setTimeout(() => {
            setModuleOpening(false);
        }, 240);
    }

    function openTab(tab) {
        showModuleSkeleton();
        setActiveTab(tab);
        if (tab !== "more") setMoreSubTab(null);
        setSearchQuery("");
        setStatusFilter("all");
    }

    function openMoreSubTab(tab) {
        showModuleSkeleton();
        setActiveTab("more");
        setMoreSubTab(tab);
        setSearchQuery("");
        setStatusFilter("all");
    }

    useEffect(() => {
        return () => {
            if (moduleOpeningTimer.current) {
                clearTimeout(moduleOpeningTimer.current);
            }
        };
    }, []);

    // Today's Activities
    const [activities, setActivities] = useState([
        { id: 1, type: "Urgent Breakdown Check", site: "Skyline Residency Lift 2", time: "10:30 AM", status: "In Progress", color: "bg-red-500 text-white" },
        { id: 2, type: "Routine Monthly Service", site: "Grand Plaza, Block A", time: "01:00 PM", status: "Pending", color: "bg-amber-500 text-white" },
        { id: 3, type: "Installation Site Audit", site: "Apex Corporate Park", time: "03:30 PM", status: "Scheduled", color: "bg-[#0a649d] text-white" }
    ]);

    // Recent Complaints
    const [complaints, setComplaints] = useState([
        { id: "COMP-402", customer: "Apex Business Park", status: "In Progress", priority: "High", color: "text-red-600 bg-red-50 border-red-100", date: "2026-06-20", description: "Elevator cabin stuck between 3rd and 4th floor. Emergency alarm activated.", assignedTech: "" },
        { id: "COMP-405", customer: "Greenwood Apartments", status: "Open", priority: "Medium", color: "text-amber-600 bg-amber-50 border-amber-100", date: "2026-06-20", description: "Infrared safety door sensor not detecting obstructions. Doors closing rapidly.", assignedTech: "" },
        { id: "COMP-398", customer: "Dr. Amit (Care Hospital)", status: "Resolved", priority: "High", color: "text-emerald-600 bg-emerald-50 border-emerald-100", date: "2026-06-19", description: "Stretcher elevator landing indicator showing incorrect floor numbers.", assignedTech: "Ramesh M." },
        { id: "COMP-395", customer: "Royal Plaza Tower C", status: "Resolved", priority: "Medium", color: "text-amber-600 bg-amber-50 border-amber-100", date: "2026-06-18", description: "Cabin exhaust fan making loud rattling noise.", assignedTech: "Vijay K." },
        { id: "COMP-390", customer: "Skyline Residency Lift 1", status: "Resolved", priority: "Low", color: "text-slate-600 bg-slate-50 border-slate-100", date: "2026-06-15", description: "Emergency phone inside elevator cabin has static line noise.", assignedTech: "" }
    ]);

    // Sync complaints with localStorage
    useEffect(() => {
        const stored = localStorage.getItem("amardip_complaints");
        if (stored) {
            try {
                setComplaints(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse complaints from localStorage", e);
            }
        }
        const storedRequests = localStorage.getItem("amardip_material_requests");
        if (storedRequests) {
            try {
                setMaterialRequests(JSON.parse(storedRequests));
            } catch (e) {
                console.error("Failed to parse material requests from localStorage", e);
            }
        }
    }, []);

    const updateMaterialRequestsState = (newRequests) => {
        setMaterialRequests(newRequests);
        localStorage.setItem("amardip_material_requests", JSON.stringify(newRequests));
    };

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        localStorage.setItem("amardip_complaints", JSON.stringify(complaints));
    }, [complaints]);

    // Upcoming AMC Visits
    const [amcVisits, setAmcVisits] = useState([
        { id: 1, customer: "Grand Plaza", building: "Tower A, Passenger 1", dueDate: "2026-06-22", phone: "+91 98765 43210" },
        { id: 2, customer: "Supreme Mall", building: "South Entrance Freight", dueDate: "2026-07-01", phone: "+91 91234 56789" },
        { id: 3, customer: "Skyline Residency", building: "Service Elevator 2", dueDate: "2026-07-05", phone: "+91 93456 78901" }
    ]);

    // Technician availability list
    const [technicians, setTechnicians] = useState([
        { id: 1, name: "Suresh R.", role: "Senior Inspector", status: "On Duty", workload: "2/4 Jobs", phone: "+91 98765 00001", allocatedTask: "" },
        { id: 2, name: "Vijay K.", role: "Maintenance Specialist", status: "Available", workload: "1/4 Jobs", phone: "+91 98765 00002", allocatedTask: "" },
        { id: 3, name: "Ramesh M.", role: "Installation Lead", status: "Busy", workload: "3/5 Jobs", phone: "+91 98765 00003", allocatedTask: "" },
        { id: 4, name: "Ananya P.", role: "Diagnostics Expert", status: "Offline", workload: "0/3 Jobs", phone: "+91 98765 00004", allocatedTask: "" }
    ]);

    // Inventory and Staff States
    const [inventory, setInventory] = useState([
        { id: 1, name: "Geared Traction Motor (5.5 kW)", category: "Motors", qty: 4, unit: "units", status: "In Stock", code: "INV-MOT-09" },
        { id: 2, name: "Steel Wire Rope (10mm)", category: "Cables", qty: 250, unit: "meters", status: "In Stock", code: "INV-CAB-12" },
        { id: 3, name: "Infrared Multi-Beam Door Sensor", category: "Sensors", qty: 15, unit: "units", status: "In Stock", code: "INV-SEN-04" },
        { id: 4, name: "Microprocessor Controller Panel V4", category: "Control Board", qty: 1, unit: "unit", status: "Low Stock", code: "INV-CON-22" },
        { id: 5, name: "Emergency Cabin Guide Shoes", category: "Safety", qty: 0, unit: "units", status: "Out of Stock", code: "INV-SAF-15" }
    ]);

    const [staff, setStaff] = useState([
        { id: 1, name: "Amit Sharma", role: "operations manager", email: "amit.ops@smartlift.ai", phone: "+91 99887 76655" },
        { id: 2, name: "Karan Johar", role: "financial supervisor", email: "karan.fin@smartlift.ai", phone: "+91 98765 01234" },
        { id: 3, name: "Priya Nair", role: "customer service coordinator", email: "priya.cc@smartlift.ai", phone: "+91 97654 32109" }
    ]);

    const allocatableTasks = [
        "Complaint: COMP-402 (Elevator Breakdown)",
        "Complaint: COMP-405 (Sensor Fault)",
        "AMC Visit: Greenwood Apts",
        "AMC Visit: Supreme Mall",
        "Installation: Royal Residency Tower C",
        "Safety Audit: Care Hospital"
    ];

    // Recent Notifications
    const [notifications, setNotifications] = useState([
        { id: 1, category: "Complaint Raised", message: "Client Rajesh Kumar raised complaint #COMP-410 for Skyline Residency", time: "10 mins ago" },
        { id: 2, category: "AMC Expiring", message: "Annual Contract for Greenwood Apartments expires in 7 days", time: "2 hours ago" },
        { id: 3, category: "Service Completed", message: "Technician Vijay K. completed checkup at Greenwood", time: "4 hours ago" }
    ]);

    // Fetch database users directory (Only for Superadmin)
    async function fetchUsers() {
        if (user?.role !== "superadmin") return;
        setUsersLoading(true);
        try {
            const res = await fetch("/api/users");
            const data = await res.json();
            if (data.success) {
                setUsersList(data.users);
            }
        } catch (err) {
            console.error("Failed to load user directory:", err);
        } finally {
            setUsersLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab === "more") {
            fetchUsers();
        }
    }, [activeTab]);

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

            setOnboardSuccess(`Successfully created ${newUserData.role} account!`);
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

    function handleAddSchedule(e) {
        e.preventDefault();
        if (!newSchedule.location || !newSchedule.nextService) return;

        const newId = schedules.length ? Math.max(...schedules.map(s => s.id)) + 1 : 1;
        const scheduleToAdd = {
            id: newId,
            location: newSchedule.location,
            lastService: newSchedule.lastService || newSchedule.nextService,
            nextService: newSchedule.nextService,
            technician: newSchedule.technician,
            status: "Scheduled"
        };

        setSchedules(prev => [scheduleToAdd, ...prev]);

        // Update KPIs
        setKpiCounts(k => ({
            ...k,
            todayService: k.todayService + 1,
            upcomingMaintenance: k.upcomingMaintenance + 1
        }));

        // Add notification
        const newNotif = {
            id: notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
            category: "Service Scheduled",
            message: `New visit scheduled at ${newSchedule.location} with engineer ${newSchedule.technician}`,
            time: "Just now"
        };
        setNotifications(prev => [newNotif, ...prev]);

        // Reset form and close modal
        setNewSchedule({
            location: "",
            lastService: "",
            nextService: "",
            technician: "Suresh R.",
            status: "Scheduled"
        });
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
                <header className="sticky top-0 z-30 bg-[#0a649d] text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="h-10.5 w-10.5 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-extrabold text-sm text-[#59e0ff] uppercase shadow-inner">
                            {user?.name?.slice(0, 2) || "AD"}
                        </div>
                        <div>
                            <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest leading-none block">
                                {user?.role === "customer" ? "Amardip Elevators" : "Amardip Elevators"}
                            </span>
                            <span className="text-base font-extrabold tracking-tight leading-normal">Good Morning, {user?.name || "Admin"}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notification trigger */}
                        <button
                            onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                            className="relative h-10 w-10 bg-white/10 hover:bg-white/18 active:scale-95 transition flex items-center justify-center rounded-full"
                        >
                            <BellIcon className="h-5.5 w-5.5 text-white" />
                            <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 rounded-full bg-red-500 border-2 border-[#0a649d] flex items-center justify-center text-[9px] font-black text-white">
                                {notifications.length}
                            </span>
                        </button>
                    </div>
                </header>

                {/* NOTIFICATION CENTER DROPDOWN */}
                {showNotificationCenter && (
                    <div className="absolute top-16 left-0 right-0 z-40 mx-4 mt-2 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-top-3 duration-250 select-none">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Unread Alerts</span>
                            <button onClick={() => setShowNotificationCenter(false)} className="text-slate-400 hover:text-slate-600 text-xs font-semibold">Dismiss</button>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
                            {notifications.map(n => (
                                <div key={n.id} className="p-4 hover:bg-slate-50 transition text-xs">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-extrabold text-[#0a649d]">{n.category}</span>
                                        <span className="text-[10px] text-slate-400">{n.time}</span>
                                    </div>
                                    <p className="text-slate-600 font-medium leading-relaxed">{n.message}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 overflow-y-auto bg-[#f1f5f9] pb-24">

                    {moduleOpening ? (
                        <ModuleOpenSkeleton />
                    ) : (
                    <>
                    {/* TAB: DASHBOARD */}
                    {activeTab === "dashboard" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">

                            <DashboardKpiGrid
                                kpiCounts={kpiCounts}
                                customerStats={customerStats}
                                serviceStats={serviceStats}
                                statsLoading={dashboardStatsLoading}
                                setActiveTab={openTab}
                                setMoreSubTab={openMoreSubTab}
                            />

                            {/* Section 1: Today's Activities */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Today&apos;s Activities</h3>
                                    <span className="text-[10px] font-bold text-slate-400">{activities.length} Events</span>
                                </div>
                                <div className="space-y-4">
                                    {activities.map(a => (
                                        <div key={a.id} className="flex gap-4">
                                            <div className="text-center w-14 shrink-0">
                                                <p className="text-xs font-extrabold text-[#0a649d] leading-none">{a.time.split(" ")[0]}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wide">{a.time.split(" ")[1]}</p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-extrabold text-slate-800 truncate">{a.type}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{a.site}</p>
                                            </div>
                                            <span className={`h-fit text-[9px] font-bold px-2 py-0.5 rounded ${a.status === "In Progress" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                                                }`}>
                                                {a.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 2: Recent Complaints */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Recent Complaints</h3>
                                    <span className="text-[10px] font-bold text-slate-400">Interactive</span>
                                </div>
                                <div className="space-y-3.5">
                                    {complaints.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedComplaint(c);
                                                setModalTech(c.assignedTech || "");
                                                setModalStatus(c.status || "Open");
                                            }}
                                            className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100/60 transition active:scale-[0.99]"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-slate-900">{c.id}</span>
                                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm border ${c.color}`}>
                                                        {c.priority}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1 truncate">{c.customer}</p>
                                            </div>
                                            <div
                                                className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${c.status === "Resolved" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                    c.status === "In Progress" ? "bg-red-50 border-red-100 text-red-700" :
                                                        "bg-amber-50 border-amber-100 text-amber-700"
                                                    }`}
                                            >
                                                {c.status}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3: Upcoming AMC Visits */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Upcoming AMC Visits</h3>
                                </div>
                                <div className="space-y-3.5">
                                    {amcVisits.map(v => (
                                        <div key={v.id} className="flex justify-between items-center">
                                            <div className="min-w-0">
                                                <p className="text-xs font-extrabold text-slate-800 truncate">{v.customer}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{v.building}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1 leading-none">Due Date: <span className="text-slate-700">{v.dueDate}</span></p>
                                            </div>
                                            <a href={`tel:${v.phone}`} className="px-3 h-8.5 rounded-xl bg-[#0a649d] hover:bg-[#085282] text-white flex items-center justify-center gap-1.5 active:scale-95 transition text-[10px] font-black shadow-sm shrink-0">
                                                <PhoneIcon className="h-3.5 w-3.5" />
                                                <span>Call Now</span>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4: Technician Status */}
                            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Technician Status</h3>
                                    <span className="text-[10px] font-bold text-slate-400">Tap Status to Toggle</span>
                                </div>
                                <div className="space-y-3">
                                    {technicians.map(t => (
                                        <div key={t.id} className="flex justify-between items-center">
                                            <div className="min-w-0">
                                                <p className="text-xs font-extrabold text-slate-800">{t.name}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{t.role} • {t.workload}</p>
                                            </div>
                                            <button
                                                onClick={() => toggleTechnicianStatus(t.id)}
                                                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 ${t.status === "Available" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                    t.status === "On Duty" ? "bg-blue-50 border-blue-100 text-blue-700" :
                                                        t.status === "Busy" ? "bg-amber-50 border-amber-100 text-amber-700" :
                                                            "bg-slate-100 border-slate-200 text-slate-600"
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
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Service Complaints</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Elevator breakdown reports and ticket logs.</p>
                            </div>

                            {/* Search box & Filter tabs */}
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search complaints..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-11 w-full pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                    />
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 p-1 bg-slate-200/50 rounded-xl">
                                    {["all", "Open", "In Progress", "Resolved"].map(status => (
                                        <button
                                            key={status}
                                            onClick={() => setStatusFilter(status)}
                                            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition capitalize ${statusFilter === status ? "bg-[#0a649d] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                }`}
                                        >
                                            {status === "all" ? "All Tickets" : status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Complaints list */}
                            <div className="space-y-6">
                                {(() => {
                                    const filtered = complaints.filter(c => {
                                        const matchesSearch = c.id.toLowerCase().includes(searchQuery.toLowerCase()) || c.customer.toLowerCase().includes(searchQuery.toLowerCase());
                                        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
                                        return matchesSearch && matchesStatus;
                                    });

                                    const grouped = filtered.reduce((groups, item) => {
                                        const date = item.date || "Unknown Date";
                                        if (!groups[date]) {
                                            groups[date] = [];
                                        }
                                        groups[date].push(item);
                                        return groups;
                                    }, {});

                                    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

                                    if (sortedDates.length === 0) {
                                        return (
                                            <p className="text-center text-xs text-slate-400 py-6">No matching complaints found.</p>
                                        );
                                    }

                                    return sortedDates.map(date => (
                                        <div key={date} className="space-y-2">
                                            <div className="flex items-center gap-2 px-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#0a649d]"></span>
                                                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{formatGroupDate(date)}</h4>
                                            </div>
                                            <div className="space-y-2.5">
                                                {grouped[date].map(c => (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => {
                                                            setSelectedComplaint(c);
                                                            setModalTech(c.assignedTech || "");
                                                            setModalStatus(c.status || "Open");
                                                        }}
                                                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition active:scale-[0.99]"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-slate-900">{c.id}</span>
                                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm border ${c.color}`}>
                                                                    {c.priority}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 mt-1 truncate">{c.customer}</p>
                                                        </div>
                                                        <div
                                                            className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${c.status === "Resolved" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                                                c.status === "In Progress" ? "bg-red-50 border-red-100 text-red-700" :
                                                                    "bg-amber-50 border-amber-100 text-amber-700"
                                                                }`}
                                                        >
                                                            {c.status}
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

                    {/* TAB: SERVICE */}
                    {activeTab === "service" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-slate-900">Maintenance & Service</h1>
                                    <p className="text-xs text-slate-500 mt-0.5">Manage AMC visits and checkoff reports.</p>
                                </div>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="h-9 w-9 rounded-xl bg-[#0a649d] text-white flex items-center justify-center shadow-md active:scale-95 transition"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Service schedules */}
                            <div className="space-y-6">
                                {(() => {
                                    const grouped = schedules.reduce((groups, item) => {
                                        const date = item.nextService || "Unknown Date";
                                        if (!groups[date]) {
                                            groups[date] = [];
                                        }
                                        groups[date].push(item);
                                        return groups;
                                    }, {});

                                    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

                                    if (sortedDates.length === 0) {
                                        return (
                                            <p className="text-center text-xs text-slate-400 py-6">No scheduled services.</p>
                                        );
                                    }

                                    return sortedDates.map(date => (
                                        <div key={date} className="space-y-2">
                                            <div className="flex items-center gap-2 px-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#0a649d]"></span>
                                                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{formatGroupDate(date)}</h4>
                                            </div>
                                            <div className="space-y-3">
                                                {grouped[date].map(sch => (
                                                    <div 
                                                        key={sch.id} 
                                                        onClick={() => setSelectedSchedule(sch)}
                                                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#0a649d]/40 transition"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="min-w-0">
                                                                <h3 className="text-sm font-extrabold text-slate-900 truncate">{sch.location}</h3>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">Engineer: <span className="font-semibold text-slate-600">{sch.technician}</span></p>
                                                            </div>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${sch.status === "Overdue" ? "bg-red-100 text-red-800 animate-pulse" :
                                                                sch.status === "Upcoming" ? "bg-amber-100 text-amber-800" :
                                                                    sch.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                                                                        "bg-blue-100 text-blue-800"
                                                                }`}>
                                                                {sch.status}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                                            <span className="text-slate-400 font-semibold">Due: {sch.nextService}</span>
                                                            {sch.status !== "Completed" && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleCompleteSchedule(sch.id); }}
                                                                    className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-3 py-1 rounded-lg font-bold transition cursor-pointer"
                                                                >
                                                                    Mark Done
                                                                </button>
                                                            )}
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
                    {activeTab === "technicians" && (
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
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openMoreSubTab(null)}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Customers</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Real customer service records.</p>
                                        </div>
                                    </div>

                                    <AdminCustomersTable user={user} embedded />
                                </div>
                            ) : moreSubTab === "amc" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openMoreSubTab(null)}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Active AMCs</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Real AMC customer records.</p>
                                        </div>
                                    </div>

                                    <AdminAmcTable user={user} embedded />
                                </div>
                            ) : moreSubTab === "serviceVisits" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openMoreSubTab(null)}
                                            className="h-8.5 w-8.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 active:scale-95 transition"
                                        >
                                            <svg className="h-4 w-4 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div>
                                            <h1 className="text-xl font-black tracking-tight text-slate-900">Service Visits</h1>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Real service ledger and visit history.</p>
                                        </div>
                                    </div>

                                    <ServiceVisitsTable user={user} embedded />
                                </div>
                            ) : moreSubTab === "inventory" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openMoreSubTab(null)}
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
                                            className="h-11 w-full pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
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
                            ) : moreSubTab === "staff" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openMoreSubTab(null)}
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
                                            className="h-11 w-full pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
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
                                            onClick={() => openMoreSubTab(null)}
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
                                                    <span className="font-extrabold text-slate-800">{kpiCounts.activeAMC}</span>
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
                                            onClick={() => openMoreSubTab(null)}
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
                                            <div className="h-14 w-14 rounded-full bg-[#0a649d] text-white flex items-center justify-center text-lg font-black uppercase">
                                                {user?.name?.slice(0, 2) || "AD"}
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
                                </div>
                            ) : moreSubTab === "notifications" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => openMoreSubTab(null)}
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
                            ) : moreSubTab === "approvals" ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openMoreSubTab(null)}
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
                                            className="h-11 w-full pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
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
                                                .filter(r => r.partName.toLowerCase().includes(searchQuery.toLowerCase()) || (r.technicianName || "Suresh R.").toLowerCase().includes(searchQuery.toLowerCase()))
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
                                                                <p className="text-[10px] text-slate-400 mt-0.5">Technician: <span className="font-semibold text-slate-600">{r.technicianName || r.technician || "Suresh R."}</span></p>
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
                                        {/* Manage Leads Button */}
                                        <button
                                            onClick={() => openMoreSubTab("customers")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Manage Leads</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">Track customer inquiries and new elevator requests</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>

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
                                                <p className="text-center text-xs text-slate-400 py-4">Querying database...</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {usersList.map(u => (
                                                        <div key={u.id} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 flex items-center justify-between">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-extrabold text-slate-800 truncate">{u.name}</p>
                                                                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">@{u.username} • <span className="capitalize text-[#0a649d]">{u.role}</span></p>
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
                    )}

                </main>

                {/* BOTTOM NAVIGATION BAR */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#0a2540] border-t border-slate-800 text-white flex justify-around items-center z-50 px-1 pb-safe">
                    <button
                        onClick={() => openTab("dashboard")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "dashboard" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <OverviewIcon className="h-5 w-5 mb-0.5" />
                        <span className="text-[9px] font-bold tracking-tight">Dashboard</span>
                    </button>

                    <button
                        onClick={() => openTab("complaints")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 relative ${activeTab === "complaints" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <AlertIcon className="h-5 w-5 mb-0.5" />
                        <span className="text-[9px] font-bold tracking-tight">Complaints</span>
                        {kpiCounts.openComplaints > 0 && (
                            <span className="absolute top-1 right-2 sm:right-4 inline-flex items-center justify-center h-4 w-4 text-[8px] font-black bg-red-500 text-white rounded-full">
                                {kpiCounts.openComplaints}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => openTab("service")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 relative ${activeTab === "service" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <ServiceIcon className="h-5 w-5 mb-0.5" />
                        <span className="text-[9px] font-bold tracking-tight">Service</span>
                        {kpiCounts.todayService > 0 && (
                            <span className="absolute top-1 right-2 sm:right-4 inline-flex items-center justify-center h-4 w-4 text-[8px] font-black bg-[#59e0ff] text-[#0a2540] rounded-full">
                                {kpiCounts.todayService}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => openTab("technicians")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "technicians" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <TechniciansIcon className="h-5 w-5 mb-0.5" />
                        <span className="text-[9px] font-bold tracking-tight">Techs</span>
                    </button>

                    <button
                        onClick={() => openTab("more")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "more" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <MoreIcon className="h-5 w-5 mb-0.5" />
                        <span className="text-[9px] font-bold tracking-tight">More</span>
                    </button>
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
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Building Site Location</label>
                                <input
                                    type="text"
                                    required
                                    value={newSchedule.location}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, location: e.target.value })}
                                    placeholder="e.g. Royal Residency Towers"
                                    className="h-10.5 w-full px-4 rounded-xl border border-slate-200 text-base outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.1)] transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Last Service Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newSchedule.lastService}
                                        onChange={(e) => setNewSchedule({ ...newSchedule, lastService: e.target.value })}
                                        className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Next Service Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newSchedule.nextService}
                                        onChange={(e) => setNewSchedule({ ...newSchedule, nextService: e.target.value })}
                                        className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assign Technician</label>
                                <select
                                    value={newSchedule.technician}
                                    onChange={(e) => setNewSchedule({ ...newSchedule, technician: e.target.value })}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.name}>{t.name} ({t.role})</option>
                                    ))}
                                </select>
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

            {/* MODAL: COMPLAINT DETAILS & ASSIGNMENT */}
            {selectedComplaint && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4.5 bg-[#0a649d] text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold">Complaint Ticket</h2>
                                <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">{selectedComplaint.id}</p>
                            </div>
                            <button
                                onClick={() => setSelectedComplaint(null)}
                                className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Detail items */}
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer / Site</span>
                                <p className="text-sm font-extrabold text-slate-800">{selectedComplaint.customer}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged Date</span>
                                    <p className="text-xs font-bold text-slate-700">{formatGroupDate(selectedComplaint.date)}</p>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</span>
                                    <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded border mt-1 ${selectedComplaint.color}`}>
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

                            {/* Status Change */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ticket Status</label>
                                <select
                                    value={modalStatus}
                                    onChange={(e) => {
                                        setModalStatus(e.target.value);
                                        handleUpdateComplaintStatus(selectedComplaint.id, e.target.value);
                                    }}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Resolved">Resolved</option>
                                </select>
                            </div>

                            {/* Tech Assignment */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assign Technician</label>
                                <select
                                    value={modalTech}
                                    onChange={(e) => setModalTech(e.target.value)}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.name}>{t.name} ({t.status})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Allocate Spare Parts */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase pl-0.5">Allocate Spare Parts</label>
                                <div className="flex gap-2">
                                    <select
                                        value={tempPartName}
                                        onChange={(e) => setTempPartName(e.target.value)}
                                        className="h-9 flex-1 px-2.5 rounded-lg border border-slate-200 text-xs bg-white outline-none focus:border-[#0a649d] cursor-pointer"
                                    >
                                        <option>Door Roller Assembly</option>
                                        <option>24V Control Relay</option>
                                        <option>Limit Switch block</option>
                                        <option>Traction Brake Lining</option>
                                        <option>Governor Safety Cable</option>
                                        <option>Car Guide Shoe</option>
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={tempPartQty}
                                        onChange={(e) => setTempPartQty(parseInt(e.target.value) || 1)}
                                        className="h-9 w-14 px-2 rounded-lg border border-slate-200 text-xs bg-white outline-none focus:border-[#0a649d] text-center font-bold"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddPart}
                                        className="h-9 px-3 bg-[#0a649d] text-white rounded-lg text-xs font-bold hover:bg-[#085282] transition cursor-pointer"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Allocated list */}
                                {allocatedParts.length > 0 && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                                        {allocatedParts.map((p, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-700">{p.partName} x {p.quantity}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePart(p.partName)}
                                                    className="text-red-500 hover:text-red-700 font-extrabold text-[10px] bg-transparent border-0 cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
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
                                    onClick={() => handleAssignComplaint(selectedComplaint.id, modalTech)}
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
                                {selectedSchedule.status === "Completed" ? (
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col">
                                            <div className="h-24 bg-gradient-to-br from-slate-200 to-slate-300 relative flex items-center justify-center text-slate-500 font-bold text-xs select-none">
                                                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="absolute bottom-1 right-2 bg-emerald-500 text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded">Post-Service</span>
                                            </div>
                                            <div className="p-1.5 bg-white border-t border-slate-100 text-center">
                                                <p className="text-[9px] font-bold text-slate-700">Gearbox Lube Check</p>
                                                <p className="text-[8px] text-slate-400 mt-0.5">Suresh R. • 10:45 AM</p>
                                            </div>
                                        </div>
                                        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col">
                                            <div className="h-24 bg-gradient-to-br from-slate-200 to-slate-300 relative flex items-center justify-center text-slate-500 font-bold text-xs select-none">
                                                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="absolute bottom-1 right-2 bg-emerald-500 text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded">Post-Service</span>
                                            </div>
                                            <div className="p-1.5 bg-white border-t border-slate-100 text-center">
                                                <p className="text-[9px] font-bold text-slate-700">Door Rail Clearance</p>
                                                <p className="text-[8px] text-slate-400 mt-0.5">Suresh R. • 11:15 AM</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
                                        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                                            No photos available yet.<br />
                                            Technician has not uploaded service evidence.
                                        </p>
                                    </div>
                                )}
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
