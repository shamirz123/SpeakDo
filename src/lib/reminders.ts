import { createAdminClient } from "./supabase/admin";
import { logDelivery, sendPushToUser, type ChannelResult } from "./notify";

// Tasks that became due more than this long ago are skipped, so turning
// reminders on never fires a flood of stale notifications.
const MAX_LATE_MS = 2 * 60 * 60 * 1000;

export interface DeliveredTask {
  taskId: string;
  title: string;
  results: ChannelResult[];
}

export interface ReminderRun {
  due: number;
  claimed: number;
  delivered: DeliveredTask[];
}

/**
 * Finds tasks that are due and not yet reminded, and sends the reminders.
 * Used by the scheduled job (all users) and by "Run check now" (one user).
 */
export async function processDueReminders(
  opts: { userId?: string } = {},
): Promise<ReminderRun> {
  const admin = createAdminClient();
  const now = new Date();
  const since = new Date(now.getTime() - MAX_LATE_MS);

  let query = admin
    .from("tasks")
    .select("id")
    .eq("status", "todo")
    .is("reminder_sent_at", null)
    .lte("due_at", now.toISOString())
    .gte("due_at", since.toISOString())
    .limit(200);
  if (opts.userId) query = query.eq("user_id", opts.userId);

  const { data: due, error } = await query;
  if (error) throw error;
  if (!due?.length) return { due: 0, claimed: 0, delivered: [] };

  // Claim the tasks first (only rows nobody else has claimed), so two
  // overlapping runs can never send the same reminder twice.
  const { data: claimed, error: claimError } = await admin
    .from("tasks")
    .update({ reminder_sent_at: now.toISOString() })
    .in(
      "id",
      due.map((t) => t.id),
    )
    .is("reminder_sent_at", null)
    .eq("status", "todo")
    .select("id,user_id,title,priority");
  if (claimError) throw claimError;

  const delivered: DeliveredTask[] = [];
  for (const task of claimed ?? []) {
    const push = await sendPushToUser(task.user_id, {
      title: task.title,
      body: task.priority === "high" ? "High priority · due now" : "Due now",
      tag: task.id,
      url: "/app",
    });
    await logDelivery(task.user_id, task.id, task.title, [push]);
    delivered.push({ taskId: task.id, title: task.title, results: [push] });
  }

  return { due: due.length, claimed: claimed?.length ?? 0, delivered };
}
