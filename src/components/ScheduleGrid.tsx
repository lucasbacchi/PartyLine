import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  ROW_HEIGHT,
  formatTime,
  getDayInfo,
  getMonday,
  toDateKey,
  type Space,
  type SpaceEvent,
} from "../lib/spaces";

type Props = {
  space: Space;
  events: SpaceEvent[];
  weekOffset: number; // 0 = this week -> 1 = next, -1 =previous
  onSlotClick: (start: Date) => void;
  onEventClick: (event: SpaceEvent) => void;
};

//closed times
const closedStyle = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #1f2937, #1f2937 6px, #111827 6px, #111827 12px)",
};

export default function ScheduleGrid({
  space,
  events,
  weekOffset,
  onSlotClick,
  onEventClick,
}: Props) {
  const weekStart = getMonday(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR },
    (_, i) => GRID_START_HOUR + i,
  );
  const gridHeight = hours.length * ROW_HEIGHT;
  const todayKey = toDateKey(new Date());

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
      >
        {/* header row */}
        <div className="border-b" />
        {days.map((day) => {
          const info = getDayInfo(space, day);
          const isToday = toDateKey(day) === todayKey;
          return (
            <div
              key={day.toISOString()}
              className={`border-b border-l p-2 text-center text-sm ${
                isToday ? "bg-indigo-50 font-semibold" : ""
              }`}
            >
              {day.toLocaleDateString(undefined, { weekday: "short" })}
              <br />
              <span className="text-gray-500">{day.getDate()}</span>
              {info.closed && (
                <span className="block text-xs text-gray-500">{info.label}</span>
              )}
            </div>
          );
        })}

        {/* hour labels */}
        <div>
          {hours.map((h) => (
            <div
              key={h}
              className="pr-2 text-right text-xs text-gray-400"
              style={{ height: ROW_HEIGHT }}
            >
              {new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" })}
            </div>
          ))}
        </div>

        {/* one column per day */}
        {days.map((day) => {
          const info = getDayInfo(space, day);
          const dayEvents = events.filter((e) => toDateKey(e.start) === toDateKey(day));

          return (
            <div key={day.toISOString()} className="relative border-l">
              {/* clickable hour slots , not clickable when the day is closed */}
              {hours.map((h) => (
                <div
                  key={h}
                  className={`border-b border-gray-100 ${
                    info.closed ? "" : "cursor-pointer hover:bg-indigo-50"
                  }`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => {
                    if (info.closed) return;
                    onSlotClick(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h));
                  }}
                />
              ))}

              {/* blacked out areas */}
              {info.closed ? (
                <div
                  className="absolute inset-x-0 top-0 z-[5] flex items-center justify-center text-xs font-medium text-gray-300"
                  style={{ ...closedStyle, height: gridHeight }}
                >
                  {info.label}
                </div>
              ) : (
                <>
                  {info.from > GRID_START_HOUR && (
                    <div
                      className="absolute inset-x-0 top-0 z-[5]"
                      style={{ ...closedStyle, height: (info.from - GRID_START_HOUR) * ROW_HEIGHT }}
                    />
                  )}
                  {info.to < GRID_END_HOUR && (
                    <div
                      className="absolute inset-x-0 z-[5]"
                      style={{
                        ...closedStyle,
                        top: (info.to - GRID_START_HOUR) * ROW_HEIGHT,
                        height: (GRID_END_HOUR - info.to) * ROW_HEIGHT,
                      }}
                    />
                  )}
                </>
              )}

              {/* events */}
              {dayEvents.map((event) => {
                const top =
                  (event.start.getHours() + event.start.getMinutes() / 60 - GRID_START_HOUR) *
                  ROW_HEIGHT;
                const height =
                  ((event.end.getTime() - event.start.getTime()) / 3600000) * ROW_HEIGHT;

                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="absolute inset-x-0.5 z-10 overflow-hidden rounded-md border-l-4 border-indigo-400 bg-indigo-100 p-1 text-left text-xs text-indigo-900 shadow-sm"
                    style={{ top, height: height - 2 }}
                  >
                    <b className="block truncate">{event.title}</b>
                    {formatTime(event.start)}–{formatTime(event.end)}
                    <span className="block truncate">
                      {event.primaryName}
                      {event.backupName && ` → ${event.backupName}`}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
