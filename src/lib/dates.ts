const pad = (n: number) => String(n).padStart(2, "0");

/** Value for an <input type="datetime-local"> in the user's local timezone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts a datetime-local value back to a UTC ISO string. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** "Today · 5:00 PM", "Tomorrow · 9:00 AM", "Fri, Oct 17 · 3:00 PM". */
export function formatDue(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = startOfDay(now);
  const diffDays = Math.round(
    (startOfDay(d).getTime() - today.getTime()) / 86_400_000,
  );
  let day: string;
  if (diffDays === 0) day = "Today";
  else if (diffDays === 1) day = "Tomorrow";
  else if (diffDays === -1) day = "Yesterday";
  else day = dateFmt.format(d);
  return `${day} · ${timeFmt.format(d)}`;
}

export function isOverdue(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < now.getTime();
}
