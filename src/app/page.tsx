import Link from "next/link";
import { BellRing, CalendarClock, Mic, Pencil, Sparkles } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { Logo } from "@/components/logo";

const FEATURES = [
  {
    icon: Mic,
    title: "Just say it",
    text: "Tap the mic and talk the way you normally would. Typing works too.",
  },
  {
    icon: Sparkles,
    title: "AI does the filing",
    text: "AI pulls out the title, date, time and priority — even from “next Friday afternoon”.",
  },
  {
    icon: BellRing,
    title: "Reminders that find you",
    text: "Get a notification or an email when a task is due, even with the app closed.",
  },
  {
    icon: Pencil,
    title: "Edit by voice",
    text: "“Mark the report done” or “move gym to Saturday” — no menus, no tapping around.",
  },
];

const STACK = ["Next.js 16", "React 19", "Gemini API", "Supabase", "Web Push", "Tailwind"];

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const authError = params.auth_error === "1";

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/demo" className="text-sm font-medium text-muted hover:text-accent">
          Try the demo
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        <section className="grid items-center gap-10 py-10 md:grid-cols-[1.1fr_0.9fr] md:py-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles className="size-3.5" /> Voice-first to-do list
            </p>
            <h1 className="text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
              Say it once.
              <br />
              <span className="gradient-text">It&apos;s on your list.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted">
              Speak a sentence. SpeakDo turns it into a task with a due date and priority — and
              reminds you when it&apos;s time, even if you&apos;ve closed the tab.
            </p>

            <ExampleCard />
          </div>

          <AuthPanel authError={authError} />
        </section>

        <section aria-label="Features" className="grid gap-4 py-10 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border border-border bg-surface p-5">
              <span className="gradient-bg mb-3 grid size-10 place-items-center rounded-2xl text-white">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {STACK.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
            >
              {s}
            </span>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Built as a portfolio project. Tasks are private to your account. The sentence you say
          is sent to Google&apos;s Gemini API to be understood (free tier, which Google may use to
          improve its products), so don&apos;t include anything sensitive.
        </p>
      </footer>
    </div>
  );
}

/** Static illustration of the core idea: a sentence in, a structured task out. */
function ExampleCard() {
  return (
    <div className="mt-8 max-w-md rounded-3xl border border-border bg-surface p-4 shadow-sm" aria-hidden>
      <div className="flex items-center gap-3">
        <span className="gradient-bg grid size-10 shrink-0 place-items-center rounded-full text-white">
          <Mic className="size-5" />
        </span>
        <p className="text-sm italic">“Remind me to submit the report tomorrow at 5pm, it&apos;s urgent”</p>
      </div>
      <div className="mt-3 rounded-2xl border border-border p-3">
        <p className="font-medium">Submit the report</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" /> Tomorrow · 5:00 PM
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger" /> high
          </span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5">work</span>
        </div>
      </div>
    </div>
  );
}
