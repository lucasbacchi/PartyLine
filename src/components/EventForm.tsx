import { useState, type FormEvent } from "react";
import PopUp from "./PopUp";
import {
  checkOpenHours,
  formatTime,
  summarizeHours,
  toDateKey,
  toTimeString,
  type Space,
  type SpaceEvent,
} from "../lib/spaces";

type Props = {
  space: Space;
  event: SpaceEvent | null;
  defaultStart: Date;
  defaultEnd: Date;
  spaceEvents: SpaceEvent[]; // OVERLAP
  onSave: (data: Omit<SpaceEvent, "id">) => void;
  onDelete: () => void;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none";

const digitsOnly = (phone: string) => phone.replace(/\D/g, "");

export default function EventForm({
  space,
  event,
  defaultStart,
  defaultEnd,
  spaceEvents,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const start = event?.start ?? defaultStart;
  const end = event?.end ?? defaultEnd;

  const [title, setTitle] = useState(event?.title ?? "");
  const [renterName, setRenterName] = useState(event?.renterName ?? "");
  const [renterPhone, setRenterPhone] = useState(event?.renterPhone ?? "");
  const [date, setDate] = useState(toDateKey(start));
  const [startTime, setStartTime] = useState(toTimeString(start));
  const [endTime, setEndTime] = useState(toTimeString(end));
  const [primaryName, setPrimaryName] = useState(event?.primaryName ?? "");
  const [primaryPhone, setPrimaryPhone] = useState(event?.primaryPhone ?? "");
  const [backupName, setBackupName] = useState(event?.backupName ?? "");
  const [backupPhone, setBackupPhone] = useState(event?.backupPhone ?? "");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const newStart = new Date(`${date}T${startTime}`);
    const newEnd = new Date(`${date}T${endTime}`);

    if (!title.trim() || !renterName.trim() || !renterPhone.trim()) {
      setError("Title, renter name, and renter phone are required.");
      return;
    }
    if (!date || isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd <= newStart) {
      setError("End time must be after the start time.");
      return;
    }

    const hoursProblem = checkOpenHours(space, newStart, newEnd);
    if (hoursProblem) {
      setError(`This space isn't open then. ${hoursProblem}`);
      return;
    }

    if (!primaryName.trim() || digitsOnly(primaryPhone).length < 7) {
      setError("Enter the primary host's name and a valid phone number.");
      return;
    }

    // backup host is optional, but if one field is filled in both are needed
    if (backupName.trim() || backupPhone.trim()) {
      if (!backupName.trim() || digitsOnly(backupPhone).length < 7) {
        setError("Enter both a name and a valid phone number for the backup host, or leave both empty.");
        return;
      }
      if (digitsOnly(backupPhone) === digitsOnly(primaryPhone)) {
        setError("Primary and backup hosts must be different people.");
        return;
      }
    }

    const overlap = spaceEvents.find(
      (other) => other.id !== event?.id && newStart < other.end && newEnd > other.start,
    );
    if (overlap) {
      setError(
        `This overlaps "${overlap.title}" (${formatTime(overlap.start)}–${formatTime(overlap.end)}).`,
      );
      return;
    }

    onSave({
      spaceId: space.id,
      title: title.trim(),
      renterName: renterName.trim(),
      renterPhone: renterPhone.trim(),
      start: newStart,
      end: newEnd,
      primaryName: primaryName.trim(),
      primaryPhone: primaryPhone.trim(),
      backupName: backupName.trim(),
      backupPhone: backupPhone.trim(),
    });
  }

  function handleDelete() {
    if (window.confirm("Delete this event?")) onDelete();
  }

  return (
    <PopUp>
      <form onSubmit={handleSubmit}>
        <h2 className="mb-1 text-xl font-bold">{event ? "Manage event" : "New event"}</h2>
        <p className="mb-4 text-sm text-gray-500">
          {space.name} · Open: {summarizeHours(space)}
        </p>

        <div className="space-y-3">
          <input className={inputClass} placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inputClass} placeholder="Renter name" value={renterName} onChange={(e) => setRenterName(e.target.value)} />
          <input className={inputClass} type="tel" placeholder="Renter phone (+15085550142)" value={renterPhone} onChange={(e) => setRenterPhone(e.target.value)} />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="text-sm">
              Date
              <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-sm">
              Start
              <input className={inputClass} type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="text-sm">
              End
              <input className={inputClass} type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Primary host</p>
              <input className={inputClass} placeholder="Full name" value={primaryName} onChange={(e) => setPrimaryName(e.target.value)} />
              <input className={inputClass} type="tel" placeholder="Phone (+15085550142)" value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Backup host (optional)</p>
              <input className={inputClass} placeholder="Full name" value={backupName} onChange={(e) => setBackupName(e.target.value)} />
              <input className={inputClass} type="tel" placeholder="Phone (+15085550142)" value={backupPhone} onChange={(e) => setBackupPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <p className="mt-3 min-h-5 text-sm text-red-600">{error}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            {event && (
              <button type="button" onClick={handleDelete} className="rounded-lg px-3 py-2 text-red-600 hover:bg-red-50">
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
              {event ? "Save changes" : "Create event"}
            </button>
          </div>
        </div>
      </form>
    </PopUp>
  );
}
