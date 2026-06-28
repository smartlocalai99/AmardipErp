import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getUserFromRequest } from "@/lib/auth";
import Image from "next/image";
import { subscribeToPush } from "@/lib/pushClient";

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
    const [categoryFilter, setCategoryFilter] = useState("All");

    // Modals
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [showUpdateStockModal, setShowUpdateStockModal] = useState(false);
    const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
    const [showQrScanner, setShowQrScanner] = useState(false);
    const [qrScanResult, setQrScanResult] = useState(null);
    const [scannerStatus, setScannerStatus] = useState("Align Technician Pass inside the box");

    // Profile password states
    const [passwordVal, setPasswordVal] = useState("store123");
    const [profileMsg, setProfileMsg] = useState("");
    const [profileErr, setProfileErr] = useState("");

    // Return Form state
    const [returnForm, setReturnForm] = useState({
        techName: "Suresh R.",
        partName: "24V Control Relay",
        quantity: 1,
        reason: "Unused spare leftover from ticket repair"
    });

    // Form inputs for adding stock
    const [newStock, setNewStock] = useState({
        partName: "Door Roller Assembly",
        partNumber: "",
        category: "Door Parts",
        quantity: 10,
        minStock: 5,
        location: "Rack B-04",
        supplier: "Elevator Components Ltd.",
        purchaseDate: "2026-06-20",
        invoiceNumber: "INV-98211",
        remarks: "Fresh batch arrival"
    });

    // Form inputs for updating stock
    const [updateStockQty, setUpdateStockQty] = useState(0);
    const [updateRemarks, setUpdateRemarks] = useState("");

    // Initial Inventory Seed State
    const [inventory, setInventory] = useState([
        { id: 1, partName: "24V Control Relay", partNumber: "SP-CON-04", category: "Relays", quantity: 24, minStock: 5, location: "Rack A-12", status: "In Stock" },
        { id: 2, partName: "Door Roller Assembly", partNumber: "SP-DOO-09", category: "Door Parts", quantity: 18, minStock: 6, location: "Rack B-04", status: "In Stock" },
        { id: 3, partName: "Infrared Door Sensor", partNumber: "SP-SEN-02", category: "Sensors", quantity: 12, minStock: 4, location: "Rack C-01", status: "In Stock" },
        { id: 4, partName: "Microprocessor Board V4", partNumber: "SP-CON-22", category: "Controller Parts", quantity: 2, minStock: 3, location: "Cabinet E-05", status: "Low Stock" },
        { id: 5, partName: "Geared Traction Motor", partNumber: "SP-MOT-15", category: "Motors", quantity: 1, minStock: 2, location: "Floor Section A", status: "Low Stock" },
        { id: 6, partName: "Guide Shoes (Safety)", partNumber: "SP-SAF-08", category: "Safety Devices", quantity: 0, minStock: 4, location: "Rack D-10", status: "Out of Stock" },
        { id: 7, partName: "Steel Wire Rope (10mm)", partNumber: "SP-CAB-01", category: "Cables", quantity: 150, minStock: 50, location: "Drum C-03", status: "In Stock" },
        { id: 8, partName: "Emergency Cabin Battery", partNumber: "SP-BAT-05", category: "Batteries", quantity: 10, minStock: 3, location: "Rack B-08", status: "In Stock" },
        { id: 9, partName: "Limit Switch", partNumber: "SP-SAF-02", category: "Safety Devices", quantity: 8, minStock: 4, location: "Rack A-05", status: "In Stock" }
    ]);

    // Initial Material Requests Seed State
    const [materialRequests, setMaterialRequests] = useState([
        { id: "REQ-901", technicianName: "Suresh R.", jobNumber: "COMP-402", partName: "24V Control Relay", quantity: 2, requestDate: "June 20, 2026", priority: "High", status: "Approved" },
        { id: "REQ-802", technicianName: "Vijay K.", jobNumber: "COMP-415", partName: "Door Roller Assembly", quantity: 4, requestDate: "June 20, 2026", priority: "Medium", status: "Pending" }
    ]);

    // Transactions log State
    const [transactions, setTransactions] = useState([
        { id: "TXN-8812", type: "Material Issued", date: "June 20, 2026", technician: "Suresh R.", details: "Issued 2x 24V Control Relay for COMP-402" },
        { id: "TXN-8811", type: "Material Received", date: "June 19, 2026", technician: "Supplier Shipment", details: "Restocked 50x Steel Wire Rope (10mm) - INV-98200" },
        { id: "TXN-8810", type: "Stock Adjustment", date: "June 18, 2026", technician: "Rajesh K. (Store)", details: "Corrected guide shoe stock level from -1 to 0" }
    ]);

    // sync with localStorage
    useEffect(() => {
        const storedInventory = localStorage.getItem("amardip_store_inventory");
        if (storedInventory) {
            try {
                setInventory(JSON.parse(storedInventory));
            } catch (e) {
                console.error("Failed to load inventory from localStorage", e);
            }
        } else {
            localStorage.setItem("amardip_store_inventory", JSON.stringify(inventory));
        }

        const storedRequests = localStorage.getItem("amardip_material_requests");
        if (storedRequests) {
            try {
                setMaterialRequests(JSON.parse(storedRequests));
            } catch (e) {
                console.error("Failed to load requests from localStorage", e);
            }
        } else {
            // Write default requests mapped
            const initRequests = [
                { id: "REQ-901", technicianName: "Suresh R.", jobNumber: "COMP-402", partName: "24V Control Relay", quantity: 2, requestDate: "June 20, 2026", priority: "High", status: "Approved", qrCode: "INVENTORY_PASS_REQ901" },
                { id: "REQ-802", technicianName: "Vijay K.", jobNumber: "COMP-415", partName: "Door Roller Assembly", quantity: 4, requestDate: "June 20, 2026", priority: "Medium", status: "Pending", qrCode: null }
            ];
            localStorage.setItem("amardip_material_requests", JSON.stringify(initRequests));
            setMaterialRequests(initRequests);
        }

        const storedTxns = localStorage.getItem("amardip_store_transactions");
        if (storedTxns) {
            try {
                setTransactions(JSON.parse(storedTxns));
            } catch (e) {
                console.error("Failed to load transactions", e);
            }
        } else {
            localStorage.setItem("amardip_store_transactions", JSON.stringify(transactions));
        }
    }, []);

    // Helper to sync state changes back to localStorage
    const updateInventoryState = (newInv) => {
        setInventory(newInv);
        localStorage.setItem("amardip_store_inventory", JSON.stringify(newInv));
    };

    const updateRequestsState = (newRequests) => {
        setMaterialRequests(newRequests);
        localStorage.setItem("amardip_material_requests", JSON.stringify(newRequests));
    };

    const updateTransactionsState = (newTxns) => {
        setTransactions(newTxns);
        localStorage.setItem("amardip_store_transactions", JSON.stringify(newTxns));
    };

    // Categories list
    const categories = [
        "Controller Parts",
        "Door Parts",
        "Sensors",
        "Motors",
        "Relays",
        "Batteries",
        "Safety Devices",
        "Cables",
        "Accessories"
    ];

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
    const handleRequestAction = (reqId, newStatus) => {
        const req = materialRequests.find(r => r.id === reqId);
        if (!req) return;

        if (newStatus === "Issued") {
            // Deduct stock if in inventory
            const targetItem = inventory.find(i => i.partName.toLowerCase() === req.partName.toLowerCase());
            if (targetItem) {
                if (targetItem.quantity < req.quantity) {
                    alert(`INSUFFICIENT STOCK! Only ${targetItem.quantity} units of ${req.partName} available.`);
                    return;
                }
                const updatedInv = inventory.map(item => {
                    if (item.id === targetItem.id) {
                        const newQty = item.quantity - req.quantity;
                        return {
                            ...item,
                            quantity: newQty,
                            status: newQty === 0 ? "Out of Stock" : (newQty <= item.minStock ? "Low Stock" : "In Stock")
                        };
                    }
                    return item;
                });
                updateInventoryState(updatedInv);
            }

            // Create Transaction Log
            const newTxn = {
                id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
                type: "Material Issued",
                date: "June 20, 2026",
                technician: req.technicianName || "Technician",
                details: `Issued ${req.quantity}x ${req.partName} for request ${req.id}`
            };
            updateTransactionsState([newTxn, ...transactions]);
        }

        const updatedRequests = materialRequests.map(r => {
            if (r.id === reqId) {
                return { ...r, status: newStatus };
            }
            return r;
        });
        updateRequestsState(updatedRequests);
        alert(`Request ${reqId} has been marked as ${newStatus}.`);
    };

    // Scan simulator trigger
    const startQrSimulation = (scannedCode) => {
        setScannerStatus("Scanning...");
        setTimeout(() => {
            setScannerStatus("MATCH FOUND!");
            setTimeout(() => {
                setShowQrScanner(false);
                processScannedQrCode(scannedCode);
            }, 600);
        }, 1000);
    };

    const processScannedQrCode = (code) => {
        // Cases:
        // 1. Pre-allocated Job Pass: `QR-COMP-402-ALLOCATED`
        if (code.startsWith("QR-") && code.endsWith("-ALLOCATED")) {
            const complaintId = code.split("-")[1]; // e.g. COMP-402
            // Load complaints from localStorage
            const stored = localStorage.getItem("amardip_complaints");
            if (stored) {
                try {
                    const allComplaints = JSON.parse(stored);
                    const complaint = allComplaints.find(c => c.id === `COMP-${complaintId}` || c.id === complaintId);
                    if (complaint) {
                        if (complaint.allocatedPartsIssued) {
                            alert("This pre-allocated job pass has ALREADY been issued.");
                            return;
                        }
                        setQrScanResult({
                            type: "allocated_job",
                            jobId: complaint.id,
                            technician: complaint.assignedTech || "Suresh R.",
                            customer: complaint.customer || "Apex Business Park",
                            parts: complaint.allocatedParts || [],
                            rawComplaint: complaint
                        });
                        return;
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            // Fallback mock if localStorage empty
            setQrScanResult({
                type: "allocated_job",
                jobId: `COMP-${complaintId}`,
                technician: "Suresh R.",
                customer: "Apex Business Park",
                parts: [
                    { partName: "24V Control Relay", quantity: 2 },
                    { partName: "Door Roller Assembly", quantity: 1 }
                ],
                rawComplaint: null
            });
        } 
        // 2. Standard Material request: `INVENTORY_PASS_REQ901`
        else if (code.startsWith("INVENTORY_PASS_")) {
            const reqId = code.replace("INVENTORY_PASS_", "REQ-");
            // Find in material requests
            const req = materialRequests.find(r => r.id === reqId || r.id === code.replace("INVENTORY_PASS_", ""));
            if (req) {
                if (req.status === "Issued") {
                    alert("This material request has ALREADY been issued.");
                    return;
                }
                setQrScanResult({
                    type: "material_request",
                    requestId: req.id,
                    technician: req.technicianName || "Technician",
                    jobNumber: req.jobNumber || "N/A",
                    partName: req.partName,
                    quantity: req.quantity,
                    rawRequest: req
                });
            } else {
                alert(`Scanned standard Request code: ${code}. Request record not found in system.`);
            }
        } else {
            alert(`Unknown/Invalid Barcode or QR Code scanned: ${code}`);
        }
    };

    const handleAdjustScannedPartQty = (index, newQty) => {
        if (newQty < 0) return;
        setQrScanResult(prev => {
            if (!prev) return prev;
            const updatedParts = prev.parts.map((p, idx) => {
                if (idx === index) {
                    return { ...p, quantity: newQty };
                }
                return p;
            });
            return { ...prev, parts: updatedParts };
        });
    };

    const handleAdjustRequestQty = (newQty) => {
        if (newQty < 0) return;
        setQrScanResult(prev => {
            if (!prev) return prev;
            return { ...prev, quantity: newQty };
        });
    };

    // Confirm Issue from QR Scanner Result Modal
    const handleConfirmQrIssue = () => {
        if (!qrScanResult) return;

        if (qrScanResult.type === "allocated_job") {
            const parts = qrScanResult.parts;
            // Deduct each part from inventory
            const updatedInv = inventory.map(item => {
                const match = parts.find(p => p.partName.toLowerCase() === item.partName.toLowerCase());
                if (match) {
                    const newQty = Math.max(0, item.quantity - match.quantity);
                    return {
                        ...item,
                        quantity: newQty,
                        status: newQty === 0 ? "Out of Stock" : (newQty <= item.minStock ? "Low Stock" : "In Stock")
                    };
                }
                return item;
            });
            updateInventoryState(updatedInv);

            // Update complaint status in localStorage
            const stored = localStorage.getItem("amardip_complaints");
            if (stored) {
                try {
                    const allComplaints = JSON.parse(stored);
                    const updatedComplaints = allComplaints.map(c => {
                        if (c.id === qrScanResult.jobId) {
                            return { 
                                ...c, 
                                allocatedPartsIssued: true,
                                allocatedParts: parts
                            };
                        }
                        return c;
                    });
                    localStorage.setItem("amardip_complaints", JSON.stringify(updatedComplaints));
                } catch (e) {
                    console.error(e);
                }
            }

            // Create Transaction Log
            const txnDetails = parts.map(p => `${p.quantity}x ${p.partName}`).join(", ");
            const newTxn = {
                id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
                type: "Material Issued",
                date: "June 20, 2026",
                technician: qrScanResult.technician,
                details: `Pre-allocated parts (${txnDetails}) issued to technician for job ${qrScanResult.jobId}`
            };
            updateTransactionsState([newTxn, ...transactions]);

            alert(`SUCCESS!\nAll pre-allocated parts handed over to ${qrScanResult.technician}.\nInventory levels updated.`);
        } 
        else if (qrScanResult.type === "material_request") {
            const req = qrScanResult.rawRequest;
            // Deduct stock
            const targetItem = inventory.find(i => i.partName.toLowerCase() === qrScanResult.partName.toLowerCase());
            if (targetItem) {
                const updatedInv = inventory.map(item => {
                    if (item.id === targetItem.id) {
                        const newQty = Math.max(0, item.quantity - qrScanResult.quantity);
                        return {
                            ...item,
                            quantity: newQty,
                            status: newQty === 0 ? "Out of Stock" : (newQty <= item.minStock ? "Low Stock" : "In Stock")
                        };
                    }
                    return item;
                });
                updateInventoryState(updatedInv);
            }

            // Update request status to Issued
            const updatedReqs = materialRequests.map(r => {
                if (r.id === qrScanResult.requestId) {
                    return { ...r, status: "Issued" };
                }
                return r;
            });
            updateRequestsState(updatedReqs);

            // Log Transaction
            const newTxn = {
                id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
                type: "Material Issued",
                date: "June 20, 2026",
                technician: qrScanResult.technician,
                details: `Request pickup scan issued ${qrScanResult.quantity}x ${qrScanResult.partName} to technician`
            };
            updateTransactionsState([newTxn, ...transactions]);

            alert(`SUCCESS!\nIssued ${qrScanResult.quantity}x ${qrScanResult.partName} to ${qrScanResult.technician}.`);
        }

        setQrScanResult(null);
    };

    // Save Stock form
    const handleSaveStock = (e) => {
        e.preventDefault();

        // Check if item exists to update or create
        const exists = inventory.find(i => i.partName.toLowerCase() === newStock.partName.toLowerCase());
        if (exists) {
            const updated = inventory.map(item => {
                if (item.id === exists.id) {
                    const newQty = item.quantity + parseInt(newStock.quantity);
                    return {
                        ...item,
                        quantity: newQty,
                        status: newQty === 0 ? "Out of Stock" : (newQty <= item.minStock ? "Low Stock" : "In Stock")
                    };
                }
                return item;
            });
            updateInventoryState(updated);
        } else {
            const partNum = newStock.partNumber || `SP-${newStock.category.substring(0,3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`;
            const newItem = {
                id: inventory.length + 1,
                partName: newStock.partName,
                partNumber: partNum,
                category: newStock.category,
                quantity: parseInt(newStock.quantity),
                minStock: parseInt(newStock.minStock),
                location: newStock.location,
                status: parseInt(newStock.quantity) === 0 ? "Out of Stock" : (parseInt(newStock.quantity) <= parseInt(newStock.minStock) ? "Low Stock" : "In Stock")
            };
            updateInventoryState([...inventory, newItem]);
        }

        // Add to Transaction Logs
        const newTxn = {
            id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
            type: "Material Received",
            date: "June 20, 2026",
            technician: newStock.supplier || "Supplier",
            details: `Received ${newStock.quantity}x ${newStock.partName}. Invoice: ${newStock.invoiceNumber || "N/A"}`
        };
        updateTransactionsState([newTxn, ...transactions]);

        setShowAddStockModal(false);
        alert(`Stock saved successfully!\n${newStock.quantity}x ${newStock.partName} added to inventory.`);
    };

    // Update Stock modal save
    const handleSaveUpdateStock = (e) => {
        e.preventDefault();
        if (!selectedInventoryItem) return;

        const updated = inventory.map(item => {
            if (item.id === selectedInventoryItem.id) {
                const newQty = parseInt(updateStockQty);
                return {
                    ...item,
                    quantity: newQty,
                    status: newQty === 0 ? "Out of Stock" : (newQty <= item.minStock ? "Low Stock" : "In Stock")
                };
            }
            return item;
        });
        updateInventoryState(updated);

        // Transaction log
        const qtyDiff = parseInt(updateStockQty) - selectedInventoryItem.quantity;
        const newTxn = {
            id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
            type: "Stock Adjustments",
            date: "June 20, 2026",
            technician: "Rajesh K. (Store)",
            details: `Adjusted ${selectedInventoryItem.partName} stock level by ${qtyDiff >= 0 ? "+" : ""}${qtyDiff} units. Remarks: ${updateRemarks || "Manual audit"}`
        };
        updateTransactionsState([newTxn, ...transactions]);

        setShowUpdateStockModal(false);
        setSelectedInventoryItem(null);
        alert("Stock level adjusted successfully!");
    };

    // Material return form submission
    const handleReturnSubmit = (e) => {
        e.preventDefault();
        
        // Find item in inventory
        const targetItem = inventory.find(i => i.partName.toLowerCase() === returnForm.partName.toLowerCase());
        if (targetItem) {
            const updated = inventory.map(item => {
                if (item.id === targetItem.id) {
                    const newQty = item.quantity + parseInt(returnForm.quantity);
                    return {
                        ...item,
                        quantity: newQty,
                        status: newQty === 0 ? "Out of Stock" : (newQty <= item.minStock ? "Low Stock" : "In Stock")
                    };
                }
                return item;
            });
            updateInventoryState(updated);
        } else {
            // Create new
            const newItem = {
                id: inventory.length + 1,
                partName: returnForm.partName,
                partNumber: `SP-RET-${Math.floor(10 + Math.random()*90)}`,
                category: "Accessories",
                quantity: parseInt(returnForm.quantity),
                minStock: 2,
                location: "Return Rack R-01",
                status: "In Stock"
            };
            updateInventoryState([...inventory, newItem]);
        }

        // Transaction log
        const newTxn = {
            id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
            type: "Returns",
            date: "June 20, 2026",
            technician: returnForm.techName,
            details: `Unused parts returned: ${returnForm.quantity}x ${returnForm.partName}. Reason: ${returnForm.reason}`
        };
        updateTransactionsState([newTxn, ...transactions]);

        setReturnForm({
            techName: "Suresh R.",
            partName: "24V Control Relay",
            quantity: 1,
            reason: "Unused spare leftover from ticket repair"
        });

        alert("Returned parts credited to store inventory!");
    };

    // Dynamic metrics counts
    const totalPartsCount = inventory.length;
    const lowStockCount = inventory.filter(i => i.status === "Low Stock").length;
    const outOfStockCount = inventory.filter(i => i.status === "Out of Stock").length;
    const pendingReqsCount = materialRequests.filter(r => r.status === "Pending" || r.status === "Approved").length;
    const todayIssuesCount = transactions.filter(t => t.type === "Material Issued" && t.date.includes("June 20")).length;
    const recentTxnsCount = transactions.length;

    // Filtered inventory listing
    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.partName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             item.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             item.location.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCat = categoryFilter === "All" || item.category === categoryFilter;
        return matchesSearch && matchesCat;
    });

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
                        onClick={() => { setShowQrScanner(true); setScannerStatus("Align Technician Pass inside the box"); }}
                        className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition flex items-center gap-1 text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm border border-emerald-500"
                    >
                        <ScanIcon className="h-4.5 w-4.5" />
                        Scan QR
                    </button>
                </header>

                {/* QR Scanner simulator overlay */}
                {showQrScanner && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col justify-between text-white p-6">
                        <div className="flex justify-between items-center mt-6">
                            <span className="font-extrabold text-base tracking-tight">QR Scanner Simulator</span>
                            <button onClick={() => setShowQrScanner(false)} className="h-9 w-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20">
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Scanner Box frame */}
                        <div className="my-auto flex flex-col items-center">
                            <div className="relative h-64 w-64 border-2 border-dashed border-[#59e0ff] rounded-2xl flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-x-0 h-0.5 bg-red-500 animate-bounce"></div>
                                <ScanIcon className="h-16 w-16 text-[#0a649d]/30" />
                            </div>
                            <p className="text-sm font-semibold mt-6 text-slate-300 animate-pulse">{scannerStatus}</p>
                        </div>

                        <div className="space-y-3 mb-6">
                            <span className="block text-[10px] text-center text-slate-500 font-bold uppercase tracking-wider">Simulate Technician Passes</span>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => startQrSimulation("QR-COMP-402-ALLOCATED")}
                                    className="h-12 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold transition active:scale-95"
                                >
                                    Suresh COMP-402 Pass
                                </button>
                                <button
                                    onClick={() => startQrSimulation("INVENTORY_PASS_REQ901")}
                                    className="h-12 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold transition active:scale-95"
                                >
                                    Suresh REQ-901 Pass
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* QR Scan Result Confirmation Modal */}
                {qrScanResult && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-5 py-4 bg-[#0a649d] text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-sm font-bold truncate">Confirm Material Issue</h2>
                                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">Verifying Tech Handover</p>
                                </div>
                                <button onClick={() => setQrScanResult(null)} className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 text-left space-y-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                                    <p><strong className="text-slate-800">Technician:</strong> {qrScanResult.technician}</p>
                                    {qrScanResult.type === "allocated_job" ? (
                                        <>
                                            <p><strong className="text-slate-800">Job Reference:</strong> {qrScanResult.jobId}</p>
                                            <p><strong className="text-slate-800">Customer:</strong> {qrScanResult.customer}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p><strong className="text-slate-800">Request ID:</strong> {qrScanResult.requestId}</p>
                                            <p><strong className="text-slate-800">Job Number:</strong> {qrScanResult.jobNumber}</p>
                                        </>
                                    )}
                                </div>

                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-0.5">Parts to be Handed Over</h4>
                                    <div className="space-y-2">
                                        {qrScanResult.type === "allocated_job" ? (
                                            qrScanResult.parts.map((p, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                                                    <span className="font-extrabold text-slate-800">{p.partName}</span>
                                                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleAdjustScannedPartQty(idx, p.quantity - 1)}
                                                            className="h-6 w-6 rounded-lg flex items-center justify-center font-black text-slate-500 hover:bg-red-50 hover:text-red-600 active:scale-90 transition text-sm cursor-pointer select-none bg-slate-50"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-6 text-center font-black text-slate-800 text-xs select-none">{p.quantity}</span>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleAdjustScannedPartQty(idx, p.quantity + 1)}
                                                            className="h-6 w-6 rounded-lg flex items-center justify-center font-black text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 active:scale-90 transition text-sm cursor-pointer select-none bg-slate-50"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                                                <span className="font-extrabold text-slate-800">{qrScanResult.partName}</span>
                                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleAdjustRequestQty(qrScanResult.quantity - 1)}
                                                        className="h-6 w-6 rounded-lg flex items-center justify-center font-black text-slate-500 hover:bg-red-50 hover:text-red-600 active:scale-90 transition text-sm cursor-pointer select-none bg-slate-50"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-6 text-center font-black text-slate-800 text-xs select-none">{qrScanResult.quantity}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleAdjustRequestQty(qrScanResult.quantity + 1)}
                                                        className="h-6 w-6 rounded-lg flex items-center justify-center font-black text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 active:scale-90 transition text-sm cursor-pointer select-none bg-slate-50"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2.5 pt-2">
                                    <button
                                        onClick={() => setQrScanResult(null)}
                                        className="h-11 flex-1 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmQrIssue}
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
                                        onClick={() => { setShowQrScanner(true); setScannerStatus("Align Technician Pass inside the box"); }}
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
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Stock Items</span>
                                        <span className="text-3xl font-black text-amber-600">{lowStockCount}</span>
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

                            {/* Search and filter controls */}
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Search by Part Name, Number, Rack..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-11 w-full px-4 rounded-xl border border-slate-200 text-base outline-none bg-white focus:border-[#0a649d] transition font-medium"
                                />

                                {/* Category Horizontal Slider */}
                                <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
                                    <button
                                        onClick={() => setCategoryFilter("All")}
                                        className={`h-8 px-4 rounded-full text-xs font-bold transition shrink-0 ${categoryFilter === "All" ? "bg-[#0a649d] text-white" : "bg-white border border-slate-200 text-slate-600"}`}
                                    >
                                        All Parts
                                    </button>
                                    {categories.map((cat, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCategoryFilter(cat)}
                                            className={`h-8 px-4 rounded-full text-xs font-bold transition shrink-0 ${categoryFilter === cat ? "bg-[#0a649d] text-white" : "bg-white border border-slate-200 text-slate-600"}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

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
                                {filteredInventory.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-8 font-semibold">No spare parts match your filters.</p>
                                ) : (
                                    filteredInventory.map((item) => (
                                        <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-3.5 relative">
                                            {/* Top info row */}
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] text-[#0a649d] font-extrabold uppercase bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                                                        {item.category}
                                                    </span>
                                                    <h3 className="text-sm font-black text-slate-800 mt-2">{item.partName}</h3>
                                                    <p className="text-[10.5px] text-slate-400 font-bold mt-0.5">Part #: {item.partNumber} • Rack: {item.location}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                    item.status === "In Stock" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                    (item.status === "Low Stock" ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-red-50 text-red-600 border border-red-100")
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </div>

                                            {/* Quantity status bar */}
                                            <div className="flex justify-between items-center pt-1 text-xs">
                                                <div>
                                                    <span className="text-slate-400 font-bold block">Available Qty</span>
                                                    <span className="text-lg font-black text-slate-800">{item.quantity} units</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-slate-400 font-bold block">Min Stock Level</span>
                                                    <span className="font-extrabold text-slate-700">{item.minStock} units</span>
                                                </div>
                                            </div>

                                            {/* Action row */}
                                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        setSelectedInventoryItem(item);
                                                        setUpdateStockQty(item.quantity);
                                                        setUpdateRemarks("");
                                                        setShowUpdateStockModal(true);
                                                    }}
                                                    className="h-9 flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200"
                                                >
                                                    Update Quantity
                                                </button>
                                                <button
                                                    onClick={() => alert(`Part Details:\n- Name: ${item.partName}\n- Code: ${item.partNumber}\n- Category: ${item.category}\n- Qty: ${item.quantity}\n- Min level: ${item.minStock}\n- Shelf Location: ${item.location}`)}
                                                    className="h-9 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200"
                                                >
                                                    View Details
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

                            <div className="space-y-3.5">
                                {materialRequests.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-8 font-semibold">No active material requests.</p>
                                ) : (
                                    materialRequests.map((req) => (
                                        <div key={req.id} className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                            {/* Top Line */}
                                            <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">{req.id} • {req.requestDate}</span>
                                                    <h3 className="text-sm font-black text-slate-800 mt-1">{req.partName}</h3>
                                                    <p className="text-xs font-semibold text-slate-500 mt-0.5">Requested by: {req.technicianName} ({req.jobNumber})</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                                    req.status === "Approved" ? "bg-sky-50 text-[#0a649d] border border-sky-100" :
                                                    (req.status === "Issued" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                                                     (req.status === "Rejected" ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"))
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                                                <div>
                                                    <span className="block text-[9.5px] font-bold text-slate-400 uppercase">Quantity Requested</span>
                                                    <span className="font-extrabold text-slate-800">{req.quantity} units</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9.5px] font-bold text-slate-400 uppercase">Priority Rating</span>
                                                    <span className={`font-black uppercase ${req.priority === "High" ? "text-red-600" : "text-amber-600"}`}>{req.priority}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {req.status === "Pending" && (
                                                <div className="flex gap-2 pt-2 border-t border-slate-50">
                                                    <button
                                                        onClick={() => handleRequestAction(req.id, "Approved")}
                                                        className="h-9 flex-1 bg-[#0a649d] hover:bg-[#085282] text-white rounded-lg text-xs font-bold transition active:scale-95"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleRequestAction(req.id, "Rejected")}
                                                        className="h-9 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition border border-red-100"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}

                                            {req.status === "Approved" && (
                                                <div className="pt-2 border-t border-slate-50">
                                                    <button
                                                        onClick={() => handleRequestAction(req.id, "Issued")}
                                                        className="h-10 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                        Issue Material
                                                    </button>
                                                </div>
                                            )}
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
                                    {transactions.map((t, idx) => (
                                        <div key={idx} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-xs space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span className="font-extrabold text-slate-800">{t.type}</span>
                                                <span className="text-[10px] text-slate-400 font-bold">{t.date}</span>
                                            </div>
                                            <p className="text-slate-600 font-medium">{t.details}</p>
                                            <span className="block text-[9.5px] text-slate-400 font-bold uppercase">Log: {t.id} • Operator: {t.technician}</span>
                                        </div>
                                    ))}
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
                                    <select
                                        value={newStock.partName}
                                        onChange={(e) => setNewStock(prev => ({ ...prev, partName: e.target.value }))}
                                        className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                    >
                                        <option value="24V Control Relay">24V Control Relay</option>
                                        <option value="Door Roller Assembly">Door Roller Assembly</option>
                                        <option value="Infrared Door Sensor">Infrared Door Sensor</option>
                                        <option value="Microprocessor Board V4">Microprocessor Board V4</option>
                                        <option value="Geared Traction Motor">Geared Traction Motor</option>
                                        <option value="Guide Shoes (Safety)">Guide Shoes (Safety)</option>
                                        <option value="Steel Wire Rope (10mm)">Steel Wire Rope (10mm)</option>
                                        <option value="Emergency Cabin Battery">Emergency Cabin Battery</option>
                                        <option value="Limit Switch">Limit Switch</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                                        <select
                                            value={newStock.category}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, category: e.target.value }))}
                                            className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                        >
                                            {categories.map((c, idx) => (
                                                <option key={idx} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={newStock.quantity}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, quantity: e.target.value }))}
                                            className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min. Alert Qty</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={newStock.minStock}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, minStock: e.target.value }))}
                                            className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Depot Rack Location</label>
                                        <input
                                            type="text"
                                            required
                                            value={newStock.location}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, location: e.target.value }))}
                                            className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Supplier Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newStock.supplier}
                                        onChange={(e) => setNewStock(prev => ({ ...prev, supplier: e.target.value }))}
                                        className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Invoice Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={newStock.invoiceNumber}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                                            className="h-10 w-full px-3 rounded-xl border border-slate-200 outline-none text-sm bg-white focus:border-[#0a649d]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</label>
                                        <input
                                            type="text"
                                            value={newStock.remarks}
                                            onChange={(e) => setNewStock(prev => ({ ...prev, remarks: e.target.value }))}
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
                                <p className="text-slate-500">Adjusting level for: <strong className="text-slate-850">{selectedInventoryItem.partName}</strong></p>
                                
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
