import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getUserFromRequest } from "@/lib/auth";
import Image from "next/image";
import { subscribeToPush } from "@/lib/pushClient";
import PushNotificationCard from "@/components/ui/PushNotificationCard";

const UNITS = ["Nos", "Meter", "Kg", "Set", "Roll", "Box", "Packet", "Litre", "Other"];

const PRIMARY_COLOR = "#0a649d";

export async function getServerSideProps(context) {
    const user = await getUserFromRequest(context.req);

    if (!user) {
        return {
            redirect: {
                destination: "/Storelogin",
                permanent: false,
            },
        };
    }

    if (user.role !== "storekeeper") {
        return {
            redirect: {
                destination: user.role === "customer" 
                    ? "/Customerdashboard" 
                    : (user.role === "worker" ? "/Techniciandashboard" : "/Admindashboard"),
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

function InventoryIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
    );
}

function RequestsIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
    );
}

function TransactionsIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
    );
}

function ProfileIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

function CloseIcon({ className = "h-5 w-5" }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

export default function Storedashboard({ user }) {
    const router = useRouter();

    useEffect(() => {
        subscribeToPush().catch(() => {});
    }, []);

    const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, inventory, requests, transactions, profile
    const [searchQuery, setSearchQuery] = useState("");

    // Modals
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [showUpdateStockModal, setShowUpdateStockModal] = useState(false);
    const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
    const [showQrScanner, setShowQrScanner] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { token, job, editableItems }
    const [scannerStatus, setScannerStatus] = useState("Point the camera at the technician's Store Pass QR");
    const scannerRef = useRef(null);
    const [addItemSearchResults, setAddItemSearchResults] = useState([]);
    const [addItemQuery, setAddItemQuery] = useState("");

    // Profile password states
    const [passwordVal, setPasswordVal] = useState("store123");
    const [profileMsg, setProfileMsg] = useState("");
    const [profileErr, setProfileErr] = useState("");

    // Return Form state
    const [returnForm, setReturnForm] = useState({
        techName: "",
        partName: "",
        quantity: 1,
        reason: ""
    });

    // Form inputs for adding stock
    const [newStock, setNewStock] = useState({
        partName: "",
        unit: "Nos",
        quantity: 0
    });

    // Form inputs for updating stock
    const [updateStockQty, setUpdateStockQty] = useState(0);
    const [updateRemarks, setUpdateRemarks] = useState("");

    // Real inventory/requests/transactions — fetched from Postgres-backed APIs
    const [inventory, setInventory] = useState([]);
    const [materialRequests, setMaterialRequests] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loadingInventory, setLoadingInventory] = useState(true);

    async function refreshInventory() {
        setLoadingInventory(true);
        try {
            const res = await fetch("/api/inventory");
            const data = await res.json();
            if (data.success) setInventory(data.items);
        } finally {
            setLoadingInventory(false);
        }
    }

    async function refreshRequests() {
        const res = await fetch("/api/admin/materials");
        const data = await res.json();
        if (data.success) setMaterialRequests(data.requests);
    }

    async function refreshTransactions() {
        const res = await fetch("/api/store/transactions");
        const data = await res.json();
        if (data.success) setTransactions(data.transactions);
    }

    useEffect(() => {
        refreshInventory();
        refreshRequests();
        refreshTransactions();
    }, []);

    // Debounced real inventory search for adding an ad-hoc item during a scan
    useEffect(() => {
        const query = addItemQuery.trim();
        if (!query) {
            setAddItemSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/inventory?search=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.success) setAddItemSearchResults(data.items);
            } catch {
                setAddItemSearchResults([]);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [addItemQuery]);

    // Password reset
    const handlePasswordChange = (e) => {
        e.preventDefault();
        setProfileErr("");
        setProfileMsg("");

        if (!passwordVal.trim()) {
            setProfileErr("Password cannot be empty.");
            return;
        }

        setProfileMsg("Security password changed successfully!");
    };

    // Logout
    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/Storelogin");
        } catch (e) {
            router.push("/Storelogin");
        }
    };

    // Issue request directly from Requests Tab
    // Real camera-based QR scanning (html5-qrcode) — feeds /api/store/scan
    async function startCameraScanner() {
        setShowQrScanner(true);
        setScannerStatus("Point the camera at the technician's Store Pass QR");
        setTimeout(async () => {
            const { Html5Qrcode } = await import("html5-qrcode");
            const scanner = new Html5Qrcode("qr-reader");
            scannerRef.current = scanner;
            try {
                await scanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: 240 },
                    async (decodedText) => {
                        try { await scanner.stop(); } catch {}
                        scannerRef.current = null;
                        setShowQrScanner(false);
                        await handleTokenScanned(decodedText);
                    },
                    () => {}
                );
            } catch (err) {
                setScannerStatus("Camera unavailable: " + err.message);
            }
        }, 50);
    }

    async function stopCameraScanner() {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch {}
            scannerRef.current = null;
        }
        setShowQrScanner(false);
    }

    async function handleTokenScanned(token) {
        const res = await fetch("/api/store/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!data.success) {
            alert(data.message || "Invalid or expired store pass.");
            return;
        }
        setScanResult({
            token,
            job: data.job,
            editableItems: data.materialRequests.map(r => ({ itemId: r.itemId, name: r.itemName, unit: r.itemUnit, quantity: r.requestedQuantity })),
        });
    }

    function adjustScanItemQty(index, quantity) {
        if (quantity < 0) return;
        setScanResult(prev => ({ ...prev, editableItems: prev.editableItems.map((it, i) => i === index ? { ...it, quantity } : it) }));
    }

    function removeScanItem(index) {
        setScanResult(prev => ({ ...prev, editableItems: prev.editableItems.filter((_, i) => i !== index) }));
    }

    function addScanItem(item) {
        setScanResult(prev => ({ ...prev, editableItems: [...prev.editableItems, { itemId: item.id, name: item.name, unit: item.unit, quantity: 1 }] }));
        setAddItemQuery("");
        setAddItemSearchResults([]);
    }

    async function confirmScanIssue() {
        const items = scanResult.editableItems.filter(it => it.quantity > 0).map(it => ({ itemId: it.itemId, quantity: it.quantity }));
        if (items.length === 0) {
            alert("Add at least one item before confirming.");
            return;
        }
        const res = await fetch("/api/store/issue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: scanResult.token, items }),
        });
        const data = await res.json();
        if (!data.success) {
            alert(data.message || "Failed to issue materials.");
            return;
        }
        alert(`Issued to ${scanResult.job.assignedTechnicianName}:\n` + data.issued.map(i => `${i.quantity} ${i.unit} x ${i.name}`).join("\n"));
        setScanResult(null);
        refreshInventory();
        refreshRequests();
        refreshTransactions();
    }

    // Save Stock form
    async function handleSaveStock(e) {
        e.preventDefault();
        const res = await fetch("/api/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newStock.partName, unit: newStock.unit, stockQuantity: Number(newStock.quantity) }),
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); return; }
        setShowAddStockModal(false);
        setNewStock({ partName: "", unit: "Nos", quantity: 0 });
        refreshInventory();
        refreshTransactions();
        alert(`Stock saved successfully!\n${newStock.quantity} ${newStock.unit} of ${newStock.partName} added to inventory.`);
    }

    // Update Stock modal save
    async function handleSaveUpdateStock(e) {
        e.preventDefault();
        if (!selectedInventoryItem) return;
        const res = await fetch(`/api/inventory/${selectedInventoryItem.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newQuantity: Number(updateStockQty), notes: updateRemarks }),
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); return; }
        setShowUpdateStockModal(false);
        setSelectedInventoryItem(null);
        refreshInventory();
        refreshTransactions();
        alert("Stock level adjusted successfully!");
    }

    // Material return form submission
    async function handleReturnSubmit(e) {
        e.preventDefault();
        const targetItem = inventory.find(i => i.name.toLowerCase() === returnForm.partName.toLowerCase());
        if (!targetItem) {
            alert("Item not found in inventory — add it first via the Inventory tab.");
            return;
        }
        const res = await fetch("/api/store/return", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: targetItem.id, quantity: Number(returnForm.quantity), notes: returnForm.reason }),
        });
        const data = await res.json();
        if (!data.success) { alert(data.message); return; }

        setReturnForm({ techName: "", partName: "", quantity: 1, reason: "" });
        refreshInventory();
        refreshTransactions();
        alert("Returned parts credited to store inventory!");
    }

    // Dynamic metrics counts
    const totalPartsCount = inventory.length;
    const outOfStockCount = inventory.filter(i => i.stockQuantity <= 0).length;
    const pendingReqsCount = materialRequests.filter(r => r.status === "pending" || r.status === "approved").length;
    const todayIssuesCount = transactions.filter(t => t.type === "issue" && new Date(t.createdAt).toDateString() === new Date().toDateString()).length;
    const recentTxnsCount = transactions.length;

    // Filtered inventory listing
    const filteredInventory = inventory.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
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
                                {user?.name || "Rajesh K. (Store)"}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={startCameraScanner}
                        className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition flex items-center gap-1 text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm border border-emerald-500"
                    >
                        <ScanIcon className="h-4.5 w-4.5" />
                        Scan QR
                    </button>
                </header>

                {/* Real camera QR scanner (html5-qrcode) */}
                {showQrScanner && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col justify-between text-white p-6">
                        <div className="flex justify-between items-center mt-6">
                            <span className="font-extrabold text-base tracking-tight">Scan Store Pass</span>
                            <button onClick={stopCameraScanner} className="h-9 w-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20">
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="my-auto flex flex-col items-center">
                            <div id="qr-reader" className="h-64 w-64 rounded-2xl overflow-hidden border-2 border-dashed border-[#59e0ff]" />
                            <p className="text-sm font-semibold mt-6 text-slate-300 text-center px-4">{scannerStatus}</p>
                        </div>

                        <div className="mb-6" />
                    </div>
                )}

                {/* Scan Result: editable material issue */}
                {scanResult && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90dvh] flex flex-col">
                            <div className="px-5 py-4 bg-[#0a649d] text-white flex justify-between items-center shrink-0">
                                <div>
                                    <h2 className="text-sm font-bold truncate">Confirm Material Issue</h2>
                                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">{scanResult.job.complaintNo}</p>
                                </div>
                                <button onClick={() => setScanResult(null)} className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 text-left space-y-4 overflow-y-auto">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                                    <p><strong className="text-slate-800">Technician:</strong> {scanResult.job.assignedTechnicianName}</p>
                                    <p><strong className="text-slate-800">Customer:</strong> {scanResult.job.customerName}</p>
                                </div>

                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-0.5">Parts to be Handed Over</h4>
                                    <div className="space-y-2">
                                        {scanResult.editableItems.length === 0 && (
                                            <p className="text-xs text-slate-400 text-center py-3">No items yet — search below to add one.</p>
                                        )}
                                        {scanResult.editableItems.map((it, idx) => (
                                            <div key={`${it.itemId}-${idx}`} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                                                <div>
                                                    <span className="font-extrabold text-slate-800">{it.name}</span>
                                                    <span className="block text-[10px] text-slate-400">{it.unit}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustScanItemQty(idx, it.quantity - 1)}
                                                            className="h-6 w-6 rounded-lg flex items-center justify-center font-black text-slate-500 hover:bg-red-50 hover:text-red-600 active:scale-90 transition text-sm cursor-pointer select-none bg-slate-50"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-6 text-center font-black text-slate-800 text-xs select-none">{it.quantity}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustScanItemQty(idx, it.quantity + 1)}
                                                            className="h-6 w-6 rounded-lg flex items-center justify-center font-black text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 active:scale-90 transition text-sm cursor-pointer select-none bg-slate-50"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeScanItem(idx)}
                                                        className="h-6 w-6 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 active:scale-90 transition"
                                                    >
                                                        <CloseIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="relative">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Add another item</label>
                                    <input
                                        type="text"
                                        value={addItemQuery}
                                        onChange={(e) => setAddItemQuery(e.target.value)}
                                        placeholder="Search inventory..."
                                        className="h-10 w-full px-3 rounded-xl border border-slate-200 text-sm outline-none bg-white focus:border-[#0a649d]"
                                    />
                                    {addItemSearchResults.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                            {addItemSearchResults.map(item => (
                                                <button
                                                    type="button"
                                                    key={item.id}
                                                    onClick={() => addScanItem(item)}
                                                    className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                                                >
                                                    {item.name} <span className="text-slate-400">({item.stockQuantity} {item.unit})</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2.5 pt-2">
                                    <button
                                        onClick={() => setScanResult(null)}
                                        className="h-11 flex-1 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmScanIssue}
                                        className="h-11 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition active:scale-95"
                                    >
                                        Confirm Issue
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Workspace content */}
                <main className="amardip-app-main flex-1 overflow-y-auto bg-[#f1f5f9]">

                    {/* VIEW: DASHBOARD TAB */}
                    {activeTab === "dashboard" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            
                            {/* Greeting card */}
                            <div className="rounded-3xl p-5 text-white shadow-md relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #1e4b7a 65%, #0e2a4a 100%)` }}>
                                <div className="absolute top-0 right-0 h-28 w-28 bg-white/5 rounded-full -mr-8 -mt-8"></div>
                                <span className="text-[10px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                                    Store Operational
                                </span>
                                <h2 className="text-xl font-black mt-3 leading-tight">Store Dashboard</h2>
                                <p className="text-[10.5px] text-white/80 font-semibold mt-1">Rajesh K. | Depot East Main Hub</p>
                            </div>

                            {/* Quick Actions grid */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Quick Operations</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={startCameraScanner}
                                        className="h-20 bg-white border border-slate-200/60 rounded-3xl p-4.5 flex flex-col justify-between items-start text-left shadow-sm active:scale-98 transition cursor-pointer"
                                    >
                                        <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <ScanIcon className="h-4.5 w-4.5" />
                                        </div>
                                        <span className="text-xs font-black text-slate-800">Scan Pickup QR</span>
                                    </button>

                                    <button
                                        onClick={() => { setActiveTab("inventory"); setShowAddStockModal(true); }}
                                        className="h-20 bg-white border border-slate-200/60 rounded-3xl p-4.5 flex flex-col justify-between items-start text-left shadow-sm active:scale-98 transition cursor-pointer"
                                    >
                                        <div className="h-7 w-7 rounded-lg bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                        </div>
                                        <span className="text-xs font-black text-slate-800">Add Stock</span>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab("requests")}
                                        className="h-20 bg-white border border-slate-200/60 rounded-3xl p-4.5 flex flex-col justify-between items-start text-left shadow-sm active:scale-98 transition cursor-pointer"
                                    >
                                        <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                            <RequestsIcon className="h-4.5 w-4.5" />
                                        </div>
                                        <span className="text-xs font-black text-slate-800">View Requests</span>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab("transactions")}
                                        className="h-20 bg-white border border-slate-200/60 rounded-3xl p-4.5 flex flex-col justify-between items-start text-left shadow-sm active:scale-98 transition cursor-pointer"
                                    >
                                        <div className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                                            <TransactionsIcon className="h-4.5 w-4.5" />
                                        </div>
                                        <span className="text-xs font-black text-slate-800">Transactions Log</span>
                                    </button>
                                </div>
                            </div>

                            {/* KPI Metrics */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Inventory Metrics</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm h-24 flex flex-col justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Spare Parts</span>
                                        <span className="text-3xl font-black text-slate-800">{totalPartsCount}</span>
                                    </div>

                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm h-24 flex flex-col justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Issues</span>
                                        <span className="text-3xl font-black text-emerald-600">{todayIssuesCount}</span>
                                    </div>

                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm h-24 flex flex-col justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Requests</span>
                                        <span className="text-3xl font-black text-[#0a649d]">{pendingReqsCount}</span>
                                    </div>

                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm h-24 flex flex-col justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Out of Stock</span>
                                        <span className="text-3xl font-black text-red-600">{outOfStockCount}</span>
                                    </div>

                                    <div className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm h-24 flex flex-col justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recent Logs</span>
                                        <span className="text-3xl font-black text-slate-500">{recentTxnsCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW: INVENTORY MANAGEMENT */}
                    {activeTab === "inventory" && (
                        <div className="p-4 space-y-5 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans">Inventory Management</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Add, update and search elevator spare parts.</p>
                            </div>

                            {/* Search controls */}
                            <input
                                type="text"
                                placeholder="Search by part name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-11 w-full px-4 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition font-medium"
                            />

                            {/* Add stock trigger */}
                            <button
                                onClick={() => setShowAddStockModal(true)}
                                className="h-12 w-full bg-[#0a649d] text-white hover:bg-[#085282] rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                Save/Add Stock Parts
                            </button>

                            {/* Inventory List */}
                            <div className="space-y-3">
                                {loadingInventory ? (
                                    <p className="text-xs text-slate-400 text-center py-8 font-semibold">Loading inventory...</p>
                                ) : filteredInventory.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-8 font-semibold">No spare parts match your filters.</p>
                                ) : (
                                    filteredInventory.map((item) => (
                                        <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-3.5 relative">
                                            {/* Top info row */}
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-800">{item.name}</h3>
                                                    <p className="text-[10.5px] text-slate-400 font-bold mt-0.5">Unit: {item.unit}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                    item.stockQuantity > 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                                                }`}>
                                                    {item.stockQuantity > 0 ? "In Stock" : "Out of Stock"}
                                                </span>
                                            </div>

                                            {/* Quantity status bar */}
                                            <div className="flex justify-between items-center pt-1 text-xs">
                                                <div>
                                                    <span className="text-slate-400 font-bold block">Available Qty</span>
                                                    <span className="text-lg font-black text-slate-800">{item.stockQuantity} {item.unit}</span>
                                                </div>
                                            </div>

                                            {/* Action row */}
                                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        setSelectedInventoryItem(item);
                                                        setUpdateStockQty(item.stockQuantity);
                                                        setUpdateRemarks("");
                                                        setShowUpdateStockModal(true);
                                                    }}
                                                    className="h-9 flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200"
                                                >
                                                    Update Quantity
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW: MATERIAL REQUESTS */}
                    {activeTab === "requests" && (
                        <div className="p-4 space-y-5 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Material Requests</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Approve, reject or dispatch requested technician materials.</p>
                            </div>

                            <p className="text-[10px] text-slate-400 -mt-2 px-1">
                                Approval happens in the admin app. Scan a technician&apos;s Store Pass QR to actually issue parts.
                            </p>

                            <div className="space-y-3.5">
                                {materialRequests.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-8 font-semibold">No active material requests.</p>
                                ) : (
                                    materialRequests.map((req) => (
                                        <div key={req.id} className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                            {/* Top Line */}
                                            <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">REQ-{req.id} • {new Date(req.createdAt).toLocaleDateString("en-IN")}</span>
                                                    <h3 className="text-sm font-black text-slate-800 mt-1">{req.itemName}</h3>
                                                    <p className="text-xs font-semibold text-slate-500 mt-0.5">Requested by: {req.requestedByName || "Technician"}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                                    req.status === "approved" ? "bg-sky-50 text-[#0a649d] border border-sky-100" :
                                                    (req.status === "issued" || req.status === "partially_issued" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                     (req.status === "rejected" ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"))
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                                                <div>
                                                    <span className="block text-[9.5px] font-bold text-slate-400 uppercase">Quantity Requested</span>
                                                    <span className="font-extrabold text-slate-800">{req.requestedQuantity} {req.itemUnit}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9.5px] font-bold text-slate-400 uppercase">Issued So Far</span>
                                                    <span className="font-extrabold text-slate-800">{req.issuedQuantity} {req.itemUnit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW: TRANSACTION HISTORY & RETURNS */}
                    {activeTab === "transactions" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Digital logs & Returns</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Chronological record of depot stock movements.</p>
                            </div>

                            {/* MATERIAL RETURN SCREEN */}
                            <form onSubmit={handleReturnSubmit} className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-50 pb-2">Material Return Slip</h3>
                                <div className="space-y-4 text-xs font-semibold">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Technician Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={returnForm.techName}
                                            onChange={(e) => setReturnForm(prev => ({ ...prev, techName: e.target.value }))}
                                            className="h-11 w-full px-3.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d]"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Material Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={returnForm.partName}
                                                onChange={(e) => setReturnForm(prev => ({ ...prev, partName: e.target.value }))}
                                                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Quantity Returned</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={returnForm.quantity}
                                                onChange={(e) => setReturnForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d]"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Return Reason</label>
                                        <textarea
                                            required
                                            value={returnForm.reason}
                                            onChange={(e) => setReturnForm(prev => ({ ...prev, reason: e.target.value }))}
                                            className="h-20 w-full p-3 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d]"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="h-11 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-sm mt-1 cursor-pointer"
                                    >
                                        Save & Return to Inventory
                                    </button>
                                </div>
                            </form>

                            {/* TRANSACTIONS LIST */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Transaction Ledger</h3>
                                <div className="space-y-3">
                                    {transactions.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-8 font-semibold">No stock movements logged yet.</p>
                                    ) : (
                                        transactions.map((t) => (
                                            <div key={t.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-xs space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-extrabold text-slate-800 capitalize">{t.type}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{new Date(t.createdAt).toLocaleDateString("en-IN")}</span>
                                                </div>
                                                <p className="text-slate-600 font-medium">
                                                    {Math.abs(t.quantityDelta)} {t.itemUnit} x {t.itemName}
                                                </p>
                                                <span className="block text-[9.5px] text-slate-400 font-bold uppercase">Log: TXN-{t.id} • Operator: {t.performedByName || t.workerName || "—"}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW: PROFILE TAB */}
                    {activeTab === "profile" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">Profile & Info</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Operator identity verification and security.</p>
                            </div>

                            {/* Store employee info */}
                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-center space-y-4">
                                <div className="h-16 w-16 bg-[#0a649d]/10 text-[#0a649d] border border-[#0a649d]/20 rounded-full flex items-center justify-center font-black text-xl mx-auto shadow-inner">
                                    RK
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Rajesh K.</h2>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Depot Storekeeper</span>
                                </div>

                                <hr className="border-slate-100" />

                                <div className="text-left text-xs text-slate-650 space-y-2 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                                    <p><strong className="text-slate-800">Employee Code:</strong> STORE50</p>
                                    <p><strong className="text-slate-800">Mobile No:</strong> +91 98765 00003</p>
                                    <p><strong className="text-slate-800">Designation:</strong> Lead Inventory Supervisor</p>
                                    <p><strong className="text-slate-800">Assigned Depot:</strong> Bangalore East Hub</p>
                                </div>
                            </div>

                            <PushNotificationCard />

                            {/* PASSWORD RESET */}
                            <form onSubmit={handlePasswordChange} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1">Security & Password</h3>

                                {profileErr && <p className="text-[11px] font-bold text-red-600 pl-1">{profileErr}</p>}
                                {profileMsg && <p className="text-[11px] font-bold text-emerald-600 pl-1">{profileMsg}</p>}

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
                                    className="h-11 w-full bg-[#0a649d] text-white rounded-xl font-bold text-xs tracking-wider transition hover:bg-[#085282] cursor-pointer"
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
                                    LOG OUT SYSTEM
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                {/* MODAL: ADD STOCK */}
                {showAddStockModal && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-5 py-4 bg-[#0a649d] text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-sm font-bold truncate">Receive New Stock</h2>
                                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">Depot replenishment</p>
                                </div>
                                <button onClick={() => setShowAddStockModal(false)} className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveStock} className="p-5 text-left text-xs font-semibold space-y-3 max-h-[500px] overflow-y-auto">
                                <div>
                                    <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Part Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newStock.partName}
                                        onChange={(e) => setNewStock(prev => ({ ...prev, partName: e.target.value }))}
                                        placeholder="e.g. Door Roller Assembly"
                                        className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit</label>
                                        <select
                                            value={newStock.unit}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, unit: e.target.value }))}
                                            className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                        >
                                            {UNITS.map((u) => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={newStock.quantity}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, quantity: e.target.value }))}
                                            className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddStockModal(false)}
                                        className="h-11 flex-1 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="h-11 flex-1 bg-[#0a649d] hover:bg-[#085282] text-white rounded-xl text-xs font-bold transition active:scale-95"
                                    >
                                        Save Stock
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL: UPDATE STOCK */}
                {showUpdateStockModal && selectedInventoryItem && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-5 py-4 bg-[#0a649d] text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-sm font-bold truncate">Update Stock Qty</h2>
                                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">Manual audit adjustment</p>
                                </div>
                                <button onClick={() => { setShowUpdateStockModal(false); setSelectedInventoryItem(null); }} className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveUpdateStock} className="p-5 text-left text-xs font-semibold space-y-4">
                                <p className="text-slate-500">Adjusting level for: <strong className="text-slate-850">{selectedInventoryItem.name}</strong></p>
                                
                                <div>
                                    <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Absolute Quantity</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={updateStockQty}
                                        onChange={(e) => setUpdateStockQty(e.target.value)}
                                        className="h-11 w-full px-3.5 rounded-xl border border-slate-200 outline-none text-base bg-white focus:border-[#0a649d]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reason / Remarks</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Audit correction, cycle count"
                                        value={updateRemarks}
                                        onChange={(e) => setUpdateRemarks(e.target.value)}
                                        className="h-11 w-full px-3.5 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                    />
                                </div>

                                <div className="flex gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setShowUpdateStockModal(false); setSelectedInventoryItem(null); }}
                                        className="h-11 flex-1 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="h-11 flex-1 bg-[#0a649d] hover:bg-[#085282] text-white rounded-xl text-xs font-bold transition active:scale-95"
                                    >
                                        Update Stock
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Bottom Navigation Tabs */}
                <nav className="amardip-bottom-nav absolute bottom-0 left-0 right-0 bg-[#0a1f35]/95 backdrop-blur-xl border-t border-white/8 text-white flex justify-around items-start z-50 px-1 pt-2 select-none">
                    <button
                        onClick={() => setActiveTab("dashboard")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "dashboard" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <DashboardIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Dashboard</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("inventory")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "inventory" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <InventoryIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Inventory</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("requests")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "requests" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <RequestsIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Requests</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("transactions")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "transactions" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <TransactionsIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Logs</span>
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
