import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp } from "../context/AppContext";
import { fetchTwilioCalls, formatHistoryTimestamp, type TwilioCallHistoryItem } from "../twilioHistory";

export function meta() {
    return [
        { title: "Call Inbox | PartyLine" },
        { name: "description", content: "View and manage your call history." }
    ];
}

export default function CallHistoryPage() {
    const { currentTenant, isLoadingTenants, user } = useApp();
    const [calls, setCalls] = useState<TwilioCallHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isLoadingTenants) return;
        if (!currentTenant || !user) {
            setCalls([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);
        setError(null);
        fetchTwilioCalls(user, currentTenant.id, controller.signal)
            .then(setCalls)
            .catch((caught: unknown) => {
                if (!controller.signal.aborted) {
                    setError(caught instanceof Error ? caught.message : "Unable to load call history.");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [currentTenant?.id, isLoadingTenants, user]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
                <h1 className="text-3xl font-bold text-white">Call Inbox</h1>
                <p className="mt-2 text-sm text-slate-400">
                    {currentTenant
                        ? `Review calls to and from ${currentTenant.name}.`
                        : "Select or join an organization to review call history."}
                </p>
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    {isLoadingTenants || isLoading ? (
                        <p className="text-sm text-slate-400">Loading call history...</p>
                    ) : error ? (
                        <p role="alert" className="text-sm text-red-400">{error}</p>
                    ) : !currentTenant ? (
                        <p className="text-sm text-slate-400">Choose an organization to load its calls.</p>
                    ) : calls.length === 0 ? (
                        <p className="text-sm text-slate-400">No calls to show yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {calls.map((call) => (
                                <li
                                    key={call.sid}
                                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-white">
                                                {call.direction.startsWith("inbound") ? "Incoming" : "Outgoing"} call
                                                <span className="ml-2 text-xs font-normal capitalize text-slate-400">
                                                    {call.status.replaceAll("-", " ")}
                                                </span>
                                            </p>
                                            <p className="mt-1 text-sm text-slate-300">
                                                {call.from} → {call.to}
                                            </p>
                                        </div>
                                        <time className="text-xs text-slate-400">
                                            {formatHistoryTimestamp(call.createdAt ?? call.startedAt)}
                                        </time>
                                    </div>
                                    {call.duration !== null && (
                                        <p className="mt-2 text-xs text-slate-500">{call.duration}s</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}