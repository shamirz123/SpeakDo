import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processDueReminders } from "@/lib/reminders";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDueReminders();
    return NextResponse.json({
      due: result.due,
      claimed: result.claimed,
      sent: result.delivered.filter((d) => d.results.some((r) => r.status === "sent")).length,
    });
  } catch (err) {
    console.error("[cron] failed", err);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
