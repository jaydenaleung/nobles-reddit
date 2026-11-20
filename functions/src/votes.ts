import {
  contentPath,
  parseContentKey,
  toggleThoughtfulSchema,
  votePollSchema,
  type PollOption,
} from '@commons/shared';
import { FieldValue, Timestamp, db } from './admin';
import { AppError, errors } from './errors';
import { callable } from './guard';

/**
 * One upvote per person per item. There are no downvotes, and a count
 * can never go below zero. Calling it again takes the mark back.
 */
export const toggleThoughtful = callable(
  { name: 'toggleThoughtful', schema: toggleThoughtfulSchema, rate: 'votes' },
  async (data, caller): Promise<{ thoughtful: boolean }> => {
    const parsed = parseContentKey(data.contentKey);
    if (!parsed) throw errors.invalid('That doesn’t look right.');
    const contentRef = db.doc(contentPath(parsed));
    const voteRef =
      parsed.kind === 'post'
        ? db.doc(`votes/${parsed.postId}/by/${caller.uid}`)
        : db.doc(`votes/${parsed.postId}/comments/${parsed.commentId}/by/${caller.uid}`);

    return db.runTransaction(async (tx) => {
      const [content, vote] = await Promise.all([tx.get(contentRef), tx.get(voteRef)]);
      if (!content.exists || content.data()!.status !== 'visible') throw errors.notFound('That');
      const current = Math.max(0, (content.data()!.thoughtfulCount as number) ?? 0);
      if (vote.exists) {
        tx.delete(voteRef);
        tx.update(contentRef, { thoughtfulCount: Math.max(0, current - 1) });
        return { thoughtful: false };
      }
      tx.create(voteRef, {
        uid: caller.uid,
        postId: parsed.postId,
        commentId: parsed.commentId ?? null,
        kind: parsed.kind,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(contentRef, { thoughtfulCount: current + 1 });
      return { thoughtful: true };
    });
  },
);

/** One vote per person per poll. Choosing another option moves the vote. */
export const votePoll = callable(
  { name: 'votePoll', schema: votePollSchema, rate: 'votes' },
  async (data, caller): Promise<{ optionId: string }> => {
    const postRef = db.doc(`posts/${data.postId}`);
    const voteRef = db.doc(`pollVotes/${data.postId}/by/${caller.uid}`);

    return db.runTransaction(async (tx) => {
      const [post, vote] = await Promise.all([tx.get(postRef), tx.get(voteRef)]);
      const p = post.data();
      if (!post.exists || !p || p.status !== 'visible' || p.kind !== 'poll' || !p.poll) {
        throw errors.notFound('That poll');
      }
      const closesAt = p.poll.closesAt as Timestamp | undefined;
      if (closesAt && closesAt.toMillis() < Date.now()) {
        throw new AppError('failed-precondition', 'This poll has closed.');
      }
      const options = (p.poll.options as PollOption[]).map((o) => ({ ...o }));
      const chosen = options.find((o) => o.id === data.optionId);
      if (!chosen) throw errors.invalid('That is not one of the options.');

      const previous = vote.exists ? (vote.data()!.optionId as string) : null;
      if (previous === data.optionId) return { optionId: data.optionId };
      if (previous) {
        const old = options.find((o) => o.id === previous);
        if (old) old.count = Math.max(0, old.count - 1);
      }
      chosen.count += 1;

      tx.update(postRef, { 'poll.options': options });
      tx.set(voteRef, {
        uid: caller.uid,
        postId: data.postId,
        commentId: null,
        kind: 'poll',
        optionId: data.optionId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { optionId: data.optionId };
    });
  },
);
