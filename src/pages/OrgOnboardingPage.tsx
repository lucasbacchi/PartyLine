import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp, type OrgSettings, type TenantRole } from "../context/AppContext";
import {
    IconBuilding,
    IconCheck,
    IconCheckCircle,
    IconCog,
    IconCopy,
    IconPhone,
    IconTrash,
    IconUsers
} from "../components/Icons";
import { getFirebaseAppCheckToken } from "../firebase";

export function meta() {
    return [
        { title: "Create or Join an Organization | PartyLine" },
        {
            name: "description",
            content: "Set up a new organization, provision a Twilio phone line, or join an existing team."
        }
    ];
}

type SetupStep = 1 | 2 | 3 | 4 | 5;

type AvailableTwilioNumber = {
    phoneNumber: string;
    friendlyName: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    isoCountry?: string;
    capabilities: {
        voice: boolean;
        SMS: boolean;
        MMS: boolean;
    };
};

type PendingMember = {
    email: string;
    displayName: string;
    phoneNumber?: string;
    role: TenantRole;
};

const US_STATES = [
    { code: "", name: "All States / Any" },
    { code: "AL", name: "AL - Alabama" },
    { code: "AK", name: "AK - Alaska" },
    { code: "AZ", name: "AZ - Arizona" },
    { code: "AR", name: "AR - Arkansas" },
    { code: "CA", name: "CA - California" },
    { code: "CO", name: "CO - Colorado" },
    { code: "CT", name: "CT - Connecticut" },
    { code: "DE", name: "DE - Delaware" },
    { code: "FL", name: "FL - Florida" },
    { code: "GA", name: "GA - Georgia" },
    { code: "HI", name: "HI - Hawaii" },
    { code: "ID", name: "ID - Idaho" },
    { code: "IL", name: "IL - Illinois" },
    { code: "IN", name: "IN - Indiana" },
    { code: "IA", name: "IA - Iowa" },
    { code: "KS", name: "KS - Kansas" },
    { code: "KY", name: "KY - Kentucky" },
    { code: "LA", name: "LA - Louisiana" },
    { code: "ME", name: "ME - Maine" },
    { code: "MD", name: "MD - Maryland" },
    { code: "MA", name: "MA - Massachusetts" },
    { code: "MI", name: "MI - Michigan" },
    { code: "MN", name: "MN - Minnesota" },
    { code: "MS", name: "MS - Mississippi" },
    { code: "MO", name: "MO - Missouri" },
    { code: "MT", name: "MT - Montana" },
    { code: "NE", name: "NE - Nebraska" },
    { code: "NV", name: "NV - Nevada" },
    { code: "NH", name: "NH - New Hampshire" },
    { code: "NJ", name: "NJ - New Jersey" },
    { code: "NM", name: "NM - New Mexico" },
    { code: "NY", name: "NY - New York" },
    { code: "NC", name: "NC - North Carolina" },
    { code: "ND", name: "ND - North Dakota" },
    { code: "OH", name: "OH - Ohio" },
    { code: "OK", name: "OK - Oklahoma" },
    { code: "OR", name: "OR - Oregon" },
    { code: "PA", name: "PA - Pennsylvania" },
    { code: "RI", name: "RI - Rhode Island" },
    { code: "SC", name: "SC - South Carolina" },
    { code: "SD", name: "SD - South Dakota" },
    { code: "TN", name: "TN - Tennessee" },
    { code: "TX", name: "TX - Texas" },
    { code: "UT", name: "UT - Utah" },
    { code: "VT", name: "VT - Vermont" },
    { code: "VA", name: "VA - Virginia" },
    { code: "WA", name: "WA - Washington" },
    { code: "WV", name: "WV - West Virginia" },
    { code: "WI", name: "WI - Wisconsin" },
    { code: "WY", name: "WY - Wyoming" }
];

const COMMON_TIMEZONES = [
    { value: "America/New_York", label: "Eastern Time (US & Canada) - ET" },
    { value: "America/Chicago", label: "Central Time (US & Canada) - CT" },
    { value: "America/Denver", label: "Mountain Time (US & Canada) - MT" },
    { value: "America/Los_Angeles", label: "Pacific Time (US & Canada) - PT" },
    { value: "America/Anchorage", label: "Alaska - AKT" },
    { value: "Pacific/Honolulu", label: "Hawaii - HT" },
    { value: "Europe/London", label: "London / GMT" },
    { value: "UTC", label: "Coordinated Universal Time (UTC)" }
];

