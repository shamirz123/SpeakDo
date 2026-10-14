import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDueReminders } from "@/lib/reminders";
import { allowAiCall } from "@/lib/usage";

/**
 * "Run the reminder check now" for the signed-in user. It runs the exact same
 * code as the scheduled job, so it proves the pipeline works without waiting
 * for (or even having) a scheduler.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!(await allowAiCall(`run:${user.id}`, 60))) {
    return NextResponse.json({ error: "Too many checks today." }, { status: 429 });
  }

  try {
    const result = await processDueReminders({ userId: user.id });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[run] failed", err);
    return NextResponse.json({ error: "The check failed. See the server log." }, { status: 500 });
  }
}
