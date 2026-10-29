import { useState, useMemo } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import { useApp, type TenantRole, type OrgMember } from "../context/AppContext";
import {
    IconBuilding,
    IconPlus,
    IconTrash,
    IconShield,
    IconCopy,
    IconCheck,
    IconCheckCircle
} from "../components/Icons";

export function meta() {
    return [
        { title: "Team & User Management | PartyLine" },
        { name: "description", content: "Manage, add, and remove organization members and permissions." }
    ];
}

const ROLE_DESCRIPTIONS: Record<TenantRole, string> = {
    owner: "Full billing, settings, phone numbers, and member control",
    admin: "Can manage team, view/edit schedules, and change settings",
    member: "Receives calls according to schedule, answers texts",
    viewer: "Read-only access to schedules and event calendar"
};

const ROLE_BADGE_STYLE: Record<TenantRole, string> = {
    owner: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    admin: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    member: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    viewer: "border-slate-600 bg-slate-800 text-slate-400"
};

export default function OrgUsersPage() {
    const {
        currentTenant,
        members,
        invites,
        addMember,
        updateMemberRole,
        toggleMemberActive,
        removeMember,
        createInvite,
        revokeInvite
    } = useApp();

    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<OrgMember | null>(null);

    // Form inputs for direct member add
    const [newDisplayName, setNewDisplayName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newRole, setNewRole] = useState<TenantRole>("member");
    const [addError, setAddError] = useState("");

    // Form inputs for invite creation
    const [inviteRole, setInviteRole] = useState<TenantRole>("member");
    const [createdCode, setCreatedCode] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const filteredMembers = useMemo(() => {
        return members.filter((m) => {
            const matchesSearch =
                m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.phoneNumber && m.phoneNumber.includes(searchQuery));
            const matchesRole = roleFilter === "all" || m.role === roleFilter;
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && m.active) ||
                (statusFilter === "inactive" && !m.active);
            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [members, searchQuery, roleFilter, statusFilter]);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError("");
        if (!newDisplayName.trim() || !newEmail.trim()) {
            setAddError("Please provide both name and email.");
            return;
        }

        try {
            await addMember({
                displayName: newDisplayName.trim(),
                email: newEmail.trim(),
                phoneNumber: newPhone.trim() || undefined,
                role: newRole
            });
            setIsAddModalOpen(false);
            setNewDisplayName("");
            setNewEmail("");
            setNewPhone("");
            setNewRole("member");
            showToast("Member successfully added to organization.");
        } catch (err) {
            setAddError(err instanceof Error ? err.message : "Failed to add member.");
        }
    };

    const handleCreateInvite = async () => {
        const code = await createInvite(inviteRole);
        setCreatedCode(code);
        showToast(`New invite code created: ${code}`);
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCode(id);
        setTimeout(() => setCopiedCode(null), 2000);
        showToast("Copied to clipboard!");
    };

    const confirmDelete = async () => {
        if (!memberToDelete) return;
        await removeMember(memberToDelete.uid);
        setMemberToDelete(null);
        showToast("Member removed from organization.");
    };

    const activeCount = members.filter((m) => m.active).length;
    const adminCount = members.filter((m) => m.role === "admin" || m.role === "owner").length;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <Navbar />

            {!currentTenant ? (
                <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6">
                    <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
                        <IconBuilding className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                        <h3 className="text-lg font-semibold text-white">No active organization</h3>
                        <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                            Select or register an organization first to manage team members and permissions.
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
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                                        <IconShield className="h-4 w-4" />
                                        <span>Administration</span>
                                    </div>
                                    <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                        Team Members & Access
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-400">
                                        Manage the operators and hosts who answer calls for{" "}
                                        <span className="font-semibold text-slate-200">{currentTenant.name}</span>.
                                    </p>
                                </div>

                                {/* Top Action Buttons */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsInviteModalOpen(true)}
                                        className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-sm"
                                    >
                                        <IconCopy className="h-4 w-4 text-blue-400" />
                                        Share Invite Link
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition"
                                    >
                                        <IconPlus className="h-4 w-4" />
                                        Add Team Member
                                    </button>
                                </div>
                            </div>

                            {/* Stats bar */}
                            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
                                    <p className="text-xs text-slate-400">Total Members</p>
                                    <p className="mt-1 text-xl sm:text-2xl font-bold text-white">{members.length}</p>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
                                    <p className="text-xs text-slate-400">Active on Duty</p>
                                    <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-400">{activeCount}</p>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
                                    <p className="text-xs text-slate-400">Admins & Owners</p>
                                    <p className="mt-1 text-xl sm:text-2xl font-bold text-blue-400">{adminCount}</p>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
                                    <p className="text-xs text-slate-400">Active Invites</p>
                                    <p className="mt-1 text-xl sm:text-2xl font-bold text-purple-400">
                                        {invites.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
                        {/* Search & Filters */}
                        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative flex-1 max-w-md">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search members by name, email, or phone..."
                                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="all">All Roles</option>
                                    <option value="owner">Owners</option>
                                    <option value="admin">Admins</option>
                                    <option value="member">Members</option>
                                    <option value="viewer">Viewers</option>
                                </select>

                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active Only</option>
                                    <option value="inactive">Inactive Only</option>
                                </select>
                            </div>
                        </div>

                        {/* Members Table */}
                        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold">User</th>
                                            <th className="px-6 py-4 font-semibold">Contact Phone</th>
                                            <th className="px-6 py-4 font-semibold">Role</th>
                                            <th className="px-6 py-4 font-semibold">Availability</th>
                                            <th className="px-6 py-4 font-semibold">Joined</th>
                                            <th className="px-6 py-4 text-right font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {filteredMembers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                    No team members match your filter criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMembers.map((m) => {
                                                const initials = m.displayName
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")
                                                    .toUpperCase()
                                                    .slice(0, 2);

                                                return (
                                                    <tr key={m.uid} className="hover:bg-slate-800/40 transition">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="relative">
                                                                    <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-white">
                                                                        {initials}
                                                                    </div>
                                                                    <span
                                                                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${
                                                                            m.active ? "bg-emerald-500" : "bg-slate-500"
                                                                        }`}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-white">
                                                                        {m.displayName}
                                                                    </p>
                                                                    <p className="text-xs text-slate-400">{m.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4">
                                                            {m.phoneNumber ? (
                                                                <span className="font-mono text-xs text-slate-300">
                                                                    {m.phoneNumber}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-500">
                                                                    No phone assigned
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <select
                                                                    value={m.role}
                                                                    onChange={(e) =>
                                                                        updateMemberRole(
                                                                            m.uid,
                                                                            e.target.value as TenantRole
                                                                        )
                                                                    }
                                                                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize focus:outline-none ${
                                                                        ROLE_BADGE_STYLE[m.role]
                                                                    }`}
                                                                >
                                                                    <option
                                                                        value="owner"
                                                                        className="bg-slate-900 text-white"
                                                                    >
                                                                        Owner
                                                                    </option>
                                                                    <option
                                                                        value="admin"
                                                                        className="bg-slate-900 text-white"
                                                                    >
                                                                        Admin
                                                                    </option>
                                                                    <option
                                                                        value="member"
                                                                        className="bg-slate-900 text-white"
                                                                    >
                                                                        Member
                                                                    </option>
                                                                    <option
                                                                        value="viewer"
                                                                        className="bg-slate-900 text-white"
                                                                    >
                                                                        Viewer
                                                                    </option>
                                                                </select>
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleMemberActive(m.uid, !m.active)}
                                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                                                    m.active
                                                                        ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                                                                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                                        m.active ? "bg-emerald-400" : "bg-slate-400"
                                                                    }`}
                                                                />
                                                                {m.active ? "Active" : "Paused"}
                                                            </button>
                                                        </td>

                                                        <td className="px-6 py-4 text-xs text-slate-400">
                                                            {m.joinedAt}
                                                        </td>

                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => setMemberToDelete(m)}
                                                                disabled={
                                                                    m.role === "owner" &&
                                                                    members.filter((x) => x.role === "owner").length <=
                                                                        1
                                                                }
                                                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition disabled:opacity-30 disabled:pointer-events-none"
                                                                title="Remove user from organization"
                                                            >
                                                                <IconTrash className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Organization Invites Section */}
                        <div className="mt-10">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white">Active Shareable Invites</h2>
                                    <p className="text-xs text-slate-400">
                                        Teammates can enter these codes at sign-up to automatically join this
                                        organization.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCreateInvite}
                                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                                >
                                    <IconPlus className="h-3.5 w-3.5" />
                                    Generate Code
                                </button>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Default Master Org Code Card */}
                                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                                                Organization Code
                                            </span>
                                            <span className="text-xs text-slate-400">Permanent</span>
                                        </div>
                                        <p className="mt-3 font-mono text-2xl font-bold tracking-wider text-white">
                                            {currentTenant?.inviteCode || "HALL-8821"}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Default code for onboarding members with default role.
                                        </p>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleCopy(currentTenant?.inviteCode || "HALL-8821", "master-code")
                                            }
                                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/30 border border-blue-500/40 px-3 py-1.5 text-xs font-medium text-blue-200 hover:bg-blue-600/40 transition"
                                        >
                                            {copiedCode === "master-code" ? (
                                                <>
                                                    <IconCheck className="h-3.5 w-3.5 text-green-400" />
                                                    <span>Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <IconCopy className="h-3.5 w-3.5" />
                                                    <span>Copy Code</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleCopy(
                                                    `${window.location.origin}/signup?type=join-org&invite=${currentTenant?.inviteCode || "HALL-8821"}`,
                                                    "master-link"
                                                )
                                            }
                                            className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition"
                                            title="Copy direct signup link"
                                        >
                                            {copiedCode === "master-link" ? "Link Copied" : "Copy Link"}
                                        </button>
                                    </div>
                                </div>

                                {/* Generated Invites */}
                                {invites.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_BADGE_STYLE[inv.role]}`}
                                                >
                                                    {inv.role} Role
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => revokeInvite(inv.id)}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    Revoke
                                                </button>
                                            </div>
                                            <p className="mt-3 font-mono text-xl font-bold tracking-wider text-white">
                                                {inv.code}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">Expires: {inv.expiresAt}</p>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(inv.code, inv.id)}
                                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                                            >
                                                {copiedCode === inv.id ? (
                                                    <>
                                                        <IconCheck className="h-3.5 w-3.5 text-green-400" />
                                                        <span>Copied!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconCopy className="h-3.5 w-3.5" />
                                                        <span>Copy Code</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </main>
                </>
            )}

            {/* Modal: Add Member Directly */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={handleAddMember}
                        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-white">Add New Team Member</h3>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        {addError && (
                            <p className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-300">
                                {addError}
                            </p>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-300">Full Name</label>
                            <input
                                type="text"
                                required
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                placeholder="e.g. Alex Alban"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300">Email Address</label>
                            <input
                                type="email"
                                required
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="alex@organization.com"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300">
                                Personal Phone (for call forwarding)
                            </label>
                            <input
                                type="tel"
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                placeholder="+16175550182"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300">Role & Permission</label>
                            <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as TenantRole)}
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                            >
                                <option value="member">Member - Answers calls according to event duty</option>
                                <option value="admin">Admin - Can manage members and schedules</option>
                                <option value="viewer">Viewer - Read-only access to events</option>
                            </select>
                            <p className="mt-1 text-[11px] text-slate-400">{ROLE_DESCRIPTIONS[newRole]}</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
                            >
                                Add Member
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Share / Create Invite */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-white">Generate Invite Link</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsInviteModalOpen(false);
                                    setCreatedCode(null);
                                }}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300">
                                Assign Default Role for Joiners
                            </label>
                            <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value as TenantRole)}
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                            >
                                <option value="member">Member (Regular host on duty)</option>
                                <option value="admin">Admin (Full administrative privileges)</option>
                                <option value="viewer">Viewer (View-only schedule access)</option>
                            </select>
                        </div>

                        {createdCode ? (
                            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 space-y-2">
                                <p className="text-xs font-medium text-green-300">Invite Code Created!</p>
                                <p className="font-mono text-2xl font-bold tracking-wider text-white">{createdCode}</p>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(createdCode, "modal-code")}
                                        className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
                                    >
                                        Copy Code
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleCopy(
                                                `${window.location.origin}/signup?type=join-org&invite=${createdCode}`,
                                                "modal-link"
                                            )
                                        }
                                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                                    >
                                        Copy Direct Link
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleCreateInvite}
                                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition shadow"
                            >
                                Generate New Invite Code
                            </button>
                        )}

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsInviteModalOpen(false);
                                    setCreatedCode(null);
                                }}
                                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirm Delete Member */}
            {memberToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-white">Remove Team Member?</h3>
                        <p className="text-xs text-slate-400">
                            Are you sure you want to remove{" "}
                            <span className="font-semibold text-white">{memberToDelete.displayName}</span> (
                            {memberToDelete.email}) from {currentTenant?.name}? They will no longer receive calls or
                            access this organization's events.
                        </p>
                        <div className="flex justify-end gap-3 pt-3">
                            <button
                                type="button"
                                onClick={() => setMemberToDelete(null)}
                                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition shadow"
                            >
                                Remove Member
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
