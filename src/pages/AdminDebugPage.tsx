import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { auth, getFirebaseAppCheckToken } from "../firebase";

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

    if (!user)
        return (
            <main className="mx-auto max-w-3xl p-8">
                <h1 className="text-3xl font-bold">Admin debug</h1>
                <p className="mt-4">Sign in first.</p>
            </main>
        );
    if (!isAdmin)
        return (
            <main className="mx-auto max-w-3xl p-8">
                <h1 className="text-3xl font-bold">Admin debug</h1>
                <p className="mt-4 text-red-600">Administrator access is required.</p>
            </main>
        );

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-8">
            <div>
                <Link to="/" className="text-blue-600 hover:underline">
                    Back to PartyLine
                </Link>
                <h1 className="mt-4 text-3xl font-bold">System debug</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Admin-only health checks and Twilio test tools.</p>
            </div>
            <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
                <h2 className="text-xl font-semibold">Service status</h2>
                <button
                    type="button"
                    onClick={loadStatus}
                    disabled={isBusy}
                    className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900"
                >
                    Refresh status
                </button>
                {status && (
                    <div className="mt-4 space-y-2">
                        <p className="font-medium">Overall: {status.status}</p>
                        {Object.entries(status.services).map(([group, services]) => (
                            <div key={group}>
                                <strong className="capitalize">{group}</strong>:{" "}
                                {Object.entries(services).map(([name, value]) => (
                                    <span className="ml-3" key={name}>
                                        {name}{" "}
                                        <span className={value === "ok" ? "text-green-600" : "text-red-600"}>
                                            {value}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </section>
            <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
                <h2 className="text-xl font-semibold">Twilio test messages</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-gray-800 dark:text-gray-200">
                        To
                        <input
                            className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
                            placeholder="+15551234567"
                            value={form.to}
                            onChange={(event) => setForm({ ...form, to: event.target.value })}
                        />
                    </label>
                    <label className="text-gray-800 dark:text-gray-200">
                        From (Twilio number)
                        <input
                            className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
                            placeholder="+15557654321"
                            value={form.from}
                            onChange={(event) => setForm({ ...form, from: event.target.value })}
                        />
                    </label>
                    <label className="text-gray-800 dark:text-gray-200">
                        SMS body
                        <textarea
                            className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
                            rows={3}
                            value={form.body}
                            onChange={(event) => setForm({ ...form, body: event.target.value })}
                        />
                    </label>
                    <label className="text-gray-800 dark:text-gray-200">
                        Call message
                        <textarea
                            className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
                            rows={3}
                            value={form.message}
                            onChange={(event) => setForm({ ...form, message: event.target.value })}
                        />
                    </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => sendTest("/admin/twilio/sms")}
                        disabled={isBusy}
                        className="rounded-md bg-purple-600 px-4 py-2 text-white disabled:opacity-60"
                    >
                        Send SMS
                    </button>
                    <button
                        type="button"
                        onClick={() => sendTest("/admin/twilio/call")}
                        disabled={isBusy}
                        className="rounded-md bg-purple-600 px-4 py-2 text-white disabled:opacity-60"
                    >
                        Place call
                    </button>
                    <button
                        type="button"
                        onClick={() => loadLatestEvent("sms")}
                        disabled={isBusy}
                        className="rounded-md border border-purple-500 px-4 py-2 text-purple-700 hover:bg-purple-50 disabled:opacity-60 dark:text-purple-300 dark:hover:bg-purple-950"
                    >
                        Last received SMS
                    </button>
                    <button
                        type="button"
                        onClick={() => loadLatestEvent("call")}
                        disabled={isBusy}
                        className="rounded-md border border-purple-500 px-4 py-2 text-purple-700 hover:bg-purple-50 disabled:opacity-60 dark:text-purple-300 dark:hover:bg-purple-950"
                    >
                        Last received call
                    </button>
                </div>
                {result && <p className="mt-4 text-green-600">{result}</p>}
                {error && <p className="mt-4 text-red-600">{error}</p>}
            </section>
        </main>
    );
}
