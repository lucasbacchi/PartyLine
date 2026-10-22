import { useMemo, useState, type SyntheticEvent } from "react";

// admin adds rentals and picks the primary host

type PartyEvent = {
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

// todo(backend-connect)
const SAMPLE_EVENTS: PartyEvent[] = [
    ///example
    {
        id: "1",
        title: "Soccer game reservation",
        renterName: "Alex Alban",
        renterPhone: "",
        start: new Date(2026, 9, 9, 18, 0),
        end: new Date(2026, 9, 9, 20, 0),
        primaryName: "Bjordi Ismailati",
        primaryPhone: "6171111111",
        backupName: "",
        backupPhone: ""
    }
];

function getStatus(e: PartyEvent): Status {
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
    const [events, setEvents] = useState<PartyEvent[]>(SAMPLE_EVENTS);
    const [filter, setFilter] = useState<Filter>("all");
    const [formTarget, setFormTarget] = useState<PartyEvent | "new" | null>(null);

    const visible = useMemo(() => {
        const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
        if (filter === "all") return sorted;
        return sorted.filter((e) => (filter === "past" ? getStatus(e) === "past" : getStatus(e) !== "past"));
    }, [events, filter]);

    // todo(backend save to the backend)
    function saveEvent(data: Omit<PartyEvent, "id">, id?: string) {
        if (id) {
            setEvents((prev) => prev.map((e) => (e.id === id ? { ...data, id } : e)));
        } else {
            setEvents((prev) => [...prev, { ...data, id: crypto.randomUUID() }]);
        }
        setFormTarget(null);
    }

    // todo(backend delete on the backend)
    function deleteEvent(id: string) {
        if (!window.confirm("Delete this event?")) return;
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setFormTarget(null);
    }

    return (
        <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
            <div className="mx-auto max-w-3xl">
                <header className="mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Events</h1>
                    <button
                        onClick={() => setFormTarget("new")}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
                    >
                        + New Event
                    </button>
                </header>

                <div className="mb-4 flex gap-2">
                    {(["upcoming", "past", "all"] as Filter[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`rounded-full border px-3 py-1 text-sm capitalize ${
                                filter === f
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-slate-700 text-slate-300 hover:bg-slate-900"
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {visible.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                        No events here yet. Click "New Event" to schedule one.
                    </p>
                )}

                <ul className="space-y-3">
                    {visible.map((e) => {
                        const status = getStatus(e);
                        return (
                            <li
                                key={e.id}
                                className={`rounded-xl border bg-slate-900 p-4 ${
                                    status === "active" ? "border-green-500/60" : "border-slate-800"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="text-lg font-semibold">{e.title}</h2>
                                    <span
                                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${statusStyle[status]}`}
                                    >
                                        {status}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400">{formatRange(e.start, e.end)}</p>
                                {(e.renterName || e.renterPhone) && (
                                    <p className="text-sm text-slate-400">
                                        Renter: {e.renterName} {e.renterPhone && `· ${e.renterPhone}`}
                                    </p>
                                )}
                                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                    <p>
                                        <span className="font-medium text-slate-200">Primary:</span> {e.primaryName}
                                        {e.primaryPhone && <span className="text-slate-400"> · {e.primaryPhone}</span>}
                                    </p>
                                    <p>
                                        <span className="font-medium text-slate-200">Backup:</span>{" "}
                                        {e.backupName || "None"}
                                        {e.backupPhone && <span className="text-slate-400"> · {e.backupPhone}</span>}
                                    </p>
                                </div>
                                <div className="mt-3 flex justify-end gap-4 text-sm">
                                    <button onClick={() => setFormTarget(e)} className="text-blue-400 hover:underline">
                                        Edit
                                    </button>
                                    <button onClick={() => deleteEvent(e.id)} className="text-red-400 hover:underline">
                                        Delete
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
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
    );
}

type FormProps = {
    event: PartyEvent | null;
    otherEvents: PartyEvent[];
    onSave: (data: Omit<PartyEvent, "id">, id?: string) => void;
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
        "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
            <form
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 p-5 sm:max-w-lg sm:rounded-2xl"
            >
                <h2 className="mb-4 text-xl font-bold">{event ? "Edit event" : "New event"}</h2>

                <div className="space-y-3">
                    <input
                        className={input}
                        placeholder="Event title"
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
                        <label className="text-sm text-slate-400">
                            Start
                            <input
                                className={input}
                                type="datetime-local"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </label>
                        <label className="text-sm text-slate-400">
                            End
                            <input
                                className={input}
                                type="datetime-local"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Primary host</p>
                            <input
                                className={input}
                                placeholder="Full name"
                                value={primaryName}
                                onChange={(e) => setPrimaryName(e.target.value)}
                            />
                            <input
                                className={input}
                                type="tel"
                                placeholder="Phone (+15085550142)"
                                value={primaryPhone}
                                onChange={(e) => setPrimaryPhone(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Backup host (optional)</p>
                            <input
                                className={input}
                                placeholder="Full name"
                                value={backupName}
                                onChange={(e) => setBackupName(e.target.value)}
                            />
                            <input
                                className={input}
                                type="tel"
                                placeholder="Phone (+15085550142)"
                                value={backupPhone}
                                onChange={(e) => setBackupPhone(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <p className="mt-3 min-h-5 text-sm text-red-400">{error}</p>

                <div className="mt-3 flex items-center justify-between gap-2">
                    <div>
                        {event && (
                            <button
                                type="button"
                                onClick={() => onDelete(event.id)}
                                className="rounded-lg px-3 py-2 text-red-400 hover:bg-red-500/10"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
                        >
                            {event ? "Save changes" : "Create event"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
