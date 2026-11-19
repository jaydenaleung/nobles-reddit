import { createHash } from 'node:crypto';
import {
  contentPath,
  parseContentKey,
  reportContentSchema,
  resolveReportSchema,
  type ReportReason,
} from '@commons/shared';
import { FieldValue, db } from './admin';
import { errors } from './errors';
import { MOD_ROLES, callable } from './guard';
import { notifyWellbeingContact } from './mail';

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/** What a moderator sees in the queue. It never includes who wrote it. */
export function snapshotOf(data: FirebaseFirestore.DocumentData): string {
  const parts = [data.title, data.body, ...(data.poll?.options ?? []).map((o: { label: string }) => o.label)];
  return parts.filter(Boolean).join('\n\n').slice(0, 4000);
}

/** The queue entry for a piece of content. One per content and reason, so repeats do not pile up. */
export function queueRef(contentKey: string, reason: 'reported' | 'ai-flag' | 'wellbeing') {
  return db.doc(`moderationQueue/${reason}-${shortHash(contentKey)}`);
}

export const reportContent = callable(
  { name: 'reportContent', schema: reportContentSchema, rate: 'reports' },
  async (data, caller): Promise<{ received: true }> => {
    const parsed = parseContentKey(data.contentKey);
    if (!parsed) throw errors.invalid('That doesn’t look right.');
    const contentRef = db.doc(contentPath(parsed));
    // One report per person per item: reporting twice updates the first report.
    const reportRef = db.doc(`reports/${shortHash(`${caller.uid}:${data.contentKey}`)}`);
    const reason = data.reason as ReportReason;
    // "I am worried about someone's safety" is treated like a wellbeing flag.
    const urgent = reason === 'safety';
    const queue = queueRef(data.contentKey, urgent ? 'wellbeing' : 'reported');

    const isNewUrgent = await db.runTransaction(async (tx) => {
      const [content, existingQueue] = await Promise.all([tx.get(contentRef), tx.get(queue)]);
      if (!content.exists || content.data()!.status !== 'visible') throw errors.notFound('That');
      tx.set(reportRef, {
        contentKey: data.contentKey,
        postId: parsed.postId,
        reporterUid: caller.uid,
        reason,
        note: data.note ?? '',
        status: 'open',
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        queue,
        {
          contentKey: data.contentKey,
          postId: parsed.postId,
          reason: urgent ? 'wellbeing' : 'reported',
          priority: urgent ? 2 : 1,
          reportReasons: FieldValue.arrayUnion(reason),
          snapshotText: snapshotOf(content.data()!),
          status: 'open',
          createdAt:
            existingQueue.exists && existingQueue.data()!.status === 'open'
              ? existingQueue.data()!.createdAt
              : FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return urgent && !(existingQueue.exists && existingQueue.data()!.status === 'open');
    });

    if (isNewUrgent) await notifyWellbeingContact(parsed.postId);
    return { received: true };
  },
);

/** A moderator marks a report or a queue item as dealt with. */
export const resolveReport = callable(
  { name: 'resolveReport', schema: resolveReportSchema, roles: MOD_ROLES, rate: 'admin' },
  async (data, caller): Promise<{ resolved: true }> => {
    const ref = db.doc(`${data.kind === 'report' ? 'reports' : 'moderationQueue'}/${data.id}`);
    const snap = await ref.get();
    if (!snap.exists) throw errors.notFound('That item');
    const batch = db.batch();
    batch.update(ref, {
      status: 'resolved',
      resolvedBy: caller.uid,
      resolvedAt: FieldValue.serverTimestamp(),
      resolutionNote: data.note ?? '',
    });
    if (data.kind === 'queue') {
      // Resolving a queue item also closes the reports that led to it.
      const reports = await db
        .collection('reports')
        .where('contentKey', '==', snap.data()!.contentKey)
        .where('status', '==', 'open')
        .limit(200)
        .get();
      for (const report of reports.docs) {
        batch.update(report.ref, {
          status: 'resolved',
          resolvedBy: caller.uid,
          resolvedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    await batch.commit();
    return { resolved: true };
  },
);
