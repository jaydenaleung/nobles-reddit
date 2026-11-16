import { LIMITS, requestSummarySchema, type SummaryResult, type ThreadSummary } from '@commons/shared';
import { FieldValue, db } from './admin';
import { ANTHROPIC_API_KEY, AiUnavailable, runAi } from './ai';
import type { ThreadForSummary } from './ai/provider';
import { errors } from './errors';
import { callable } from './guard';

function toResult(summary: ThreadSummary | (Omit<ThreadSummary, 'generatedAt'> & { generatedAtMs: number })): SummaryResult {
  const generatedAtMs = 'generatedAtMs' in summary ? summary.generatedAtMs : (summary.generatedAt?.toMillis?.() ?? Date.now());
  return {
    available: true,
    summary: {
      text: summary.text,
      bullets: summary.bullets,
      agreements: summary.agreements,
      disagreements: summary.disagreements,
      commentCountAtGeneration: summary.commentCountAtGeneration,
      model: summary.model,
      generatedAtMs,
    },
  };
}

/**
 * The auto-summary of a thread.
 *
 * Only for threads with at least 10 comments, and cached per bucket of 10:
 * a thread is summarised again at 20, 30, 40 comments, not on every view.
 *
 * What the model is sent: the post and up to 60 comments, as text only.
 * No names, no anonymous labels, no roles, no ids. It cannot reveal an author
 * because it is never told one.
 */
export const requestSummary = callable(
  {
    name: 'requestSummary',
    schema: requestSummarySchema,
    rate: 'summaries',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 60,
  },
  async (data): Promise<SummaryResult> => {
    const postRef = db.doc(`posts/${data.postId}`);
    const postSnap = await postRef.get();
    const post = postSnap.data();
    if (!post || post.status !== 'visible') throw errors.notFound('That thread');

    const commentCount = (post.commentCount as number) ?? 0;
    if (commentCount < LIMITS.summaryMinComments) return { available: false, reason: 'too-few-comments' };
    const bucket = Math.floor(commentCount / LIMITS.summaryBucket) * LIMITS.summaryBucket;
    const cached = post.summary as ThreadSummary | undefined;
    if (cached && cached.commentCountAtGeneration === bucket) return toResult(cached);

    const comments = await postRef
      .collection('comments')
      .where('status', '==', 'visible')
      .orderBy('createdAt', 'asc')
      .limit(LIMITS.summaryMaxComments)
      .get();
    // Comments are numbered by position. The numbers stand in for ids, which the model never sees.
    const position = new Map(comments.docs.map((d, i) => [d.id, i + 1]));
    const thread: ThreadForSummary = {
      title: String(post.title ?? ''),
      body: String(post.body ?? ''),
      comments: comments.docs.map((d, i) => ({
        n: i + 1,
        replyTo: d.data().parentId ? (position.get(d.data().parentId) ?? null) : null,
        text: String(d.data().body ?? ''),
      })),
    };

    try {
      const result = await runAi((provider) => provider.summarize(thread));
      const summary = {
        ...result.output,
        commentCountAtGeneration: bucket,
        model: result.model,
      };
      await postRef.update({ summary: { ...summary, generatedAt: FieldValue.serverTimestamp() } });
      return toResult({ ...summary, generatedAtMs: Date.now() });
    } catch (error) {
      if (!(error instanceof AiUnavailable)) throw error;
      // An older summary is better than none; otherwise say plainly that it is unavailable.
      if (cached) return toResult(cached);
      return { available: false, reason: error.reason === 'budget' ? 'unavailable-today' : 'unavailable' };
    }
  },
);
