import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logDelivery, sendPushToUser } from "@/lib/notify";
import { allowAiCall } from "@/lib/usage";

/** Sends a sample push to the signed-in user's devices so they can check their setup. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Re-use the usage table as a simple throttle: 20 test sends a day.
  if (!(await allowAiCall(`test:${user.id}`, 20))) {
    return NextResponse.json({ error: "Too many test reminders today." }, { status: 429 });
  }

  const result = await sendPushToUser(user.id, {
    title: "SpeakDo test reminder",
    body: "Notifications are working. You'll get one like this when a task is due.",
    tag: "speakdo-test",
    url: "/app",
  });
  await logDelivery(user.id, null, "Test notification", [result]);

  return NextResponse.json({ result });
}
