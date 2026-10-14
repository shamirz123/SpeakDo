"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.27c0-.8-.07-1.56-.2-2.3H12v4.35h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.11Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.83 13.08A6.6 6.6 0 0 1 5.48 11c0-.72.12-1.42.35-2.08V6.08H2.17a11 11 0 0 0 0 9.84l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15A10.57 10.57 0 0 0 12 1 11 11 0 0 0 2.17 6.08l3.66 2.84C6.7 7.32 9.13 5.38 12 5.38Z" />
    </svg>
  );
}

export function AuthPanel({ authError }: { authError?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    authError ? "Sign-in didn't complete. Please try again." : null,
  );
  const [googleBusy, setGoogleBusy] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-5 text-sm text-muted">
        Sign-in isn&apos;t configured on this server yet. You can still{" "}
        <Link href="/demo" className="font-semibold text-accent underline">
          try the demo
        </Link>
        .
      </div>
    );
  }

  const redirectTo = () => `${window.location.origin}/auth/callback?next=/app`;

  async function google() {
    setGoogleBusy(true);
    setError(null);
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (err) {
      setError("Couldn't start Google sign-in. Please try again.");
      setGoogleBusy(false);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const { error: err } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (err) {
      setError(
        err.status === 429
          ? "Too many emails sent. Please wait a few minutes and try again."
          : "Couldn't send the sign-in link. Check the address and try again.",
      );
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div id="signin" className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <button
        onClick={google}
        disabled={googleBusy}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-surface-2 px-4 py-3 font-medium transition hover:border-accent disabled:opacity-60"
      >
        {googleBusy ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> or use your email <span className="h-px flex-1 bg-border" />
      </div>

      {status === "sent" ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-success/10 p-4 text-sm">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p>
            Check <b>{email}</b> for a sign-in link. You can close this tab.
          </p>
        </div>
      ) : (
        <form onSubmit={magicLink} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            aria-label="Email address"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 py-3 outline-none focus:border-accent"
          />
          <button
            disabled={status === "sending"}
            className="gradient-bg inline-flex items-center gap-2 rounded-full px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {status === "sending" ? <Loader2 className="size-4 animate-spin" /> : "Email me a link"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <Link
        href="/demo"
        className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        Just looking? Try the demo <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
