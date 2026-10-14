"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { LogOut, Sparkles, TriangleAlert, X } from "lucide-react";
import { CommandBar } from "./command-bar";
import { Logo } from "./logo";
import { PreviewPanel, type Draft } from "./preview-panel";
import { ReminderSettings } from "./reminder-settings";
import { TaskList } from "./task-list";
import { useSpeech } from "@/hooks/use-speech";
import { useTasks, type StoreMode } from "@/hooks/use-tasks";
import type { ParseResponse, Task, TaskRef } from "@/lib/types";

const EXAMPLES = [
  "Remind me to submit the report tomorrow at 5pm, high priority",
  "Buy milk and call mom at 6 tonight",
  "Gym on Saturday morning",
];

interface Props {
  mode: StoreMode;
  userId?: string;
  email?: string;
}

export function Dashboard({ mode, userId, email }: Props) {
  const { tasks, loading, error, clearError, addTask, updateTask, removeTask } = useTasks(
    mode,
    userId,
  );
  const [heard, setHeard] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [clarification, setClarification] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = useCallback(
    async (text: string) => {
      setParsing(true);
      setParseError(null);
      setNotice(null);
      setDrafts([]);
      setClarification(null);
      setHeard(text);

      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            // Demo tasks live in the browser, so the server needs them for "mark X done".
            tasks:
              mode === "demo"
                ? tasks.slice(0, 50).map(
                    (t): TaskRef => ({
                      id: t.id,
                      title: t.title,
                      due_at: t.due_at,
                      status: t.status,
                    }),
                  )
                : undefined,
          }),
        });
        const data = (await res.json()) as ParseResponse & { error?: string };
        if (!res.ok) {
          setParseError(data.error ?? "Something went wrong. Please try again.");
          setHeard("");
          return;
        }

        const byId = new Map(tasks.map((t) => [t.id, t]));
        setDrafts(
          data.actions.map((a, i) => ({
            key: `${Date.now()}-${i}`,
            action: a.action,
            task_id: a.task_id,
            taskTitle: a.task_id ? (byId.get(a.task_id)?.title ?? null) : null,
            title: a.title,
            due_at: a.due_at,
            priority: a.priority,
            category: a.category,
            notes: a.notes,
          })),
        );
        setClarification(data.clarification);
      } catch {
        setParseError("Couldn't reach the server. Check your connection and try again.");
        setHeard("");
      } finally {
        setParsing(false);
      }
    },
    [mode, tasks],
  );

  const speech = useSpeech(submit);

  const patchDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const removeDraft = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));
  const dismiss = () => {
    setDrafts([]);
    setHeard("");
    setClarification(null);
  };

  async function confirm() {
    let added = 0;
    let changed = 0;
    for (const d of drafts) {
      if (d.action === "create" && d.title?.trim()) {
        await addTask({
          title: d.title,
          due_at: d.due_at,
          priority: d.priority ?? "medium",
          category: d.category,
          notes: d.notes,
        });
        added++;
      } else if (d.task_id && d.action === "complete") {
        await updateTask(d.task_id, { status: "done" });
        changed++;
      } else if (d.task_id && d.action === "delete") {
        await removeTask(d.task_id);
        changed++;
      } else if (d.task_id && d.action === "update") {
        await updateTask(d.task_id, {
          ...(d.title?.trim() ? { title: d.title.trim() } : {}),
          ...(d.due_at ? { due_at: d.due_at } : {}),
          ...(d.priority ? { priority: d.priority } : {}),
          ...(d.category ? { category: d.category } : {}),
          ...(d.notes ? { notes: d.notes } : {}),
        });
        changed++;
      }
    }
    dismiss();
    const parts = [];
    if (added) parts.push(`Added ${added} ${added === 1 ? "task" : "tasks"}`);
    if (changed) parts.push(`${changed} updated`);
    setNotice(parts.join(" · ") || null);
    setTimeout(() => setNotice(null), 3500);
  }

  const toggle = (task: Task) =>
    updateTask(task.id, { status: task.status === "done" ? "todo" : "done" });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <Logo href={mode === "cloud" ? "/app" : "/"} />
        {mode === "cloud" ? (
          <form action="/auth/signout" method="post" className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-muted sm:block">{email}</span>
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-sm font-medium text-muted ring-1 ring-border hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        ) : (
          <Link
            href="/?signin=1"
            className="gradient-bg rounded-full px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        )}
      </header>

      {mode === "demo" && (
        <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          <b>Demo mode.</b> Tasks stay in this browser and there are no reminders.{" "}
          <Link href="/?signin=1" className="font-semibold text-accent underline">
            Sign in
          </Link>{" "}
          to sync across devices and get notified when tasks are due.
        </p>
      )}

      {mode === "cloud" && (
        <ReminderSettings
          onCreateTestTask={() =>
            addTask({
              title: "Test reminder",
              due_at: new Date(Date.now() + 65_000).toISOString(),
              priority: "medium",
              category: "test",
            })
          }
        />
      )}

      <CommandBar onSubmit={submit} busy={parsing} speech={speech} />

      {tasks.length === 0 && !loading && !heard && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Examples">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
            <Sparkles className="size-3.5" /> Try saying
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => submit(ex)}
              disabled={parsing}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs hover:border-accent hover:text-accent disabled:opacity-50"
            >
              “{ex}”
            </button>
          ))}
        </div>
      )}

      {parseError && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{parseError}</span>
          <button onClick={() => setParseError(null)} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}

      {(drafts.length > 0 || clarification) && (
        <PreviewPanel
          heard={heard}
          drafts={drafts}
          clarification={clarification}
          onChange={patchDraft}
          onRemove={removeDraft}
          onConfirm={confirm}
          onCancel={dismiss}
        />
      )}

      {notice && (
        <p role="status" className="rise rounded-2xl bg-success/10 px-4 py-2.5 text-center text-sm font-medium text-success">
          {notice}
        </p>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}

      <TaskList tasks={tasks} loading={loading} onToggle={toggle} onDelete={removeTask} />
    </div>
  );
}
