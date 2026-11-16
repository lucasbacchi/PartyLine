import { useMemo, useState, useEffect, type SyntheticEvent } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useApp, type OrgMember } from "../context/AppContext";
import { db } from "../firebase";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { Link } from "react-router";
import {
    IconBuilding,
    IconPlus,
    IconRepeat,
    IconSearch,
    IconClock,
    IconUser,
    IconCalendar,
    IconChevronLeft,
    IconChevronRight,
    IconPhone
} from "../components/Icons";

export function meta() {
    return [
        { title: "Events & Rental Schedule | PartyLine" },
        {
            name: "description",
            content: "Manage event schedules, recurring shifts, calendar views, and live phone routing."
        }
    ];
}

export type RecurrenceType = "none" | "daily" | "weekly" | "weekdays";

export type Event = {
    id: string;
    title: string;
    renterName: string;
    renterPhone: string;
    start: Date;
    end: Date;
    primaryUid?: string;
    primaryName: string;
    primaryPhone: string;
    backupUid?: string;
    backupName: string;
    backupPhone: string;
    recurrence?: RecurrenceType;
    daysOfWeek?: number[];
    recurrenceEndDate?: Date | null;
};

type Filter = "upcoming" | "past" | "all";
type Status = "active" | "upcoming" | "past";
type ViewMode = "list" | "calendar" | "agenda";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isEventCurrentlyActive(e: Event, now: Date = new Date()): boolean {
    const recurrence = e.recurrence || "none";
    if (recurrence === "none") {
        return now >= e.start && now <= e.end;
    }

    if (e.recurrenceEndDate) {
        const endOfDay = new Date(e.recurrenceEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (now > endOfDay) return false;
    }

    const startDay = new Date(e.start);
    startDay.setHours(0, 0, 0, 0);
    if (now < startDay) return false;

    const dayOfWeek = now.getDay();
    if (recurrence === "weekly") {
        const days = Array.isArray(e.daysOfWeek) ? e.daysOfWeek : [];
        if (!days.includes(dayOfWeek)) return false;
    } else if (recurrence === "weekdays") {
        if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = e.start.getHours() * 60 + e.start.getMinutes();
    const endMinutes = e.end.getHours() * 60 + e.end.getMinutes();

    if (endMinutes >= startMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
}

export function findMatchingEvent(events: Event[], timestamp: string | null): Event | undefined {
    if (!timestamp) return undefined;
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return undefined;
    return events.find((e) => isEventCurrentlyActive(e, date));
}

export function isEventOnCalendarDate(event: Event, targetDate: Date): boolean {
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const startDay = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());

    const recurrence = event.recurrence || "none";
    if (recurrence === "none") {
        const endDay = new Date(event.end.getFullYear(), event.end.getMonth(), event.end.getDate());
        return target >= startDay && target <= endDay;
    }

    if (target < startDay) return false;

    if (event.recurrenceEndDate) {
        const untilDay = new Date(
            event.recurrenceEndDate.getFullYear(),
            event.recurrenceEndDate.getMonth(),
            event.recurrenceEndDate.getDate()
        );
        if (target > untilDay) return false;
    }

    const dayOfWeek = target.getDay();
    if (recurrence === "weekly") {
        return Boolean(event.daysOfWeek && event.daysOfWeek.includes(dayOfWeek));
    }
    if (recurrence === "weekdays") {
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    }
    if (recurrence === "daily") {
        return true;
    }
    return false;
}

function getStatus(e: Event): Status {
    const now = new Date();
    if (isEventCurrentlyActive(e, now)) return "active";

    const recurrence = e.recurrence || "none";
    if (recurrence !== "none") {
        if (e.recurrenceEndDate) {
            const endOfDay = new Date(e.recurrenceEndDate);
            endOfDay.setHours(23, 59, 59, 999);
            return now > endOfDay ? "past" : "upcoming";
        }
        return "upcoming";
    }

    return now < e.start ? "upcoming" : "past";
}

function formatRange(start: Date, end: Date) {
    const day = start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
    });
    const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${day} · ${time(start)} – ${time(end)}`;
}

function formatScheduleDescription(e: Event): string {
    const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const timeStr = `${time(e.start)} – ${time(e.end)}`;
    const recurrence = e.recurrence || "none";

    if (recurrence === "none") {
        return formatRange(e.start, e.end);
    }

    const untilStr = e.recurrenceEndDate
        ? ` · Until ${e.recurrenceEndDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
        : "";

    if (recurrence === "daily") {
        return `Repeats Daily · ${timeStr}${untilStr}`;
    }
    if (recurrence === "weekdays") {
        return `Repeats Mon–Fri · ${timeStr}${untilStr}`;
    }
    if (recurrence === "weekly") {
        const days = (e.daysOfWeek || []).map((d) => DAY_NAMES[d]).join(", ") || "Weekly";
        return `Weekly on ${days} · ${timeStr}${untilStr}`;
    }
    return formatRange(e.start, e.end);
}

// turns a date into the string for datetime input
function toInputValue(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// turns a date into YYYY-MM-DD
function toDateInputValue(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

const statusStyle: Record<Status, string> = {
    active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    upcoming: "border-blue-500/40 bg-blue-500/15 text-blue-300",
    past: "border-slate-600 bg-slate-800 text-slate-400"
};

export default function EventsPage() {
    const { currentTenant, members } = useApp();
    const [events, setEvents] = useState<Event[]>([]);
    const [filter, setFilter] = useState<Filter>("all");
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [formTarget, setFormTarget] = useState<Event | "new" | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Live subscription to real Firestore events
    useEffect(() => {
        if (!currentTenant?.id) {
            setEvents([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const eventsRef = collection(db, "tenants", currentTenant.id, "events");

        const unsubscribe = onSnapshot(
            eventsRef,
            (snapshot) => {
                const loadedEvents: Event[] = snapshot.docs.map((docSnap) => {
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
                        primaryUid: data.primaryUid || undefined,
                        primaryName: data.primaryName || "",
                        primaryPhone: data.primaryPhone || "",
                        backupUid: data.backupUid || undefined,
                        backupName: data.backupName || "",
                        backupPhone: data.backupPhone || "",
                        recurrence: (data.recurrence as RecurrenceType) || "none",
                        daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [],
                        recurrenceEndDate: recEnd
                    };
                });

                setEvents(loadedEvents);
                setIsLoading(false);
            },
            (error) => {
                console.warn("Firestore events subscription warning:", error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentTenant?.id]);

    const activeEvents = useMemo(() => events.filter((e) => isEventCurrentlyActive(e)), [events]);
    const liveEvent = activeEvents[0];
    const primaryPhoneItem = currentTenant?.phoneNumbers?.find((p) => p.isPrimary) || currentTenant?.phoneNumbers?.[0];

    const visible = useMemo(() => {
        const sorted = [...events].sort((a, b) => {
            const aActive = isEventCurrentlyActive(a) ? 1 : 0;
            const bActive = isEventCurrentlyActive(b) ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            return a.start.getTime() - b.start.getTime();
        });
        if (filter === "all") return sorted;
        return sorted.filter((e) => (filter === "past" ? getStatus(e) === "past" : getStatus(e) !== "past"));
    }, [events, filter]);

    // Save event to Firestore
    async function saveEvent(data: Omit<Event, "id">, id?: string) {
        if (!currentTenant?.id) return;

        const eventData = {
            title: data.title,
            renterName: data.renterName,
            renterPhone: data.renterPhone,
            start: data.start,
            end: data.end,
            primaryUid: data.primaryUid || null,
            primaryName: data.primaryName,
            primaryPhone: data.primaryPhone,
            backupUid: data.backupUid || null,
            backupName: data.backupName,
            backupPhone: data.backupPhone,
            recurrence: data.recurrence || "none",
            daysOfWeek: data.daysOfWeek || [],
            recurrenceEndDate: data.recurrenceEndDate || null,
            updatedAt: new Date()
        };

        if (id) {
            const eventDocRef = doc(db, "tenants", currentTenant.id, "events", id);
            await updateDoc(eventDocRef, eventData);
        } else {
            const eventsRef = collection(db, "tenants", currentTenant.id, "events");
            await addDoc(eventsRef, { ...eventData, createdAt: new Date() });
        }
        setFormTarget(null);
    }

    // Delete event from Firestore
    async function deleteEvent(id: string) {
        if (!currentTenant?.id) return;
        if (!window.confirm("Delete this event from the database?")) return;

        const eventDocRef = doc(db, "tenants", currentTenant.id, "events", id);
        await deleteDoc(eventDocRef);
        setFormTarget(null);
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <Navbar />
            <main className="flex-1 p-4 sm:p-6">
                <div className="mx-auto max-w-5xl">
                    {/* Header */}
                    <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <IconCalendar className="h-7 w-7 text-blue-500" />
                                Events & Rental Schedule
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {currentTenant
                                    ? `Assigned hosts dynamically receive incoming calls for ${currentTenant.name}.`
                                    : "Select or register an organization to schedule events."}
                            </p>
                        </div>
                        {currentTenant && (
                            <button
                                onClick={() => setFormTarget("new")}
                                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
                            >
                                <IconPlus className="h-4 w-4" />
                                New Event / Schedule
                            </button>
                        )}
                    </header>

                    {!currentTenant ? (
                        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
                            <IconBuilding className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                            <h3 className="text-lg font-semibold text-white">No active organization</h3>
                            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                                You need to belong to an organization before scheduling rentals and assigning duty hosts.
                            </p>
                            <Link
                                to="/account"
                                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
                            >
                                Create or Join an Organization
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* LIVE PHONE ROUTING STATUS BANNER */}
                            {liveEvent ? (
                                <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-linear-to-r from-emerald-950/70 via-slate-900 to-slate-900 p-5 shadow-2xl relative overflow-hidden">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex items-start gap-3.5">
                                            <div className="relative mt-1">
                                                <span className="flex h-3.5 w-3.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                                        Live Phone Routing Active
                                                    </span>
                                                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                                        ON DUTY
                                                    </span>
                                                </div>
                                                <h3 className="text-base font-bold text-white mt-1">
                                                    {liveEvent.title}
                                                </h3>
                                                <p className="text-xs text-slate-300 mt-1">
                                                    Incoming calls to{" "}
                                                    <span className="font-mono font-semibold text-white">
                                                        {primaryPhoneItem?.number || currentTenant.name}
                                                    </span>{" "}
                                                    are currently routing directly to:
                                                </p>
                                                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
                                                    <div className="flex items-center gap-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/40 px-3 py-1.5 text-emerald-200">
                                                        <IconPhone className="h-3.5 w-3.5 text-emerald-400" />
                                                        <span className="font-semibold">Primary:</span> {liveEvent.primaryName}{" "}
                                                        <span className="font-mono text-emerald-300">({liveEvent.primaryPhone})</span>
                                                    </div>
                                                    {liveEvent.backupName && (
                                                        <div className="flex items-center gap-1.5 rounded-xl bg-slate-800/90 border border-slate-700 px-3 py-1.5 text-slate-300">
                                                            <span className="font-semibold text-slate-400">Backup:</span> {liveEvent.backupName}{" "}
                                                            <span className="font-mono text-slate-400">({liveEvent.backupPhone})</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                                            <span className="text-[11px] text-slate-400">
                                                Active shift interval
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setFormTarget(liveEvent)}
                                                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                                            >
                                                Edit Active Shift
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2.5 text-slate-400">
                                        <span className="h-2 w-2 rounded-full bg-slate-600"></span>
                                        <span>
                                            No event is currently live. Incoming calls to{" "}
                                            <span className="font-mono text-slate-300">
                                                {primaryPhoneItem?.number || "your line"}
                                            </span>{" "}
                                            follow your organization's default fallback settings.
                                        </span>
                                    </div>
                                    <Link to="/org/settings" className="text-blue-400 hover:text-blue-300 font-medium shrink-0">
                                        View Fallback Settings →
                                    </Link>
                                </div>
                            )}

                            {/* VIEW MODE TOGGLE & FILTERS */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                                <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("list")}
                                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                            viewMode === "list"
                                                ? "bg-blue-600 text-white shadow"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        📋 Master List
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("calendar")}
                                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                            viewMode === "calendar"
                                                ? "bg-blue-600 text-white shadow"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <IconCalendar className="h-3.5 w-3.5" />
                                        Calendar View
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("agenda")}
                                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                            viewMode === "agenda"
                                                ? "bg-blue-600 text-white shadow"
                                                : "text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <IconClock className="h-3.5 w-3.5" />
                                        Upcoming Agenda
                                    </button>
                                </div>

                                {viewMode === "list" && (
                                    <div className="flex gap-2">
                                        {(["upcoming", "past", "all"] as Filter[]).map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                                                    filter === f
                                                        ? "border-blue-600 bg-blue-600 text-white shadow"
                                                        : "border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white"
                                                }`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {isLoading ? (
                                <p className="p-12 text-center text-xs text-slate-500">
                                    Loading schedule and calendar from database...
                                </p>
                            ) : events.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-500">
                                    No events found in the database. Click "+ New Event / Schedule" to get started.
                                </div>
                            ) : viewMode === "calendar" ? (
                                /* CALENDAR VIEW */
                                <EventsCalendarView
                                    events={events}
                                    onSelectEvent={(e) => setFormTarget(e)}
                                    onNewEvent={() => setFormTarget("new")}
                                />
                            ) : viewMode === "agenda" ? (
                                /* AGENDA VIEW */
                                <EventsAgendaView
                                    events={events}
                                    onSelectEvent={(e) => setFormTarget(e)}
                                    onDeleteEvent={deleteEvent}
                                />
                            ) : (
                                /* MASTER LIST VIEW */
                                <ul className="space-y-3">
                                    {visible.map((e) => {
                                        const status = getStatus(e);
                                        const isLive = isEventCurrentlyActive(e);

                                        return (
                                            <li
                                                key={e.id}
                                                className={`rounded-2xl border bg-slate-900/80 p-5 transition ${
                                                    isLive
                                                        ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                                                        : "border-slate-800 hover:border-slate-700"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h2 className="text-lg font-semibold text-white">{e.title}</h2>
                                                        {isLive && (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 animate-pulse">
                                                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                                                LIVE NOW
                                                            </span>
                                                        )}
                                                        {e.recurrence && e.recurrence !== "none" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                                                                <IconRepeat className="h-3 w-3" />
                                                                {e.recurrence === "daily"
                                                                    ? "Daily"
                                                                    : e.recurrence === "weekdays"
                                                                      ? "Mon–Fri"
                                                                      : "Weekly"}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span
                                                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${statusStyle[status]}`}
                                                    >
                                                        {status}
                                                    </span>
                                                </div>

                                                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                                                    <IconClock className="h-3.5 w-3.5 text-slate-400" />
                                                    {formatScheduleDescription(e)}
                                                </p>

                                                {(e.renterName || e.renterPhone) && (
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        Renter: <span className="text-slate-200">{e.renterName}</span>{" "}
                                                        {e.renterPhone && `· ${e.renterPhone}`}
                                                    </p>
                                                )}

                                                <div className="mt-4 grid gap-2 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3 text-xs sm:grid-cols-2">
                                                    <p>
                                                        <span className="font-semibold text-slate-200">
                                                            Primary Host:
                                                        </span>{" "}
                                                        {e.primaryName}
                                                        {e.primaryPhone && (
                                                            <span className="font-mono text-slate-400">
                                                                {" "}
                                                                · {e.primaryPhone}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p>
                                                        <span className="font-semibold text-slate-200">
                                                            Backup Host:
                                                        </span>{" "}
                                                        {e.backupName || "None"}
                                                        {e.backupPhone && (
                                                            <span className="font-mono text-slate-400">
                                                                {" "}
                                                                · {e.backupPhone}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="mt-4 flex justify-end gap-3 text-xs">
                                                    <button
                                                        onClick={() => setFormTarget(e)}
                                                        className="font-semibold text-blue-400 hover:text-blue-300"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => deleteEvent(e.id)}
                                                        className="font-semibold text-red-400 hover:text-red-300"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </>
                    )}
                </div>

                {formTarget && (
                    <EventForm
                        event={formTarget === "new" ? null : formTarget}
                        otherEvents={events.filter((e) => formTarget === "new" || e.id !== formTarget.id)}
                        members={members}
                        onSave={saveEvent}
                        onDelete={deleteEvent}
                        onClose={() => setFormTarget(null)}
                    />
                )}
            </main>
            <Footer />
        </div>
    );
}

// CALENDAR VIEW COMPONENT
function EventsCalendarView({
    events,
    onSelectEvent,
    onNewEvent
}: {
    events: Event[];
    onSelectEvent: (e: Event) => void;
    onNewEvent: (date?: Date) => void;
}) {
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthName = currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const jumpToToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days = useMemo(() => {
        const list: Array<{ date: Date; isCurrentMonth: boolean; dayNum: number }> = [];

        const prevMonthLastDate = new Date(year, month, 0).getDate();
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            list.push({
                date: new Date(year, month - 1, prevMonthLastDate - i),
                isCurrentMonth: false,
                dayNum: prevMonthLastDate - i
            });
        }

        for (let d = 1; d <= totalDaysInMonth; d++) {
            list.push({
                date: new Date(year, month, d),
                isCurrentMonth: true,
                dayNum: d
            });
        }

        const remaining = 7 - (list.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                list.push({
                    date: new Date(year, month + 1, i),
                    isCurrentMonth: false,
                    dayNum: i
                });
            }
        }

        return list;
    }, [year, month, firstDayOfWeek, totalDaysInMonth]);

    const isToday = (d: Date) => {
        const now = new Date();
        return (
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
        );
    };

    const isSelected = (d: Date) => {
        return (
            d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear()
        );
    };

    const selectedDayEvents = useMemo(() => {
        return events.filter((e) => isEventOnCalendarDate(e, selectedDate));
    }, [events, selectedDate]);

    return (
        <div className="space-y-4">
            {/* Calendar Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white min-w-44">{monthName}</h2>
                    <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-0.5">
                        <button
                            type="button"
                            onClick={prevMonth}
                            className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Previous month"
                        >
                            <IconChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={nextMonth}
                            className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Next month"
                        >
                            <IconChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={jumpToToday}
                        className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => onNewEvent(selectedDate)}
                        className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
                    >
                        <IconPlus className="h-3.5 w-3.5" />
                        Add Event
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
                <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/70 text-center text-xs font-bold text-slate-400 py-3">
                    {DAY_NAMES.map((name) => (
                        <div key={name} className="uppercase tracking-wider">
                            {name}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60 text-xs">
                    {days.map((item, idx) => {
                        const dayEvents = events.filter((e) => isEventOnCalendarDate(e, item.date));
                        const today = isToday(item.date);
                        const selected = isSelected(item.date);

                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedDate(item.date)}
                                className={`min-h-24 p-1.5 transition cursor-pointer flex flex-col justify-between ${
                                    !item.isCurrentMonth
                                        ? "bg-slate-950/40 text-slate-600"
                                        : selected
                                          ? "bg-blue-950/30 ring-1 ring-inset ring-blue-500/50"
                                          : "hover:bg-slate-800/40"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span
                                        className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                                            today
                                                ? "bg-blue-600 font-bold text-white shadow"
                                                : selected
                                                  ? "bg-slate-700 text-white font-bold"
                                                  : item.isCurrentMonth
                                                    ? "text-slate-300"
                                                    : "text-slate-600"
                                        }`}
                                    >
                                        {item.dayNum}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {dayEvents.length}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1 flex-1 overflow-hidden">
                                    {dayEvents.slice(0, 3).map((e) => {
                                        const isLive = today && isEventCurrentlyActive(e);
                                        const timeStr = e.start.toLocaleTimeString(undefined, { hour: "numeric" });

                                        return (
                                            <button
                                                key={e.id}
                                                type="button"
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    onSelectEvent(e);
                                                }}
                                                className={`w-full truncate text-left rounded-md px-1.5 py-0.5 text-[10px] font-medium transition flex items-center gap-1 ${
                                                    isLive
                                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                                                        : e.recurrence && e.recurrence !== "none"
                                                          ? "bg-purple-500/15 text-purple-300 hover:bg-purple-500/25"
                                                          : "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25"
                                                }`}
                                                title={`${e.title} (${timeStr})`}
                                            >
                                                {isLive && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                                )}
                                                <span className="truncate">{e.title}</span>
                                            </button>
                                        );
                                    })}
                                    {dayEvents.length > 3 && (
                                        <p className="text-[9px] text-slate-400 pl-1">
                                            +{dayEvents.length - 3} more
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected Day Event Drawer */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Schedule for {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </h3>
                    <span className="text-xs text-slate-400">
                        {selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"}
                    </span>
                </div>

                {selectedDayEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">
                        No events scheduled on this day. Click "Add Event" to schedule.
                    </p>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {selectedDayEvents.map((e) => {
                            const isLive = isToday(selectedDate) && isEventCurrentlyActive(e);
                            return (
                                <div
                                    key={e.id}
                                    onClick={() => onSelectEvent(e)}
                                    className={`rounded-xl border p-3 transition cursor-pointer flex flex-col justify-between ${
                                        isLive
                                            ? "border-emerald-500/50 bg-emerald-950/20"
                                            : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-1">
                                            <h4 className="font-semibold text-white text-xs">{e.title}</h4>
                                            {isLive && (
                                                <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/40">
                                                    LIVE NOW
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-[11px] text-slate-400">
                                            {formatScheduleDescription(e)}
                                        </p>
                                    </div>
                                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                                        <span className="text-slate-300">
                                            Host: <strong className="text-white">{e.primaryName}</strong> ({e.primaryPhone})
                                        </span>
                                        <span className="text-blue-400 hover:underline">Edit →</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// AGENDA VIEW COMPONENT
function EventsAgendaView({
    events,
    onSelectEvent,
    onDeleteEvent
}: {
    events: Event[];
    onSelectEvent: (e: Event) => void;
    onDeleteEvent: (id: string) => void;
}) {
    const upcomingDays = useMemo(() => {
        const list: Array<{ date: Date; label: string; events: Event[] }> = [];
        const today = new Date();

        for (let i = 0; i < 21; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
            const dayEvents = events.filter((e) => isEventOnCalendarDate(e, d));

            if (dayEvents.length > 0) {
                let label = d.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric"
                });
                if (i === 0) label = "Today · " + label;
                else if (i === 1) label = "Tomorrow · " + label;

                list.push({
                    date: d,
                    label,
                    events: dayEvents
                });
            }
        }
        return list;
    }, [events]);

    const activeEvents = useMemo(() => events.filter((e) => isEventCurrentlyActive(e)), [events]);

    return (
        <div className="space-y-6">
            {activeEvents.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 shadow-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Happening Right Now (Active Phone Routing)
                        </h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {activeEvents.map((e) => (
                            <div
                                key={e.id}
                                className="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-4 shadow flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between">
                                        <h4 className="font-bold text-white text-sm">{e.title}</h4>
                                        <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/40">
                                            LIVE NOW
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-300">{formatScheduleDescription(e)}</p>
                                    <div className="mt-3 rounded-lg bg-emerald-950/60 p-2 text-xs border border-emerald-500/20 space-y-1">
                                        <p className="text-emerald-200">
                                            <strong>Primary Host:</strong> {e.primaryName} ·{" "}
                                            <span className="font-mono">{e.primaryPhone}</span>
                                        </p>
                                        {e.backupName && (
                                            <p className="text-slate-400">
                                                <strong>Backup:</strong> {e.backupName} ·{" "}
                                                <span className="font-mono">{e.backupPhone}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end gap-3 text-xs pt-2 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => onSelectEvent(e)}
                                        className="text-blue-400 hover:text-blue-300 font-semibold"
                                    >
                                        Edit Event
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {upcomingDays.length === 0 && activeEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-500">
                    No upcoming events scheduled on the agenda for the next 3 weeks. Click "+ New Event / Schedule" to schedule.
                </div>
            ) : (
                <div className="space-y-6">
                    {upcomingDays.map((dayGroup) => (
                        <div key={dayGroup.label} className="space-y-3">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                    {dayGroup.label}
                                </h3>
                                <div className="flex-1 h-px bg-slate-800" />
                            </div>

                            <div className="space-y-2.5">
                                {dayGroup.events.map((e) => {
                                    const isLive = isEventCurrentlyActive(e);
                                    const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

                                    return (
                                        <div
                                            key={`${dayGroup.label}-${e.id}`}
                                            className={`rounded-2xl border p-4 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                                                isLive
                                                    ? "border-emerald-500/50 bg-slate-900/90 shadow-md shadow-emerald-500/5"
                                                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3.5">
                                                <div className="shrink-0 rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-center min-w-20">
                                                    <span className="text-xs font-bold text-white block">
                                                        {time(e.start)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block">
                                                        to {time(e.end)}
                                                    </span>
                                                </div>

                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-bold text-white text-sm">{e.title}</h4>
                                                        {isLive && (
                                                            <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/40">
                                                                LIVE
                                                            </span>
                                                        )}
                                                        {e.recurrence && e.recurrence !== "none" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                                                                <IconRepeat className="h-3 w-3" />
                                                                {e.recurrence === "daily" ? "Daily" : e.recurrence === "weekdays" ? "Mon–Fri" : "Weekly"}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {(e.renterName || e.renterPhone) && (
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            Renter: <span className="text-slate-200">{e.renterName}</span>{" "}
                                                            {e.renterPhone && `· ${e.renterPhone}`}
                                                        </p>
                                                    )}

                                                    <p className="mt-1 text-xs text-slate-300">
                                                        <span className="text-slate-400">Primary:</span>{" "}
                                                        <strong>{e.primaryName}</strong> ({e.primaryPhone})
                                                        {e.backupName && (
                                                            <span className="text-slate-400 ml-2">
                                                                · Backup: {e.backupName} ({e.backupPhone})
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end gap-3 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectEvent(e)}
                                                    className="font-semibold text-blue-400 hover:text-blue-300"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteEvent(e.id)}
                                                    className="font-semibold text-red-400 hover:text-red-300"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// HOST MEMBER SELECT
function HostMemberSelect({
    label,
    selectedUid,
    selectedName,
    selectedPhone,
    onChange,
    members,
    excludeUid,
    isOptional = false
}: {
    label: string;
    selectedUid?: string;
    selectedName: string;
    selectedPhone: string;
    onChange: (member: { uid?: string; name: string; phone: string }) => void;
    members: OrgMember[];
    excludeUid?: string;
    isOptional?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [isCustomMode, setIsCustomMode] = useState(Boolean(selectedName && !selectedUid));

    const availableMembers = useMemo(() => {
        return members.filter((m) => {
            if (excludeUid && m.uid === excludeUid) return false;
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                m.displayName.toLowerCase().includes(q) ||
                m.email.toLowerCase().includes(q) ||
                (m.phoneNumber && m.phoneNumber.includes(q))
            );
        });
    }, [members, excludeUid, search]);

    if (isCustomMode) {
        return (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300">{label} (Custom Host)</p>
                    <button
                        type="button"
                        onClick={() => {
                            setIsCustomMode(false);
                            onChange({ uid: undefined, name: "", phone: "" });
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                    >
                        Pick from Team
                    </button>
                </div>
                <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="Full name"
                    value={selectedName}
                    onChange={(e) => onChange({ uid: undefined, name: e.target.value, phone: selectedPhone })}
                />
                <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none text-sm font-mono"
                    type="tel"
                    placeholder="Phone number (+16175550142)"
                    value={selectedPhone}
                    onChange={(e) => onChange({ uid: undefined, name: selectedName, phone: e.target.value })}
                />
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">
                    {label} {isOptional && <span className="font-normal text-slate-500">(Optional)</span>}
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setIsCustomMode(true);
                        setIsOpen(false);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                    Manual entry
                </button>
            </div>

            {selectedName ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/80 p-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300 border border-blue-500/30">
                            {selectedName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">{selectedName}</p>
                            <p className="truncate text-[11px] font-mono text-slate-400">
                                {selectedPhone || (
                                    <span className="text-amber-400">⚠️ No phone assigned</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(true)}
                            className="rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 font-medium"
                        >
                            Change
                        </button>
                        {isOptional && (
                            <button
                                type="button"
                                onClick={() => onChange({ uid: undefined, name: "", phone: "" })}
                                className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:text-red-400"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-3 py-2.5 text-xs text-slate-400 hover:border-slate-500 hover:text-white transition"
                >
                    <span className="flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Select a team member...
                    </span>
                    <span className="text-slate-500">▼</span>
                </button>
            )}

            {isOpen && (
                <div className="mt-1 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl space-y-2 z-10 relative">
                    <div className="relative">
                        <IconSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter team members..."
                            autoFocus
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {availableMembers.length === 0 ? (
                            <p className="p-3 text-center text-xs text-slate-500">No matching team members found.</p>
                        ) : (
                            availableMembers.map((m) => (
                                <button
                                    key={m.uid}
                                    type="button"
                                    onClick={() => {
                                        onChange({
                                            uid: m.uid,
                                            name: m.displayName,
                                            phone: m.phoneNumber || ""
                                        });
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg p-2 text-left text-xs hover:bg-slate-800 transition"
                                >
                                    <div>
                                        <p className="font-semibold text-white">{m.displayName}</p>
                                        <p className="text-[11px] text-slate-400">
                                            {m.phoneNumber ? (
                                                <span className="font-mono">{m.phoneNumber}</span>
                                            ) : (
                                                <span className="text-amber-400 font-semibold">No phone on file</span>
                                            )}{" "}
                                            · <span className="capitalize">{m.role}</span>
                                        </p>
                                    </div>
                                    {m.active && (
                                        <span className="h-2 w-2 rounded-full bg-emerald-400" title="Active on duty" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                    <div className="border-t border-slate-800 pt-1.5 flex justify-between items-center text-[11px]">
                        <button
                            type="button"
                            onClick={() => {
                                setIsCustomMode(true);
                                setIsOpen(false);
                            }}
                            className="text-blue-400 hover:underline"
                        >
                            Enter custom host manually
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// EVENT FORM
type FormProps = {
    event: Event | null;
    otherEvents: Event[];
    members: OrgMember[];
    onSave: (data: Omit<Event, "id">, id?: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
};

function EventForm({ event, otherEvents, members, onSave, onDelete, onClose }: FormProps) {
    const [title, setTitle] = useState(event?.title ?? "");
    const [renterName, setRenterName] = useState(event?.renterName ?? "");
    const [renterPhone, setRenterPhone] = useState(event?.renterPhone ?? "");
    const [start, setStart] = useState(event ? toInputValue(event.start) : "");
    const [end, setEnd] = useState(event ? toInputValue(event.end) : "");

    const [recurrence, setRecurrence] = useState<RecurrenceType>(event?.recurrence ?? "none");
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
        event?.daysOfWeek && event.daysOfWeek.length > 0
            ? event.daysOfWeek
            : [1]
    );
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(
        event?.recurrenceEndDate ? toDateInputValue(event.recurrenceEndDate) : ""
    );

    const [primaryUid, setPrimaryUid] = useState<string | undefined>(event?.primaryUid);
    const [primaryName, setPrimaryName] = useState(event?.primaryName ?? "");
    const [primaryPhone, setPrimaryPhone] = useState(event?.primaryPhone ?? "");

    const [backupUid, setBackupUid] = useState<string | undefined>(event?.backupUid);
    const [backupName, setBackupName] = useState(event?.backupName ?? "");
    const [backupPhone, setBackupPhone] = useState(event?.backupPhone ?? "");

    const [error, setError] = useState("");

    const toggleDay = (dayIndex: number) => {
        if (daysOfWeek.includes(dayIndex)) {
            if (daysOfWeek.length > 1) {
                setDaysOfWeek(daysOfWeek.filter((d) => d !== dayIndex));
            }
        } else {
            setDaysOfWeek([...daysOfWeek, dayIndex].sort());
        }
    };

    function handleSubmit(ev: SyntheticEvent) {
        ev.preventDefault();
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (!title.trim()) return setError("Please enter an event title.");
        if (!start || !end || endDate <= startDate) return setError("End time must be after the start time.");
        if (!primaryName.trim() || digitsOnly(primaryPhone).length < 7)
            return setError("Please assign a primary host with a valid phone number.");

        if (backupName.trim() || backupPhone.trim()) {
            if (!backupName.trim() || digitsOnly(backupPhone).length < 7)
                return setError("Enter both a name and a valid phone for the backup host, or leave both empty.");
            if (digitsOnly(backupPhone) === digitsOnly(primaryPhone))
                return setError("Primary and backup hosts must have different phone numbers.");
        }

        if (recurrence === "weekly" && daysOfWeek.length === 0) {
            return setError("Please select at least one day of the week for weekly recurrence.");
        }

        const recEndDate = recurrence !== "none" && recurrenceEndDate ? new Date(recurrenceEndDate) : null;
        if (recEndDate && recEndDate < startDate) {
            return setError("Recurrence end date cannot be earlier than start date.");
        }

        if (recurrence === "none") {
            const clash = otherEvents.find(
                (o) => (!o.recurrence || o.recurrence === "none") && startDate < o.end && endDate > o.start
            );
            if (clash) return setError(`This overlaps with single event "${clash.title}".`);
        }

        onSave(
            {
                title: title.trim(),
                renterName: renterName.trim(),
                renterPhone: renterPhone.trim(),
                start: startDate,
                end: endDate,
                primaryUid,
                primaryName: primaryName.trim(),
                primaryPhone: primaryPhone.trim(),
                backupUid,
                backupName: backupName.trim(),
                backupPhone: backupPhone.trim(),
                recurrence,
                daysOfWeek: recurrence === "weekly" ? daysOfWeek : [],
                recurrenceEndDate: recEndDate
            },
            event?.id
        );
    }

    const input =
        "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none text-sm";

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center backdrop-blur-sm">
            <form
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:max-w-xl shadow-2xl"
            >
                <h2 className="mb-4 text-xl font-bold text-white">
                    {event ? "Edit schedule / event" : "New schedule / event"}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Event Title</label>
                        <input
                            className={input}
                            placeholder="e.g. Somerville Soccer Game, Friday Open Gym"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Renter / Organizer (Optional)</label>
                            <input
                                className={input}
                                placeholder="e.g. Somerville Youth League"
                                value={renterName}
                                onChange={(e) => setRenterName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Renter Phone (Optional)</label>
                            <input
                                className={input}
                                type="tel"
                                placeholder="+1 (617) 555-0199"
                                value={renterPhone}
                                onChange={(e) => setRenterPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                                <IconRepeat className="h-4 w-4" />
                                Repeat / Schedule Recurrence
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                                { id: "none", label: "One-Time" },
                                { id: "daily", label: "Daily" },
                                { id: "weekdays", label: "Mon – Fri" },
                                { id: "weekly", label: "Weekly Schedule" }
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setRecurrence(opt.id as RecurrenceType)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                        recurrence === opt.id
                                            ? "border-purple-500 bg-purple-500/20 text-white shadow"
                                            : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {recurrence === "weekly" && (
                            <div className="space-y-1.5 pt-1">
                                <p className="text-xs text-slate-400">Select active days:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {DAY_NAMES.map((name, idx) => (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => toggleDay(idx)}
                                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                                daysOfWeek.includes(idx)
                                                    ? "bg-purple-600 text-white"
                                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                                            }`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {recurrence !== "none" && (
                            <div className="pt-1">
                                <label className="block text-xs text-slate-400 mb-1">
                                    Repeat Until (Optional End Date)
                                </label>
                                <input
                                    className={input}
                                    type="date"
                                    value={recurrenceEndDate}
                                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-300">
                            {recurrence === "none" ? "Start Date & Time" : "Daily Start Time / First Date"}
                            <input
                                className={`mt-1 ${input}`}
                                type="datetime-local"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </label>
                        <label className="text-xs font-semibold text-slate-300">
                            {recurrence === "none" ? "End Date & Time" : "Daily End Time"}
                            <input
                                className={`mt-1 ${input}`}
                                type="datetime-local"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-800">
                        <HostMemberSelect
                            label="Primary Host"
                            selectedUid={primaryUid}
                            selectedName={primaryName}
                            selectedPhone={primaryPhone}
                            members={members}
                            excludeUid={backupUid}
                            onChange={(m) => {
                                setPrimaryUid(m.uid);
                                setPrimaryName(m.name);
                                setPrimaryPhone(m.phone);
                            }}
                        />

                        <HostMemberSelect
                            label="Backup Host"
                            selectedUid={backupUid}
                            selectedName={backupName}
                            selectedPhone={backupPhone}
                            members={members}
                            excludeUid={primaryUid}
                            isOptional={true}
                            onChange={(m) => {
                                setBackupUid(m.uid);
                                setBackupName(m.name);
                                setBackupPhone(m.phone);
                            }}
                        />
                    </div>
                </div>

                <p className="mt-4 min-h-5 text-xs text-red-400">{error}</p>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                    <div>
                        {event && (
                            <button
                                type="button"
                                onClick={() => onDelete(event.id)}
                                className="rounded-xl px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
                        >
                            {event ? "Save changes" : "Create event"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
