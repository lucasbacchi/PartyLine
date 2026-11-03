import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { IconBuilding, IconCog, IconPhone, IconPlus, IconUsers, IconCalendar, IconUser } from "./Icons";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Navbar() {
    const { user, currentTenant, tenants, switchTenant, userProfile } = useApp();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const orgMenuRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
                setIsOrgMenuOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setIsUserMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function handleSignOut() {
        try {
            await signOut(auth);
            setIsUserMenuOpen(false);
            navigate("/login");
        } catch (err) {
            console.error("Sign out error", err);
        }
    }

    const isActive = (path: string) => {
        if (path === "/events" && location.pathname === "/events") return true;
        if (path === "/org/users" && location.pathname.startsWith("/org/users")) return true;
        if (path === "/org/settings" && location.pathname.startsWith("/org/settings")) return true;
        if (path === "/account" && location.pathname.startsWith("/account")) return true;
        return false;
    };

    const linkClasses = (path: string) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(path)
                ? "bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/20"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
        }`;

    const displayName = user?.displayName || userProfile.displayName || "User";
    const initials =
        displayName
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "PL";

    return (
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
                {/* Brand & Main Links */}
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 text-sm font-black text-white shadow-md shadow-blue-500/20">
                            P
                        </span>
                        <span className="bg-linear-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                            PartyLine
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    {user && (
                        <nav className="hidden items-center gap-1 md:flex">
                            <Link to="/events" className={linkClasses("/events")}>
                                <IconCalendar className="h-4 w-4" />
                                Events
                            </Link>
                            <Link to="/org/users" className={linkClasses("/org/users")}>
                                <IconUsers className="h-4 w-4" />
                                Team Members
                            </Link>
                            <Link to="/org/settings" className={linkClasses("/org/settings")}>
                                <IconCog className="h-4 w-4" />
                                Org Settings
                            </Link>
                        </nav>
                    )}
                </div>

                {/* Right controls: Org Switcher & User Menu or Auth Buttons */}
                {user ? (
                    <div className="flex items-center gap-3">
                        {/* Org Switcher */}
                        {currentTenant ? (
                            <div className="relative" ref={orgMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsOrgMenuOpen((prev) => !prev)}
                                    className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
                                >
                                    <IconBuilding className="h-4 w-4 text-blue-400" />
                                    <span className="max-w-30 truncate sm:max-w-40">{currentTenant.name}</span>
                                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                                        {currentTenant.userRole}
                                    </span>
                                    <svg
                                        className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOrgMenuOpen ? "rotate-180" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>

                                {/* Org Switcher Dropdown */}
                                {isOrgMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl ring-1 ring-black/50 z-50">
                                        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                            Switch Organization
                                        </p>
                                        <div className="space-y-1">
                                            {tenants.map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => {
                                                        switchTenant(t.id);
                                                        setIsOrgMenuOpen(false);
                                                    }}
                                                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                                                        t.id === currentTenant.id
                                                            ? "bg-blue-600/20 text-blue-300 font-medium"
                                                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                                    }`}
                                                >
                                                    <span className="truncate">{t.name}</span>
                                                    <span className="text-[10px] uppercase text-slate-500">
                                                        {t.role}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-2 border-t border-slate-800 pt-2">
                                            <Link
                                                to="/org/new"
                                                onClick={() => setIsOrgMenuOpen(false)}
                                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-blue-400 hover:bg-blue-600/10 font-medium"
                                            >
                                                <IconPlus className="h-3.5 w-3.5" />
                                                New Organization Setup
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link
                                to="/org/new"
                                className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white transition"
                            >
                                <IconPlus className="h-3.5 w-3.5 text-blue-400" />
                                <span>Create or Join Org</span>
                            </Link>
                        )}

                        {/* User profile dropdown */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                type="button"
                                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 p-1 text-slate-200 transition hover:border-slate-500 hover:ring-2 hover:ring-blue-500/30"
                                title={displayName}
                            >
                                <span className="grid h-7 w-7 place-items-center rounded-full bg-linear-to-tr from-blue-600 to-indigo-500 text-xs font-bold text-white shadow-sm">
                                    {initials}
                                </span>
                            </button>

                            {isUserMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl ring-1 ring-black/50 z-50">
                                    <div className="border-b border-slate-800 px-3 py-2">
                                        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                                        <p className="text-xs text-slate-400 truncate">
                                            {user?.email || userProfile.email}
                                        </p>
                                    </div>
                                    <div className="py-1">
                                        <Link
                                            to="/account"
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                                        >
                                            <IconUser className="h-4 w-4 text-slate-400" />
                                            Account Settings
                                        </Link>
                                        <Link
                                            to="/org/new"
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                                        >
                                            <IconBuilding className="h-4 w-4 text-blue-400" />
                                            New Organization Setup
                                        </Link>
                                        <Link
                                            to="/org/users"
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
                                        >
                                            <IconUsers className="h-4 w-4 text-slate-400" />
                                            Team Members
                                        </Link>
                                        <Link
                                            to="/org/settings"
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
                                        >
                                            <IconCog className="h-4 w-4 text-slate-400" />
                                            Org Settings
                                        </Link>
                                        <Link
                                            to="/events"
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
                                        >
                                            <IconCalendar className="h-4 w-4 text-slate-400" />
                                            Events Schedule
                                        </Link>
                                        <Link
                                            to="/admin/debug"
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                                        >
                                            <IconPhone className="h-4 w-4 text-slate-400" />
                                            System Debug
                                        </Link>
                                    </div>
                                    <div className="border-t border-slate-800 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleSignOut}
                                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link
                            to="/login"
                            className="rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/signup"
                            className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-600/30 hover:bg-blue-500 transition"
                        >
                            Sign up
                        </Link>
                    </div>
                )}
            </div>

            {/* Mobile Navigation bar */}
            {user && (
                <div className="flex border-t border-slate-800/80 px-4 py-2 md:hidden justify-around bg-slate-950">
                    <Link to="/events" className={linkClasses("/events")}>
                        <IconCalendar className="h-4 w-4" />
                        <span className="text-xs">Events</span>
                    </Link>
                    <Link to="/org/users" className={linkClasses("/org/users")}>
                        <IconUsers className="h-4 w-4" />
                        <span className="text-xs">Team</span>
                    </Link>
                    <Link to="/org/settings" className={linkClasses("/org/settings")}>
                        <IconCog className="h-4 w-4" />
                        <span className="text-xs">Settings</span>
                    </Link>
                    <Link to="/account" className={linkClasses("/account")}>
                        <IconUser className="h-4 w-4" />
                        <span className="text-xs">Account</span>
                    </Link>
                </div>
            )}
        </header>
    );
}
