import { useState, type FormEvent } from "react";
import PopUp from "./PopUp";
import {
  DAY_NAMES,
  checkOpenHours,
  makeHours,
  type DayHours,
  type Holiday,
  type Space,
  type SpaceEvent,
} from "../lib/spaces";

type Props = {
  space: Space | null; 
  spaceEvents: SpaceEvent[]; // existing events in this space
  onSave: (space: Space) => void;
  onDelete: () => void;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none";
const smallInputClass =
  "rounded-lg border border-gray-300 px-2 py-1 focus:border-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400";

export default function SpaceForm({ space, spaceEvents, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(space?.name ?? "");
  const [note, setNote] = useState(space?.note ?? "");
  // new spaces start out open Monday to Friday, 9 to 5
  const [hours, setHours] = useState<DayHours[]>(
    space?.hours ?? makeHours([0, 1, 2, 3, 4], "09:00", "17:00"),
  );
  const [holidays, setHolidays] = useState<Holiday[]>(space?.holidays ?? []);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayLabel, setHolidayLabel] = useState("");
  const [error, setError] = useState("");

  function updateDay(index: number, changes: Partial<DayHours>) {
    setHours((prev) => prev.map((day, i) => (i === index ? { ...day, ...changes } : day)));
  }

  function addHoliday() {
    if (!holidayDate) {
      setError("Pick a date for the holiday.");
      return;
    }
    if (holidays.some((h) => h.date === holidayDate)) {
      setError("That date is already listed.");
      return;
    }
    setHolidays((prev) => [...prev, { date: holidayDate, label: holidayLabel.trim() }]);
    setHolidayDate("");
    setHolidayLabel("");
    setError("");
  }

  function removeHoliday(date: string) {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Space name is required.");
      return;
    }
    for (let i = 0; i < 7; i++) {
      if (hours[i].open && hours[i].from >= hours[i].to) {
        setError(`${DAY_NAMES[i]}: closing time must be after opening time.`);
        return;
      }
    }

    const updated: Space = {
      id: space?.id ?? crypto.randomUUID(),
      name: name.trim(),
      note: note.trim(),
      hours,
      holidays,
    };

    // warn if existing events would end up outside the new hours
    const outside = spaceEvents.filter((e) => checkOpenHours(updated, e.start, e.end));
    if (outside.length > 0) {
      const keep = window.confirm(
        `${outside.length} existing event(s) fall outside the new open hours. Keep them anyway?`,
      );
      if (!keep) return;
    }

    onSave(updated);
  }

  function handleDelete() {
    if (window.confirm("Delete this space and all of its events?")) onDelete();
  }

  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <PopUp>
      <form onSubmit={handleSubmit}>
        <h2 className="mb-4 text-xl font-bold">{space ? "Edit space" : "Add space"}</h2>

        <div className="space-y-3">
          <input className={inputClass} placeholder="Space name (e.g. Soccer Field)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputClass} placeholder="Short description (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <h3 className="mb-1 mt-4 font-semibold">Open hours</h3>
        <p className="mb-2 text-xs text-gray-500">
          Unchecked days and times outside these hours are blacked out and can't be booked.
        </p>
        <div className="space-y-1">
          {hours.map((day, i) => (
            <div key={DAY_NAMES[i]} className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex w-20 items-center gap-2">
                <input type="checkbox" checked={day.open} onChange={(e) => updateDay(i, { open: e.target.checked })} />
                {DAY_NAMES[i]}
              </label>
              <input type="time" step={900} min="06:00" max="23:00" className={smallInputClass} value={day.from} disabled={!day.open} onChange={(e) => updateDay(i, { from: e.target.value })} />
              <span>to</span>
              <input type="time" step={900} min="06:00" max="23:00" className={smallInputClass} value={day.to} disabled={!day.open} onChange={(e) => updateDay(i, { to: e.target.value })} />
            </div>
          ))}
        </div>

        <h3 className="mb-1 mt-4 font-semibold">Holidays and special closures</h3>
        <ul className="mb-2 space-y-1 text-sm">
          {sortedHolidays.length === 0 && <li className="text-gray-500">No holidays added.</li>}
          {sortedHolidays.map((h) => {
            const date = new Date(`${h.date}T00:00`);
            const alreadyClosed = !hours[(date.getDay() + 6) % 7].open;
            return (
              <li key={h.date} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                <span>
                  {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {h.label || "Closed"}
                  {alreadyClosed && <span className="ml-1 text-xs text-gray-500">(already closed that day)</span>}
                </span>
                <button type="button" onClick={() => removeHoliday(h.date)} className="text-red-600 hover:underline">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <input type="date" className={`${inputClass} !w-auto`} value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
          <input className={inputClass} placeholder="Label (e.g. Christmas)" value={holidayLabel} onChange={(e) => setHolidayLabel(e.target.value)} />
          <button type="button" onClick={addHoliday} className="whitespace-nowrap rounded-lg border px-3 py-2 text-sm hover:bg-gray-100">
            Add
          </button>
        </div>

        <p className="mt-3 min-h-5 text-sm text-red-600">{error}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            {space && (
              <button type="button" onClick={handleDelete} className="rounded-lg px-3 py-2 text-red-600 hover:bg-red-50">
                Delete space
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
              {space ? "Save changes" : "Add space"}
            </button>
          </div>
        </div>
      </form>
    </PopUp>
  );
}
