"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Check, Trash2 } from "lucide-react";
import { addDays, formatDue, isOverdue, startOfDay } from "@/lib/dates";
import { downloadIcs, googleCalendarUrl, type CalendarTask } from "@/lib/ics";
import type { Priority, Task } from "@/lib/types";

type Tab = "today" | "upcoming" | "anytime" | "done";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "anytime", label: "No date" },
  { id: "done", label: "Done" },
];

const EMPTY: Record<Tab, string> = {
  today: "Nothing due today. Tap the mic and add something.",
  upcoming: "No upcoming tasks with a date.",
  anytime: "No tasks without a date.",
  done: "Completed tasks show up here.",
};

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-danger",
  medium: "bg-warn",
  low: "bg-muted",
};

interface Props {
  tasks: Task[];
  loading: boolean;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, loading, onToggle, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>("today");
  const [now, setNow] = useState(() => new Date());

  // Keep "overdue" and "Today" labels fresh without a reload.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const groups = useMemo(() => {
    const endOfToday = addDays(startOfDay(now), 1).getTime();
    const byDue = (a: Task, b: Task) =>
      new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime();

    const open = tasks.filter((t) => t.status === "todo");
    return {
      today: open
        .filter((t) => t.due_at && new Date(t.due_at).getTime() < endOfToday)
        .sort(byDue),
      upcoming: open
        .filter((t) => t.due_at && new Date(t.due_at).getTime() >= endOfToday)
        .sort(byDue),
      anytime: open.filter((t) => !t.due_at),
      done: tasks
        .filter((t) => t.status === "done")
        .sort(
          (a, b) =>
            new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime(),
        ),
    } satisfies Record<Tab, Task[]>;
  }, [tasks, now]);

  const visible = groups[tab];

  return (
    <section aria-label="Your tasks">
      <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = groups[t.id].length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                    active ? "bg-accent-soft text-accent" : "bg-border text-muted"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          {EMPTY[tab]}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} now={now} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Add to calendar": the phone's own calendar then rings the alarm, even offline. */
function CalendarMenu({ task }: { task: CalendarTask }) {
  const item =
    "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2";
  return (
    <details className="relative">
      <summary
        aria-label={`Add ${task.title} to your calendar`}
        title="Add to calendar (your phone will ring the alarm)"
        className="grid cursor-pointer list-none place-items-center rounded-full p-2 text-muted transition hover:bg-accent-soft hover:text-accent [&::-webkit-details-marker]:hidden"
      >
        <CalendarPlus className="size-4" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-60 rounded-xl border border-border bg-surface p-1 shadow-lg">
        <button type="button" onClick={() => downloadIcs(task)} className={item}>
          <span className="block font-medium">Apple / Outlook / Android</span>
          <span className="block text-xs text-muted">Download a file with alarms (.ics)</span>
        </button>
        <a
          href={googleCalendarUrl(task)}
          target="_blank"
          rel="noopener noreferrer"
          className={item}
        >
          <span className="block font-medium">Google Calendar</span>
          <span className="block text-xs text-muted">Uses your calendar&apos;s default reminder</span>
        </a>
      </div>
    </details>
  );
}

function TaskRow({
  task,
  now,
  onToggle,
  onDelete,
}: {
  task: Task;
  now: Date;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const done = task.status === "done";
  const overdue = !done && isOverdue(task.due_at, now);

  return (
    <li className="rise group flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3">
      <button
        onClick={() => onToggle(task)}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        aria-pressed={done}
        className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition ${
          done
            ? "border-success bg-success text-white"
            : "border-border hover:border-accent"
        }`}
      >
        {done && <Check className="size-4" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${done ? "text-muted line-through" : ""}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          {task.due_at && (
            <span
              className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-danger" : ""}`}
            >
              <CalendarClock className="size-3.5" aria-hidden />
              {formatDue(task.due_at, now)}
              {overdue && " · overdue"}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${PRIORITY_DOT[task.priority]}`} aria-hidden />
            {task.priority}
          </span>
          {task.category && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5">{task.category}</span>
          )}
        </div>
      </div>

      {!done && task.due_at && (
        <CalendarMenu task={{ ...task, due_at: task.due_at }} />
      )}

      <button
        onClick={() => onDelete(task.id)}
        aria-label={`Delete ${task.title}`}
        className="rounded-full p-2 text-muted transition hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
