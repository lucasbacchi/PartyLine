import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp } from "../context/AppContext";
import { fetchTwilioTexts, formatHistoryTimestamp, type TwilioTextHistoryItem } from "../twilioHistory";

export function meta() {
    return [
        { title: "Text Inbox | PartyLine" },
        { name: "description", content: "View and manage your SMS inbox and messages." }
    ];
}

export default function SMSInbox() {
    const { currentTenant, isLoadingTenants, user } = useApp();
    const [messages, setMessages] = useState<TwilioTextHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isLoadingTenants) return;
        if (!currentTenant || !user) {
            setMessages([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);
        setError(null);
        fetchTwilioTexts(user, currentTenant.id, controller.signal)
            .then(setMessages)
            .catch((caught: unknown) => {
                if (!controller.signal.aborted) {
                    setError(caught instanceof Error ? caught.message : "Unable to load text history.");
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
                <h1 className="text-3xl font-bold text-white">Text Inbox</h1>
                <p className="mt-2 text-sm text-slate-400">
                    {currentTenant
                        ? `Review texts to and from ${currentTenant.name}.`
                        : "Select or join an organization to review text messages."}
                </p>
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    {isLoadingTenants || isLoading ? (
                        <p className="text-sm text-slate-400">Loading messages...</p>
                    ) : error ? (
                        <p role="alert" className="text-sm text-red-400">{error}</p>
                    ) : !currentTenant ? (
                        <p className="text-sm text-slate-400">Choose an organization to load its messages.</p>
                    ) : messages.length === 0 ? (
                        <p className="text-sm text-slate-400">No messages to show yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {messages.map((message) => (
                                <li
                                    key={message.sid}
                                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-white">
                                            {message.direction === "inbound" ? message.from : message.to}
                                            <span className="ml-2 text-xs font-normal capitalize text-slate-400">
                                                {message.status.replaceAll("-", " ")}
                                            </span>
                                        </p>
                                        <time className="text-xs text-slate-400">
                                            {formatHistoryTimestamp(message.sentAt ?? message.createdAt)}
                                        </time>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{message.body}</p>
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
