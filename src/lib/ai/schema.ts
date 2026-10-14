import { z } from "zod";

// Flat on purpose: every field is always present (nullable) so the structured
// output stays simple and the model can't omit anything by accident.
export const ActionSchema = z.object({
  action: z.enum(["create", "update", "complete", "delete"]),
  task_id: z.string().nullable(),
  title: z.string().nullable(),
  due_at: z.string().nullable(),
  priority: z.enum(["low", "medium", "high"]).nullable(),
  category: z.string().nullable(),
  notes: z.string().nullable(),
});

export const ParseResultSchema = z.object({
  actions: z.array(ActionSchema),
  clarification: z.string().nullable(),
});

export const ParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(600),
  timeZone: z.string().max(64).optional(),
  // Demo mode keeps tasks in the browser, so the client supplies them.
  tasks: z
    .array(
      z.object({
        id: z.string().max(64),
        title: z.string().max(300),
        due_at: z.string().nullable(),
        status: z.enum(["todo", "done"]),
      }),
    )
    .max(60)
    .optional(),
});
