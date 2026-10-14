export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "done";

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null; // ISO string (UTC)
  priority: Priority;
  category: string | null;
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
}

export type NewTask = {
  title: string;
  notes?: string | null;
  due_at?: string | null;
  priority?: Priority;
  category?: string | null;
};

export type TaskPatch = Partial<
  Pick<Task, "title" | "notes" | "due_at" | "priority" | "category" | "status">
>;

export type ActionType = "create" | "update" | "complete" | "delete";

/** One thing the AI understood from a spoken or typed sentence. */
export interface ParsedAction {
  action: ActionType;
  task_id: string | null;
  title: string | null;
  due_at: string | null;
  priority: Priority | null;
  category: string | null;
  notes: string | null;
}

export interface ParseResponse {
  actions: ParsedAction[];
  clarification: string | null;
}

/** Minimal task shape sent to the AI so it can refer to existing tasks. */
export interface TaskRef {
  id: string;
  title: string;
  due_at: string | null;
  status: TaskStatus;
}
