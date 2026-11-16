import { useEffect, useState, useMemo, useRef } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp } from "../context/AppContext";
import { useWebRTCCall } from "../context/WebRTCCallContext";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { fetchTwilioTexts, sendTwilioText, formatHistoryTimestamp, type TwilioTextHistoryItem } from "../twilioHistory";
import { type Event, findMatchingEvent } from "./EventsPage";
import {
    IconPhone,
    IconSend,
    IconCalendar,
    IconUser,
    IconSearch,
    IconMessageSquare,
    IconCheckCircle
} from "../components/Icons";

export function meta() {
    return [
        { title: "Text Inbox | PartyLine" },
        { name: "description", content: "View, manage, and reply to SMS messages." }
    ];
}

type ViewMode = "sender" | "date";

type MessageThread = {
    contactNumber: string;
    contactName?: string;
    lastMessage: TwilioTextHistoryItem;
    messages: TwilioTextHistoryItem[];
    unreadCount: number;
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

export default function SMSInbox() {
    const { currentTenant, isLoadingTenants, user, members } = useApp();
    const { startCall } = useWebRTCCall();
    const [messages, setMessages] = useState<TwilioTextHistoryItem[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // View options
    const [viewMode, setViewMode] = useState<ViewMode>("sender");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedContact, setSelectedContact] = useState<string | null>(null);

    // Replying state
    const [replyText, setReplyText] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [replyError, setReplyError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Inline reply state for date view
    const [activeInlineReplyId, setActiveInlineReplyId] = useState<string | null>(null);
    const [inlineReplyText, setInlineReplyText] = useState("");

    const threadEndRef = useRef<HTMLDivElement>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // 1. Fetch live events for current tenant to correlate messages with events
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
            (err) => console.warn("Failed to listen to events in SMS inbox:", err)
        );

        return () => unsubscribe();
    }, [currentTenant?.id]);

    // 2. Fetch SMS message history from Twilio
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
            .then((list) => {
                setMessages(list);
            })
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

    // Scroll to bottom of conversation thread when new message or selection changes
    useEffect(() => {
        if (selectedContact && threadEndRef.current) {
            threadEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [selectedContact, messages]);

    // Helper: Identify contact name from phone number (matching events or members)
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

    // Filtered messages by search
    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return messages;
        const q = searchQuery.toLowerCase();
        return messages.filter(
            (m) =>
                m.body.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.to.toLowerCase().includes(q)
        );
    }, [messages, searchQuery]);

    // Grouping by Sender / Caller (Conversation Threads)
    const threads = useMemo(() => {
        const map = new Map<string, MessageThread>();

        for (const msg of filteredMessages) {
            // The external party's number: if inbound, it's 'from'; if outbound, it's 'to'
            const contact = msg.direction === "inbound" ? msg.from : msg.to;
            if (!contact) continue;

            const existing = map.get(contact);
            if (!existing) {
                map.set(contact, {
                    contactNumber: contact,
                    contactName: resolveContactName(contact),
                    lastMessage: msg,
                    messages: [msg],
                    unreadCount: msg.direction === "inbound" ? 1 : 0
                });
            } else {
                existing.messages.push(msg);
                // Keep the most recent message as lastMessage
                const curTime = Date.parse(existing.lastMessage.sentAt || existing.lastMessage.createdAt || "") || 0;
                const newTime = Date.parse(msg.sentAt || msg.createdAt || "") || 0;
                if (newTime > curTime) {
                    existing.lastMessage = msg;
                }
            }
        }

        // Sort threads by latest message time
        return Array.from(map.values()).sort((a, b) => {
            const timeA = Date.parse(a.lastMessage.sentAt || a.lastMessage.createdAt || "") || 0;
            const timeB = Date.parse(b.lastMessage.sentAt || b.lastMessage.createdAt || "") || 0;
            return timeB - timeA;
        });
    }, [filteredMessages, members, events]);

    // Auto-select first thread if none selected
    useEffect(() => {
        if (threads.length > 0 && (!selectedContact || !threads.some((t) => t.contactNumber === selectedContact))) {
            setSelectedContact(threads[0].contactNumber);
        }
    }, [threads, selectedContact]);

    // Grouping by Date & Event
    const groupedByDateAndEvent = useMemo(() => {
        const dateGroups = new Map<string, Map<string, TwilioTextHistoryItem[]>>();

        for (const msg of filteredMessages) {
            const timeStr = msg.sentAt || msg.createdAt;
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
            eventMap.get(eventKey)!.push(msg);
        }

        return dateGroups;
    }, [filteredMessages, events]);

    // Send SMS reply handler
    const handleSendReply = async (targetPhone: string, bodyText: string) => {
        if (!user || !currentTenant?.id) return;
        if (!bodyText.trim()) return;

        setIsSendingReply(true);
        setReplyError(null);

        try {
            const sent = await sendTwilioText(user, currentTenant.id, targetPhone, bodyText.trim());
            // Prepend/append optimistically to messages list
            setMessages((prev) => [sent, ...prev]);
            setReplyText("");
            setInlineReplyText("");
            setActiveInlineReplyId(null);
            showToast(`SMS sent successfully to ${targetPhone}`);
        } catch (err) {
            setReplyError(err instanceof Error ? err.message : "Failed to send message.");
        } finally {
            setIsSendingReply(false);
        }
    };

    const activeThread = threads.find((t) => t.contactNumber === selectedContact);
    const activeThreadMessages = useMemo(() => {
        if (!activeThread) return [];
        return [...activeThread.messages].sort((a, b) => {
            const timeA = Date.parse(a.sentAt || a.createdAt || "") || 0;
            const timeB = Date.parse(b.sentAt || b.createdAt || "") || 0;
            return timeA - timeB;
        });
    }, [activeThread]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 flex flex-col">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <IconMessageSquare className="h-8 w-8 text-blue-500" />
                            SMS Inbox & Messages
                        </h1>
                        <p className="mt-1 text-xs text-slate-400">
                            {currentTenant
                                ? `Manage, organize, and reply to texts for ${currentTenant.name}.`
                                : "Select or join an organization to view text messages."}
                        </p>
                    </div>

                    {/* View mode toggle */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode("sender")}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    viewMode === "sender"
                                        ? "bg-blue-600 text-white shadow"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <IconUser className="h-3.5 w-3.5" />
                                By Sender / Caller
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
                        placeholder="Search messages by phone or text..."
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
                        Loading messages and conversation threads from Twilio...
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
                        {error}
                    </div>
                ) : !currentTenant ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
                        Choose an organization to review its messages.
                    </div>
                ) : messages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400 text-sm">
                        No text messages found yet. Incoming messages will appear here automatically.
                    </div>
                ) : viewMode === "sender" ? (
                    /* SENDER / THREADED CONVERSATION VIEW */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-140">
                        {/* Threads Sidebar */}
                        <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col shadow-xl">
                            <div className="border-b border-slate-800 p-3 bg-slate-950/60 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                    Conversations ({threads.length})
                                </span>
                            </div>
                            <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-145 flex-1">
                                {threads.map((thread) => {
                                    const isSelected = selectedContact === thread.contactNumber;
                                    const name = thread.contactName;

                                    return (
                                        <button
                                            key={thread.contactNumber}
                                            type="button"
                                            onClick={() => setSelectedContact(thread.contactNumber)}
                                            className={`w-full p-4 text-left transition flex items-start gap-3 ${
                                                isSelected
                                                    ? "bg-blue-600/15 border-l-4 border-blue-500"
                                                    : "hover:bg-slate-800/50"
                                            }`}
                                        >
                                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white border border-slate-700">
                                                {name ? name.slice(0, 2).toUpperCase() : "📱"}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-xs text-white truncate font-mono">
                                                        {name || thread.contactNumber}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                                                        {
                                                            formatHistoryTimestamp(
                                                                thread.lastMessage.sentAt ||
                                                                    thread.lastMessage.createdAt
                                                            ).split(",")[0]
                                                        }
                                                    </span>
                                                </div>
                                                {name && (
                                                    <p className="text-[10px] font-mono text-slate-400 truncate">
                                                        {thread.contactNumber}
                                                    </p>
                                                )}
                                                <p className="mt-1 truncate text-xs text-slate-400 line-clamp-1">
                                                    {thread.lastMessage.direction === "outbound-api" && (
                                                        <span className="text-blue-400 font-medium">You: </span>
                                                    )}
                                                    {thread.lastMessage.body}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Conversation Chat Window */}
                        <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col shadow-xl">
                            {activeThread ? (
                                <>
                                    {/* Conversation Header */}
                                    <div className="border-b border-slate-800 p-4 bg-slate-950/70 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white text-sm font-mono truncate">
                                                    {activeThread.contactName || activeThread.contactNumber}
                                                </h3>
                                                {activeThread.contactName && (
                                                    <span className="text-xs text-slate-400 font-mono">
                                                        ({activeThread.contactNumber})
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {activeThreadMessages.length} messages in conversation
                                            </p>
                                        </div>

                                        {/* Call Back Button */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                startCall(activeThread.contactNumber, activeThread.contactName)
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition shadow cursor-pointer"
                                            title={`Call back ${activeThread.contactNumber} from organization number`}
                                        >
                                            <IconPhone className="h-3.5 w-3.5" />
                                            Call Back (WebRTC)
                                        </button>
                                    </div>

                                    {/* Messages Bubbles Stream */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-115 min-h-80 bg-slate-950/40">
                                        {activeThreadMessages.map((msg) => {
                                            const isOutbound = msg.direction !== "inbound";
                                            const matchedEvent = findMatchingEvent(events, msg.sentAt || msg.createdAt);

                                            return (
                                                <div
                                                    key={msg.sid}
                                                    className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                                                >
                                                    {/* Event Tag if during scheduled event */}
                                                    {matchedEvent && (
                                                        <div className="mb-1 flex items-center gap-1 text-[10px] text-purple-300 font-medium">
                                                            <IconCalendar className="h-3 w-3" />
                                                            <span>{matchedEvent.title}</span>
                                                        </div>
                                                    )}

                                                    <div
                                                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                                                            isOutbound
                                                                ? "bg-blue-600 text-white rounded-br-xs"
                                                                : "bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700/60"
                                                        }`}
                                                    >
                                                        <p className="whitespace-pre-wrap">{msg.body}</p>
                                                    </div>

                                                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                                                        <span>
                                                            {formatHistoryTimestamp(msg.sentAt || msg.createdAt)}
                                                        </span>
                                                        <span className="capitalize">
                                                            {msg.status.replaceAll("-", " ")}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={threadEndRef} />
                                    </div>

                                    {/* Reply Textbox Box */}
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSendReply(activeThread.contactNumber, replyText);
                                        }}
                                        className="border-t border-slate-800 p-3 bg-slate-950/80"
                                    >
                                        {replyError && (
                                            <p className="mb-2 rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-300">
                                                {replyError}
                                            </p>
                                        )}
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 relative">
                                                <textarea
                                                    rows={2}
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder={`Type a text reply to ${activeThread.contactNumber}...`}
                                                    maxLength={1600}
                                                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                />
                                                <span className="absolute right-2.5 bottom-2 text-[10px] text-slate-400 font-mono">
                                                    {replyText.length}/1600
                                                </span>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={isSendingReply || !replyText.trim()}
                                                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition shadow disabled:opacity-40"
                                            >
                                                <IconSend className="h-3.5 w-3.5" />
                                                <span>{isSendingReply ? "Sending..." : "Send"}</span>
                                            </button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                <div className="p-12 text-center text-xs text-slate-400">
                                    Select a conversation thread to view and reply.
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

                                {Array.from(eventMap.entries()).map(([eventKey, dayMessages]) => {
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
                                                        {event ? event.title : "General / Off-Schedule Texts"}
                                                    </span>
                                                    {event && (
                                                        <span className="text-[11px] text-purple-300 font-mono">
                                                            (Host: {event.primaryName})
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400">
                                                    {dayMessages.length} message{dayMessages.length === 1 ? "" : "s"}
                                                </span>
                                            </div>

                                            {/* Messages in this Event/Date */}
                                            <div className="divide-y divide-slate-800/60">
                                                {dayMessages.map((msg) => {
                                                    const isOutbound = msg.direction !== "inbound";
                                                    const partnerPhone = isOutbound ? msg.to : msg.from;
                                                    const partnerName = resolveContactName(partnerPhone);
                                                    const isReplyingInline = activeInlineReplyId === msg.sid;
                                                    const matchedEvent = findMatchingEvent(
                                                        events,
                                                        msg.sentAt || msg.createdAt
                                                    );

                                                    return (
                                                        <div
                                                            key={msg.sid}
                                                            className="p-4 hover:bg-slate-800/30 transition"
                                                        >
                                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                                                                isOutbound
                                                                                    ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                                                                    : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                                                            }`}
                                                                        >
                                                                            {isOutbound ? "Outgoing" : "Incoming"}
                                                                        </span>
                                                                        <span className="font-mono text-xs font-semibold text-white">
                                                                            {partnerName
                                                                                ? `${partnerName} (${partnerPhone})`
                                                                                : partnerPhone}
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-2 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                                        {msg.body}
                                                                    </p>
                                                                </div>

                                                                <div className="flex flex-col items-end gap-1.5">
                                                                    <time className="text-[11px] text-slate-400">
                                                                        {formatHistoryTimestamp(
                                                                            msg.sentAt || msg.createdAt
                                                                        )}
                                                                    </time>

                                                                    {/* Action buttons: Call Back & Reply */}
                                                                    <div className="flex items-center gap-2 pt-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                startCall(
                                                                                    partnerPhone,
                                                                                    undefined,
                                                                                    matchedEvent?.title
                                                                                )
                                                                            }
                                                                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                                                                            title={`Call ${partnerPhone} from organization number`}
                                                                        >
                                                                            <IconPhone className="h-3 w-3" />
                                                                            Call Back
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (isReplyingInline) {
                                                                                    setActiveInlineReplyId(null);
                                                                                } else {
                                                                                    setActiveInlineReplyId(msg.sid);
                                                                                    setInlineReplyText("");
                                                                                }
                                                                            }}
                                                                            className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 transition"
                                                                        >
                                                                            <IconSend className="h-3 w-3" />
                                                                            Reply SMS
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Inline Reply Form */}
                                                            {isReplyingInline && (
                                                                <form
                                                                    onSubmit={(e) => {
                                                                        e.preventDefault();
                                                                        handleSendReply(partnerPhone, inlineReplyText);
                                                                    }}
                                                                    className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2"
                                                                >
                                                                    <p className="text-[11px] text-slate-300 font-medium">
                                                                        Send reply to{" "}
                                                                        <span className="font-mono text-white">
                                                                            {partnerPhone}
                                                                        </span>
                                                                        :
                                                                    </p>
                                                                    <div className="flex items-end gap-2">
                                                                        <textarea
                                                                            rows={2}
                                                                            value={inlineReplyText}
                                                                            onChange={(e) =>
                                                                                setInlineReplyText(e.target.value)
                                                                            }
                                                                            placeholder="Type your reply message..."
                                                                            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                        <div className="flex flex-col gap-1.5 shrink-0">
                                                                            <button
                                                                                type="submit"
                                                                                disabled={
                                                                                    isSendingReply ||
                                                                                    !inlineReplyText.trim()
                                                                                }
                                                                                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                                                                            >
                                                                                {isSendingReply ? "Sending..." : "Send"}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setActiveInlineReplyId(null)
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
