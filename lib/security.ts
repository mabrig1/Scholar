import { NextResponse } from "next/server";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export const LEGAL_VERSION = "2026-09-30";

export function safeFileName(value: string, max = 180) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "_")
    .replace(/^\.+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || "upload";
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Best-effort per-instance rate limiting. It reduces accidental abuse and burst
 * traffic, but must not be treated as a substitute for platform/WAF rate limits.
 */
export function rateLimit(request: Request, namespace: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const key = `${namespace}:${clientIp(request)}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  );
}

export function contentLengthTooLarge(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const size = Number(raw);
  return Number.isFinite(size) && size > maxBytes;
}

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
