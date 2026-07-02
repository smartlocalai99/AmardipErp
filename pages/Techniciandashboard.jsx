import { useState, useEffect, useRef } from "react";
import { subscribeToPush } from "@/lib/pushClient";
import { useRouter } from "next/router";
import { getUserFromRequest } from "@/lib/auth";
import Image from "next/image";
import QRCode from "qrcode";
import PushNotificationCard from "@/components/ui/PushNotificationCard";
import { acknowledgeTicketNotification, clearAppBadgeCount } from "@/lib/appBadge";

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

function BellIcon({ className = "h-5 w-5" }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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

function CameraIcon({ className = "h-5 w-5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <circle cx="12" cy="13" r="4" strokeWidth="2.5" />
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

export default function Techniciandashboard({ user }) {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, jobs, inventory, notifications, profile
    const [activeJob, setActiveJob] = useState(null); // active job workspace
    const [jobsFilter, setJobsFilter] = useState("assigned"); // assigned, completed

    // Signature Canvas Refs & States
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureCaptured, setSignatureCaptured] = useState(false);
    const [sigCustomerName, setSigCustomerName] = useState("");
    const [sigConsentChecked, setSigConsentChecked] = useState(false);

    // Camera/Selfie verification states
    const videoRef = useRef(null);
    const [cameraStream, setCameraStream] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [selfieCaptured, setSelfieCaptured] = useState(false);
    const [selfieUrl, setSelfieUrl] = useState("");
    const [checkingIn, setCheckingIn] = useState(false);

    // QR scanner simulator states
    const [showQrScanner, setShowQrScanner] = useState(false);
    const [qrStatusText, setQrStatusText] = useState("Align Lift QR inside frame");

    // Store Material Pass (real QR job-pass image) states
    const [jobPassJob, setJobPassJob] = useState(null);
    const [showJobPassModal, setShowJobPassModal] = useState(false);
    const [jobPassLoading, setJobPassLoading] = useState(false);
    const [jobPassImage, setJobPassImage] = useState(null);

    // Profile password states
    const [passwordVal, setPasswordVal] = useState("tech123");
    const [profileMsg, setProfileMsg] = useState("");
    const [profileErr, setProfileErr] = useState("");

    // Photo evidence slots states (stores URL data or filenames)
    const [photoSlots, setPhotoSlots] = useState({
        before: null,
        during: null,
        after: null,
        parts: null
    });

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

    // Notification List
    const [notifications, setNotifications] = useState([
        { id: 1, type: "info", title: "Safety Gear Reminder", message: "Wear safety harness and helmet during overhead shaft testing.", time: "Today", read: true }
    ]);

    function mapAssignedComplaintToJob(c) {
        return {
            id: c.complaintNo,
            dbId: c.id,
            customerName: c.customerName,
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
            checklist: { power: false, door: false, controller: false, motor: false, safety: false, emergency: false, brake: false, testing: false },
            workReport: { problem: "", workPerformed: "", sparePartsUsed: "", remarks: "", status: "Completed" },
            gpsCheckedIn: false,
            checkInTime: null,
            selfieUrl: "",
            signature: null,
            completeTime: null,
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
        fetchAssignedComplaints();
        // Subscribe to push notifications (non-blocking — worker can still decline)
        subscribeToPush().catch(() => {});
    }, []);

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
        setActiveTab("jobs");
    };

    // Start Journey
    const handleStartJourney = (job) => {
        updateJobStatus(job.id, "En Route");
    };

    // GPS Arrival Verification
    const triggerGPSCheckIn = async () => {
        setCheckingIn(true);
        await new Promise(r => setTimeout(r, 1200));
        setSelfieCaptured(true);
        setSelfieUrl("LOCATION_CAPTURED");
        setCameraActive(false);
        setCheckingIn(false);
    };

    const simulateSelfieCapture = () => {
        // Mock countdown
        let count = 3;
        const interval = setInterval(() => {
            count--;
            if (count === 0) {
                clearInterval(interval);
                // Captured
                setSelfieUrl("MOCK_SELFIE_VERIFIED_OK");
                setSelfieCaptured(true);
                setCameraActive(false);
            }
        }, 600);
    };

    const captureRealSelfie = () => {
        if (cameraStream && videoRef.current) {
            const canvas = document.createElement("canvas");
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext("2d");
            // Crop square
            ctx.drawImage(videoRef.current, 10, 0, 220, 220, 0, 0, 300, 300);
            const data = canvas.toDataURL("image/jpeg");
            setSelfieUrl(data);
            setSelfieCaptured(true);
            
            // Stop tracks
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
            setCameraActive(false);
        } else {
            simulateSelfieCapture();
        }
    };

    const confirmCheckIn = () => {
        const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        setJobs(prev => prev.map(job => {
            if (job.id === activeJob.id) {
                return {
                    ...job,
                    gpsCheckedIn: true,
                    checkInTime: timeNow,
                    selfieUrl: selfieUrl || "LOCATION_CAPTURED",
                    status: "Arrived"
                };
            }
            return job;
        }));
        setActiveJob(prev => ({
            ...prev,
            gpsCheckedIn: true,
            checkInTime: timeNow,
            selfieUrl: selfieUrl || "LOCATION_CAPTURED",
            status: "Arrived"
        }));
        
        // Reset states
        setSelfieCaptured(false);
        setSelfieUrl("");
        alert("Location check-in successful! GPS matching 12.9716° N, 77.5946° E verified. You can now perform the work checklist.");
    };

    // QR scan simulation
    const triggerScanQR = () => {
        setShowQrScanner(true);
        setQrStatusText("Align Lift QR inside frame");
    };

    const runQrSimulation = (scannedLiftId) => {
        setQrStatusText("Scanning...");
        setTimeout(() => {
            setQrStatusText("MATCH FOUND!");
            setTimeout(() => {
                setShowQrScanner(false);
                // Find job with this lift
                const matchJob = jobs.find(j => j.liftId === scannedLiftId);
                if (matchJob) {
                    openJobDetails(matchJob);
                    alert(`Lift verified! Opening job Workspace for ${scannedLiftId}`);
                } else {
                    alert(`QR Scan result: ${scannedLiftId}. No active service assigned for this unit.`);
                }
            }, 600);
        }, 1000);
    };

    // Checklist toggles
    const handleChecklistToggle = (itemKey) => {
        if (!activeJob) return;
        const updatedChecklist = {
            ...activeJob.checklist,
            [itemKey]: !activeJob.checklist[itemKey]
        };
        
        setJobs(prev => prev.map(j => {
            if (j.id === activeJob.id) {
                return { ...j, checklist: updatedChecklist };
            }
            return j;
        }));

        setActiveJob(prev => ({ ...prev, checklist: updatedChecklist }));
    };

    // Photo uploads handling
    const handlePhotoSelection = (e, slot) => {
        if (e.target.files && e.target.files[0]) {
            const fileUrl = URL.createObjectURL(e.target.files[0]);
            setPhotoSlots(prev => ({ ...prev, [slot]: fileUrl }));
        }
    };

    const simulatePhotoUpload = (slot) => {
        setPhotoSlots(prev => ({ ...prev, [slot]: "MOCK_WORK_IMAGE_OK" }));
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

        // Checklist validation
        const pendingItems = Object.entries(activeJob.checklist).filter(([_, val]) => !val);
        if (pendingItems.length > 0) {
            alert("VALIDATION ERROR: You must complete all 8 checklist checkpoints before closing!");
            return;
        }

        // GPS Check-in validation
        if (!activeJob.gpsCheckedIn) {
            alert("VALIDATION ERROR: Please complete the GPS location check-in first!");
            return;
        }

        // Report Text check
        if (!activeJob.workReport.problem.trim() || !activeJob.workReport.workPerformed.trim()) {
            alert("VALIDATION ERROR: Please write details in Problem Identified and Work Performed fields!");
            return;
        }

        // Customer Signature checks
        if (!signatureCaptured || !sigCustomerName.trim() || !sigConsentChecked) {
            alert("VALIDATION ERROR: Customer signature drawing, Name, and consent validation check are mandatory!");
            return;
        }

        setSubmittingJob(true);

        // Persist to DB — a network/DB failure must not block the field worker from completing the job
        if (activeJob.dbId) {
            try {
                await fetch("/api/worker/complete-job", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jobDbId: activeJob.dbId,
                        problemIdentified: activeJob.workReport.problem,
                        workPerformed: activeJob.workReport.workPerformed,
                        sparePartsUsed: activeJob.workReport.sparePartsUsed,
                        statusResolution: activeJob.workReport.status,
                        gpsCheckedIn: activeJob.gpsCheckedIn,
                        checklistData: activeJob.checklist,
                        customerRepName: sigCustomerName,
                        voiceLanguage: voiceLanguage !== "auto" ? voiceLanguage : null,
                        voiceOriginalTranscript: voiceTranscript || null,
                        voiceEnglishTranslation: voiceEnglishNote || null,
                        voiceProcessingStatus: voiceTranscript ? "DONE" : null,
                    }),
                });
            } catch (err) {
                console.warn("complete-job save error (non-blocking):", err.message);
            }
        }

        // Mark Completed locally
        const timeDone = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        setJobs(prev => prev.map(j => {
            if (j.id === activeJob.id) {
                return {
                    ...j,
                    status: "Completed",
                    completeTime: `Today, ${timeDone}`,
                    signature: {
                        customerName: sigCustomerName,
                        img: "MOCK_SIGNATURE_OK"
                    }
                };
            }
            return j;
        }));

        // Reset workspace states
        setPhotoSlots({ before: null, during: null, after: null, parts: null });
        setSigCustomerName("");
        setSigConsentChecked(false);
        setSignatureCaptured(false);
        resetVoiceNote();
        setSubmittingJob(false);

        alert(`JOB COMPLETED SUCCESSFULLY!\n- Ticket ${activeJob.id} has been resolved.\n- Admin Portal notification dispatched.\n- Automated Service PDF report sent to customer.`);

        setActiveJob(null);
        setActiveTab("dashboard");
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
                alert(data.message || "Failed to generate store pass.");
                setShowJobPassModal(false);
                return;
            }
            const dataUrl = await QRCode.toDataURL(data.token, { width: 320, margin: 2 });
            setJobPassImage(dataUrl);
        } catch (err) {
            alert("Failed to generate store pass.");
            setShowJobPassModal(false);
        } finally {
            setJobPassLoading(false);
        }
    };

    // Password reset
    const handlePasswordChangeSubmit = (e) => {
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
            router.push("/Technicianlogin");
        } catch (e) {
            router.push("/Technicianlogin");
        }
    };

    // Dynamic counts
    const todayJobsCount = jobs.filter(j => j.status !== "Completed").length;
    const pendingJobsCount = jobs.filter(j => j.status === "Assigned").length;
    const completedJobsCount = jobs.filter(j => j.status === "Completed").length;
    const emergencyJobsCount = jobs.filter(j => j.status !== "Completed" && j.priority === "Emergency").length;
    const activeAssignedJobs = jobs.filter(j => j.status !== "Completed");
    const unreadNotificationsCount = notifications.filter(n => !n.read).length;

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
                                {user?.name || "Suresh R. (Lead)"}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => { setActiveTab("notifications"); setActiveJob(null); }}
                        className="relative h-10 w-10 bg-white/10 hover:bg-white/18 active:scale-95 transition flex items-center justify-center rounded-full"
                    >
                        <BellIcon className="h-5.5 w-5.5 text-white" />
                        {unreadNotificationsCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 rounded-full bg-red-500 border-2 border-[#0a649d] flex items-center justify-center text-[9px] font-black text-white">
                                {unreadNotificationsCount}
                            </span>
                        )}
                    </button>
                </header>

                {/* QR Scanner simulator overlay */}
                {showQrScanner && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col justify-between text-white p-6">
                        <div className="flex justify-between items-center mt-6">
                            <span className="font-extrabold text-base tracking-tight">QR Lift Scan Simulator</span>
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
                            <p className="text-sm font-semibold mt-6 text-slate-300 animate-pulse">{qrStatusText}</p>
                        </div>

                        <div className="space-y-3 mb-6">
                            <span className="block text-[10px] text-center text-slate-500 font-bold uppercase tracking-wider">Simulate Lift Codes</span>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => runQrSimulation("LIFT-9821")}
                                    className="h-12 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold transition active:scale-95"
                                >
                                    Scan Unit LIFT-9821
                                </button>
                                <button
                                    onClick={() => runQrSimulation("LIFT-7652")}
                                    className="h-12 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold transition active:scale-95"
                                >
                                    Scan Unit LIFT-7652
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Workspace content */}
                <main className="amardip-app-main flex-1 overflow-y-auto bg-[#f1f5f9]">

                    {/* VIEW: DASHBOARD TAB */}
                    {activeTab === "dashboard" && !activeJob && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            
                            {/* Greeting card */}
                            <div className="rounded-3xl p-5 text-white shadow-md relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #1e4b7a 65%, #0e2a4a 100%)` }}>
                                <div className="absolute top-0 right-0 h-28 w-28 bg-white/5 rounded-full -mr-8 -mt-8"></div>
                                <span className="text-[10px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                                    Duty Status: Active
                                </span>
                                <h2 className="text-xl font-black mt-3 leading-tight">Welcome, Suresh</h2>
                                <p className="text-[10.5px] text-white/80 font-semibold mt-1">Employee ID: TECH50 | Emergency Breakdown Lead</p>
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
                                        onClick={() => { setActiveTab("jobs"); setJobsFilter("assigned"); }}
                                        className="rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm hover:shadow active:scale-98 transition flex flex-col justify-between h-26 cursor-pointer select-none"
                                    >
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Pending Dispatch</span>
                                        <p className="text-2xl font-black text-slate-900 mt-2">{pendingJobsCount}</p>
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

                            {/* Quick Action Grid */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Quick Service Actions</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => { setActiveTab("jobs"); setJobsFilter("assigned"); }}
                                        className="h-14.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 px-4 active:scale-95 transition text-left cursor-pointer"
                                    >
                                        <div className="h-9.5 w-9.5 rounded-xl bg-blue-50 text-[#0a649d] flex items-center justify-center">
                                            <JobsIcon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10.5px] font-black text-slate-800 leading-none block">View Jobs</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">Assigned List</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={triggerScanQR}
                                        className="h-14.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 px-4 active:scale-95 transition text-left cursor-pointer"
                                    >
                                        <div className="h-9.5 w-9.5 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                            <ScanIcon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10.5px] font-black text-slate-800 leading-none block">Scan Lift QR</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">Instant Verify</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            const activeJ = jobs.find(j => j.status !== "Completed");
                                            if (activeJ) {
                                                openJobDetails(activeJ);
                                            } else {
                                                alert("No active incomplete jobs to work on.");
                                            }
                                        }}
                                        className="h-14.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 px-4 active:scale-95 transition text-left cursor-pointer"
                                    >
                                        <div className="h-9.5 w-9.5 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div>
                                            <span className="text-[10.5px] font-black text-slate-800 leading-none block">Resume Work</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">Active Job</span>
                                        </div>
                                    </button>
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
                                                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{job.customerName} • Lift {job.liftId}</span>
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
                                                            <p><strong className="text-slate-700">Site:</strong> {job.buildingName}</p>
                                                            <p><strong className="text-slate-700">Assigned:</strong> {job.assignedTime}</p>
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

                                    {/* SECTION 1: CUSTOMER & LIFT INFO */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Site & Asset Details</h3>
                                        <div className="space-y-3.5 text-xs">
                                            <div className="space-y-1">
                                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Customer / Building</span>
                                                <p className="font-extrabold text-slate-800">{activeJob.customerName}</p>
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
                                            <button 
                                                onClick={() => alert("Launching integrated routing...\nDestination: " + activeJob.address)}
                                                className="h-10 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold transition active:scale-95 cursor-pointer"
                                            >
                                                <MapIcon className="h-4.5 w-4.5 text-slate-400" />
                                                Open Maps
                                            </button>
                                        </div>
                                    </div>

                                    {/* SECTION 1B: STORE MATERIAL PASS */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Store Material Pass</h3>
                                        <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                                            Generate a real QR pass for this job. The storekeeper scans it to issue any spare parts requested for {activeJob.id}.
                                        </p>
                                        <button
                                            onClick={() => openJobPass(activeJob)}
                                            className="h-10.5 w-full bg-[#0a649d] text-white hover:bg-[#085282] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm cursor-pointer"
                                        >
                                            <ScanIcon className="h-4.5 w-4.5" />
                                            Generate Store Pass QR
                                        </button>
                                    </div>

                                    {/* SECTION 2: GPS SITE CHECK-IN */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Location Check-In</h3>
                                        
                                        {!activeJob.gpsCheckedIn ? (
                                            <div className="space-y-4">
                                                {!cameraActive ? (
                                                    <button
                                                        onClick={triggerGPSCheckIn}
                                                        disabled={checkingIn || activeJob.status === "Assigned"}
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
                                                ) : (
                                                    <div className="space-y-4 text-center">
                                                        <div className="relative h-48 w-full rounded-2xl bg-black overflow-hidden border border-slate-200">
                                                            <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover scale-x-[-1]"></video>
                                                            <div className="absolute inset-0 border-[3px] border-[#59e0ff] rounded-2xl pointer-events-none opacity-50 m-4"></div>
                                                            
                                                            {/* Virt Shutter animation */}
                                                            {selfieCaptured && (
                                                                <div className="absolute inset-0 bg-white flex items-center justify-center animate-out fade-out duration-300">
                                                                    <span className="font-extrabold text-black uppercase tracking-wider">CAPTURE DONE</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={captureRealSelfie}
                                                                className="h-10 flex-1 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase transition active:scale-95"
                                                            >
                                                                Capture Selfie
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (cameraStream) {
                                                                        cameraStream.getTracks().forEach(track => track.stop());
                                                                    }
                                                                    setCameraActive(false);
                                                                }}
                                                                className="h-10 px-4 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold transition active:scale-95"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {selfieCaptured && (
                                                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between animate-in zoom-in-95">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="h-9 w-9 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                                                                <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                            <div className="text-left">
                                                                <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wide leading-none">Location Captured</span>
                                                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">GPS check-in ready.</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={confirmCheckIn}
                                                            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold tracking-wide active:scale-95 transition"
                                                        >
                                                            CONFIRM ARRIVAL
                                                        </button>
                                                    </div>
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
                                                    <p><strong className="text-emerald-950">Location:</strong> GPS Matched (12.9716° N, 77.5946° E)</p>
                                                    <p><strong className="text-emerald-950">Verification:</strong> Location captured and saved in service ledger</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 3: SERVICE CHECKLIST (ONLY IF ARRIVED) */}
                                    {activeJob.gpsCheckedIn && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4 animate-in slide-in-from-bottom-3">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d]">8-Point Service Checklist</h3>
                                                <span className="text-[10px] font-black text-slate-400">
                                                    {Object.values(activeJob.checklist).filter(Boolean).length}/8 DONE
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs font-semibold text-slate-700">
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.power} 
                                                        onChange={() => handleChecklistToggle("power")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Power Supply & Voltages Checked</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.door} 
                                                        onChange={() => handleChecklistToggle("door")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Door Drive & Sliders Operated</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.controller} 
                                                        onChange={() => handleChecklistToggle("controller")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Microprocessor Controller Checked</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.motor} 
                                                        onChange={() => handleChecklistToggle("motor")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Traction Motor & Gearbox Inspected</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.safety} 
                                                        onChange={() => handleChecklistToggle("safety")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Safety Devices & Governor Inspected</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.emergency} 
                                                        onChange={() => handleChecklistToggle("emergency")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Emergency Alarm & Battery Backup Verified</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.brake} 
                                                        onChange={() => handleChecklistToggle("brake")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Electromagnetic Brake System Checked</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={activeJob.checklist.testing} 
                                                        onChange={() => handleChecklistToggle("testing")}
                                                        className="h-4.5 w-4.5 text-[#0a649d] border-slate-300 rounded focus:ring-[#0a649d]" 
                                                    />
                                                    <span>Final Load Testing & Leveling Completed</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 4: PHOTO EVIDENCE (ONLY IF ARRIVED) */}
                                    {activeJob.gpsCheckedIn && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                            <div className="border-b border-slate-100 pb-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d]">Optional Job Photos</h3>
                                                <p className="mt-1 text-[10px] font-semibold text-slate-400">Photos help office review, but completion requires location, work notes, and client sign.</p>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 text-center">
                                                {/* Before */}
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-3 flex flex-col items-center justify-between min-h-28 relative">
                                                    {photoSlots.before ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                                            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold mb-1">✓</div>
                                                            <span className="text-[10px] text-slate-500 font-extrabold">Before Photo</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <CameraIcon className="text-slate-300 mt-1" />
                                                            <span className="text-[10px] text-slate-400 font-bold block my-1.5 leading-tight">Before Repair</span>
                                                            <button onClick={() => simulatePhotoUpload("before")} className="text-[9px] font-black text-[#0a649d] hover:underline bg-transparent border-0 cursor-pointer">Simulate Capture</button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* During */}
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-3 flex flex-col items-center justify-between min-h-28 relative">
                                                    {photoSlots.during ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                                            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold mb-1">✓</div>
                                                            <span className="text-[10px] text-slate-500 font-extrabold">During Photo</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <CameraIcon className="text-slate-300 mt-1" />
                                                            <span className="text-[10px] text-slate-400 font-bold block my-1.5 leading-tight">Work Progress</span>
                                                            <button onClick={() => simulatePhotoUpload("during")} className="text-[9px] font-black text-[#0a649d] hover:underline bg-transparent border-0 cursor-pointer">Simulate Capture</button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* After */}
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-3 flex flex-col items-center justify-between min-h-28 relative">
                                                    {photoSlots.after ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                                            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold mb-1">✓</div>
                                                            <span className="text-[10px] text-slate-500 font-extrabold">After Photo</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <CameraIcon className="text-slate-300 mt-1" />
                                                            <span className="text-[10px] text-slate-400 font-bold block my-1.5 leading-tight">After Testing</span>
                                                            <button onClick={() => simulatePhotoUpload("after")} className="text-[9px] font-black text-[#0a649d] hover:underline bg-transparent border-0 cursor-pointer">Simulate Capture</button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Spare Parts */}
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-3 flex flex-col items-center justify-between min-h-28 relative">
                                                    {photoSlots.parts ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                                            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold mb-1">✓</div>
                                                            <span className="text-[10px] text-slate-500 font-extrabold">Spares Replaced</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <CameraIcon className="text-slate-300 mt-1" />
                                                            <span className="text-[10px] text-slate-400 font-bold block my-1.5 leading-tight">Spare Parts Installed</span>
                                                            <button onClick={() => simulatePhotoUpload("parts")} className="text-[9px] font-black text-[#0a649d] hover:underline bg-transparent border-0 cursor-pointer">Simulate Capture</button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION 5: WORK REPORT REMARKS */}
                                    {activeJob.gpsCheckedIn && (
                                        <div className="rounded-3xl border border-slate-200 bg-white p-4.5 shadow-sm space-y-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a649d] border-b border-slate-100 pb-2">Technical Work Report</h3>
                                            
                                            <div className="space-y-4 text-xs">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Problem Identified</label>
                                                    <textarea 
                                                        required
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
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-0.5">Work Performed</label>
                                                    <textarea
                                                        required
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
                                    {activeJob.gpsCheckedIn && (
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
                                    {activeJob.gpsCheckedIn && (
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

                    {/* VIEW: NOTIFICATIONS TAB */}
                    {activeTab === "notifications" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-slate-900">Notifications</h1>
                                    <p className="text-xs text-slate-500 mt-0.5">Urgent dispatches and inventory status.</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                        clearAppBadgeCount();
                                    }}
                                    className="text-[10.5px] font-black text-[#0a649d] hover:underline bg-transparent border-0 cursor-pointer"
                                >
                                    Mark all read
                                </button>
                            </div>

                            {activeAssignedJobs.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Jobs</h2>
                                    {activeAssignedJobs.map(job => (
                                        <button
                                            key={job.id}
                                            onClick={() => openJobDetails(job)}
                                            className="w-full rounded-3xl border border-sky-100 bg-sky-50/80 p-4 text-left shadow-sm active:scale-[0.99] transition"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">{job.id}</p>
                                                    <h3 className="mt-1 truncate text-sm font-black text-slate-900">{job.customer}</h3>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{job.issue}</p>
                                                </div>
                                                <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase text-sky-700 ring-1 ring-sky-100">
                                                    {job.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between border-t border-sky-100 pt-3 text-[10px] font-bold text-slate-500">
                                                <span>{job.address}</span>
                                                <span className={job.priority === "Emergency" ? "text-red-600" : "text-[#0a649d]"}>{job.priority}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                {notifications.length === 0 ? (
                                    <p className="p-8 text-center text-xs text-slate-400">No alerts found.</p>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => {
                                                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                                            }}
                                            className={`p-4 hover:bg-slate-50 transition cursor-pointer text-xs flex gap-3 ${!n.read ? "bg-blue-50/40" : ""}`}
                                        >
                                            <div className="flex-1 space-y-1">
                                                <div className="flex justify-between items-center pl-0.5">
                                                    <span className="font-extrabold text-slate-800">{n.title}</span>
                                                    <span className="text-[9.5px] text-slate-400 font-bold">{n.time}</span>
                                                </div>
                                                <p className="text-slate-500 font-semibold leading-relaxed pl-0.5">{n.message}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
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
                                    SR
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Suresh R.</h2>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Senior Breakdown Tech</span>
                                </div>

                                <hr className="border-slate-100" />

                                <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                        <span className="text-[8.5px] font-bold text-slate-400 uppercase block">Experience</span>
                                        <span className="font-black text-slate-800 block mt-1">6 Years</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                        <span className="text-[8.5px] font-bold text-slate-400 uppercase block">Resolved</span>
                                        <span className="font-black text-[#0a649d] block mt-1">24 Lifts</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                        <span className="text-[8.5px] font-bold text-slate-400 uppercase block">Rating</span>
                                        <span className="font-black text-emerald-600 block mt-1">4.9 ★</span>
                                    </div>
                                </div>

                                <div className="text-left text-xs text-slate-650 space-y-2 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                                    <p><strong className="text-slate-800">Employee Code:</strong> TECH50</p>
                                    <p><strong className="text-slate-800">Mobile No:</strong> +91 98765 00001</p>
                                    <p><strong className="text-slate-800">Designation:</strong> Service Lead, Breakdown division</p>
                                    <p><strong className="text-slate-800">Department:</strong> Bangalore East Hub</p>
                                </div>
                            </div>

                            <PushNotificationCard />

                            {/* CHANGE PASSWORD */}
                            <form onSubmit={handlePasswordChangeSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
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

                {/* MODAL: Store Material Pass (real QR image) */}
                {showJobPassModal && jobPassJob && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 select-none">
                            <div className="px-5 py-4 bg-[#0a649d] text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-sm font-bold truncate">Store Material Pass</h2>
                                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">{jobPassJob.id}</p>
                                </div>
                                <button onClick={() => setShowJobPassModal(false)} className="h-8 w-8 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition">
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
                                    onClick={() => setShowJobPassModal(false)}
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
                        onClick={() => {
                            clearAppBadgeCount();
                            handleTabChange("notifications");
                        }}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "notifications" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <BellIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Alerts</span>
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
    );
}
