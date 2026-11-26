import "server-only";

// Best-effort process-local throttle. On serverless deployments each instance
// has an independent bucket; use an edge/WAF or shared store for global limits.
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_KEY = 10;

export function allowMobileRedeem(ip: string, code: string) {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  // Bound memory if an attacker cycles through many distinct codes/IPs.
  if (buckets.size > 20_000) buckets.clear();
  const keys = [`ip:${ip}`, `code:${code}`];
  if (keys.some((key) => (buckets.get(key)?.count ?? 0) >= MAX_PER_KEY)) return false;
  for (const key of keys) {
    const old = buckets.get(key);
    buckets.set(key, { count: (old?.count ?? 0) + 1, resetAt: old?.resetAt ?? now + WINDOW_MS });
  }
  return true;
}
