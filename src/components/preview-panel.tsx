"use client";

import { CalendarClock, Check, Flag, Pencil, Trash2, X } from "lucide-react";
import { fromLocalInput, toLocalInput } from "@/lib/dates";
import type { ActionType, Priority } from "@/lib/types";

export interface Draft {
  key: string;
  action: ActionType;
  task_id: string | null;
  taskTitle: string | null; // the existing task this refers to
  title: string | null;
  due_at: string | null;
  priority: Priority | null;
  category: string | null;
  notes: string | null;
}

interface Props {
  heard: string;
  drafts: Draft[];
  clarification: string | null;
  busy?: boolean;
  onChange: (key: string, patch: Partial<Draft>) => void;
  onRemove: (key: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const LABEL: Record<ActionType, { text: string; icon: typeof Check; tone: string }> = {
  create: { text: "New task", icon: CalendarClock, tone: "text-accent bg-accent-soft" },
  update: { text: "Change", icon: Pencil, tone: "text-warn bg-warn/15" },
  complete: { text: "Mark done", icon: Check, tone: "text-success bg-success/15" },
  delete: { text: "Delete", icon: Trash2, tone: "text-danger bg-danger/15" },
};

const field =
  "rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export function PreviewPanel({
  heard,
  drafts,
  clarification,
  busy,
  onChange,
  onRemove,
  onConfirm,
  onCancel,
}: Props) {
  const creates = drafts.filter((d) => d.action === "create").length;
  const confirmLabel =
    drafts.length === 0
      ? ""
      : creates === drafts.length
        ? `Add ${creates} ${creates === 1 ? "task" : "tasks"}`
        : `Apply ${drafts.length} ${drafts.length === 1 ? "change" : "changes"}`;

  return (
    <section
      aria-label="What I understood"
      className="rise rounded-3xl border border-accent/40 bg-surface p-4 shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">I heard</p>
          <p className="truncate text-sm italic">“{heard}”</p>
        </div>
        <button
          onClick={onCancel}
          aria-label="Dismiss"
          className="rounded-full p-1.5 text-muted hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      </div>

      {clarification && (
        <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">{clarification}</p>
      )}

      <ul className="space-y-2">
        {drafts.map((d) => {
          const meta = LABEL[d.action];
          const Icon = meta.icon;
          const editable = d.action === "create" || d.action === "update";
          return (
            <li key={d.key} className="rounded-2xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.tone}`}
                >
                  <Icon className="size-3.5" /> {meta.text}
                </span>
                <button
                  onClick={() => onRemove(d.key)}
                  aria-label="Remove this item"
                  className="rounded-full p-1 text-muted hover:bg-surface-2"
                >
                  <X className="size-4" />
                </button>
              </div>

              {d.action !== "create" && d.taskTitle && (
                <p className="mt-2 text-sm font-medium">“{d.taskTitle}”</p>
              )}

              {editable && (
                <div className="mt-2 space-y-2">
                  {(d.action === "create" || d.title !== null) && (
                    <input
                      value={d.title ?? ""}
                      onChange={(e) => onChange(d.key, { title: e.target.value })}
                      aria-label="Task title"
                      maxLength={300}
                      className={`${field} w-full font-medium`}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5 text-muted">
                      <CalendarClock className="size-4" aria-hidden />
                      <input
                        type="datetime-local"
                        value={toLocalInput(d.due_at)}
                        onChange={(e) =>
                          onChange(d.key, { due_at: fromLocalInput(e.target.value) })
                        }
                        aria-label="Due date and time"
                        className={`${field} text-foreground`}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-muted">
                      <Flag className="size-4" aria-hidden />
                      <select
                        value={d.priority ?? "medium"}
                        onChange={(e) =>
                          onChange(d.key, { priority: e.target.value as Priority })
                        }
                        aria-label="Priority"
                        className={`${field} text-foreground`}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                  </div>
                  {d.action === "create" && !d.due_at && (
                    <p className="text-xs text-muted">
                      No due time — it won&apos;t send a reminder. Pick one above if you want one.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:bg-surface-2"
        >
          Cancel
        </button>
        {drafts.length > 0 && (
          <button
            onClick={onConfirm}
            disabled={busy || drafts.some((d) => d.action === "create" && !d.title?.trim())}
            className="gradient-bg rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </section>
  );
}
