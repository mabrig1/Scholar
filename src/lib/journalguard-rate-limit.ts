/**
 * Best-effort per-isolate throttling only. Deploy a shared edge/WAF limit for
 * abuse prevention; untrusted forwarded headers must not be relied on as identity.
 */
const buckets = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 60_000;
const MAX_KEYS = 3000;
export function journalGuardRateLimit(request: Request, now = Date.now()): { allowed: boolean; retryAfter: number } {
  if (buckets.size > MAX_KEYS) {
    for (const [key, entry] of buckets) if (entry.expires <= now) buckets.delete(key);
    if (buckets.size > MAX_KEYS) buckets.clear(); // memory bound, never security guarantee
  }
  // Prefer trusted edge injection. Neither this nor x-forwarded-for is sufficient
  // for security decisions without a trusted proxy configuration.
  const peer = request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown";
  const key = peer.trim().slice(0, 128);
  const found = buckets.get(key);
  if (!found || now >= found.expires) {
    buckets.set(key, { count: 1, expires: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  found.count += 1;
  return found.count <= 20
    ? { allowed: true, retryAfter: 0 }
    : { allowed: false, retryAfter: Math.max(1, Math.ceil((found.expires - now) / 1000)) };
}
