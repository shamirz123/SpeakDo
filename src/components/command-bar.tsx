"use client";

import { useState } from "react";
import { Loader2, Mic, Send, Square } from "lucide-react";

interface Props {
  onSubmit: (text: string) => void;
  busy: boolean;
  speech: {
    supported: boolean;
    listening: boolean;
    transcript: string;
    error: string | null;
    start: () => void;
    stop: () => void;
  };
}

export function CommandBar({ onSubmit, busy, speech }: Props) {
  const [text, setText] = useState("");
  const { supported, listening, transcript, error, start, stop } = speech;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    onSubmit(value);
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-3 shadow-sm">
      <form onSubmit={submit} className="flex items-center gap-3">
        <div className="relative shrink-0">
          {listening && (
            <span
              aria-hidden
              className="mic-ring gradient-bg absolute inset-0 rounded-full"
            />
          )}
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={!supported || busy}
            aria-label={listening ? "Stop listening" : "Start voice input"}
            title={supported ? undefined : "Voice input isn't supported in this browser"}
            className="gradient-bg relative grid size-14 place-items-center rounded-full text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {listening ? <Square className="size-5 fill-current" /> : <Mic className="size-6" />}
          </button>
        </div>

        <input
          value={listening ? transcript : text}
          onChange={(e) => setText(e.target.value)}
          readOnly={listening}
          disabled={busy}
          maxLength={600}
          placeholder={
            listening
              ? "Listening… speak now"
              : "Say or type: “remind me to call mom tomorrow at 6”"
          }
          aria-label="Describe a task"
          className="min-w-0 flex-1 bg-transparent px-1 py-3 text-base outline-none placeholder:text-muted"
        />

        <button
          type="submit"
          disabled={busy || listening || !text.trim()}
          aria-label="Add"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground transition hover:bg-accent-soft hover:text-accent disabled:opacity-40 disabled:hover:bg-surface-2 disabled:hover:text-foreground"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        </button>
      </form>

      {(error || !supported) && (
        <p role="status" className="px-3 pt-2 pb-1 text-sm text-muted">
          {error ??
            "Voice input works in Chrome, Edge and Safari. You can still type your tasks."}
        </p>
      )}
    </div>
  );
}
