import { HOT_EPOCH_SECONDS, HOT_TIME_DIVISOR } from './constants';

/**
 * Upvotes count fully, comments count half.
 * There are no downvotes, so a score can never go below zero.
 */
export function engagementScore(thoughtfulCount: number, commentCount: number): number {
  return Math.max(0, thoughtfulCount) + 0.5 * Math.max(0, commentCount);
}

/**
 * The hot rank used to order the feed.
 *
 *   score = thoughtfulCount + 0.5 * commentCount
 *   hot   = log10(max(score, 1)) + (createdAtSeconds - 1767225600) / 45000
 *
 * A post needs ten times the engagement to beat one that is 12.5 hours newer.
 * Pinned posts are sorted first by the query, not by this number.
 */
export function hotScore(thoughtfulCount: number, commentCount: number, createdAtSeconds: number): number {
  const score = engagementScore(thoughtfulCount, commentCount);
  const order = Math.log10(Math.max(score, 1));
  const age = (createdAtSeconds - HOT_EPOCH_SECONDS) / HOT_TIME_DIVISOR;
  // Seven decimal places keep the stored number stable across runtimes.
  return Math.round((order + age) * 1e7) / 1e7;
}

export interface Rankable {
  pinned: boolean;
  hotScore: number;
}

/** Pinned first, then by hot score. Used for client-side re-sorting and in tests. */
export function compareHot(a: Rankable, b: Rankable): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.hotScore - a.hotScore;
}
