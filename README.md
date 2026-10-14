# SpeakDo

A voice-first task manager. Say *"remind me to submit the report tomorrow at 5pm, it's urgent"* and SpeakDo files it as a task with a due time and priority. When it's due, you get a push notification, even if the app is closed.

## What it does

- **Voice or text input.** Tap the mic (Web Speech API) or type.
- **AI parsing.** A free LLM (Google Gemini) turns one sentence into structured tasks: title, due date and time, priority, category. It understands relative dates ("next Friday", "in 2 hours") in your timezone and splits several tasks out of one sentence.
- **Edit by voice.** "Mark the report done", "move gym to Saturday", "delete the milk task".
- **You stay in control.** Nothing is saved until you confirm a preview of what the AI understood; every field is editable.
- **Reminders when the app is closed.** Web Push notifications (no install on desktop and Android), plus a calendar button that gives any task an alarm in the phone's own calendar.
- **Delivery log and test tools.** See every reminder attempt and why it did or didn't go out, send test notifications, and run a 1-minute end-to-end test.
- **Accounts and sync.** Google or email magic-link sign-in, tasks synced live across devices, per-user data isolation with Row Level Security.
- **Demo mode.** `/demo` works without signing in (tasks stay in the browser).

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · Tailwind CSS 4 · Supabase (Auth, Postgres, Realtime) · Gemini API (free tier, OpenAI-compatible endpoint, structured outputs via Zod) · Web Push (VAPID).

## How reminders work

```
Supabase pg_cron (every minute)
        │  POST /api/cron/reminders  (Bearer CRON_SECRET)
        ▼
find tasks: todo, due now, not yet reminded
        │  claim them atomically (sets reminder_sent_at)
        ▼
for each task → Web Push to the user's devices → write a row to reminder_log
```

Claiming rows before sending means two overlapping runs can never send the same reminder twice. Tasks that became due more than two hours ago are skipped, so enabling reminders never sends a flood of stale ones. Changing a task's due time re-arms its reminder (database trigger).

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. **Project Settings → API**: copy the URL, anon key and service-role key into `.env.local`.
4. **Authentication → Providers → Google**: enable it (create OAuth credentials in Google Cloud Console; the redirect URL is shown in Supabase).
5. **Authentication → URL Configuration**: set the Site URL to your site, and add `http://localhost:3000/**` and your production URL to Redirect URLs.

### 3. AI (free)

Create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no credit card) and put it in `AI_API_KEY`. The default model is `gemini-3.5-flash-lite`; change it with `AI_MODEL`. Google retires older Gemini models for new accounts fairly often, so if you ever see a "model is no longer available" error in the server log, pick a current free model from [the pricing page](https://ai.google.dev/gemini-api/docs/pricing).

Any OpenAI-compatible endpoint works: set `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY` to use Groq, OpenRouter, a paid provider, and so on.

Two things to know about the free tier: it has per-minute and per-day request limits (shown in AI Studio), and Google may use free-tier prompts to improve its products, so don't send sensitive text. Usage is also capped per day on our side (`AI_DAILY_LIMIT_USER`, `AI_DAILY_LIMIT_DEMO`) to stay inside those limits.

### 4. Push notifications

```bash
npx web-push generate-vapid-keys
```

Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`.

> **iPhone/iPad:** Apple only delivers web push to sites added to the Home Screen (Share → Add to Home Screen). Desktop and Android need nothing but a click on "Allow".

### 5. The reminder scheduler

Generate a long random `CRON_SECRET`, then in Supabase enable the **pg_cron** and **pg_net** extensions (Database → Extensions) and run the commented `cron.schedule(...)` block at the bottom of `schema.sql` with your deployed URL and secret.

Prefer not to use pg_cron? Any external pinger (for example [cron-job.org](https://cron-job.org)) can call `POST https://YOUR-APP/api/cron/reminders` every minute with the header `Authorization: Bearer <CRON_SECRET>`. Vercel's free-tier cron only runs daily, which is too coarse for reminders.

**Locally**, nothing calls that endpoint, so run the stand-in script in a second terminal:

```bash
npm run cron:local
```

### 6. Run

```bash
npm run dev
```

## Testing that reminders really arrive

Open **Reminders** in the app (signed in) and use **Check that it works**:

- **Send a test notification** pushes to your devices right now and tells you exactly what happened.
- **Run reminder check now** runs the same code as the scheduler for your account.
- **Test in 1 minute** creates a task due in about a minute. Close the tab, keep `npm run dev` and `npm run cron:local` running, and the notification should arrive on its own.
- **Recent deliveries** lists every attempt with a reason ("Sent to 1 device", "No device has notifications turned on", ...). If the list stays empty after a task's due time, the scheduler isn't running.

Reminders can only go out while the server and scheduler are running, so closing your laptop stops local testing. In production, Vercel plus the scheduler run without any of your devices.

## Calendar alarms

Every task with a due time has a calendar icon. It adds the task to the phone's or computer's own calendar (`.ics` file with an alarm 10 minutes before and at the due time, or a Google Calendar link). The device rings the alarm itself, so it works with no server, no internet and no SpeakDo tab open. The Google link uses your calendar's default reminder rather than our alarms.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add every variable from `.env.example` (set `NEXT_PUBLIC_SITE_URL` to your production URL).
3. Deploy, then set up the scheduler (step 5) with the production URL.
4. Add the production URL to Supabase's Redirect URLs and to your Google OAuth client.

## Project layout

```
src/
  app/
    page.tsx                  landing + sign-in
    app/page.tsx              signed-in dashboard (server-checked)
    demo/page.tsx             no-login demo
    api/parse                 sentence → structured actions (LLM)
    api/cron/reminders        sends due reminders
    api/reminders/test        "send me a test reminder"
    auth/callback|signout     Supabase auth routes
  components/                 command bar, preview panel, task list, settings
  hooks/                      use-speech, use-tasks (cloud + demo), use-push
  lib/
    ai/                       prompt, schema, validation of model output
    notify.ts                 Web Push sender + delivery log
    reminders.ts              finds and sends due reminders (cron + "check now")
    ics.ts                    calendar (.ics) alarm builder
    supabase/                 browser / server / admin clients
  proxy.ts                    session refresh + route guards
public/sw.js                  service worker that shows push notifications
supabase/schema.sql           tables, RLS policies, triggers, usage cap
```

## Design decisions worth knowing

- **Model output is never trusted.** Every action from the LLM is validated server-side: unknown task IDs are dropped, dates are normalised to UTC, lengths are capped.
- **Current time comes from the server**, not the client, so "tomorrow" can't be skewed by a wrong device clock.
- **The service-role key never reaches the browser.** It's used only by the reminder job and the usage cap.
- **Cost protection.** Daily per-user and per-visitor caps are enforced atomically in Postgres, and fail closed in production.
