// Types, functions - EventSpaces
export type DayHours = { open: boolean; from: string; to: string };
export type Holiday = { date: string; label: string };

export type Space = {
  id: string;
  name: string;
  note: string;
  hours: DayHours[]; 
  holidays: Holiday[];
};

export type SpaceEvent = {
  id: string;
  spaceId: string;
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

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// schedule grid 12am  to 12 am
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
export const ROW_HEIGHT = 30; 

export function makeHours(openDays: number[], from: string, to: string): DayHours[] {
  return DAY_NAMES.map((_, i) => ({ open: openDays.includes(i), from, to }));
}

// get monday of the week in device date, date and time to string, 
export function getMonday(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function toDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function toTimeString(d: Date): string {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function timeToHours(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatTimeString(time: string): string {
  return formatTime(new Date(`2000-01-01T${time}`));
}

function hoursToLabel(h: number): string {
  return formatTime(new Date(2000, 0, 1, Math.floor(h), Math.round((h % 1) * 60)));
}

//  holiday / closed day / open hours
export function getDayInfo(space: Space, date: Date) {
  const holiday = space.holidays.find((h) => h.date === toDateKey(date));
  if (holiday) {
    return { closed: true as const, label: holiday.label || "Holiday" };
  }

  const day = space.hours[(date.getDay() + 6) % 7];
  if (!day.open) {
    return { closed: true as const, label: "Closed" };
  }

  return {
    closed: false as const,
    from: timeToHours(day.from),
    to: timeToHours(day.to),
  };
}


export function checkOpenHours(space: Space, start: Date, end: Date): string {
  const info = getDayInfo(space, start);
  if (info.closed) {
    return info.label === "Closed" ? "That day is closed." : `Closed for ${info.label}.`;
  }

  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  if (startHour < info.from || endHour > info.to) {
    return `Open hours that day are ${hoursToLabel(info.from)} to ${hoursToLabel(info.to)}.`;
  }
  return "";
}

// Timeand day slots
export function summarizeHours(space: Space): string {
  const openDays = space.hours
    .map((day, i) => (day.open ? i : -1))
    .filter((i) => i >= 0);
  if (openDays.length === 0) return "Closed all week";

  const first = space.hours[openDays[0]];
  const sameHours = openDays.every(
    (i) => space.hours[i].from === first.from && space.hours[i].to === first.to,
  );

  // group consecutive days into ranges like Mon–Fri
  const ranges: [number, number][] = [];
  let rangeStart = openDays[0];
  let prev = openDays[0];
  for (const i of openDays.slice(1)) {
    if (i === prev + 1) {
      prev = i;
    } else {
      ranges.push([rangeStart, prev]);
      rangeStart = i;
      prev = i;
    }
  }
  ranges.push([rangeStart, prev]);

  const days = ranges
    .map(([a, b]) => (a === b ? DAY_NAMES[a] : `${DAY_NAMES[a]}–${DAY_NAMES[b]}`))
    .join(", ");

  return sameHours
    ? `${days} · ${formatTimeString(first.from)}–${formatTimeString(first.to)}`
    : `${days} · hours vary`;
}

//example ----

export const INITIAL_SPACES: Space[] = [
  {
    id: "soccer-field",
    name: "Soccer Field",
    note: "",
    hours: makeHours([0, 1, 2, 3, 4, 5, 6], "08:00", "21:00"),
    holidays: [],
  },
];

export const INITIAL_EVENTS: SpaceEvent[] = [
  {
    id: "event-1",
    spaceId: "soccer-field",
    title: "Soccer game reservation",
    renterName: "",
    renterPhone: "",
    start: new Date(2026, 9, 9, 18, 0), // Octobet 9 6pm to 8pm random event
    end: new Date(2026, 9, 9, 20, 0), 
    primaryName: "Gigi Buffon",
    primaryPhone: "+15085550101", 
    backupName: "",
    backupPhone: "",
  },
];
///---e
