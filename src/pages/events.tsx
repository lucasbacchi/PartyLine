import { useState } from "react";
import { useNavigate } from "react-router";
import EventForm from "../components/EventForm";
import ScheduleGrid from "../components/ScheduleGrid";
import SpaceForm from "../components/SpaceForm";
import {
  INITIAL_EVENTS,
  INITIAL_SPACES,
  getMonday,
  summarizeHours,
  type Space,
  type SpaceEvent,
} from "../lib/spaces";

// popups
type EventModalState = { event: SpaceEvent | null; start: Date; end: Date };
type SpaceModalState = { space: Space | null };

export default function EventsPage() {
  const navigate = useNavigate();

  //  replace
  const [spaces, setSpaces] = useState<Space[]>(INITIAL_SPACES);
  const [events, setEvents] = useState<SpaceEvent[]>(INITIAL_EVENTS);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [eventModal, setEventModal] = useState<EventModalState | null>(null);
  const [spaceModal, setSpaceModal] = useState<SpaceModalState | null>(null);

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId) ?? null;

  //navigate  
//back button 
  function handleBack() {
    //
    if (selectedSpace) {
      setSelectedSpaceId(null);
      setWeekOffset(0);
    } else {
      navigate(-1);
    }
  }

  function openSpace(id: string) {
    setSelectedSpaceId(id);
    setWeekOffset(0);
  }

  //

  function saveEvent(data: Omit<SpaceEvent, "id">) {
    const editingId = eventModal?.event?.id;
    if (editingId) {
      setEvents((prev) => prev.map((e) => (e.id === editingId ? { ...data, id: editingId } : e)));
    } else {
      setEvents((prev) => [...prev, { ...data, id: crypto.randomUUID() }]);
    }
    setEventModal(null);
  }

  function deleteEvent() {
    const id = eventModal?.event?.id;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEventModal(null);
  }

  function saveSpace(space: Space) {
    const exists = spaces.some((s) => s.id === space.id);
    setSpaces((prev) => (exists ? prev.map((s) => (s.id === space.id ? space : s)) : [...prev, space]));
    setSpaceModal(null);
  }

  function deleteSpace() {
    const id = spaceModal?.space?.id;
    setSpaces((prev) => prev.filter((s) => s.id !== id));
    setEvents((prev) => prev.filter((e) => e.spaceId !== id));
    if (selectedSpaceId === id) setSelectedSpaceId(null);
    setSpaceModal(null);
  }

  // ---- helpers for opening the event popup ----

  function newEventAt(start: Date) {
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    setEventModal({ event: null, start, end });
  }

  function newEventDefault() {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    newEventAt(start);
  }

  // ---- week label for the schedule ----

  const weekStart = getMonday(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const dateFormat: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const weekLabel = `${weekStart.toLocaleDateString(undefined, dateFormat)} – ${weekEnd.toLocaleDateString(undefined, dateFormat)}`;

  const now = new Date();
  const thisMonday = getMonday(now);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 p-3">
          <button onClick={handleBack} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100">
            ‹ Back
          </button>
          <button onClick={() => navigate("/")} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100">
            Home
          </button>
          <span className="ml-auto text-sm font-semibold text-indigo-700">PartyLine</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        {!selectedSpace ? (
          <>
            {/* list of spaces */}
            <div className="mb-1 flex items-center justify-between gap-2">
              <h1 className="text-2xl font-bold">Event Spaces</h1>
              <button
                onClick={() => setSpaceModal({ space: null })}
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
              >
                + Add space
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">Pick a space to see and manage its schedule.</p>

            {spaces.length === 0 && (
              <p className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                No spaces yet. Click "Add space" to create one.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {spaces.map((space) => {
                const spaceEvents = events.filter((e) => e.spaceId === space.id);
                const liveEvent = spaceEvents.find((e) => now >= e.start && now <= e.end);
                const eventsThisWeek = spaceEvents.filter(
                  (e) => e.start >= thisMonday && e.start < nextMonday,
                ).length;

                return (
                  <div
                    key={space.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm ${
                      liveEvent ? "border-green-400" : "border-gray-200"
                    }`}
                  >
                    <button onClick={() => openSpace(space.id)} className="block w-full text-left">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-lg font-semibold hover:text-indigo-700">{space.name}</h2>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            liveEvent
                              ? "border-green-300 bg-green-100 text-green-800"
                              : "border-gray-300 bg-gray-100 text-gray-600"
                          }`}
                        >
                          {liveEvent ? "In use now" : "Free now"}
                        </span>
                      </div>
                      {space.note && <p className="text-sm text-gray-500">{space.note}</p>}
                      <p className="mt-2 text-sm text-gray-700">Open: {summarizeHours(space)}</p>
                      <p className="text-sm text-gray-700">
                        {eventsThisWeek} event{eventsThisWeek === 1 ? "" : "s"} this week
                        {liveEvent && ` · On duty: ${liveEvent.primaryName}`}
                      </p>
                    </button>
                    <div className="mt-3 text-right">
                      <button
                        onClick={() => setSpaceModal({ space })}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Edit space
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* schedule for one space */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold">{selectedSpace.name}</h1>
                <p className="text-sm text-gray-500">
                  Open: {summarizeHours(selectedSpace)}. Click an open time to add an event, or an event to manage it.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSpaceModal({ space: selectedSpace })}
                  className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100"
                >
                  Edit space
                </button>
                <button
                  onClick={newEventDefault}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
                >
                  + New event
                </button>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <button onClick={() => setWeekOffset(weekOffset - 1)} className="rounded-lg border bg-white px-3 py-1 hover:bg-gray-100" aria-label="Previous week">
                ‹
              </button>
              <span className="min-w-36 text-center text-sm font-medium">{weekLabel}</span>
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="rounded-lg border bg-white px-3 py-1 hover:bg-gray-100" aria-label="Next week">
                ›
              </button>
              <button onClick={() => setWeekOffset(0)} className="ml-2 text-sm text-indigo-600 hover:underline">
                This week
              </button>
            </div>

            <ScheduleGrid
              space={selectedSpace}
              events={events.filter((e) => e.spaceId === selectedSpace.id)}
              weekOffset={weekOffset}
              onSlotClick={newEventAt}
              onEventClick={(event) => setEventModal({ event, start: event.start, end: event.end })}
            />

            <p className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <span
                className="inline-block h-4 w-6 rounded"
                style={{ backgroundImage: "repeating-linear-gradient(45deg, #1f2937, #1f2937 6px, #111827 6px, #111827 12px)" }}
              />
              Closed (can't be booked)
            </p>
          </>
        )}
      </main>

      {/* popups */}
      {eventModal && selectedSpace && (
        <EventForm
          space={selectedSpace}
          event={eventModal.event}
          defaultStart={eventModal.start}
          defaultEnd={eventModal.end}
          spaceEvents={events.filter((e) => e.spaceId === selectedSpace.id)}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setEventModal(null)}
        />
      )}
      {spaceModal && (
        <SpaceForm
          space={spaceModal.space}
          spaceEvents={spaceModal.space ? events.filter((e) => e.spaceId === spaceModal.space!.id) : []}
          onSave={saveSpace}
          onDelete={deleteSpace}
          onClose={() => setSpaceModal(null)}
        />
      )}
    </div>
  );
}
