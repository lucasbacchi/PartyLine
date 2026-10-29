import { useMemo, useState, useEffect, type SyntheticEvent } from "react";
import Navbar from "../components/Navbar";
import { useApp } from "../context/AppContext";
import { db } from "../firebase";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { Link } from "react-router";
import { IconBuilding, IconPlus } from "../components/Icons";

export type Event = {
    id: string;
    title: string;
    renterName: string;
    renterPhone: string;
    start: Date;
    end: Date;
    primaryName: string;
    primaryPhone: string;
    backupName: string;
    backupPhone: string;
};

type Filter = "upcoming" | "past" | "all";
type Status = "active" | "upcoming" | "past";

function getStatus(e: Event): Status {
    const now = new Date();
    if (now >= e.start && now <= e.end) return "active";
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

// turns a date into the string for the datetime input
function toInputValue(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

const statusStyle: Record<Status, string> = {
    active: "border-green-500/40 bg-green-500/15 text-green-300",
    upcoming: "border-blue-500/40 bg-blue-500/15 text-blue-300",
    past: "border-slate-600 bg-slate-800 text-slate-400"
};

export default function EventsPage() {
    const { currentTenant } = useApp();
    const [events, setEvents] = useState<Event[]>([]);
    const [filter, setFilter] = useState<Filter>("all");
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

                    return {
                        id: docSnap.id,
                        title: data.title || "Rental Event",
                        renterName: data.renterName || "",
                        renterPhone: data.renterPhone || "",
                        start: startDate,
                        end: endDate,
                        primaryName: data.primaryName || "",
                        primaryPhone: data.primaryPhone || "",
                        backupName: data.backupName || "",
                        backupPhone: data.backupPhone || ""
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

    const visible = useMemo(() => {
        const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
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
            primaryName: data.primaryName,
            primaryPhone: data.primaryPhone,
            backupName: data.backupName,
            backupPhone: data.backupPhone,
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
                <div className="mx-auto max-w-4xl">
                    <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold">Events & Rental Schedule</h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {currentTenant
                                    ? `Assigned hosts receive incoming calls for ${currentTenant.name}.`
                                    : "Select or register an organization to schedule events."}
                            </p>
                        </div>
                        {currentTenant && (
                            <button
                                onClick={() => setFormTarget("new")}
                                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
                            >
                                <IconPlus className="h-4 w-4" />
                                New Event
                            </button>
                        )}
                    </header>

                    {!currentTenant ? (
                        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
                            <IconBuilding className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                            <h3 className="text-lg font-semibold text-white">No active organization</h3>
                            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                                You need to belong to an organization before scheduling rentals and assigning duty
                                hosts.
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
                            <div className="mb-6 flex gap-2">
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

                            {isLoading ? (
                                <p className="p-8 text-center text-xs text-slate-500">
                                    Loading schedule from database...
                                </p>
                            ) : visible.length === 0 ? (
                                <p className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-500">
                                    No events found in the database. Click "+ New Event" to schedule your first rental.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {visible.map((e) => {
                                        const status = getStatus(e);
                                        return (
                                            <li
                                                key={e.id}
                                                className={`rounded-2xl border bg-slate-900/80 p-5 transition ${
                                                    status === "active"
                                                        ? "border-green-500/50 shadow-lg shadow-green-500/5"
                                                        : "border-slate-800 hover:border-slate-700"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <h2 className="text-lg font-semibold text-white">{e.title}</h2>
                                                    <span
                                                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${statusStyle[status]}`}
                                                    >
                                                        {status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    {formatRange(e.start, e.end)}
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
                        onSave={saveEvent}
                        onDelete={deleteEvent}
                        onClose={() => setFormTarget(null)}
                    />
                )}
            </main>
        </div>
    );
}

type FormProps = {
    event: Event | null;
    otherEvents: Event[];
    onSave: (data: Omit<Event, "id">, id?: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
};

function EventForm({ event, otherEvents, onSave, onDelete, onClose }: FormProps) {
    const [title, setTitle] = useState(event?.title ?? "");
    const [renterName, setRenterName] = useState(event?.renterName ?? "");
    const [renterPhone, setRenterPhone] = useState(event?.renterPhone ?? "");
    const [start, setStart] = useState(event ? toInputValue(event.start) : "");
    const [end, setEnd] = useState(event ? toInputValue(event.end) : "");
    const [primaryName, setPrimaryName] = useState(event?.primaryName ?? "");
    const [primaryPhone, setPrimaryPhone] = useState(event?.primaryPhone ?? "");
    const [backupName, setBackupName] = useState(event?.backupName ?? "");
    const [backupPhone, setBackupPhone] = useState(event?.backupPhone ?? "");
    const [error, setError] = useState("");

    function handleSubmit(ev: SyntheticEvent) {
        ev.preventDefault();
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (!title.trim()) return setError("Please enter an event title.");
        if (!start || !end || endDate <= startDate) return setError("End time must be after the start time.");
        if (!primaryName.trim() || digitsOnly(primaryPhone).length < 7)
            return setError("Enter the primary host's name and a valid phone number.");

        // backup is optional, but needs a name and phone if used
        if (backupName.trim() || backupPhone.trim()) {
            if (!backupName.trim() || digitsOnly(backupPhone).length < 7)
                return setError("Enter both a name and a valid phone for the backup host, or leave both empty.");
            if (digitsOnly(backupPhone) === digitsOnly(primaryPhone))
                return setError("Primary and backup hosts must be different people.");
        }

        // one number can only ring one host at a time
        const clash = otherEvents.find((o) => startDate < o.end && endDate > o.start);
        if (clash) return setError(`This overlaps "${clash.title}". Pick a different time.`);

        onSave(
            {
                title: title.trim(),
                renterName: renterName.trim(),
                renterPhone: renterPhone.trim(),
                start: startDate,
                end: endDate,
                primaryName: primaryName.trim(),
                primaryPhone: primaryPhone.trim(),
                backupName: backupName.trim(),
                backupPhone: backupPhone.trim()
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
                className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:max-w-lg shadow-2xl"
            >
                <h2 className="mb-4 text-xl font-bold text-white">{event ? "Edit event" : "New event"}</h2>

                <div className="space-y-3">
                    <input
                        className={input}
                        placeholder="Event title (e.g. Somerville Soccer Game)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <input
                            className={input}
                            placeholder="Renter name (optional)"
                            value={renterName}
                            onChange={(e) => setRenterName(e.target.value)}
                        />
                        <input
                            className={input}
                            type="tel"
                            placeholder="Renter phone (optional)"
                            value={renterPhone}
                            onChange={(e) => setRenterPhone(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-slate-400">
                            Start Time
                            <input
                                className={input}
                                type="datetime-local"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </label>
                        <label className="text-xs text-slate-400">
                            End Time
                            <input
                                className={input}
                                type="datetime-local"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 pt-2">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-300">Primary Host</p>
                            <input
                                className={input}
                                placeholder="Full name"
                                value={primaryName}
                                onChange={(e) => setPrimaryName(e.target.value)}
                            />
                            <input
                                className={input}
                                type="tel"
                                placeholder="Phone (+16175550142)"
                                value={primaryPhone}
                                onChange={(e) => setPrimaryPhone(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-300">Backup Host (optional)</p>
                            <input
                                className={input}
                                placeholder="Full name"
                                value={backupName}
                                onChange={(e) => setBackupName(e.target.value)}
                            />
                            <input
                                className={input}
                                type="tel"
                                placeholder="Phone (+16175550142)"
                                value={backupPhone}
                                onChange={(e) => setBackupPhone(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <p className="mt-3 min-h-5 text-xs text-red-400">{error}</p>

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
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow"
                        >
                            {event ? "Save changes" : "Create event"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
