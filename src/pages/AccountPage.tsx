import { useState, useEffect } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp, type TenantRole } from "../context/AppContext";
import {
    IconBuilding,
    IconCheckCircle,
    IconPlus,
    IconShield,
    IconUser,
    IconPhone,
    IconBell
} from "../components/Icons";

export function meta() {
    return [
        { title: "My Account & Organizations | PartyLine" },
        { name: "description", content: "Manage your personal profile, phone number, and organization memberships." }
    ];
}

const ROLE_BADGE_STYLE: Record<TenantRole, string> = {
    owner: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    admin: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    member: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    viewer: "border-slate-600 bg-slate-800 text-slate-400"
};

export default function AccountPage() {
    const {
        user,
        userProfile,
        updateUserProfile,
        tenants,
        currentTenant,
        switchTenant,
        leaveOrganization,
        joinOrganizationByCode,
        createOrganization,
        userInvites,
        respondToUserInvite
    } = useApp();

    // Personal settings state
    const [name, setName] = useState(userProfile.displayName || user?.displayName || "");
    const [email, setEmail] = useState(userProfile.email || user?.email || "");
    const [phone, setPhone] = useState(userProfile.phoneNumber || user?.phoneNumber || "");
    const [dnd, setDnd] = useState(userProfile.doNotDisturb);
    const [smsNotify, setSmsNotify] = useState(userProfile.notifySmsOnMissedCalls);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    useEffect(() => {
        setName(userProfile.displayName || user?.displayName || "");
        setEmail(userProfile.email || user?.email || "");
        setPhone(userProfile.phoneNumber || user?.phoneNumber || "");
        setDnd(userProfile.doNotDisturb);
        setSmsNotify(userProfile.notifySmsOnMissedCalls);
    }, [userProfile, user]);

    // Join org state
    const [joinCode, setJoinCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState("");

    // Create org modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [newOrgPhone, setNewOrgPhone] = useState("");
    const [isCreatingOrg, setIsCreatingOrg] = useState(false);

    // Leave org confirmation state
    const [orgToLeave, setOrgToLeave] = useState<{ id: string; name: string } | null>(null);

    // Toast
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProfile(true);
        try {
            await updateUserProfile({
                displayName: name.trim(),
                email: email.trim(),
                phoneNumber: phone.trim(),
                doNotDisturb: dnd,
                notifySmsOnMissedCalls: smsNotify
            });
            showToast("Your profile and preferences have been updated.");
        } catch {
            showToast("Unable to update profile.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleJoinOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoinError("");
        if (!joinCode.trim()) {
            setJoinError("Please enter an invite code.");
            return;
        }

        setIsJoining(true);
        try {
            const success = await joinOrganizationByCode(joinCode.trim());
            if (success) {
                setJoinCode("");
                showToast("Successfully joined organization!");
            } else {
                setJoinError("Invalid or expired invite code.");
            }
        } catch {
            setJoinError("Failed to join organization.");
        } finally {
            setIsJoining(false);
        }
    };

    const handleCreateNewOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrgName.trim()) return;

        setIsCreatingOrg(true);
        try {
            await createOrganization(newOrgName.trim(), newOrgPhone.trim());
            setIsCreateModalOpen(false);
            setNewOrgName("");
            setNewOrgPhone("");
            showToast("Organization created successfully!");
        } catch {
            showToast("Failed to create organization.");
        } finally {
            setIsCreatingOrg(false);
        }
    };

    const confirmLeaveOrg = async () => {
        if (!orgToLeave) return;
        await leaveOrganization(orgToLeave.id);
        setOrgToLeave(null);
        showToast(`You have left ${orgToLeave.name}.`);
    };

    const initials = (name || "User")
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <Navbar />

            {/* Profile Header */}
            <div className="border-b border-slate-800 bg-slate-900/40">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
                        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-500 text-2xl font-bold text-white shadow-xl shadow-blue-500/20">
                            {initials}
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                {name || "My Account"}
                            </h1>
                            <p className="text-sm text-slate-400">
                                {email || "No email assigned"} · Member of {tenants.length} organization(s)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-10">
                {/* Pending Invites Alert Banner (if any) */}
                {userInvites.length > 0 && (
                    <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 shadow-lg">
                        <div className="flex items-center gap-2 text-blue-300 font-semibold text-sm mb-3">
                            <IconBell className="h-5 w-5" />
                            <span>You have {userInvites.length} pending organization invite(s)</span>
                        </div>
                        <div className="space-y-3">
                            {userInvites.map((inv) => (
                                <div
                                    key={inv.id}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-blue-500/20 bg-slate-900/80 p-4"
                                >
                                    <div>
                                        <p className="font-semibold text-white">{inv.tenantName}</p>
                                        <p className="text-xs text-slate-400">
                                            Role offered:{" "}
                                            <span className="font-medium uppercase text-blue-300">{inv.role}</span> ·
                                            Invited on {inv.invitedAt}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => respondToUserInvite(inv.id, true)}
                                            className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
                                        >
                                            Accept & Join
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => respondToUserInvite(inv.id, false)}
                                            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid gap-10 lg:grid-cols-3">
                    {/* Left Column: Personal Profile & Contact Settings */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Profile Settings Card */}
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 text-white font-semibold">
                                <IconUser className="h-5 w-5 text-blue-400" />
                                <h2>Profile & Contact Details</h2>
                            </div>

                            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300">Display Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Your full name"
                                            className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300">
                                        Personal Phone Number (Forwarding Target)
                                    </label>
                                    <div className="relative mt-1">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <IconPhone className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+19789972789"
                                            className="block w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        When you are on duty for an event, PartyLine rings this personal number without
                                        revealing it to renters.
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-slate-800 space-y-3">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Call & Availability Preferences
                                    </p>

                                    <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 cursor-pointer hover:border-slate-700 transition">
                                        <div>
                                            <p className="text-sm font-medium text-white">Do Not Disturb</p>
                                            <p className="text-xs text-slate-400">
                                                Temporarily route calls directly to the backup host even if you are on
                                                duty
                                            </p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={dnd}
                                            onChange={(e) => setDnd(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 cursor-pointer hover:border-slate-700 transition">
                                        <div>
                                            <p className="text-sm font-medium text-white">
                                                SMS Notification for Missed Calls
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                Receive a direct text alert when a renter misses you or leaves a
                                                voicemail
                                            </p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={smsNotify}
                                            onChange={(e) => setSmsNotify(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                                        />
                                    </label>
                                </div>

                                <div className="pt-3 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSavingProfile}
                                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition disabled:opacity-60"
                                    >
                                        {isSavingProfile ? "Saving changes..." : "Save Profile Settings"}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Organizations List Card */}
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                <div className="flex items-center gap-2.5 text-white font-semibold">
                                    <IconBuilding className="h-5 w-5 text-blue-400" />
                                    <h2>My Organizations ({tenants.length})</h2>
                                </div>
                                <Link
                                    to="/org/new"
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                                >
                                    <IconPlus className="h-3.5 w-3.5 text-blue-400" />
                                    New Org Setup
                                </Link>
                            </div>

                            <div className="mt-4 space-y-3">
                                {tenants.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                                        You are not a member of any organization yet. Click "+ New Org" to create one or
                                        enter an invite code on the right to join.
                                    </p>
                                ) : (
                                    tenants.map((t) => {
                                        const isCurrent = t.id === currentTenant?.id;
                                        return (
                                            <div
                                                key={t.id}
                                                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border p-4 transition ${
                                                    isCurrent
                                                        ? "border-blue-500/50 bg-blue-500/10 shadow-sm"
                                                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-white">
                                                        {t.name[0]}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-white">{t.name}</p>
                                                            {isCurrent && (
                                                                <span className="rounded bg-blue-500 px-1.5 py-0.2 text-[10px] font-bold uppercase text-white">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span
                                                                className={`rounded px-2 py-0.2 text-[10px] font-bold uppercase ${ROLE_BADGE_STYLE[t.role]}`}
                                                            >
                                                                {t.role}
                                                            </span>
                                                            <span className="text-xs text-slate-500">ID: {t.id}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {!isCurrent && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                switchTenant(t.id);
                                                                showToast(`Switched active organization to ${t.name}`);
                                                            }}
                                                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                                                        >
                                                            Switch To Org
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setOrgToLeave({ id: t.id, name: t.name })}
                                                        disabled={tenants.length <= 1}
                                                        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition disabled:opacity-30 disabled:pointer-events-none"
                                                        title={
                                                            tenants.length <= 1
                                                                ? "You must belong to at least one organization."
                                                                : "Leave this organization"
                                                        }
                                                    >
                                                        Leave
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Join with code & Actions */}
                    <div className="space-y-6">
                        {/* Join with Invite Code Card */}
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-xl">
                            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                                <IconShield className="h-5 w-5" />
                                <h3>Join an Organization</h3>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">
                                Have an invite code from your team or facility administrator? Enter it here to join.
                            </p>

                            <form onSubmit={handleJoinOrg} className="space-y-3">
                                <div>
                                    <input
                                        type="text"
                                        required
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. HALL-8821"
                                        className="w-full uppercase tracking-wider rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                                {joinError && <p className="text-xs text-red-400">{joinError}</p>}
                                <button
                                    type="submit"
                                    disabled={isJoining}
                                    className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition disabled:opacity-60"
                                >
                                    {isJoining ? "Joining..." : "Join with Code"}
                                </button>
                            </form>
                        </div>

                        {/* Create Another Org Card */}
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                            <h3 className="font-semibold text-white mb-1">Create Another Organization</h3>
                            <p className="text-xs text-slate-400 mb-4">
                                Need to manage a separate league, sports hall, or event space with its own dedicated
                                numbers?
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(true)}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                            >
                                <IconPlus className="h-4 w-4 text-blue-400" />
                                Register New Organization
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal: Create Organization */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={handleCreateNewOrg}
                        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-white">Create New Organization</h3>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300">Organization Name</label>
                            <input
                                type="text"
                                required
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                                placeholder="e.g. North End Gymnasium"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300">
                                Primary Phone Number (Optional)
                            </label>
                            <input
                                type="tel"
                                value={newOrgPhone}
                                onChange={(e) => setNewOrgPhone(e.target.value)}
                                placeholder="+19789972789"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isCreatingOrg}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow disabled:opacity-60"
                            >
                                {isCreatingOrg ? "Creating..." : "Create Organization"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Confirm Leave Organization */}
            {orgToLeave && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-white">Leave Organization?</h3>
                        <p className="text-xs text-slate-400">
                            Are you sure you want to remove yourself from{" "}
                            <span className="font-semibold text-white">{orgToLeave.name}</span>? You will lose access to
                            this organization's numbers and events unless reinvited.
                        </p>
                        <div className="flex justify-end gap-3 pt-3">
                            <button
                                type="button"
                                onClick={() => setOrgToLeave(null)}
                                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmLeaveOrg}
                                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition shadow"
                            >
                                Leave Org
                            </button>
                        </div>
                    </div>
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
