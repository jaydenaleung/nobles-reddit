import {
  decideScreening,
  fallbackScreen,
  hotScore,
  commentKey,
  postKey,
  type ScreenFinding,
} from '@commons/shared';
import type { DocumentReference } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue, db } from './admin';
import { ANTHROPIC_API_KEY, AiUnavailable, runAi } from './ai';
import { boardQuestionId, rebuildBoardFeed } from './board';
import { env } from './env';
import { notifyWellbeingContact } from './mail';
import { queueRef, snapshotOf } from './reports';

const triggerOptions = { region: env.region, memory: '256MiB' as const, maxInstances: 10 };

/**
 * Screening. New and edited content waits as `held` + `pending` until this
 * has looked at it.
 *
 *   low risk   -> published
 *   medium     -> stays held, goes to the moderation queue
 *   self-harm or harm to others -> NEVER deleted and never published: stays
 *                held, goes to the top of the queue marked "wellbeing", and
 *                the school's wellbeing contact is emailed
 *
 * If the model is unavailable (budget spent, API down, bad output) content is
 * still published, after a small phrase check for the clearest safety signals.
 * The classifier is a helper. Reports and moderators remain.
 */
async function screen(ref: DocumentReference, contentKey: string, postId: string): Promise<void> {
  const first = await ref.get();
  const data = first.data();
  if (!data || data.screening !== 'pending') return;
  const text = snapshotOf(data);

  let findings: ScreenFinding[];
  let usedModel = true;
  try {
    findings = (await runAi((provider) => provider.classify(text))).output.labels;
  } catch (error) {
    if (!(error instanceof AiUnavailable)) throw error;
    usedModel = false;
    findings = fallbackScreen(text);
  }
  const decision = decideScreening(findings);

  const raisedWellbeing = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data();
    // Someone may have edited, removed or moderated it while the model was thinking.
    if (!current || current.screening !== 'pending') return false;
    if (snapshotOf(current) !== text) return false;
    if (current.status === 'removed') {
      tx.update(ref, { screening: 'clear' });
      return false;
    }
    if (decision.outcome === 'publish') {
      tx.update(ref, { status: 'visible', screening: usedModel ? 'clear' : 'skipped' });
      return false;
    }
    const wellbeing = decision.outcome === 'wellbeing';
    tx.update(ref, { status: 'held', screening: wellbeing ? 'wellbeing' : 'flagged' });
    tx.set(queueRef(contentKey, wellbeing ? 'wellbeing' : 'ai-flag'), {
      contentKey,
      postId,
      reason: wellbeing ? 'wellbeing' : 'ai-flag',
      priority: wellbeing ? 2 : 1,
      score: decision.score,
      labels: decision.labels,
      snapshotText: text,
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
    });
    return wellbeing;
  });

  if (raisedWellbeing) await notifyWellbeingContact(postId);
}

export const screenContent = onDocumentWritten(
  { ...triggerOptions, document: 'posts/{postId}', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists || after.data()?.screening !== 'pending') return;
    await screen(after.ref, postKey(event.params.postId), event.params.postId);
  },
);

export const screenComment = onDocumentWritten(
  {
    ...triggerOptions,
    document: 'posts/{postId}/comments/{commentId}',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 60,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists || after.data()?.screening !== 'pending') return;
    await screen(after.ref, commentKey(event.params.postId, event.params.commentId), event.params.postId);
  },
);

/* ---------- Feed counters. Recounted from the source each time, so they heal themselves. ---------- */

async function refreshBoardIfQuestion(postId: string): Promise<void> {
  if ((await boardQuestionId()) === postId) await rebuildBoardFeed();
}

/** Keeps commentCount, anonCommentCount and hotScore right when a comment appears, disappears or changes status. */
export const onCommentWritten = onDocumentWritten(
  { ...triggerOptions, document: 'posts/{postId}/comments/{commentId}' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const statusChanged = before?.status !== after?.status;
    const boardChanged = !!before?.boardApproved !== !!after?.boardApproved;
    const bodyChanged = before?.body !== after?.body;
    if (!statusChanged && !boardChanged && !(bodyChanged && after?.boardApproved)) return;

    const postRef = db.doc(`posts/${event.params.postId}`);
    if (statusChanged) {
      const visible = postRef.collection('comments').where('status', '==', 'visible');
      const [total, anonymous, post] = await Promise.all([
        visible.count().get(),
        visible.where('authorDisplay.mode', '==', 'anonymous').count().get(),
        postRef.get(),
      ]);
      const p = post.data();
      if (p) {
        const commentCount = total.data().count;
        await postRef.update({
          commentCount,
          anonCommentCount: anonymous.data().count,
          hotScore: hotScore(p.thoughtfulCount ?? 0, commentCount, p.createdAt?.seconds ?? 0),
        });
      }
    }
    await refreshBoardIfQuestion(event.params.postId);
  },
);

/** Keeps a thread's thoughtfulCount and hotScore right. */
export const onPostVoteWritten = onDocumentWritten(
  { ...triggerOptions, document: 'votes/{postId}/by/{uid}' },
  async (event) => {
    const postRef = db.doc(`posts/${event.params.postId}`);
    const [count, post] = await Promise.all([
      db.collection(`votes/${event.params.postId}/by`).count().get(),
      postRef.get(),
    ]);
    const p = post.data();
    if (!p) return;
    const thoughtfulCount = count.data().count;
    await postRef.update({
      thoughtfulCount,
      hotScore: hotScore(thoughtfulCount, p.commentCount ?? 0, p.createdAt?.seconds ?? 0),
    });
  },
);

/** Keeps a comment's thoughtfulCount right. */
export const onCommentVoteWritten = onDocumentWritten(
  { ...triggerOptions, document: 'votes/{postId}/comments/{commentId}/by/{uid}' },
  async (event) => {
    const { postId, commentId } = event.params;
    const commentRef = db.doc(`posts/${postId}/comments/${commentId}`);
    const [count, comment] = await Promise.all([
      db.collection(`votes/${postId}/comments/${commentId}/by`).count().get(),
      commentRef.get(),
    ]);
    if (!comment.exists) return;
    await commentRef.update({ thoughtfulCount: count.data().count });
  },
);

/** Keeps each space's thread count right, and the hall screen in step with its question. */
export const onPostWritten = onDocumentWritten({ ...triggerOptions, document: 'posts/{postId}' }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const spaceIds = new Set<string>();
  if (before?.status !== after?.status || before?.spaceId !== after?.spaceId) {
    if (before?.spaceId) spaceIds.add(before.spaceId);
    if (after?.spaceId) spaceIds.add(after.spaceId);
  }
  for (const spaceId of spaceIds) {
    const count = await db
      .collection('posts')
      .where('spaceId', '==', spaceId)
      .where('status', '==', 'visible')
      .count()
      .get();
    try {
      await db.doc(`spaces/${spaceId}`).update({ postCount: count.data().count });
    } catch {
      logger.warn('A thread points at a space that does not exist');
    }
  }
  await refreshBoardIfQuestion(event.params.postId);
});

/** `refreshBoardFeed`: rebuilds the hall screen whenever its question changes. */
export const refreshBoardFeed = onDocumentWritten({ ...triggerOptions, document: 'config/board' }, async () => {
  await rebuildBoardFeed();
});
