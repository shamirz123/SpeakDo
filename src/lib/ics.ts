// Builds calendar events so a task becomes an alarm in the phone's or computer's
// own calendar app. The device fires that alarm itself, so it works with no
// server, no internet and no SpeakDo tab open.

export interface CalendarTask {
  id: string;
  title: string;
  notes: string | null;
  due_at: string;
  priority: "low" | "medium" | "high";
}

const EVENT_MINUTES = 30;

const pad = (n: number) => String(n).padStart(2, "0");

function icsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// RFC 5545 text escaping.
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 characters must be folded onto continuation lines.
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

export function buildIcs(task: CalendarTask, now: Date = new Date()): string {
  const start = new Date(task.due_at);
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);
  const description = [task.notes, `Priority: ${task.priority}`, "Added from SpeakDo"]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SpeakDo//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${task.id}@speakdo`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeText(task.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    // One alarm 10 minutes before, one exactly when the task is due.
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(task.title)}`,
    "TRIGGER:-PT10M",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(task.title)}`,
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** A Google Calendar "add event" link (Google applies the calendar's own default reminder). */
export function googleCalendarUrl(task: CalendarTask): string {
  const start = new Date(task.due_at);
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: task.title,
    dates: `${icsDate(start)}/${icsDate(end)}`,
    details: [task.notes, "Added from SpeakDo"].filter(Boolean).join("\n"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Triggers a browser download of the .ics file (phones offer to open it in Calendar). */
export function downloadIcs(task: CalendarTask) {
  const blob = new Blob([buildIcs(task)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  a.href = url;
  a.download = `${slug || "task"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
