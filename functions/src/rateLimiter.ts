import { RATE_LIMITS, takeToken, type Bucket, type RateLimitAction } from '@commons/shared';
import { db } from './admin';
import { AppError } from './errors';

/**
 * Takes one token from the caller's bucket for this kind of action, or throws.
 * Buckets live in rateLimits/{uid}, which no client can read or write.
 */
export async function consumeRateLimit(uid: string, action: RateLimitAction, nowMs = Date.now()): Promise<void> {
  const ref = db.doc(`rateLimits/${uid}`);
  const config = RATE_LIMITS[action];
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const buckets = (snap.data()?.buckets ?? {}) as Record<string, Bucket>;
    const taken = takeToken(buckets[action], config, nowMs);
    tx.set(ref, { buckets: { [action]: taken.bucket } }, { merge: true });
    return taken;
  });
  if (!result.allowed) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60_000));
    throw new AppError(
      'resource-exhausted',
      `You are doing that a lot. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  }
}
