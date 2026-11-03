import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { auth, getFirebaseAppCheckToken } from "../firebase";
import { IconShield, IconPhone } from "../components/Icons";

type ServiceGroup = Record<string, "ok" | "error">;
type StatusResponse = { status: string; services: { firebase: ServiceGroup; twilio: ServiceGroup } };

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function adminRequest(user: User, path: string, init?: RequestInit): Promise<Response> {
    const [appCheckToken, idToken] = await Promise.all([getFirebaseAppCheckToken(), user.getIdToken()]);
    return fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            "X-Firebase-AppCheck": appCheckToken,
            ...init?.headers
        }
    });
}

export default function AdminDebugPage() {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [form, setForm] = useState({ to: "", from: "+19789972789", body: "", message: "" });
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    useEffect(
        () =>
            onAuthStateChanged(auth, async (nextUser) => {
                setUser(nextUser);
                if (nextUser) {
                    const token = await nextUser.getIdTokenResult();
                    setIsAdmin(token.claims.admin === true);
                } else {
                    setIsAdmin(false);
                }
            }),
        []
    );

    async function loadStatus() {
        if (!user) return;
        setIsBusy(true);
        setError(null);
        try {
            const response = await adminRequest(user, "/admin/status");
            const body = (await response.json()) as StatusResponse & { error?: string };
            if (!response.ok && response.status !== 503) throw new Error(body.error ?? "Unable to load system status.");
            setStatus(body);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load system status.");
        } finally {
            setIsBusy(false);
        }
    }

    async function sendTest(path: "/admin/twilio/sms" | "/admin/twilio/call") {
        if (!user) return;
        setIsBusy(true);
        setError(null);
        setResult(null);
        const payload = path.endsWith("sms")
            ? { to: form.to, from: form.from, body: form.body }
            : { to: form.to, from: form.from, message: form.message };
        try {
            const response = await adminRequest(user, path, { method: "POST", body: JSON.stringify(payload) });
            const body = (await response.json()) as { sid?: string; status?: string; error?: string };
            if (!response.ok) throw new Error(body.error ?? "Twilio request failed.");
            setResult(`${path.endsWith("sms") ? "SMS" : "Call"} accepted (${body.sid}, ${body.status}).`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Twilio request failed.");
        } finally {
            setIsBusy(false);
        }
    }

    async function loadLatestEvent(type: "sms" | "call") {
        if (!user) return;
        setIsBusy(true);
        setError(null);
        try {
            const response = await adminRequest(user, `/admin/twilio/events/latest?type=${type}`);
            const body = (await response.json()) as {
                event?: { from?: string; to?: string; body?: string; status?: string; receivedAt?: string };
                error?: string;
            };
            if (!response.ok) throw new Error(body.error ?? "Unable to load the latest received event.");
            setResult(
                body.event
                    ? `${type === "sms" ? "SMS" : "Call"} received from ${body.event.from ?? "unknown"}${
                          type === "sms"
                              ? `: ${body.event.body ?? "(empty message)"}`
                              : ` (${body.event.status ?? "received"})`
                      }.`
                    : `No received ${type === "sms" ? "SMS messages" : "calls"} have been recorded yet.`
            );
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load the latest received event.");
        } finally {
            setIsBusy(false);
        }
    }

    const inputClasses =
        "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

    if (!user)
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
                <Navbar />
                <main className="mx-auto max-w-3xl p-8 flex-1 flex flex-col items-center justify-center text-center">
                    <h1 className="text-3xl font-bold">Admin Debug</h1>
                    <p className="mt-2 text-slate-400">Please sign in with an administrator account to continue.</p>
                    <Link
                        to="/login"
                        className="mt-4 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition cursor-pointer"
                    >
                        Sign in
                    </Link>
                </main>
                <Footer />
            </div>
        );

    if (!isAdmin)
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
                <Navbar />
                <main className="mx-auto max-w-3xl p-8 flex-1 flex flex-col items-center justify-center text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 mb-3">
                        <IconShield className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold">Access Restricted</h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Global administrator access is required to view low-level system health and Twilio diagnostic
                        tools.
                    </p>
                    <Link
                        to="/events"
                        className="mt-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                    >
                        Back to Events
                    </Link>
                </main>
                <Footer />
            </div>
        );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
            <Navbar />

            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/40">
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                        <IconShield className="h-4 w-4" />
                        <span>System Diagnostics</span>
                    </div>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">System Debug</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Live Firebase services status and direct Twilio telephony test suite.
                    </p>
                </div>
            </div>

            <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 space-y-8">
                {/* Status section */}
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Service Health Status</h2>
                        <button
                            type="button"
                            onClick={loadStatus}
                            disabled={isBusy}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition cursor-pointer shadow"
                        >
                            {isBusy ? "Checking..." : "Refresh Status"}
                        </button>
                    </div>

                    {status && (
                        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Overall System:</span>
                                <span
                                    className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                                        status.status === "ok"
                                            ? "bg-green-500/15 text-green-300 border border-green-500/30"
                                            : "bg-red-500/15 text-red-300 border border-red-500/30"
                                    }`}
                                >
                                    {status.status}
                                </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-800">
                                {Object.entries(status.services).map(([group, services]) => (
                                    <div key={group} className="rounded-lg bg-slate-900 p-3 border border-slate-800/80">
                                        <p className="text-xs font-bold uppercase text-slate-300 mb-2">{group}</p>
                                        <div className="space-y-1">
                                            {Object.entries(services).map(([name, value]) => (
                                                <div key={name} className="flex justify-between text-xs">
                                                    <span className="text-slate-400">{name}</span>
                                                    <span
                                                        className={
                                                            value === "ok"
                                                                ? "font-semibold text-green-400"
                                                                : "font-semibold text-red-400"
                                                        }
                                                    >
                                                        {value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Twilio Telephony Test Section */}
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
                    <div className="flex items-center gap-2 text-white font-semibold">
                        <IconPhone className="h-5 w-5 text-blue-400" />
                        <h2>Twilio Telephony Diagnostics</h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 pt-2">
                        <label className="block text-xs font-medium text-slate-300">
                            Destination Phone (To)
                            <input
                                className={inputClasses}
                                placeholder="+15551234567"
                                value={form.to}
                                onChange={(event) => setForm({ ...form, to: event.target.value })}
                            />
                        </label>
                        <label className="block text-xs font-medium text-slate-300">
                            Twilio Number (From)
                            <input
                                className={inputClasses}
                                placeholder="+15557654321"
                                value={form.from}
                                onChange={(event) => setForm({ ...form, from: event.target.value })}
                            />
                        </label>
                        <label className="block text-xs font-medium text-slate-300">
                            SMS Message Body
                            <textarea
                                className={inputClasses}
                                rows={2}
                                value={form.body}
                                onChange={(event) => setForm({ ...form, body: event.target.value })}
                            />
                        </label>
                        <label className="block text-xs font-medium text-slate-300">
                            Voice Call Message (Text-to-Speech)
                            <textarea
                                className={inputClasses}
                                rows={2}
                                value={form.message}
                                onChange={(event) => setForm({ ...form, message: event.target.value })}
                            />
                        </label>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2.5">
                        <button
                            type="button"
                            onClick={() => sendTest("/admin/twilio/sms")}
                            disabled={isBusy}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer shadow"
                        >
                            Send SMS Test
                        </button>
                        <button
                            type="button"
                            onClick={() => sendTest("/admin/twilio/call")}
                            disabled={isBusy}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer shadow"
                        >
                            Place Voice Call Test
                        </button>
                        <button
                            type="button"
                            onClick={() => loadLatestEvent("sms")}
                            disabled={isBusy}
                            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer"
                        >
                            Inspect Latest Inbound SMS
                        </button>
                        <button
                            type="button"
                            onClick={() => loadLatestEvent("call")}
                            disabled={isBusy}
                            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer"
                        >
                            Inspect Latest Inbound Call
                        </button>
                    </div>

                    {result && (
                        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
                            {result}
                        </div>
                    )}
                    {error && (
                        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                            {error}
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </div>
    );
}
