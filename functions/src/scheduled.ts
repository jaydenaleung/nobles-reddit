import { commentKey, hotScore, postKey } from '@commons/shared';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp, db } from './admin';
import { env } from './env';

/**
 * Every 10 minutes: recompute the hot score of recent threads from their
 * counts. The triggers already keep it right; this heals anything they missed.
 */
export async function refreshRecentHotScores(days = 14): Promise<number> {
  const since = Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection('posts')
    .where('status', '==', 'visible')
    .where('createdAt', '>=', since)
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();
  let changed = 0;
  let batch = db.batch();
  for (const doc of snap.docs) {
    const p = doc.data();
    const next = hotScore(p.thoughtfulCount ?? 0, p.commentCount ?? 0, p.createdAt?.seconds ?? 0);
    if (next !== p.hotScore) {
      batch.update(doc.ref, { hotScore: next });
      changed += 1;
      if (changed % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }
  if (changed % 400 !== 0) await batch.commit();
  return changed;
}

export const refreshHotScores = onSchedule(
  { schedule: 'every 10 minutes', region: env.region, timeoutSeconds: 120 },
  async () => {
    const changed = await refreshRecentHotScores();
    if (changed > 0) logger.info('Hot scores refreshed', { changed });
  },
);

/**
 * Data retention. Content that was removed more than RETENTION_MONTHS ago
 * (default 24) is moved out of the live collections into `archive`, which no
 * client can read. The authorship record is kept, as school policy requires.
 */
export async function archiveRemovedContent(now = Date.now()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - env.retentionMonths);
  const before = Timestamp.fromDate(cutoff);
  const [posts, comments] = await Promise.all([
    db.collection('posts').where('status', '==', 'removed').where('removedAt', '<', before).limit(200).get(),
    db
      .collectionGroup('comments')
      .where('status', '==', 'removed')
      .where('removedAt', '<', before)
      .limit(200)
      .get(),
  ]);
  let archived = 0;
  for (const doc of [...posts.docs, ...comments.docs]) {
    const isPost = doc.ref.parent.id === 'posts';
    const key = isPost ? postKey(doc.id) : commentKey(doc.ref.parent.parent!.id, doc.id);
    const batch = db.batch();
    batch.set(db.doc(`archive/${key}`), { ...doc.data(), archivedAt: FieldValue.serverTimestamp() });
    batch.delete(doc.ref);
    await batch.commit();
    archived += 1;
  }
  return archived;
}

export const archiveOldContent = onSchedule(
  { schedule: '30 3 * * *', timeZone: 'America/New_York', region: env.region, timeoutSeconds: 300 },
  async () => {
    const archived = await archiveRemovedContent();
    if (archived > 0) logger.info('Old removed content archived', { archived });
  },
);
