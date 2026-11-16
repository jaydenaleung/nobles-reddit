export interface Bucket {
  tokens: number;
  updatedAtMs: number;
}
export interface BucketConfig {
  capacity: number;
  perHour: number;
}
export interface TakeResult {
  allowed: boolean;
  bucket: Bucket;
  /** Milliseconds until one token is available again. Zero when allowed. */
  retryAfterMs: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * A token bucket. It starts full, refills steadily and never holds more than
 * its capacity. Pure, so it can be unit-tested; the functions wrap it in a
 * Firestore transaction.
 */
export function takeToken(previous: Bucket | undefined, config: BucketConfig, nowMs: number): TakeResult {
  const start: Bucket = previous ?? { tokens: config.capacity, updatedAtMs: nowMs };
  const elapsed = Math.max(0, nowMs - start.updatedAtMs);
  const refilled = Math.min(config.capacity, start.tokens + (elapsed / HOUR_MS) * config.perHour);
  if (refilled >= 1) {
    return { allowed: true, bucket: { tokens: refilled - 1, updatedAtMs: nowMs }, retryAfterMs: 0 };
  }
  const retryAfterMs = Math.ceil(((1 - refilled) / config.perHour) * HOUR_MS);
  return { allowed: false, bucket: { tokens: refilled, updatedAtMs: nowMs }, retryAfterMs };
}