export default function OrgOnboardingPage() {
    const { user, createOrganization, joinOrganizationByCode, isAuthLoading } = useApp();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Mode: "create" or "join"
    const activeTab = searchParams.get("tab") === "join" ? "join" : "create";

    // Wizard Step (1 to 5)
    const [currentStep, setCurrentStep] = useState<SetupStep>(1);

    // --- Form State: Step 1 (Basics) ---
    const [orgName, setOrgName] = useState("");
    const [timezone, setTimezone] = useState("America/New_York");

    // --- Form State: Step 2 (Phone Number / Twilio) ---
    const [areaCodeInput, setAreaCodeInput] = useState("617");
    const [localityInput, setLocalityInput] = useState("");
    const [regionInput, setRegionInput] = useState("");
    const [postalCodeInput, setPostalCodeInput] = useState("");
    const [availableNumbers, setAvailableNumbers] = useState<AvailableTwilioNumber[]>([]);
    const [selectedNumber, setSelectedNumber] = useState<string>("");
    const [customPhoneInput, setCustomPhoneInput] = useState("");
    const [useCustomPhone, setUseCustomPhone] = useState(false);
    const [skipPhoneProvisioning, setSkipPhoneProvisioning] = useState(false);
    const [isSearchingNumbers, setIsSearchingNumbers] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [numbersError, setNumbersError] = useState<string | null>(null);

    // --- Form State: Step 3 (Calling Preferences) ---
    const [routingStrategy, setRoutingStrategy] = useState<"sequential" | "round_robin" | "simultaneous">("sequential");
    const [ringTimeoutSeconds, setRingTimeoutSeconds] = useState(20);
    const [answerMessage, setAnswerMessage] = useState(
        "Thank you for calling PartyLine. Connecting your call to our on-duty team member..."
    );
    const [fallbackAction, setFallbackAction] = useState<"voicemail" | "forward" | "hangup">("voicemail");
    const [fallbackPhone, setFallbackPhone] = useState("");
    const [smsAutoReplyEnabled, setSmsAutoReplyEnabled] = useState(true);
    const [smsAutoReplyMessage, setSmsAutoReplyMessage] = useState(
        "Thank you for reaching out to PartyLine! A host on duty has received your message and will reply shortly."
    );

    // --- Form State: Step 4 (Team & Invites) ---
    const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [newMemberName, setNewMemberName] = useState("");
    const [newMemberPhone, setNewMemberPhone] = useState("");
    const [newMemberRole, setNewMemberRole] = useState<TenantRole>("member");
    const [copiedCode, setCopiedCode] = useState(false);

    // Submission & Creation State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
    const [createdInviteCode, setCreatedInviteCode] = useState<string>("");

    // --- Join Org Tab State ---
    const [joinCode, setJoinCode] = useState(searchParams.get("invite") || "");
    const [isJoining, setIsJoining] = useState(false);
    const [joinSuccess, setJoinSuccess] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);

    // Calculated invite code preview for Step 4
    const previewInviteCode =
        (orgName
            .trim()
            .slice(0, 4)
            .toUpperCase()
            .replace(/[^A-Z]/g, "ORG") || "PL") + "-8821";

    // Auto-search available numbers when entering Step 2 or initial mount
    useEffect(() => {
        if (currentStep === 2 && availableNumbers.length === 0 && !hasSearched) {
            void fetchAvailableNumbers({ areaCode: "617" });
        }
    }, [currentStep, availableNumbers.length, hasSearched]);

    async function fetchAvailableNumbers(overrides?: {
        areaCode?: string;
        locality?: string;
        region?: string;
        postalCode?: string;
    }) {
        setIsSearchingNumbers(true);
        setNumbersError(null);
        setHasSearched(true);
        try {
            const area = overrides?.areaCode !== undefined ? overrides.areaCode : areaCodeInput;
            const locality = overrides?.locality !== undefined ? overrides.locality : localityInput;
            const region = overrides?.region !== undefined ? overrides.region : regionInput;
            const postalCode = overrides?.postalCode !== undefined ? overrides.postalCode : postalCodeInput;

            const params = new URLSearchParams();
            if (area.trim()) params.set("areaCode", area.trim());
            if (locality.trim()) params.set("locality", locality.trim());
            if (region.trim()) params.set("region", region.trim());
            if (postalCode.trim()) params.set("postalCode", postalCode.trim());

            const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
            const appCheckToken = await getFirebaseAppCheckToken();
            const idToken = user ? await user.getIdToken() : "";

            const res = await fetch(`${apiUrl}/api/twilio/available-numbers?${params.toString()}`, {
                headers: {
                    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                    ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {})
                }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Unable to fetch phone numbers from Twilio.");
            }

            const list: AvailableTwilioNumber[] = data.numbers || [];
            setAvailableNumbers(list);

            if (list.length > 0) {
                setSelectedNumber(list[0].phoneNumber);
            } else {
                setSelectedNumber("");
            }
        } catch (err) {
            console.error("Twilio phone search failed:", err);
            setAvailableNumbers([]);
            setSelectedNumber("");
            setNumbersError(err instanceof Error ? err.message : "Unable to search phone numbers from Twilio.");
        } finally {
            setIsSearchingNumbers(false);
        }
    }

    function handleAddPendingMember() {
        if (!newMemberEmail.trim()) return;
        setPendingMembers((prev) => [
            ...prev,
            {
                email: newMemberEmail.trim(),
                displayName: newMemberName.trim() || newMemberEmail.trim().split("@")[0],
                phoneNumber: newMemberPhone.trim(),
                role: newMemberRole
            }
        ]);
        setNewMemberEmail("");
        setNewMemberName("");
        setNewMemberPhone("");
        setNewMemberRole("member");
    }

    function handleRemovePendingMember(index: number) {
        setPendingMembers((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleCompleteSetup() {
        if (!orgName.trim()) {
            setErrorMessage("Please enter an organization name.");
            setCurrentStep(1);
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            // Determine phone number to bind
            let finalPhone = "";
            if (!skipPhoneProvisioning) {
                finalPhone = useCustomPhone ? customPhoneInput.trim() : selectedNumber;
            }

            const initialSettings: Partial<OrgSettings> = {
                timezone,
                routingStrategy,
                ringTimeoutSeconds,
                answerMessage,
                fallbackAction,
                fallbackPhone: fallbackAction === "forward" ? fallbackPhone.trim() : "",
                smsAutoReplyEnabled,
                smsAutoReplyMessage
            };

            const newTenantId = await createOrganization(orgName.trim(), finalPhone, initialSettings, pendingMembers);

            setCreatedOrgId(newTenantId);
            setCreatedInviteCode(previewInviteCode);
            setCurrentStep(5);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to create organization.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleJoinOrg(e: React.FormEvent) {
        e.preventDefault();
        if (!joinCode.trim()) {
            setJoinError("Please enter your organization invite code.");
            return;
        }

        setIsJoining(true);
        setJoinError(null);

        try {
            const success = await joinOrganizationByCode(joinCode.trim().toUpperCase());
            if (success) {
                setJoinSuccess(true);
                setTimeout(() => navigate("/events"), 1200);
            } else {
                setJoinError("Invalid or expired invite code. Please check with your organization admin.");
            }
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : "Could not join organization.");
        } finally {
            setIsJoining(false);
        }
    }

    function switchTab(tab: "create" | "join") {
        setSearchParams({ tab });
        setErrorMessage(null);
        setJoinError(null);
    }

    if (!isAuthLoading && !user) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
                <Navbar />
                <main className="mx-auto max-w-md p-8 flex-1 flex flex-col items-center justify-center text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
                        <IconBuilding className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Sign In Required</h1>
                    <p className="mt-2 text-sm text-slate-400">
                        You need an active PartyLine account to create or join an organization.
                    </p>
                    <Link
                        to="/login?mode=signup"
                        className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
                    >
                        Sign In or Sign Up
                    </Link>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
            <Navbar />

            <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12 relative overflow-x-clip">
                {/* Subtle background glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -z-10 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

                <div className="mx-auto max-w-3xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <Link to="/" className="inline-flex items-center gap-2 mb-3">
                            <span className="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 text-sm font-black text-white shadow-md shadow-blue-500/20">
                                P
                            </span>
                            <span className="text-xl font-bold tracking-tight text-white">PartyLine</span>
                        </Link>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                            {activeTab === "create" ? "Set up your organization" : "Join an organization"}
                        </h1>
                        <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
                            {activeTab === "create"
                                ? "Provision your Twilio phone line, configure smart call routing, and invite your team in a few quick steps."
                                : "Have an invite code from your team or facility manager? Enter it below to get instant access."}
                        </p>

                        {/* Top Mode Tabs */}
                        <div className="mt-6 inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 shadow-lg">
                            <button
                                type="button"
                                onClick={() => switchTab("create")}
                                className={`rounded-lg px-5 py-2 text-xs sm:text-sm font-semibold transition ${
                                    activeTab === "create"
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                Create New Organization
                            </button>
                            <button
                                type="button"
                                onClick={() => switchTab("join")}
                                className={`rounded-lg px-5 py-2 text-xs sm:text-sm font-semibold transition ${
                                    activeTab === "join"
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                Join with Invite Code
                            </button>
                        </div>
                    </div>

                    {/* Feedback Errors */}
                    {errorMessage && (
                        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs sm:text-sm text-red-300 shadow-lg">
                            {errorMessage}
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB 1: CREATE ORGANIZATION WIZARD                              */}
                    {/* ============================================================== */}
                    {activeTab === "create" && (
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
                            {/* Wizard Progress Bar */}
                            {currentStep < 5 && (
                                <div className="mb-8">
                                    <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
                                        {[
                                            { step: 1, label: "Basics" },
                                            { step: 2, label: "Phone Line" },
                                            { step: 3, label: "Routing" },
                                            { step: 4, label: "Team & Invites" }
                                        ].map((item) => (
                                            <div
                                                key={item.step}
                                                className={`flex flex-col items-center gap-1.5 transition ${
                                                    currentStep === item.step
                                                        ? "text-blue-400 font-bold"
                                                        : currentStep > item.step
                                                          ? "text-slate-300 font-medium"
                                                          : "text-slate-600"
                                                }`}
                                            >
                                                <div
                                                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition ${
                                                        currentStep === item.step
                                                            ? "bg-blue-600 text-white ring-4 ring-blue-500/20"
                                                            : currentStep > item.step
                                                              ? "bg-emerald-600 text-white"
                                                              : "border border-slate-700 bg-slate-800 text-slate-400"
                                                    }`}
                                                >
                                                    {currentStep > item.step ? (
                                                        <IconCheck className="h-4 w-4" />
                                                    ) : (
                                                        item.step
                                                    )}
                                                </div>
                                                <span className="text-[11px] sm:text-xs truncate max-w-20 sm:max-w-none">
                                                    {item.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                            className="h-full bg-linear-to-r from-blue-600 to-indigo-500 transition-all duration-300"
                                            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* --- STEP 1: ORGANIZATION BASICS --- */}
                            {currentStep === 1 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <IconBuilding className="h-5 w-5 text-blue-400" />
                                            <span>Organization Details</span>
                                        </h2>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Give your organization a name and choose the primary timezone for shift
                                            scheduling.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                                Organization or Facility Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={orgName}
                                                onChange={(e) => setOrgName(e.target.value)}
                                                placeholder="e.g. Fenway Hall Management, Beta House, Somerville Rentals"
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                                Operating Timezone
                                            </label>
                                            <select
                                                value={timezone}
                                                onChange={(e) => setTimezone(e.target.value)}
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                {COMMON_TIMEZONES.map((tz) => (
                                                    <option key={tz.value} value={tz.value}>
                                                        {tz.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                All event rosters and host rotation times will be calculated in this
                                                timezone.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!orgName.trim()) {
                                                    setErrorMessage("Please enter an organization name to continue.");
                                                    return;
                                                }
                                                setErrorMessage(null);
                                                setCurrentStep(2);
                                            }}
                                            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition"
                                        >
                                            Next: Choose Phone Line →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* --- STEP 2: TWILIO PHONE NUMBER SETUP --- */}
                            {currentStep === 2 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <IconPhone className="h-5 w-5 text-blue-400" />
                                            <span>Provision Your Shared Phone Line</span>
                                        </h2>
                                        <p className="mt-1 text-xs text-slate-400">
                                            PartyLine assigns a dedicated local phone number powered by Twilio so team
                                            members never have to give out their personal cells.
                                        </p>
                                    </div>

                                    {!skipPhoneProvisioning && !useCustomPhone && (
                                        <div className="space-y-4">
                                            {/* Detailed Search Filters */}
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                        Search Twilio Registry
                                                    </span>
                                                    {(areaCodeInput ||
                                                        localityInput ||
                                                        regionInput ||
                                                        postalCodeInput) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAreaCodeInput("");
                                                                setLocalityInput("");
                                                                setRegionInput("");
                                                                setPostalCodeInput("");
                                                            }}
                                                            className="text-[11px] text-slate-400 hover:text-slate-200"
                                                        >
                                                            Clear filters
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid gap-2.5 sm:grid-cols-4">
                                                    <div>
                                                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                            Area Code
                                                        </label>
                                                        <input
                                                            type="text"
                                                            maxLength={3}
                                                            value={areaCodeInput}
                                                            onChange={(e) =>
                                                                setAreaCodeInput(
                                                                    e.target.value.replace(/\D/g, "").slice(0, 3)
                                                                )
                                                            }
                                                            placeholder="e.g. 617"
                                                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                            City / Town / Locality
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={localityInput}
                                                            onChange={(e) => setLocalityInput(e.target.value)}
                                                            placeholder="e.g. Boston, Cambridge"
                                                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                            State / Region
                                                        </label>
                                                        <select
                                                            value={regionInput}
                                                            onChange={(e) => setRegionInput(e.target.value)}
                                                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                                                        >
                                                            {US_STATES.map((st) => (
                                                                <option key={st.code} value={st.code}>
                                                                    {st.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                            ZIP Code
                                                        </label>
                                                        <input
                                                            type="text"
                                                            maxLength={5}
                                                            value={postalCodeInput}
                                                            onChange={(e) =>
                                                                setPostalCodeInput(
                                                                    e.target.value.replace(/\D/g, "").slice(0, 5)
                                                                )
                                                            }
                                                            placeholder="e.g. 02115"
                                                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                                    {/* Quick Presets */}
                                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                        <span className="text-slate-500">Popular:</span>
                                                        {[
                                                            {
                                                                label: "Boston (617)",
                                                                area: "617",
                                                                reg: "MA",
                                                                loc: "Boston"
                                                            },
                                                            {
                                                                label: "Lowell (978)",
                                                                area: "978",
                                                                reg: "MA",
                                                                loc: "Lowell"
                                                            },
                                                            {
                                                                label: "Worcester (508)",
                                                                area: "508",
                                                                reg: "MA",
                                                                loc: "Worcester"
                                                            },
                                                            {
                                                                label: "NYC (212)",
                                                                area: "212",
                                                                reg: "NY",
                                                                loc: "New York"
                                                            },
                                                            {
                                                                label: "Austin (512)",
                                                                area: "512",
                                                                reg: "TX",
                                                                loc: "Austin"
                                                            }
                                                        ].map((chip) => (
                                                            <button
                                                                key={chip.label}
                                                                type="button"
                                                                onClick={() => {
                                                                    setAreaCodeInput(chip.area);
                                                                    setRegionInput(chip.reg);
                                                                    setLocalityInput(chip.loc);
                                                                    setPostalCodeInput("");
                                                                    void fetchAvailableNumbers({
                                                                        areaCode: chip.area,
                                                                        region: chip.reg,
                                                                        locality: chip.loc,
                                                                        postalCode: ""
                                                                    });
                                                                }}
                                                                className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-0.5 text-slate-300 hover:border-slate-700 hover:text-white transition"
                                                            >
                                                                {chip.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => void fetchAvailableNumbers()}
                                                        disabled={isSearchingNumbers}
                                                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50 shadow"
                                                    >
                                                        {isSearchingNumbers ? "Searching..." : "Search Numbers"}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Searching Indicator */}
                                            {isSearchingNumbers && (
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center space-y-2">
                                                    <div className="mx-auto h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                    <p className="text-xs text-slate-400">
                                                        Checking Twilio inventory for available numbers...
                                                    </p>
                                                </div>
                                            )}

                                            {/* Error Message */}
                                            {numbersError && !isSearchingNumbers && (
                                                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
                                                    <p className="font-semibold">Unable to search phone numbers</p>
                                                    <p className="mt-0.5 text-[11px] text-red-400">{numbersError}</p>
                                                </div>
                                            )}

                                            {/* No Numbers Found Message */}
                                            {hasSearched &&
                                                availableNumbers.length === 0 &&
                                                !isSearchingNumbers &&
                                                !numbersError && (
                                                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-2">
                                                        <p className="text-sm font-bold text-amber-300">
                                                            We can't find any numbers with that search criteria.
                                                        </p>
                                                        <p className="text-xs text-slate-300 max-w-md mx-auto">
                                                            No available numbers matched{" "}
                                                            {areaCodeInput ? `area code (${areaCodeInput})` : ""}{" "}
                                                            {localityInput ? `in ${localityInput}` : ""}{" "}
                                                            {regionInput ? `(${regionInput})` : ""}. Try searching a
                                                            nearby town, a different area code, or clear the city
                                                            filter.
                                                        </p>
                                                    </div>
                                                )}

                                            {/* Available Numbers Grid with Real Localities */}
                                            {availableNumbers.length > 0 && !isSearchingNumbers && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                                                        <span>Available numbers ({availableNumbers.length})</span>
                                                        <span>Select a line for your team</span>
                                                    </div>
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        {availableNumbers.map((num) => (
                                                            <label
                                                                key={num.phoneNumber}
                                                                className={`relative flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition ${
                                                                    selectedNumber === num.phoneNumber
                                                                        ? "border-blue-500 bg-blue-600/15 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
                                                                        : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950"
                                                                }`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <input
                                                                        type="radio"
                                                                        name="twilioNumber"
                                                                        value={num.phoneNumber}
                                                                        checked={selectedNumber === num.phoneNumber}
                                                                        onChange={() =>
                                                                            setSelectedNumber(num.phoneNumber)
                                                                        }
                                                                        className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <div>
                                                                        <p className="text-sm font-bold text-white font-mono tracking-wide">
                                                                            {num.friendlyName}
                                                                        </p>
                                                                        <p className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                                                                            <span className="text-[11px] text-slate-400">
                                                                                📍
                                                                            </span>
                                                                            <span>
                                                                                {num.locality
                                                                                    ? num.locality
                                                                                    : "Metro Area"}
                                                                                , {num.region || "US"}
                                                                                {num.postalCode
                                                                                    ? ` · ${num.postalCode}`
                                                                                    : ""}
                                                                            </span>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                                                                            Voice
                                                                        </span>
                                                                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                                                                            SMS
                                                                        </span>
                                                                    </div>
                                                                    {num.capabilities.MMS && (
                                                                        <span className="text-[10px] text-slate-500">
                                                                            MMS Enabled
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Alternate: Use Custom Phone Number */}
                                    {useCustomPhone && (
                                        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-2">
                                            <label className="block text-xs font-medium text-slate-300">
                                                Enter your existing E.164 phone number
                                            </label>
                                            <input
                                                type="text"
                                                value={customPhoneInput}
                                                onChange={(e) => setCustomPhoneInput(e.target.value)}
                                                placeholder="+16175550199"
                                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                            />
                                            <p className="text-[11px] text-slate-400">
                                                Must be formatted with country code (e.g. +1 for US/Canada).
                                            </p>
                                        </div>
                                    )}

                                    {/* Alternate toggles */}
                                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUseCustomPhone(!useCustomPhone);
                                                setSkipPhoneProvisioning(false);
                                            }}
                                            className="text-blue-400 hover:underline"
                                        >
                                            {useCustomPhone
                                                ? "← Choose a Twilio number instead"
                                                : "Use an existing phone number"}
                                        </button>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={skipPhoneProvisioning}
                                                onChange={(e) => {
                                                    setSkipPhoneProvisioning(e.target.checked);
                                                    if (e.target.checked) setUseCustomPhone(false);
                                                }}
                                                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>Skip phone setup for now (add later)</span>
                                        </label>
                                    </div>

                                    <div className="pt-4 flex justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
                                        >
                                            ← Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (
                                                    !skipPhoneProvisioning &&
                                                    useCustomPhone &&
                                                    !customPhoneInput.trim()
                                                ) {
                                                    setErrorMessage(
                                                        "Please enter your phone number or choose a Twilio number."
                                                    );
                                                    return;
                                                }
                                                setErrorMessage(null);
                                                setCurrentStep(3);
                                            }}
                                            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition"
                                        >
                                            Next: Calling Preferences →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* --- STEP 3: CALLING PREFERENCES --- */}
                            {currentStep === 3 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <IconCog className="h-5 w-5 text-blue-400" />
                                            <span>Default Calling Behavior</span>
                                        </h2>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Configure how inbound calls are greeted, distributed, and backed up across
                                            your hosts.
                                        </p>
                                    </div>

                                    {/* Strategy Cards */}
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                                            Ring Strategy
                                        </label>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            {[
                                                {
                                                    id: "sequential",
                                                    title: "Sequential (Waterfall)",
                                                    desc: "Rings assigned on-duty host first, then rolls to backup if missed."
                                                },
                                                {
                                                    id: "round_robin",
                                                    title: "Round Robin",
                                                    desc: "Evenly balances calls across all active team members on shift."
                                                },
                                                {
                                                    id: "simultaneous",
                                                    title: "Simultaneous Ring",
                                                    desc: "Rings everyone on duty at once. The first host to answer takes it."
                                                }
                                            ].map((strat) => (
                                                <label
                                                    key={strat.id}
                                                    className={`flex flex-col justify-between p-4 rounded-2xl border cursor-pointer transition ${
                                                        routingStrategy === strat.id
                                                            ? "border-blue-500 bg-blue-600/15 ring-2 ring-blue-500/30"
                                                            : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-bold text-white">
                                                                {strat.title}
                                                            </span>
                                                            <input
                                                                type="radio"
                                                                name="routingStrategy"
                                                                value={strat.id}
                                                                checked={routingStrategy === strat.id}
                                                                onChange={() =>
                                                                    setRoutingStrategy(
                                                                        strat.id as
                                                                            | "sequential"
                                                                            | "round_robin"
                                                                            | "simultaneous"
                                                                    )
                                                                }
                                                                className="h-4 w-4 text-blue-600"
                                                            />
                                                        </div>
                                                        <p className="text-xs text-slate-400 leading-relaxed">
                                                            {strat.desc}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Ring Timeout */}
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                                Ring Duration Before Next Host / Fallback
                                            </label>
                                            <span className="font-mono text-xs font-bold text-blue-400">
                                                {ringTimeoutSeconds} seconds
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={10}
                                            max={60}
                                            step={5}
                                            value={ringTimeoutSeconds}
                                            onChange={(e) => setRingTimeoutSeconds(Number(e.target.value))}
                                            className="w-full h-2 rounded-lg bg-slate-800 accent-blue-500 cursor-pointer"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                            <span>10s (Fast)</span>
                                            <span>20s (Default)</span>
                                            <span>60s (Long)</span>
                                        </div>
                                    </div>

                                    {/* Answer Message */}
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                            Spoken Greeting Message (Text-to-Speech)
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={answerMessage}
                                            onChange={(e) => setAnswerMessage(e.target.value)}
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Played immediately to the caller before routing to the host on shift.
                                        </p>
                                    </div>

                                    {/* Fallback Action */}
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                                If All Hosts Miss the Call
                                            </label>
                                            <select
                                                value={fallbackAction}
                                                onChange={(e) =>
                                                    setFallbackAction(
                                                        e.target.value as "voicemail" | "forward" | "hangup"
                                                    )
                                                }
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="voicemail">Send to Voicemail</option>
                                                <option value="forward">Forward to Emergency External Number</option>
                                                <option value="hangup">Hang Up Gracefully</option>
                                            </select>
                                        </div>
                                        {fallbackAction === "forward" && (
                                            <div>
                                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                                    Emergency Backup Phone Number
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={fallbackPhone}
                                                    onChange={(e) => setFallbackPhone(e.target.value)}
                                                    placeholder="+16175550199"
                                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* SMS Auto-Reply */}
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-white">Inbound SMS Auto-Reply</p>
                                                <p className="text-[11px] text-slate-400">
                                                    Automatically text customers back when they message this number.
                                                </p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={smsAutoReplyEnabled}
                                                    onChange={(e) => setSmsAutoReplyEnabled(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                                            </label>
                                        </div>
                                        {smsAutoReplyEnabled && (
                                            <input
                                                type="text"
                                                value={smsAutoReplyMessage}
                                                onChange={(e) => setSmsAutoReplyMessage(e.target.value)}
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                            />
                                        )}
                                    </div>

                                    <div className="pt-4 flex justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(2)}
                                            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
                                        >
                                            ← Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(4)}
                                            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition"
                                        >
                                            Next: Team & Invites →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* --- STEP 4: TEAM & INVITES --- */}
                            {currentStep === 4 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <IconUsers className="h-5 w-5 text-blue-400" />
                                            <span>Add Team Members & Invite Code</span>
                                        </h2>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Add team members to your organization now, or share your invite code so they
                                            can join on their own.
                                        </p>
                                    </div>

                                    {/* Invite Code Showcase */}
                                    <div className="rounded-2xl border border-blue-500/30 bg-blue-600/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                                                Your Organization Master Invite Code
                                            </p>
                                            <p className="mt-1 text-2xl font-black font-mono tracking-wider text-white">
                                                {previewInviteCode}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                Anyone with this code can join as a team member.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(previewInviteCode);
                                                setCopiedCode(true);
                                                setTimeout(() => setCopiedCode(false), 2000);
                                            }}
                                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
                                        >
                                            {copiedCode ? (
                                                <IconCheck className="h-4 w-4" />
                                            ) : (
                                                <IconCopy className="h-4 w-4" />
                                            )}
                                            <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                                        </button>
                                    </div>

                                    {/* Add Member Form */}
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                                            Invite Members Now (Optional)
                                        </p>
                                        <div className="grid gap-3 sm:grid-cols-4">
                                            <input
                                                type="text"
                                                placeholder="Name (e.g. Alex Alban)"
                                                value={newMemberName}
                                                onChange={(e) => setNewMemberName(e.target.value)}
                                                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email address"
                                                value={newMemberEmail}
                                                onChange={(e) => setNewMemberEmail(e.target.value)}
                                                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Cell / Forwarding phone"
                                                value={newMemberPhone}
                                                onChange={(e) => setNewMemberPhone(e.target.value)}
                                                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                            />
                                            <div className="flex gap-2">
                                                <select
                                                    value={newMemberRole}
                                                    onChange={(e) => setNewMemberRole(e.target.value as TenantRole)}
                                                    className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="member">Member</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={handleAddPendingMember}
                                                    className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>

                                        {/* Pending Members List */}
                                        {pendingMembers.length > 0 && (
                                            <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                                                <p className="text-[11px] font-semibold text-slate-400">
                                                    Members to add on creation ({pendingMembers.length}):
                                                </p>
                                                {pendingMembers.map((m, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 text-xs"
                                                    >
                                                        <div>
                                                            <span className="font-semibold text-white">
                                                                {m.displayName}
                                                            </span>
                                                            <span className="ml-2 text-slate-400 font-mono text-[11px]">
                                                                {m.email}
                                                            </span>
                                                            {m.phoneNumber && (
                                                                <span className="ml-2 text-slate-500 text-[11px]">
                                                                    · {m.phoneNumber}
                                                                </span>
                                                            )}
                                                            <span className="ml-2 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 uppercase">
                                                                {m.role}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePendingMember(idx)}
                                                            className="text-slate-400 hover:text-red-400 p-1"
                                                        >
                                                            <IconTrash className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 flex justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(3)}
                                            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
                                        >
                                            ← Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCompleteSetup}
                                            disabled={isSubmitting}
                                            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition disabled:opacity-50"
                                        >
                                            {isSubmitting ? "Creating Organization..." : "Complete Setup & Launch 🚀"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* --- STEP 5: SUCCESS & LAUNCH --- */}
                            {currentStep === 5 && (
                                <div className="text-center py-6 space-y-6 animate-fade-in">
                                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-xl shadow-emerald-500/10">
                                        <IconCheckCircle className="h-10 w-10" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                                            {orgName} is Ready!
                                        </h2>
                                        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                                            Your organization has been created, calling preferences are configured, and
                                            your Twilio line is live.
                                        </p>
                                    </div>

                                    {/* Summary Card */}
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-left max-w-md mx-auto space-y-3 text-xs">
                                        <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                            <span className="text-slate-400">Organization:</span>
                                            <span className="font-semibold text-white">
                                                {orgName} {createdOrgId ? `(${createdOrgId})` : ""}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                            <span className="text-slate-400">Phone Line:</span>
                                            <span className="font-mono font-semibold text-blue-400 text-right">
                                                {!skipPhoneProvisioning
                                                    ? useCustomPhone
                                                        ? customPhoneInput
                                                        : availableNumbers.find((n) => n.phoneNumber === selectedNumber)
                                                          ? `${availableNumbers.find((n) => n.phoneNumber === selectedNumber)?.friendlyName} (${availableNumbers.find((n) => n.phoneNumber === selectedNumber)?.locality || "Local"}, ${availableNumbers.find((n) => n.phoneNumber === selectedNumber)?.region || "US"})`
                                                          : selectedNumber
                                                    : "None (Add later)"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                            <span className="text-slate-400">Routing Mode:</span>
                                            <span className="font-semibold text-white capitalize">
                                                {routingStrategy.replace("_", " ")}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Invite Code:</span>
                                            <span className="font-mono font-bold text-emerald-400">
                                                {createdInviteCode}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                                        <Link
                                            to="/events"
                                            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/25"
                                        >
                                            Go to Events & Schedule →
                                        </Link>
                                        <Link
                                            to="/org/settings"
                                            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
                                        >
                                            Configure Settings
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB 2: JOIN AN EXISTING ORGANIZATION                           */}
                    {/* ============================================================== */}
                    {activeTab === "join" && (
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl animate-fade-in">
                            <form onSubmit={handleJoinOrg} className="max-w-md mx-auto space-y-6">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                                        Organization Invite Code
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. FENW-8821"
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                                    />
                                    <p className="mt-2 text-xs text-slate-500 text-center">
                                        Invite codes are typically 8-10 characters, like{" "}
                                        <span className="font-mono text-slate-400">HALL-1234</span>.
                                    </p>
                                </div>

                                {joinError && (
                                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 text-center">
                                        {joinError}
                                    </div>
                                )}

                                {joinSuccess && (
                                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300 flex items-center justify-center gap-2">
                                        <IconCheckCircle className="h-4 w-4" />
                                        <span>Joined successfully! Redirecting to events...</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isJoining || joinSuccess || !joinCode.trim()}
                                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition disabled:opacity-50"
                                >
                                    {isJoining ? "Joining Organization..." : "Join Organization"}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
