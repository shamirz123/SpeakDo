// Stand-in for the production scheduler while developing locally.
//
// In production a scheduler (Supabase pg_cron or an external pinger) calls
// /api/cron/reminders every minute. Locally nothing does that, so reminders
// would never fire once you close the browser tab. Run this in a second
// terminal alongside `npm run dev`:
//
//   npm run cron:local
//
// Then add a task due in a minute, close the tab, and wait for the notification.

import { readFileSync } from "node:fs";

function loadEnvLocal() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  } catch {
    // no .env.local; fall back to the process environment
  }
  return env;
}

const env = loadEnvLocal();
const secret = process.env.CRON_SECRET || env.CRON_SECRET;
const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const everySeconds = Number(process.env.CRON_EVERY_SECONDS) || 30;

if (!secret) {
  console.error("CRON_SECRET is missing. Add it to .env.local first.");
  process.exit(1);
}

const clock = () => new Date().toLocaleTimeString();

async function tick() {
  try {
    const res = await fetch(`${base}/api/cron/reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(`[${clock()}] server answered ${res.status}: ${body.error ?? "error"}`);
    } else if (body.claimed > 0) {
      console.log(`[${clock()}] REMINDERS: ${body.claimed} task(s) were due, ${body.sent} delivered`);
    } else {
      console.log(`[${clock()}] checked, nothing due`);
    }
  } catch {
    console.log(`[${clock()}] can't reach ${base} (is "npm run dev" running?)`);
  }
}

console.log(`Checking ${base} for due reminders every ${everySeconds}s. Press Ctrl+C to stop.`);
tick();
setInterval(tick, everySeconds * 1000);
