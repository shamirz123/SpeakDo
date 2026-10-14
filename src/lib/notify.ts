import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

export interface ReminderPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export type DeliveryStatus = "sent" | "failed" | "skipped";

/** The outcome of trying one channel, with a human-readable reason. */
export interface ChannelResult {
  channel: "push";
  status: DeliveryStatus;
  detail: string;
}

let vapidReady: boolean | null = null;

function initVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) {
    vapidReady = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
  return true;
}

/** Sends a push to every device the user has enabled. Dead subscriptions are removed. */
export async function sendPushToUser(
  userId: string,
  payload: ReminderPayload,
): Promise<ChannelResult> {
  if (!initVapid()) {
    return {
      channel: "push",
      status: "skipped",
      detail: "Push isn't set up on the server (VAPID keys missing).",
    };
  }

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);

  if (!subs?.length) {
    return {
      channel: "push",
      status: "skipped",
      detail: "No device has notifications turned on.",
    };
  }

  let sent = 0;
  const errors: string[] = [];
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser revoked this subscription for good.
        if (status === 404 || status === 410) {
          dead.push(s.id);
          errors.push("a device had turned notifications off (removed)");
        } else {
          errors.push(`push service error ${status ?? "unknown"}`);
        }
      }
    }),
  );

  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);

  if (sent > 0) {
    return {
      channel: "push",
      status: "sent",
      detail: `Sent to ${sent} device${sent > 1 ? "s" : ""}${errors.length ? ` (${errors.length} failed)` : ""}.`,
    };
  }
  return { channel: "push", status: "failed", detail: `Not delivered: ${errors[0]}.` };
}

/** Records every attempt so the app can show what was sent, and why something wasn't. */
export async function logDelivery(
  userId: string,
  taskId: string | null,
  taskTitle: string,
  results: ChannelResult[],
) {
  try {
    await createAdminClient()
      .from("reminder_log")
      .insert(
        results.map((r) => ({
          user_id: userId,
          task_id: taskId,
          task_title: taskTitle.slice(0, 300),
          channel: r.channel,
          status: r.status,
          detail: r.detail,
        })),
      );
  } catch (err) {
    console.error("[notify] could not write delivery log", err);
  }
}
