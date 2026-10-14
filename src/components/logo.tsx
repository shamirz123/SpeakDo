import Link from "next/link";
import { Mic } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="gradient-bg grid size-8 place-items-center rounded-xl text-white shadow-sm">
        <Mic className="size-4" strokeWidth={2.5} aria-hidden />
      </span>
      <span className="text-lg">
        Speak<span className="gradient-text">Do</span>
      </span>
    </Link>
  );
}
