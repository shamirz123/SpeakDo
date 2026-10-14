"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { NewTask, Task, TaskPatch } from "@/lib/types";

export type StoreMode = "cloud" | "demo";

const DEMO_KEY = "speakdo-demo-tasks-v1";

function loadDemo(): Task[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveDemo(tasks: Task[]) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(tasks));
  } catch {
    // Private mode / quota: demo simply won't persist.
  }
}

/**
 * One task API for both modes. "cloud" talks to Supabase (with realtime sync
 * across devices); "demo" keeps everything in this browser's localStorage.
 * Updates are optimistic and rolled back if the server rejects them.
 */
export function useTasks(mode: StoreMode, userId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(
    () => (mode === "cloud" ? createClient() : null),
    [mode],
  );
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Initial load + realtime subscription.
  useEffect(() => {
    let cancelled = false;

    if (!supabase) {
      // localStorage doesn't exist during SSR, so read it after hydration.
      const id = setTimeout(() => {
        setTasks(loadDemo());
        setLoading(false);
      }, 0);
      return () => clearTimeout(id);
    }

    supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError("Couldn't load your tasks. Check your connection.");
        else setTasks((data ?? []) as Task[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`tasks-${userId ?? "me"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setTasks((prev) => prev.filter((t) => t.id !== id));
            return;
          }
          const row = payload.new as Task;
          setTasks((prev) =>
            prev.some((t) => t.id === row.id)
              ? prev.map((t) => (t.id === row.id ? row : t))
              : [row, ...prev],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const persistDemo = useCallback(
    (next: Task[]) => {
      if (mode === "demo") saveDemo(next);
    },
    [mode],
  );

  const fail = useCallback((previous: Task[], message: string) => {
    setTasks(previous);
    setError(message);
  }, []);

  const addTask = useCallback(
    async (input: NewTask) => {
      const task: Task = {
        id: crypto.randomUUID(),
        title: input.title.trim().slice(0, 300),
        notes: input.notes ?? null,
        due_at: input.due_at ?? null,
        priority: input.priority ?? "medium",
        category: input.category ?? null,
        status: "todo",
        created_at: new Date().toISOString(),
        completed_at: null,
      };
      const previous = tasksRef.current;
      const next = [task, ...previous];
      setTasks(next);
      setError(null);

      if (!supabase) return persistDemo(next);
      const { error: err } = await supabase
        .from("tasks")
        .insert({ ...task, user_id: userId });
      if (err) fail(previous, "Couldn't save that task. Please try again.");
    },
    [supabase, userId, persistDemo, fail],
  );

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const previous = tasksRef.current;
      const full: TaskPatch & { completed_at?: string | null } = { ...patch };
      if (patch.status) {
        full.completed_at = patch.status === "done" ? new Date().toISOString() : null;
      }
      const next = previous.map((t) => (t.id === id ? { ...t, ...full } : t));
      setTasks(next);
      setError(null);

      if (!supabase) return persistDemo(next);
      const { error: err } = await supabase.from("tasks").update(full).eq("id", id);
      if (err) fail(previous, "Couldn't update that task. Please try again.");
    },
    [supabase, persistDemo, fail],
  );

  const removeTask = useCallback(
    async (id: string) => {
      const previous = tasksRef.current;
      const next = previous.filter((t) => t.id !== id);
      setTasks(next);
      setError(null);

      if (!supabase) return persistDemo(next);
      const { error: err } = await supabase.from("tasks").delete().eq("id", id);
      if (err) fail(previous, "Couldn't delete that task. Please try again.");
    },
    [supabase, persistDemo, fail],
  );

  return { tasks, loading, error, clearError: () => setError(null), addTask, updateTask, removeTask };
}
