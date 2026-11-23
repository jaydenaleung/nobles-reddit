import { FORMER_MEMBER_LABEL, LIMITS, excerpt, type BoardReply, type PollOption } from '@commons/shared';
import { FieldValue, db } from './admin';
import { noblemanSource } from './sources/nobleman';

/** Which thread is the question on the hall screen right now, if any. */
export async function boardQuestionId(): Promise<string | null> {
  const snap = await db.doc('config/board').get();
  return (snap.data()?.questionPostId as string | null | undefined) ?? null;
}

/**
 * Rebuilds boardFeed/current, the one public document behind /board.
 *
 * It is a sanitised snapshot: the question, the poll counts, and only the
 * replies a moderator approved for the screen. It contains no uid and no
 * authorship. Each reply shows its author's name.
 */
export async function rebuildBoardFeed(): Promise<void> {
  const questionPostId = await boardQuestionId();
  const nobleman = await noblemanSource().fetchLatest(3);
  const target = db.doc('boardFeed/current');

  const empty = {
    questionPostId: null,
    questionText: '',
    spaceName: '',
    pollOptions: [] as PollOption[],
    counts: { weighedIn: 0, replies: 0 },
    approvedReplies: [] as BoardReply[],
    nobleman,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!questionPostId) {
    await target.set(empty);
    return;
  }

  const postRef = db.doc(`posts/${questionPostId}`);
  const [postSnap, repliesSnap] = await Promise.all([
    postRef.get(),
    postRef
      .collection('comments')
      .where('boardApproved', '==', true)
      .where('status', '==', 'visible')
      .orderBy('createdAt', 'desc')
      .limit(LIMITS.boardReplies)
      .get(),
  ]);
  const post = postSnap.data();
  if (!post || post.status !== 'visible') {
    await target.set(empty);
    return;
  }

  const pollOptions: PollOption[] = (post.poll?.options ?? []).map((o: PollOption) => ({
    id: o.id,
    label: o.label,
    count: o.count,
  }));
  const pollVotes = pollOptions.reduce((sum, o) => sum + o.count, 0);
  const replies = (post.commentCount as number) ?? 0;

  const approvedReplies: BoardReply[] = repliesSnap.docs.map((d) => {
    const c = d.data();
    const reply: BoardReply = {
      displayName: String(c.authorDisplay?.name ?? FORMER_MEMBER_LABEL),
      text: excerpt(String(c.body ?? ''), LIMITS.boardReplyMax),
    };
    if (c.authorDisplay?.role) reply.role = c.authorDisplay.role;
    return reply;
  });

  await target.set({
    questionPostId,
    questionText: String(post.title ?? ''),
    spaceName: String(post.spaceName ?? ''),
    pollOptions,
    counts: {
      weighedIn: pollOptions.length > 0 ? pollVotes : ((post.thoughtfulCount as number) ?? 0) + replies,
      replies,
    },
    approvedReplies,
    nobleman,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
