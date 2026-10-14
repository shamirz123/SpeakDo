import OpenAI from "openai";
import { NextResponse } from "next/server";
import { aiConfigured, parseTaskSentence } from "@/lib/ai/parse-task";
import { ParseRequestSchema } from "@/lib/ai/schema";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/browser";
import { allowAiCall, visitorKey } from "@/lib/usage";
import type { TaskRef } from "@/lib/types";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function POST(request: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "The AI service isn't configured on this server yet." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = ParseRequestSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json(
      { error: "Please say or type something (up to 600 characters)." },
      { status: 400 },
    );
  }

  // Who is asking? Signed-in users get a larger daily allowance than demo visitors.
  let userId: string | null = null;
  let savedTasks: TaskRef[] = [];
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (user) savedTasks = await loadTasks(supabase, user.id);
  }

  const limit = userId
    ? num(process.env.AI_DAILY_LIMIT_USER, 100)
    : num(process.env.AI_DAILY_LIMIT_DEMO, 8);
  const key = userId ? `u:${userId}` : visitorKey(request.headers);

  if (!(await allowAiCall(key, limit))) {
    return NextResponse.json(
      {
        error: userId
          ? "You've reached today's AI limit. It resets at midnight UTC."
          : "Demo limit reached for today. Sign in for a much higher limit.",
      },
      { status: 429 },
    );
  }

  try {
    const result = await parseTaskSentence(
      input.data.text,
      userId ? savedTasks : (input.data.tasks ?? []),
      input.data.timeZone,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[parse] failed", err);
    // Free tiers have per-minute limits; tell the user to wait rather than blaming them.
    const rateLimited = err instanceof OpenAI.APIError && err.status === 429;
    return NextResponse.json(
      {
        error: rateLimited
          ? "The free AI service is at its limit for a moment. Wait a minute and try again."
          : "The AI is busy right now. Please try again in a moment.",
      },
      { status: rateLimited ? 429 : 502 },
    );
  }
}

async function loadTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<TaskRef[]> {
  const { data } = await supabase
    .from("tasks")
    .select("id,title,due_at,status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as TaskRef[];
}
