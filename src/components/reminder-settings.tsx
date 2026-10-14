"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleSlash,
  FlaskConical,
  Loader2,
  RefreshCw,
  Timer,
} from "lucide-react";
import { usePush } from "@/hooks/use-push";
import { createClient } from "@/lib/supabase/browser";

interface LogRow {
  id: string;
  task_title: string;
  channel: string;
  status: "sent" | "failed" | "skipped";
  detail: string | null;
  created_at: string;
}

interface RunResult {
  due: number;
  delivered: { taskId: string; title: string; results: { status: string; detail: string }[] }[];
}

const STATUS_STYLE = {
  sent: { icon: CheckCircle2, tone: "text-success", label: "Sent" },
  failed: { icon: CircleAlert, tone: "text-danger", label: "Failed" },
  skipped: { icon: CircleSlash, tone: "text-warn", label: "Not sent" },
} as const;

function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

const button =
  "inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-1.5 text-sm font-medium transition hover:bg-border disabled:opacity-60";

export function ReminderSettings({
  onCreateTestTask,
}: {
  onCreateTestTask: () => Promise<void>;
}) {
  const push = usePush();
  const [open, setOpen] = useState(false);

  const [busy, setBusy] = useState<null | "test" | "run" | "minute">(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "bad"; text: string } | null>(
    null,
  );

  const [log, setLog] = useState<LogRow[]>([]);
  const [logError, setLogError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refreshLog = useCallback(async () => {
    const { data, error } = await createClient()
      .from("reminder_log")
      .select("id,task_title,channel,status,detail,created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    setNow(Date.now());
    if (error) setLogError(true);
    else {
      setLogError(false);
      setLog((data ?? []) as LogRow[]);
    }
  }, []);

  // While the panel is open, keep the delivery list fresh so you can watch reminders arrive.
  useEffect(() => {
    if (!open) return;
    const first = setTimeout(() => void refreshLog(), 0);
    const id = setInterval(() => void refreshLog(), 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [open, refreshLog]);

  async function post(path: string) {
    const res = await fetch(path, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function sendTest() {
    setBusy("test");
    setMessage(null);
    try {
      const { ok, data } = await post("/api/reminders/test");
      if (!ok) return setMessage({ tone: "bad", text: data.error ?? "The test failed." });
      const r = data.result as { status: keyof typeof STATUS_STYLE; detail: string };
      setMessage({
        tone: r.status === "sent" ? "ok" : r.status === "skipped" ? "warn" : "bad",
        text: r.detail,
      });
      void refreshLog();
    } catch {
      setMessage({ tone: "bad", text: "Couldn't reach the server." });
    } finally {
      setBusy(null);
    }
  }

  async function runCheck() {
    setBusy("run");
    setMessage(null);
    try {
      const { ok, data } = await post("/api/reminders/run");
      if (!ok) return setMessage({ tone: "bad", text: data.error ?? "The check failed." });
      const result = data as RunResult;
      if (result.due === 0) {
        setMessage({
          tone: "warn",
          text: "Nothing is due right now. Add a task with a time that has just passed, or use “Test in 1 minute”.",
        });
      } else {
        const parts = result.delivered.map(
          (d) => `“${d.title}”: ${d.results.map((r) => r.detail).join(" ")}`,
        );
        const anySent = result.delivered.some((d) => d.results.some((r) => r.status === "sent"));
        setMessage({ tone: anySent ? "ok" : "warn", text: parts.join("  ") });
      }
      void refreshLog();
    } catch {
      setMessage({ tone: "bad", text: "Couldn't reach the server." });
    } finally {
      setBusy(null);
    }
  }

  async function testInOneMinute() {
    setBusy("minute");
    setMessage(null);
    try {
      await onCreateTestTask();
      setMessage({
        tone: "ok",
        text: "Test task created, due in about a minute. Close this tab if you like. If the scheduler is running, a notification will arrive and appear in the list below.",
      });
    } finally {
      setBusy(null);
    }
  }

  const pushOn = push.state === "on";
  const messageTone = {
    ok: "bg-success/10 text-success",
    warn: "bg-warn/10 text-warn",
    bad: "bg-danger/10 text-danger",
  };

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {pushOn ? (
          <BellRing className="size-5 text-accent" aria-hidden />
        ) : (
          <BellOff className="size-5 text-muted" aria-hidden />
        )}
        <span className="flex-1">
          <span className="block text-sm font-semibold">Reminders</span>
          <span className="block text-xs text-muted">
            {pushOn
              ? "Notifications on for this device"
              : "Off. Turn on notifications, or add tasks to your calendar."}
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-muted transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-4 py-4">
          {/* Push notifications */}
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Notifications on this device</p>
              <p className="mt-0.5 text-xs text-muted">
                A pop-up appears when a task is due, even if SpeakDo is closed and the phone is
                locked. You can also tap the calendar icon on any task to give it an alarm in your
                calendar app.
              </p>
              {push.state === "unsupported" && (
                <p className="mt-2 text-xs text-warn">
                  This browser can&apos;t receive push notifications, or push isn&apos;t set up on
                  this server. Use the calendar icon on your tasks instead.
                </p>
              )}
              {push.state === "needs-install" && (
                <p className="mt-2 text-xs text-warn">
                  On iPhone/iPad: tap Share → <b>Add to Home Screen</b>, open SpeakDo from there,
                  then come back here.
                </p>
              )}
              {push.state === "blocked" && (
                <p className="mt-2 text-xs text-warn">
                  Notifications are blocked. Allow them from the lock icon next to the address bar,
                  then reload.
                </p>
              )}
              {push.error && <p className="mt-2 text-xs text-danger">{push.error}</p>}
            </div>
            {(push.state === "off" || push.state === "on") && (
              <button
                onClick={pushOn ? push.disable : push.enable}
                disabled={push.busy}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
                  pushOn
                    ? "bg-surface-2 text-foreground hover:bg-border"
                    : "gradient-bg text-white hover:opacity-90"
                }`}
              >
                {push.busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : pushOn ? (
                  "Turn off"
                ) : (
                  "Enable"
                )}
              </button>
            )}
          </div>

          {/* Testing tools */}
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="size-4" aria-hidden /> Check that it works
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={sendTest} disabled={busy !== null} className={button + " !bg-surface"}>
                {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
                Send a test notification
              </button>
              <button onClick={runCheck} disabled={busy !== null} className={button + " !bg-surface"}>
                {busy === "run" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Run reminder check now
              </button>
              <button
                onClick={testInOneMinute}
                disabled={busy !== null}
                className={button + " !bg-surface"}
              >
                {busy === "minute" ? <Loader2 className="size-4 animate-spin" /> : <Timer className="size-4" />}
                Test in 1 minute
              </button>
            </div>
            {message && (
              <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${messageTone[message.tone]}`}>
                {message.text}
              </p>
            )}
          </div>

          {/* Delivery log */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Recent deliveries</p>
              <button
                onClick={() => void refreshLog()}
                aria-label="Refresh deliveries"
                className="rounded-full p-1.5 text-muted hover:bg-surface-2"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
            {logError ? (
              <p className="rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">
                The delivery log isn&apos;t set up yet. Run{" "}
                <code>supabase/migrations/002_delivery_log.sql</code> in the Supabase SQL Editor,
                then refresh.
              </p>
            ) : log.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
                Nothing yet. Every reminder attempt will show up here, with the reason if it
                didn&apos;t go out.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {log.map((row) => {
                  const style = STATUS_STYLE[row.status];
                  const Icon = style.icon;
                  return (
                    <li key={row.id} className="flex items-start gap-2 rounded-xl border border-border px-3 py-2">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${style.tone}`} aria-hidden />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">{row.task_title}</p>
                        <p className="text-xs text-muted">
                          <span className={style.tone}>{style.label}</span> · {row.channel} ·{" "}
                          {row.detail}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(row.created_at, now)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
