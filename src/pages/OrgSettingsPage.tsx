import { useState, useEffect } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp, type OrgSettings } from "../context/AppContext";
import {
    IconBuilding,
    IconCheckCircle,
    IconCog,
    IconPhone,
    IconPlus,
    IconShield,
    IconTrash
} from "../components/Icons";

export function meta() {
    return [
        { title: "Organization Settings | PartyLine" },
        { name: "description", content: "Configure phone numbers, call routing rules, and messaging behavior." }
    ];
}

const TIMEZONES = [
    { label: "Eastern Time (US & Canada)", value: "America/New_York" },
    { label: "Central Time (US & Canada)", value: "America/Chicago" },
    { label: "Mountain Time (US & Canada)", value: "America/Denver" },
    { label: "Pacific Time (US & Canada)", value: "America/Los_Angeles" },
    { label: "UTC", value: "UTC" }
];

export default function OrgSettingsPage() {
    const { currentTenant, updateOrgSettings, addPhoneNumber, removePhoneNumber, setPrimaryPhoneNumber } = useApp();

    const [orgName, setOrgName] = useState(currentTenant?.name || "");
    const [settings, setSettings] = useState<OrgSettings>(() => {
        return (
            currentTenant?.settings || {
                routingStrategy: "sequential",
                ringTimeoutSeconds: 20,
                answerMessage: "Thank you for calling PartyLine. Connecting your call to our on-duty team member...",
                fallbackAction: "voicemail",
                fallbackPhone: "",
                smsAutoReplyEnabled: true,
                smsAutoReplyMessage:
                    "Thank you for reaching out to PartyLine! A host on duty has received your message and will reply shortly.",
                timezone: "America/New_York"
            }
        );
    });

    useEffect(() => {
        if (currentTenant) {
            setOrgName(currentTenant.name);
            setSettings(currentTenant.settings);
        }
    }, [currentTenant]);

    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Add phone number modal state
    const [isAddPhoneModalOpen, setIsAddPhoneModalOpen] = useState(false);
    const [newNumber, setNewNumber] = useState("");
    const [newNumberLabel, setNewNumberLabel] = useState("");
    const [newNumberPrimary, setNewNumberPrimary] = useState(false);
    const [phoneError, setPhoneError] = useState("");

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleSaveGlobalSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateOrgSettings(settings);
            showToast("Organization settings saved successfully!");
        } catch {
            showToast("Failed to save organization settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddPhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPhoneError("");
        if (!newNumber.trim()) {
            setPhoneError("Phone number is required.");
            return;
        }

        try {
            await addPhoneNumber({
                number: newNumber.trim(),
                label: newNumberLabel.trim() || "Main Line",
                isPrimary: newNumberPrimary
            });
            setIsAddPhoneModalOpen(false);
            setNewNumber("");
            setNewNumberLabel("");
            setNewNumberPrimary(false);
            showToast("Phone number added successfully!");
        } catch {
            setPhoneError("Failed to add phone number.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <Navbar />

            {!currentTenant ? (
                <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6">
                    <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
                        <IconBuilding className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                        <h3 className="text-lg font-semibold text-white">No active organization</h3>
                        <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                            Select or register an organization first to configure its numbers and calling behavior.
                        </p>
                        <Link
                            to="/account"
                            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
                        >
                            Create or Join an Organization
                        </Link>
                    </div>
                </main>
            ) : (
                <>
                    {/* Page Header */}
                    <div className="border-b border-slate-800 bg-slate-900/40">
                        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                                <IconCog className="h-4 w-4" />
                                <span>Configuration</span>
                            </div>
                            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                Organization Settings
                            </h1>
                            <p className="mt-1 text-sm text-slate-400">
                                Manage phone numbers, default calling behavior, answer greetings, and SMS preferences
                                for <span className="font-semibold text-slate-200">{currentTenant.name}</span>.
                            </p>
                        </div>
                    </div>

                    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
                        <form onSubmit={handleSaveGlobalSettings} className="space-y-8">
                            {/* Section 1: General Organization Info */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 text-white font-semibold">
                                    <IconBuilding className="h-5 w-5 text-blue-400" />
                                    <h2>Organization Profile</h2>
                                </div>

                                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300">
                                            Organization Display Name
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={orgName}
                                            onChange={(e) => setOrgName(e.target.value)}
                                            className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-300">
                                            Operating Timezone
                                        </label>
                                        <select
                                            value={settings.timezone}
                                            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                                            className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                                        >
                                            {TIMEZONES.map((tz) => (
                                                <option
                                                    key={tz.value}
                                                    value={tz.value}
                                                    className="bg-slate-900 text-white"
                                                >
                                                    {tz.label} ({tz.value})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Phone Numbers Management */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                    <div className="flex items-center gap-2.5 text-white font-semibold">
                                        <IconPhone className="h-5 w-5 text-blue-400" />
                                        <h2>Phone Numbers ({currentTenant?.phoneNumbers.length ?? 0})</h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddPhoneModalOpen(true)}
                                        className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                                    >
                                        <IconPlus className="h-3.5 w-3.5 text-blue-400" />
                                        Add Phone Number
                                    </button>
                                </div>

                                <p className="mt-3 text-xs text-slate-400">
                                    These are the public-facing numbers renters call or text. PartyLine intercepts
                                    inbound events and directs them to the host on duty.
                                </p>

                                <div className="mt-4 space-y-3">
                                    {currentTenant?.phoneNumbers.length === 0 ? (
                                        <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                                            No phone numbers assigned yet. Click "Add Phone Number" to link a Twilio or
                                            provisioned number.
                                        </p>
                                    ) : (
                                        currentTenant?.phoneNumbers.map((pn) => (
                                            <div
                                                key={pn.id}
                                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700 transition"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                                        <IconPhone className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-sm font-bold text-white">
                                                                {pn.number}
                                                            </span>
                                                            {pn.isPrimary && (
                                                                <span className="rounded bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-300">
                                                                    Primary Line
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400">{pn.label}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {!pn.isPrimary && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPrimaryPhoneNumber(pn.id)}
                                                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                                                        >
                                                            Set as Primary
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhoneNumber(pn.id)}
                                                        disabled={currentTenant.phoneNumbers.length <= 1}
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition disabled:opacity-30 disabled:pointer-events-none"
                                                        title={
                                                            currentTenant.phoneNumbers.length <= 1
                                                                ? "At least one number is required."
                                                                : "Delete number"
                                                        }
                                                    >
                                                        <IconTrash className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Section 3: Calling Behavior & Routing Strategy */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-6">
                                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 text-white font-semibold">
                                    <IconShield className="h-5 w-5 text-blue-400" />
                                    <h2>Calling Behavior & Routing Strategy</h2>
                                </div>

                                {/* Strategy Selection Cards */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                                        Inbound Call Distribution Mode
                                    </label>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        {/* Sequential */}
                                        <label
                                            className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition ${
                                                settings.routingStrategy === "sequential"
                                                    ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                                                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="font-semibold text-sm text-white">
                                                    Sequential (Hunt Group)
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="strategy"
                                                    value="sequential"
                                                    checked={settings.routingStrategy === "sequential"}
                                                    onChange={() =>
                                                        setSettings({ ...settings, routingStrategy: "sequential" })
                                                    }
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                                                Rings the primary scheduled host first. If unanswered within the
                                                timeout, rolls over to the backup host, then admin.
                                            </p>
                                            <span className="mt-3 inline-block rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300 w-fit">
                                                Recommended
                                            </span>
                                        </label>

                                        {/* Round Robin */}
                                        <label
                                            className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition ${
                                                settings.routingStrategy === "round_robin"
                                                    ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                                                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="font-semibold text-sm text-white">Round Robin</div>
                                                <input
                                                    type="radio"
                                                    name="strategy"
                                                    value="round_robin"
                                                    checked={settings.routingStrategy === "round_robin"}
                                                    onChange={() =>
                                                        setSettings({ ...settings, routingStrategy: "round_robin" })
                                                    }
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                                                Evenly balances calls across all active team members scheduled during
                                                that shift window.
                                            </p>
                                            <span className="mt-3 inline-block text-[10px] text-slate-500">
                                                Fair Distribution
                                            </span>
                                        </label>

                                        {/* Simultaneous */}
                                        <label
                                            className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition ${
                                                settings.routingStrategy === "simultaneous"
                                                    ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                                                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="font-semibold text-sm text-white">
                                                    Simultaneous Ring
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="strategy"
                                                    value="simultaneous"
                                                    checked={settings.routingStrategy === "simultaneous"}
                                                    onChange={() =>
                                                        setSettings({ ...settings, routingStrategy: "simultaneous" })
                                                    }
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                                                Rings every active host simultaneously. Whichever host picks up first
                                                connects to the caller.
                                            </p>
                                            <span className="mt-3 inline-block text-[10px] text-slate-500">
                                                Fastest Pickup
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Ring Timeout */}
                                <div className="grid gap-6 sm:grid-cols-2 pt-2">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-slate-300">
                                                Ring Timeout Per Member
                                            </label>
                                            <span className="font-mono text-xs font-semibold text-blue-400">
                                                {settings.ringTimeoutSeconds} seconds
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={10}
                                            max={60}
                                            step={5}
                                            value={settings.ringTimeoutSeconds}
                                            onChange={(e) =>
                                                setSettings({ ...settings, ringTimeoutSeconds: Number(e.target.value) })
                                            }
                                            className="mt-2 w-full accent-blue-500 cursor-pointer"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                            <span>10s (Fast)</span>
                                            <span>20s (Default)</span>
                                            <span>60s (Long)</span>
                                        </div>
                                    </div>

                                    {/* Fallback Action */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300">
                                            Fallback Action If No One Answers
                                        </label>
                                        <select
                                            value={settings.fallbackAction}
                                            onChange={(e) =>
                                                setSettings({
                                                    ...settings,
                                                    fallbackAction: e.target.value as OrgSettings["fallbackAction"]
                                                })
                                            }
                                            className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="voicemail" className="bg-slate-900 text-white">
                                                Take Voicemail & Send Transcript
                                            </option>
                                            <option value="forward" className="bg-slate-900 text-white">
                                                Forward to External Backup Number
                                            </option>
                                            <option value="hangup" className="bg-slate-900 text-white">
                                                Play Busy Greeting and End Call
                                            </option>
                                        </select>
                                    </div>
                                </div>

                                {settings.fallbackAction === "forward" && (
                                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                                        <label className="block text-xs font-medium text-amber-300">
                                            External Backup Forwarding Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={settings.fallbackPhone}
                                            onChange={(e) =>
                                                setSettings({ ...settings, fallbackPhone: e.target.value })
                                            }
                                            placeholder="+15085550199"
                                            className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                )}

                                {/* Answer Message / IVR */}
                                <div className="pt-2">
                                    <label className="block text-xs font-medium text-slate-300">
                                        Initial Inbound Voice Greeting (Text-to-Speech)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={settings.answerMessage}
                                        onChange={(e) => setSettings({ ...settings, answerMessage: e.target.value })}
                                        placeholder="Thank you for calling PartyLine..."
                                        className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                    />
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        Callers hear this voice announcement immediately before PartyLine dials your
                                        hosts.
                                    </p>
                                </div>
                            </div>

                            {/* Section 4: Inbound SMS & Auto-Reply */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                    <div>
                                        <h2 className="text-white font-semibold">SMS Auto-Reply Settings</h2>
                                        <p className="text-xs text-slate-400">
                                            Automatically send an immediate acknowledgment when a renter texts your
                                            shared line.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings.smsAutoReplyEnabled}
                                        onChange={(e) =>
                                            setSettings({ ...settings, smsAutoReplyEnabled: e.target.checked })
                                        }
                                        className="h-5 w-5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                                    />
                                </div>

                                {settings.smsAutoReplyEnabled && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300">
                                            Auto-Reply Message Template
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={settings.smsAutoReplyMessage}
                                            onChange={(e) =>
                                                setSettings({ ...settings, smsAutoReplyMessage: e.target.value })
                                            }
                                            placeholder="Thank you for reaching out..."
                                            className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Save Action Bar */}
                            <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
                                <p className="text-xs text-slate-400">
                                    Changes apply across all future inbound calls and texts for {currentTenant?.name}.
                                </p>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition disabled:opacity-60"
                                >
                                    {isSaving ? "Saving..." : "Save Org Settings"}
                                </button>
                            </div>
                        </form>
                    </main>
                </>
            )}

            {/* Modal: Add Phone Number */}
            {isAddPhoneModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={handleAddPhoneSubmit}
                        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-white">Add Twilio / Organization Number</h3>
                            <button
                                type="button"
                                onClick={() => setIsAddPhoneModalOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        {phoneError && (
                            <p className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-300">
                                {phoneError}
                            </p>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-300">
                                Phone Number (E.164 format)
                            </label>
                            <input
                                type="tel"
                                required
                                value={newNumber}
                                onChange={(e) => setNewNumber(e.target.value)}
                                placeholder="+19789972789"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300">Friendly Label</label>
                            <input
                                type="text"
                                value={newNumberLabel}
                                onChange={(e) => setNewNumberLabel(e.target.value)}
                                placeholder="e.g. Field Reservations, Main Hall"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <label className="flex items-center gap-2 pt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={newNumberPrimary}
                                onChange={(e) => setNewNumberPrimary(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-300">Make this the default primary number</span>
                        </label>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsAddPhoneModalOpen(false)}
                                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
                            >
                                Add Number
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <Footer />

            {/* Toast Feedback */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl animate-fade-in">
                    <IconCheckCircle className="h-5 w-5 text-green-400" />
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
}
