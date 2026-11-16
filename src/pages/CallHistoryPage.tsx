import { useState, useEffect, useMemo } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp } from "../context/AppContext";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { fetchTwilioCalls, sendTwilioText, formatHistoryTimestamp, type TwilioCallHistoryItem } from "../twilioHistory";
import { type Event, findMatchingEvent } from "./EventsPage";
import {
    IconPhone,
    IconSend,
    IconCalendar,
    IconUser,
    IconSearch,
    IconCheckCircle,
    IconClock
} from "../components/Icons";

export function meta() {
    return [
        { title: "Call Inbox | PartyLine" },
        { name: "description", content: "View, manage, and call back your incoming and outgoing calls." }
    ];
}

type ViewMode = "caller" | "date";

type CallerThread = {
    callerNumber: string;
    contactName?: string;
    totalCalls: number;
    missedCalls: number;
    lastCall: TwilioCallHistoryItem;
    calls: TwilioCallHistoryItem[];
};

function formatDayLabel(dateString: string | null): string {
    if (!dateString) return "Unknown Date";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Unknown Date";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function CallHistoryPage() {
    const { currentTenant, isLoadingTenants, user, members } = useApp();
    const [calls, setCalls] = useState<TwilioCallHistoryItem[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // View options
    const [viewMode, setViewMode] = useState<ViewMode>("caller");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCaller, setSelectedCaller] = useState<string | null>(null);

    // SMS sending state
    const [activeInlineSmsId, setActiveInlineSmsId] = useState<string | null>(null);
    const [smsText, setSmsText] = useState("");
    const [isSendingSms, setIsSendingSms] = useState(false);
    const [smsError, setSmsError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // 1. Fetch live events for current tenant to correlate calls with events
    useEffect(() => {
        if (!currentTenant?.id) {
            setEvents([]);
            return;
        }

        const eventsRef = collection(db, "tenants", currentTenant.id, "events");
        const unsubscribe = onSnapshot(
            eventsRef,
            (snapshot) => {
                const loaded = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data();
                    const startDate = data.start?.toDate ? data.start.toDate() : new Date(data.start);
                    const endDate = data.end?.toDate ? data.end.toDate() : new Date(data.end);
                    const recEnd = data.recurrenceEndDate?.toDate
                        ? data.recurrenceEndDate.toDate()
                        : data.recurrenceEndDate
                          ? new Date(data.recurrenceEndDate)
                          : null;

                    return {
                        id: docSnap.id,
                        title: data.title || "Rental Event",
                        renterName: data.renterName || "",
                        renterPhone: data.renterPhone || "",
                        start: startDate,
                        end: endDate,
                        primaryUid: data.primaryUid,
                        primaryName: data.primaryName || "",
                        primaryPhone: data.primaryPhone || "",
                        backupUid: data.backupUid,
                        backupName: data.backupName || "",
                        backupPhone: data.backupPhone || "",
                        recurrence: data.recurrence,
                        daysOfWeek: data.daysOfWeek,
                        recurrenceEndDate: recEnd
                    } as Event;
                });
                setEvents(loaded);
            },
            (err) => console.warn("Failed to listen to events in call history:", err)
        );

        return () => unsubscribe();
    }, [currentTenant?.id]);

    // 2. Fetch Call history from Twilio
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

    // Helper: Identify contact name from phone number
    const resolveContactName = (phone: string): string | undefined => {
        const clean = phone.replace(/\D/g, "");
        if (!clean) return undefined;

        // Check members
        const matchedMember = members.find((m) => m.phoneNumber && m.phoneNumber.replace(/\D/g, "") === clean);
        if (matchedMember) return `${matchedMember.displayName} (Team)`;

        // Check renters in events
        const matchedEvent = events.find((e) => e.renterPhone && e.renterPhone.replace(/\D/g, "") === clean);
        if (matchedEvent && matchedEvent.renterName) return `${matchedEvent.renterName} (Renter)`;

        return undefined;
    };

    // Filter calls by search
    const filteredCalls = useMemo(() => {
        if (!searchQuery.trim()) return calls;
        const q = searchQuery.toLowerCase();
        return calls.filter(
            (c) =>
                c.from.toLowerCase().includes(q) || c.to.toLowerCase().includes(q) || c.status.toLowerCase().includes(q)
        );
    }, [calls, searchQuery]);

    // Grouping by Caller (Call Threads)
    const callerThreads = useMemo(() => {
        const map = new Map<string, CallerThread>();

        for (const call of filteredCalls) {
            const externalPhone = call.direction.startsWith("inbound") ? call.from : call.to;
            if (!externalPhone) continue;

            const isMissed =
                call.direction.startsWith("inbound") &&
                (call.status === "no-answer" || call.status === "busy" || call.status === "failed");

            const existing = map.get(externalPhone);
            if (!existing) {
                map.set(externalPhone, {
                    callerNumber: externalPhone,
                    contactName: resolveContactName(externalPhone),
                    totalCalls: 1,
                    missedCalls: isMissed ? 1 : 0,
                    lastCall: call,
                    calls: [call]
                });
            } else {
                existing.totalCalls += 1;
                if (isMissed) existing.missedCalls += 1;
                existing.calls.push(call);

                const curTime = Date.parse(existing.lastCall.createdAt || existing.lastCall.startedAt || "") || 0;
                const newTime = Date.parse(call.createdAt || call.startedAt || "") || 0;
                if (newTime > curTime) {
                    existing.lastCall = call;
                }
            }
        }

        return Array.from(map.values()).sort((a, b) => {
            const timeA = Date.parse(a.lastCall.createdAt || a.lastCall.startedAt || "") || 0;
            const timeB = Date.parse(b.lastCall.createdAt || b.lastCall.startedAt || "") || 0;
            return timeB - timeA;
        });
    }, [filteredCalls, members, events]);

    // Auto-select first caller thread
    useEffect(() => {
        if (
            callerThreads.length > 0 &&
            (!selectedCaller || !callerThreads.some((t) => t.callerNumber === selectedCaller))
        ) {
            setSelectedCaller(callerThreads[0].callerNumber);
        }
    }, [callerThreads, selectedCaller]);

    // Grouping by Date & Event
    const groupedByDateAndEvent = useMemo(() => {
        const dateGroups = new Map<string, Map<string, TwilioCallHistoryItem[]>>();

        for (const call of filteredCalls) {
            const timeStr = call.createdAt || call.startedAt;
            const dayKey = formatDayLabel(timeStr);

            if (!dateGroups.has(dayKey)) {
                dateGroups.set(dayKey, new Map());
            }
            const eventMap = dateGroups.get(dayKey)!;

            const matched = findMatchingEvent(events, timeStr);
            const eventKey = matched ? `event-${matched.id}` : "general";

            if (!eventMap.has(eventKey)) {
                eventMap.set(eventKey, []);
            }
            eventMap.get(eventKey)!.push(call);
        }

        return dateGroups;
    }, [filteredCalls, events]);

    // Send SMS follow-up handler
    const handleSendSms = async (targetPhone: string, bodyText: string) => {
        if (!user || !currentTenant?.id) return;
        if (!bodyText.trim()) return;

        setIsSendingSms(true);
        setSmsError(null);

        try {
            await sendTwilioText(user, currentTenant.id, targetPhone, bodyText.trim());
            setSmsText("");
            setActiveInlineSmsId(null);
            showToast(`SMS sent to ${targetPhone}`);
        } catch (err) {
            setSmsError(err instanceof Error ? err.message : "Failed to send SMS message.");
        } finally {
            setIsSendingSms(false);
        }
    };

    const activeCallerThread = callerThreads.find((t) => t.callerNumber === selectedCaller);
    const activeCallerCalls = useMemo(() => {
        if (!activeCallerThread) return [];
        return [...activeCallerThread.calls].sort((a, b) => {
            const timeA = Date.parse(a.createdAt || a.startedAt || "") || 0;
            const timeB = Date.parse(b.createdAt || b.startedAt || "") || 0;
            return timeB - timeA;
        });
    }, [activeCallerThread]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 flex flex-col">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <IconPhone className="h-8 w-8 text-emerald-500" />
                            Call Inbox & History
                        </h1>
                        <p className="mt-1 text-xs text-slate-400">
                            {currentTenant
                                ? `Review calls to and from ${currentTenant.name}, organized by caller or schedule.`
                                : "Select or join an organization to review call history."}
                        </p>
                    </div>

                    {/* View mode toggle */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode("caller")}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    viewMode === "caller"
                                        ? "bg-blue-600 text-white shadow"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <IconUser className="h-3.5 w-3.5" />
                                By Caller / Contact
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("date")}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    viewMode === "date"
                                        ? "bg-blue-600 text-white shadow"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <IconCalendar className="h-3.5 w-3.5" />
                                By Date & Event
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter and search bar */}
                <div className="mb-6 relative max-w-md">
                    <IconSearch className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search calls by phone number or status..."
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
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

                {isLoadingTenants || isLoading ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-xs text-slate-400">
                        Loading call logs from Twilio...
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
                        {error}
                    </div>
                ) : !currentTenant ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
                        Choose an organization to load its calls.
                    </div>
                ) : calls.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400 text-sm">
                        No calls found yet. Incoming calls to your organization line will appear here.
                    </div>
                ) : viewMode === "caller" ? (
                    /* BY CALLER VIEW */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[560px]">
                        {/* Callers Sidebar */}
                        <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col shadow-xl">
                            <div className="border-b border-slate-800 p-3 bg-slate-950/60 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                    Callers ({callerThreads.length})
                                </span>
                            </div>
                            <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[580px] flex-1">
                                {callerThreads.map((thread) => {
                                    const isSelected = selectedCaller === thread.callerNumber;
                                    const name = thread.contactName;

                                    return (
                                        <button
                                            key={thread.callerNumber}
                                            type="button"
                                            onClick={() => setSelectedCaller(thread.callerNumber)}
                                            className={`w-full p-4 text-left transition flex items-start gap-3 ${
                                                isSelected
                                                    ? "bg-blue-600/15 border-l-4 border-blue-500"
                                                    : "hover:bg-slate-800/50"
                                            }`}
                                        >
                                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white border border-slate-700">
                                                {name ? name.slice(0, 2).toUpperCase() : "📞"}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-xs text-white truncate font-mono">
                                                        {name || thread.callerNumber}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                                                        {
                                                            formatHistoryTimestamp(
                                                                thread.lastCall.createdAt || thread.lastCall.startedAt
                                                            ).split(",")[0]
                                                        }
                                                    </span>
                                                </div>
                                                {name && (
                                                    <p className="text-[10px] font-mono text-slate-400 truncate">
                                                        {thread.callerNumber}
                                                    </p>
                                                )}
                                                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                                                    <span>
                                                        {thread.totalCalls} call{thread.totalCalls === 1 ? "" : "s"}
                                                    </span>
                                                    {thread.missedCalls > 0 && (
                                                        <span className="text-red-400 font-semibold">
                                                            · {thread.missedCalls} missed
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Caller Detail & History Window */}
                        <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col shadow-xl">
                            {activeCallerThread ? (
                                <>
                                    {/* Caller Header with Call Back Button */}
                                    <div className="border-b border-slate-800 p-4 bg-slate-950/70 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white text-sm font-mono truncate">
                                                    {activeCallerThread.contactName || activeCallerThread.callerNumber}
                                                </h3>
                                                {activeCallerThread.contactName && (
                                                    <span className="text-xs text-slate-400 font-mono">
                                                        ({activeCallerThread.callerNumber})
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {activeCallerCalls.length} call
                                                {activeCallerCalls.length === 1 ? "" : "s"} logged with this number
                                            </p>
                                        </div>

                                        {/* Call Back Button */}
                                        <a
                                            href={`tel:${activeCallerThread.callerNumber}`}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20"
                                            title={`Call back ${activeCallerThread.callerNumber}`}
                                        >
                                            <IconPhone className="h-4 w-4" />
                                            Call Back Now
                                        </a>
                                    </div>

                                    {/* Call Logs Stream */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[420px] min-h-[300px] bg-slate-950/40 divide-y divide-slate-800/40">
                                        {activeCallerCalls.map((call) => {
                                            const matchedEvent = findMatchingEvent(
                                                events,
                                                call.createdAt || call.startedAt
                                            );
                                            const isInbound = call.direction.startsWith("inbound");

                                            return (
                                                <div key={call.sid} className="pt-3 first:pt-0">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                                                        isInbound
                                                                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                                                            : "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                                                    }`}
                                                                >
                                                                    {isInbound ? "Incoming Call" : "Outgoing Call"}
                                                                </span>
                                                                <span className="text-xs font-medium capitalize text-slate-300">
                                                                    Status: {call.status.replaceAll("-", " ")}
                                                                </span>
                                                            </div>

                                                            {matchedEvent && (
                                                                <p className="mt-1 flex items-center gap-1 text-[11px] text-purple-300 font-medium">
                                                                    <IconCalendar className="h-3 w-3" />
                                                                    During Event: {matchedEvent.title} (Host:{" "}
                                                                    {matchedEvent.primaryName})
                                                                </p>
                                                            )}

                                                            <p className="mt-1 font-mono text-xs text-slate-400">
                                                                {call.from} → {call.to}
                                                            </p>
                                                        </div>

                                                        <div className="text-right">
                                                            <time className="text-[11px] text-slate-400 block">
                                                                {formatHistoryTimestamp(
                                                                    call.createdAt || call.startedAt
                                                                )}
                                                            </time>
                                                            {call.duration !== null && (
                                                                <span className="text-[11px] font-mono text-slate-400">
                                                                    Duration: {call.duration}s
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Send Back SMS Follow-up Textbox */}
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSendSms(activeCallerThread.callerNumber, smsText);
                                        }}
                                        className="border-t border-slate-800 p-4 bg-slate-950/80"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                                <IconSend className="h-3.5 w-3.5 text-blue-400" />
                                                Send SMS message back to {activeCallerThread.callerNumber}:
                                            </p>
                                        </div>
                                        {smsError && (
                                            <p className="mb-2 rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-300">
                                                {smsError}
                                            </p>
                                        )}
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 relative">
                                                <textarea
                                                    rows={2}
                                                    value={smsText}
                                                    onChange={(e) => setSmsText(e.target.value)}
                                                    placeholder="Type a follow-up SMS text message to this caller..."
                                                    maxLength={1600}
                                                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={isSendingSms || !smsText.trim()}
                                                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition shadow disabled:opacity-40"
                                            >
                                                <IconSend className="h-3.5 w-3.5" />
                                                <span>{isSendingSms ? "Sending..." : "Send SMS"}</span>
                                            </button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                <div className="p-12 text-center text-xs text-slate-400">
                                    Select a caller to view call records and call back.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* DATE & EVENT VIEW */
                    <div className="space-y-6">
                        {Array.from(groupedByDateAndEvent.entries()).map(([dayLabel, eventMap]) => (
                            <div key={dayLabel} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                                        {dayLabel}
                                    </h2>
                                    <div className="flex-1 h-px bg-slate-800" />
                                </div>

                                {Array.from(eventMap.entries()).map(([eventKey, dayCalls]) => {
                                    const event =
                                        eventKey !== "general"
                                            ? events.find((e) => `event-${e.id}` === eventKey)
                                            : null;

                                    return (
                                        <div
                                            key={eventKey}
                                            className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-lg"
                                        >
                                            {/* Group Sub-Header */}
                                            <div className="border-b border-slate-800/80 bg-slate-950/60 p-3.5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-white">
                                                        {event ? event.title : "General / Off-Schedule Calls"}
                                                    </span>
                                                    {event && (
                                                        <span className="text-[11px] text-purple-300 font-mono">
                                                            (Duty Host: {event.primaryName} · {event.primaryPhone})
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400">
                                                    {dayCalls.length} call{dayCalls.length === 1 ? "" : "s"}
                                                </span>
                                            </div>

                                            {/* Calls in this Event/Date */}
                                            <div className="divide-y divide-slate-800/60">
                                                {dayCalls.map((call) => {
                                                    const isInbound = call.direction.startsWith("inbound");
                                                    const partnerPhone = isInbound ? call.from : call.to;
                                                    const partnerName = resolveContactName(partnerPhone);
                                                    const isReplyingInline = activeInlineSmsId === call.sid;

                                                    return (
                                                        <div
                                                            key={call.sid}
                                                            className="p-4 hover:bg-slate-800/30 transition"
                                                        >
                                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                                                                isInbound
                                                                                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                                                                    : "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                                                            }`}
                                                                        >
                                                                            {isInbound ? "Incoming" : "Outgoing"}
                                                                        </span>
                                                                        <span className="font-mono text-xs font-semibold text-white">
                                                                            {partnerName
                                                                                ? `${partnerName} (${partnerPhone})`
                                                                                : partnerPhone}
                                                                        </span>
                                                                        <span className="text-[11px] capitalize text-slate-400">
                                                                            · {call.status.replaceAll("-", " ")}
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-1 font-mono text-xs text-slate-400">
                                                                        {call.from} → {call.to}
                                                                        {call.duration !== null &&
                                                                            ` · ${call.duration}s`}
                                                                    </p>
                                                                </div>

                                                                <div className="flex flex-col items-end gap-1.5">
                                                                    <time className="text-[11px] text-slate-400">
                                                                        {formatHistoryTimestamp(
                                                                            call.createdAt || call.startedAt
                                                                        )}
                                                                    </time>

                                                                    {/* Action buttons: Call Back & Send SMS */}
                                                                    <div className="flex items-center gap-2 pt-1">
                                                                        <a
                                                                            href={`tel:${partnerPhone}`}
                                                                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                                                                            title={`Call back ${partnerPhone}`}
                                                                        >
                                                                            <IconPhone className="h-3 w-3" />
                                                                            Call Back
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (isReplyingInline) {
                                                                                    setActiveInlineSmsId(null);
                                                                                } else {
                                                                                    setActiveInlineSmsId(call.sid);
                                                                                    setSmsText("");
                                                                                }
                                                                            }}
                                                                            className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 transition"
                                                                        >
                                                                            <IconSend className="h-3 w-3" />
                                                                            Send SMS
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Inline SMS Reply Box */}
                                                            {isReplyingInline && (
                                                                <form
                                                                    onSubmit={(e) => {
                                                                        e.preventDefault();
                                                                        handleSendSms(partnerPhone, smsText);
                                                                    }}
                                                                    className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2"
                                                                >
                                                                    <p className="text-[11px] text-slate-300 font-medium">
                                                                        Send text message to{" "}
                                                                        <span className="font-mono text-white">
                                                                            {partnerPhone}
                                                                        </span>
                                                                        :
                                                                    </p>
                                                                    <div className="flex items-end gap-2">
                                                                        <textarea
                                                                            rows={2}
                                                                            value={smsText}
                                                                            onChange={(e) => setSmsText(e.target.value)}
                                                                            placeholder="Type your message..."
                                                                            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                        <div className="flex flex-col gap-1.5 shrink-0">
                                                                            <button
                                                                                type="submit"
                                                                                disabled={
                                                                                    isSendingSms || !smsText.trim()
                                                                                }
                                                                                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                                                                            >
                                                                                {isSendingSms ? "Sending..." : "Send"}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setActiveInlineSmsId(null)
                                                                                }
                                                                                className="rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </form>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <Footer />

            {/* Toast Confirmation */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl animate-fade-in">
                    <IconCheckCircle className="h-5 w-5 text-green-400" />
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
}
