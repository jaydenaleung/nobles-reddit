import {
  ADMIN_DISPLAY_NAME,
  DAILY_QUESTION_SPACE,
  buildSearchTokens,
  dailyQuestionActionSchema,
  emptySchema,
  hotScore,
  isSchoolDay,
  postKey,
  proposeHumanQuestionSchema,
  schoolDate,
} from '@commons/shared';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp, db } from './admin';
import { ANTHROPIC_API_KEY, AiUnavailable, runAi } from './ai';
import { auditIn } from './audit';
import { env } from './env';
import { AppError, errors } from './errors';
import { MOD_ROLES, callable } from './guard';

/**
 * Asks the model for three candidate questions and stores them as `proposed`.
 * Nothing here publishes anything: a moderator approves one, or none.
 *
 * The model sees thread titles from the last week (never bodies), the school's
 * calendar notes and the list of banned topics.
 */
export async function proposeQuestions(): Promise<{ proposed: number; reason?: string }> {
  const date = schoolDate();
  const existing = await db.collection('dailyQuestions').where('date', '==', date).limit(1).get();
  if (!existing.empty) return { proposed: 0, reason: 'already-proposed' };

  const weekAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [posts, calendar, ai] = await Promise.all([
    db
      .collection('posts')
      .where('status', '==', 'visible')
      .where('createdAt', '>=', weekAgo)
      .orderBy('createdAt', 'desc')
      .limit(60)
      .get(),
    db.doc('config/calendar').get(),
    db.doc('config/ai').get(),
  ]);

  const context = {
    date,
    recentTitles: posts.docs.map((d) => String(d.data().title ?? '')).filter(Boolean),
    calendarNotes: (calendar.data()?.notes as string[] | undefined) ?? [],
    bannedTopics: (ai.data()?.bannedTopics as string[] | undefined) ?? [],
  };

  let questions: string[];
  try {
    questions = (await runAi((provider) => provider.suggestQuestion(context))).output.questions;
  } catch (error) {
    if (error instanceof AiUnavailable) return { proposed: 0, reason: error.reason };
    throw error;
  }

  const batch = db.batch();
  questions.forEach((text, i) => {
    batch.create(db.doc(`dailyQuestions/${date}-${i + 1}`), {
      date,
      text,
      source: 'ai',
      status: 'proposed',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return { proposed: questions.length };
}

/** 06:00 at school, Monday to Friday. */
export const proposeDailyQuestion = onSchedule(
  {
    schedule: '0 6 * * 1-5',
    timeZone: 'America/New_York',
    region: env.region,
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
    retryCount: 1,
  },
  async () => {
    if (!isSchoolDay()) return;
    const result = await proposeQuestions();
    logger.info('Daily question proposal', result);
  },
);

/** Lets a moderator ask for today's suggestions by hand (for example on a morning the schedule missed). */
export const proposeDailyQuestionNow = callable(
  {
    name: 'proposeDailyQuestionNow',
    schema: emptySchema,
    roles: MOD_ROLES,
    rate: 'admin',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
  },
  async (): Promise<{ proposed: number; reason?: string }> => proposeQuestions(),
);

/** A moderator writes their own question instead of using a suggested one. */
export const proposeHumanQuestion = callable(
  { name: 'proposeHumanQuestion', schema: proposeHumanQuestionSchema, roles: MOD_ROLES, rate: 'admin' },
  async (data): Promise<{ id: string }> => {
    const date = schoolDate();
    const ref = db.collection('dailyQuestions').doc();
    await ref.create({
      date,
      text: data.text,
      source: 'human',
      status: 'proposed',
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
  },
);

/**
 * A moderator approves (or rejects) a proposed question. Approving turns it
 * into a normal thread, pinned in Current events, posted by "Administration",
 * and makes it the question on the hall screen.
 */
export const approveDailyQuestion = callable(
  { name: 'approveDailyQuestion', schema: dailyQuestionActionSchema, roles: MOD_ROLES, rate: 'admin' },
  async (data, caller): Promise<{ status: 'approved' | 'rejected'; postId?: string }> => {
    const questionRef = db.doc(`dailyQuestions/${data.id}`);

    if (data.action === 'reject') {
      const snap = await questionRef.get();
      if (!snap.exists) throw errors.notFound('That question');
      if (snap.data()!.status !== 'proposed') throw new AppError('failed-precondition', 'That question was already decided.');
      await questionRef.update({ status: 'rejected', decidedBy: caller.uid, decidedAt: FieldValue.serverTimestamp() });
      return { status: 'rejected' };
    }

    const spaces = await db.collection('spaces').where('slug', '==', DAILY_QUESTION_SPACE).limit(1).get();
    const space = spaces.docs[0];
    if (!space) throw new AppError('failed-precondition', 'The Current events space is missing.');
    const postRef = db.collection('posts').doc();
    const key = postKey(postRef.id);

    await db.runTransaction(async (tx) => {
      const question = await tx.get(questionRef);
      if (!question.exists) throw errors.notFound('That question');
      const q = question.data()!;
      if (q.status !== 'proposed') throw new AppError('failed-precondition', 'That question was already decided.');
      // Yesterday's question stops being pinned when today's goes up.
      const previous = await tx.get(
        db.collection('posts').where('questionOfTheDay', '==', true).where('pinned', '==', true).limit(10),
      );

      const now = FieldValue.serverTimestamp();
      const title = String(q.text);
      tx.create(postRef, {
        spaceId: space.id,
        spaceName: space.data().name,
        kind: data.pollOptions ? 'poll' : 'text',
        title,
        body: '',
        ...(data.pollOptions
          ? { poll: { options: data.pollOptions.map((label, i) => ({ id: `o${i + 1}`, label, count: 0 })) } }
          : {}),
        authorDisplay: { mode: 'named', name: ADMIN_DISPLAY_NAME, role: 'admin' },
        thoughtfulCount: 0,
        commentCount: 0,
        anonCommentCount: 0,
        hotScore: hotScore(0, 0, Math.floor(Date.now() / 1000)),
        pinned: true,
        pinnedBy: 'administration',
        questionOfTheDay: true,
        // A moderator read and approved this text, so it is published directly.
        status: 'visible',
        screening: 'clear',
        searchTokens: buildSearchTokens(title, '', space.data().name),
        createdAt: now,
      });
      // The approving moderator is recorded as the author, like any other post.
      tx.create(db.doc(`authorship/${key}`), { contentKey: key, authorUid: caller.uid, createdAt: now });
      for (const old of previous.docs) tx.update(old.ref, { pinned: false, pinnedBy: FieldValue.delete() });
      tx.update(questionRef, { status: 'approved', approvedBy: caller.uid, postId: postRef.id, decidedAt: now });
      tx.set(db.doc('config/board'), { questionPostId: postRef.id, updatedAt: now }, { merge: true });
      auditIn(tx, {
        actorUid: caller.uid,
        actorEmail: caller.email,
        action: 'approveDailyQuestion',
        contentKey: key,
        reason: title,
      });
    });

    // The other suggestions for the same day are no longer needed.
    const approved = await questionRef.get();
    const others = await db
      .collection('dailyQuestions')
      .where('date', '==', approved.data()!.date)
      .where('status', '==', 'proposed')
      .get();
    if (!others.empty) {
      const batch = db.batch();
      for (const other of others.docs) batch.update(other.ref, { status: 'rejected' });
      await batch.commit();
    }
    return { status: 'approved', postId: postRef.id };
  },
);
