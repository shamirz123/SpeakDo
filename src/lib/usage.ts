import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase/admin";

/** Stable, non-reversible key for an anonymous visitor (we never store raw IPs). */
export function visitorKey(headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  const ua = headers.get("user-agent") || "";
  const hash = createHash("sha256").update(`${ip}|${ua}`).digest("hex");
  return `ip:${hash.slice(0, 24)}`;
}

/**
 * Counts one AI call against today's cap. Returns false once the cap is hit.
 * If usage tracking itself is unavailable it fails closed in production so a
 * misconfiguration can't turn into an unbounded API bill.
 */
export async function allowAiCall(key: string, limit: number): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("increment_usage", {
      p_key: key,
      p_limit: limit,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[usage] could not check AI usage cap", err);
    return process.env.NODE_ENV !== "production";
  }
}
