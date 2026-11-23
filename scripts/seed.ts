/**
 * Fills the database with sample data.
 *
 *   npm run seed                      -> the Firebase emulators (the default, and safe)
 *   npm run seed -- --allow-prod      -> the real project in .env.local, after you type its id
 *
 * Everything written here is marked `sample: true` and uses obviously made-up
 * names. No real person is ever seeded, and no sign-in accounts are created:
 * the three sample users are profile records only, there to own the sample
 * posts.
 */
import { createInterface } from 'node:readline/promises';
import {
  ADMIN_DISPLAY_NAME,
  DEFAULT_SPACES,
  buildSearchTokens,
  commentKey,
  hotScore,
  postKey,
  type AuthorDisplay,
} from '@commons/shared';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { loadEnv } from './env.mjs';

const allowProd = process.argv.includes('--allow-prod');
const emulatorEnv = loadEnv('emulator');

async function connect() {
  if (!allowProd) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    const projectId = emulatorEnv.FIREBASE_PROJECT_ID ?? 'demo-nobles-commons';
    initializeApp({ projectId });
    console.log(`Seeding the emulator (${projectId}) at ${process.env.FIRESTORE_EMULATOR_HOST}`);
    return getFirestore();
  }
  const env = loadEnv('local');
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId || !env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      'Seeding production needs FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS in .env.local.',
    );
    process.exit(1);
  }
  delete process.env.FIRESTORE_EMULATOR_HOST;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = await rl.question(
    `This writes SAMPLE data to the REAL project "${projectId}".\nType the project id to continue: `,
  );
  rl.close();
  if (typed.trim() !== projectId) {
    console.error('That did not match. Nothing was written.');
    process.exit(1);
  }
  initializeApp({ projectId, credential: applicationDefault() });
  return getFirestore();
}

const db = await connect();
const now = Date.now();
const hoursAgo = (hours: number) => Timestamp.fromMillis(now - hours * 3_600_000);

/* ---------- Spaces ---------- */
const spaceIds: Record<string, string> = {};
const existingSpaces = await db.collection('spaces').get();
for (const doc of existingSpaces.docs) spaceIds[doc.data().slug] = doc.id;
for (const space of DEFAULT_SPACES) {
  if (spaceIds[space.slug]) continue;
  const ref = db.collection('spaces').doc();
  spaceIds[space.slug] = ref.id;
  await ref.set({ ...space, isPublic: true, postCount: 0, createdAt: FieldValue.serverTimestamp() });
}
const spaceName = (slug: string) => DEFAULT_SPACES.find((s) => s.slug === slug)!.name;

/* ---------- Roles for the sample sign-ins (emulator only) and the three sample users ---------- */
if (!allowProd) {
  await db
    .doc('config/roles')
    .set(
      { emailToRole: { 'sample.teacher@nobles.edu': 'faculty', 'sample.moderator@nobles.edu': 'moderator' } },
      { merge: true },
    );
}
const users = {
  student: { uid: 'sample-student', firstName: 'Sample', lastInitial: 'S', classYear: 2028, role: 'student' },
  faculty: { uid: 'sample-teacher', firstName: 'Sample', lastInitial: 'T', classYear: null, role: 'faculty' },
  admin: { uid: 'sample-admin', firstName: 'Sample', lastInitial: 'A', classYear: null, role: 'admin' },
} as const;
for (const user of Object.values(users)) {
  await db.doc(`users/${user.uid}`).set({
    email: `${user.uid.replace('-', '.')}.record@nobles.edu`,
    firstName: user.firstName,
    lastInitial: user.lastInitial,
    displayName: `${user.firstName} ${user.lastInitial}.`,
    classYear: user.classYear,
    role: user.role,
    divisions: [],
    sample: true,
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  });
}

const named = (who: keyof typeof users): AuthorDisplay => {
  const u = users[who];
  const display: AuthorDisplay = { name: `${u.firstName} ${u.lastInitial}.`, role: u.role };
  if (u.classYear) display.classYear = u.classYear;
  return display;
};

/* ---------- Threads ---------- */
interface SeedComment {
  body: string;
  author: AuthorDisplay;
  uid: string;
  hours: number;
  replyTo?: number;
  board?: boolean;
  thoughtful?: number;
}
interface SeedPost {
  slug: string;
  title: string;
  body?: string;
  author: AuthorDisplay;
  uid: string;
  hours: number;
  thoughtful: number;
  extra?: Record<string, unknown>;
  comments?: SeedComment[];
}

const questionComments: SeedComment[] = [
  {
    body: 'I commute 50 minutes. Thirty extra minutes is real for me.',
    author: named('student'),
    uid: users.student.uid,
    hours: 5.5,
    board: true,
    thoughtful: 9,
  },
  {
    body: 'Could someone collect the actual commute times?',
    author: named('faculty'),
    uid: users.faculty.uid,
    hours: 5.2,
    board: true,
    thoughtful: 6,
  },
  {
    body: 'Later starts help, but *only* if bedtimes move too.',
    author: named('student'),
    uid: users.student.uid,
    hours: 5,
    thoughtful: 4,
  },
  {
    body: 'Practice would end later. That matters for winter sports.',
    author: named('admin'),
    uid: users.admin.uid,
    hours: 4.6,
    replyTo: 2,
  },
  {
    body: 'What if the first block was a study hall on some days?',
    author: named('student'),
    uid: users.student.uid,
    hours: 4.2,
  },
  {
    body: 'I would sleep the same amount and just start homework later.',
    author: named('student'),
    uid: users.student.uid,
    hours: 4,
  },
  {
    body: 'The research on teenage sleep is fairly clear, but schedules are hard to move.',
    author: named('faculty'),
    uid: users.faculty.uid,
    hours: 3.6,
  },
  {
    body: 'Buses and trains do not move just because we do.',
    author: named('admin'),
    uid: users.admin.uid,
    hours: 3.1,
    replyTo: 0,
  },
  { body: 'Even 8:15 would feel different.', author: named('student'), uid: users.student.uid, hours: 2.4 },
  {
    body: 'Could we try it for one month and ask again?',
    author: named('student'),
    uid: users.student.uid,
    hours: 1.8,
    thoughtful: 3,
  },
  {
    body: 'A one-month trial sounds fair to me.',
    author: named('faculty'),
    uid: users.faculty.uid,
    hours: 1.1,
    replyTo: 9,
  },
];

const posts: SeedPost[] = [
  {
    slug: 'school-news',
    title: 'Read this first: how Neddit works',
    body:
      'Neddit is the Nobles Discussion Board. Post about school stuff or the news, and talk it through.\n\n' +
      'Neddit is about learning to disagree respectfully. Focus on the ideas, not the people who wrote them. Everything goes up under your name.\n\n' +
      'If a post looks wrong, hit Report and a mod will look at it.',
    author: { name: ADMIN_DISPLAY_NAME, role: 'admin' },
    uid: users.admin.uid,
    hours: 48,
    thoughtful: 12,
    extra: { pinned: true, pinnedBy: 'administration' },
    comments: [
      {
        body: 'Thanks for spelling this out so plainly.',
        author: named('student'),
        uid: users.student.uid,
        hours: 40,
      },
      { body: 'Glad this exists.', author: named('faculty'), uid: users.faculty.uid, hours: 30 },
    ],
  },
  {
    slug: 'current-events',
    title: 'Should the school day start at 8:30 instead of 8:00?',
    author: named('faculty'),
    uid: users.faculty.uid,
    hours: 6,
    thoughtful: 8,
    extra: {
      kind: 'poll',
      questionOfTheDay: true,
      poll: {
        options: [
          { id: 'o1', label: 'Yes, later', count: 11 },
          { id: 'o2', label: 'Not sure', count: 4 },
          { id: 'o3', label: 'No, keep 8:00', count: 3 },
        ],
      },
      summary: {
        text: 'Sample summary. Most people like the idea of more sleep. They disagree about practice schedules and commute times, and several suggest a short trial.',
        bullets: [
          'More sleep is welcome.',
          'Later practices worry athletes.',
          'A one-month trial is a popular idea.',
        ],
        agreements: 'More sleep would help.',
        disagreements: 'Whether the rest of the day can move.',
        commentCountAtGeneration: 10,
        model: 'sample',
        generatedAt: hoursAgo(1),
      },
    },
    comments: questionComments,
  },
  {
    slug: 'school-news',
    title: 'Lacrosse opens the season with a one-goal win',
    author: named('student'),
    uid: users.student.uid,
    hours: 3,
    thoughtful: 5,
    extra: {
      kind: 'link',
      link: {
        url: 'https://example.org/sample-nobleman-story',
        domain: 'example.org',
        source: 'nobleman',
        title: 'Sample link: this is a made-up article',
      },
    },
    comments: [
      { body: 'That last save was something.', author: named('student'), uid: users.student.uid, hours: 2 },
    ],
  },
  {
    slug: 'middle-school',
    title: 'Is it okay to ask upperclassmen for help with homework?',
    body: 'I’m new this year and I don’t really know who to ask. I don’t want to bug anyone who’s busy.',
    author: named('student'),
    uid: users.student.uid,
    hours: 8,
    thoughtful: 7,
    comments: [
      {
        body: 'Yes. Most of us remember being new. Ask.',
        author: named('student'),
        uid: users.student.uid,
        hours: 7,
      },
      {
        body: 'The library tables before first block are a good place to find someone.',
        author: named('faculty'),
        uid: users.faculty.uid,
        hours: 6.5,
      },
    ],
  },
  {
    slug: 'clubs',
    title: 'What would make the club fair actually useful this year?',
    body: 'Last year I walked around for twenty minutes and signed up for nothing. Anyone else?',
    author: named('faculty'),
    uid: users.faculty.uid,
    hours: 5,
    thoughtful: 4,
    comments: [{ body: 'A map. Just a map.', author: named('student'), uid: users.student.uid, hours: 4 }],
  },
  {
    slug: 'athletics',
    title: 'Which home games should the whole school come to?',
    author: named('student'),
    uid: users.student.uid,
    hours: 0.7,
    thoughtful: 0,
  },
];

let questionPostId = '';
const already = await db.collection('posts').where('sample', '==', true).limit(1).get();
if (!already.empty) {
  console.log('Sample threads are already there. Leaving them as they are.');
  const question = await db
    .collection('posts')
    .where('sample', '==', true)
    .where('questionOfTheDay', '==', true)
    .limit(1)
    .get();
  questionPostId = question.docs[0]?.id ?? '';
} else {
  for (const post of posts) {
    const postRef = db.collection('posts').doc();
    const comments = post.comments ?? [];
    const createdAt = hoursAgo(post.hours);
    const body = post.body ?? '';
    const batch = db.batch();
    batch.set(postRef, {
      spaceId: spaceIds[post.slug],
      spaceName: spaceName(post.slug),
      kind: 'text',
      title: post.title,
      body,
      authorDisplay: post.author,
      thoughtfulCount: post.thoughtful,
      commentCount: comments.length,
      hotScore: hotScore(post.thoughtful, comments.length, createdAt.seconds),
      pinned: false,
      status: 'visible',
      screening: 'clear',
      searchTokens: buildSearchTokens(post.title, body, spaceName(post.slug)),
      sample: true,
      createdAt,
      ...post.extra,
    });
    batch.set(db.doc(`authorship/${postKey(postRef.id)}`), {
      contentKey: postKey(postRef.id),
      authorUid: post.uid,
      createdAt,
    });
    // The seeded "Thoughtful" count is held by placeholder marks so the counters stay consistent.
    for (let i = 0; i < post.thoughtful; i++) {
      batch.set(db.doc(`votes/${postRef.id}/by/sample-voter-${i}`), {
        uid: `sample-voter-${i}`,
        postId: postRef.id,
        commentId: null,
        kind: 'post',
        sample: true,
        createdAt,
      });
    }
    const commentIds: string[] = [];
    comments.forEach((comment, index) => {
      const ref = postRef.collection('comments').doc();
      commentIds[index] = ref.id;
      const parentId = comment.replyTo !== undefined ? commentIds[comment.replyTo]! : null;
      const at = hoursAgo(comment.hours);
      batch.set(ref, {
        postId: postRef.id,
        parentId,
        depth: parentId ? 1 : 0,
        body: comment.body,
        authorDisplay: comment.author,
        thoughtfulCount: comment.thoughtful ?? 0,
        status: 'visible',
        screening: 'clear',
        boardApproved: !!comment.board,
        sample: true,
        createdAt: at,
      });
      batch.set(db.doc(`authorship/${commentKey(postRef.id, ref.id)}`), {
        contentKey: commentKey(postRef.id, ref.id),
        authorUid: comment.uid,
        createdAt: at,
      });
      for (let i = 0; i < (comment.thoughtful ?? 0); i++) {
        batch.set(db.doc(`votes/${postRef.id}/comments/${ref.id}/by/sample-voter-${i}`), {
          uid: `sample-voter-${i}`,
          postId: postRef.id,
          commentId: ref.id,
          kind: 'comment',
          sample: true,
          createdAt: at,
        });
      }
    });
    await batch.commit();
    if (post.extra?.questionOfTheDay) questionPostId = postRef.id;
  }
  console.log(`Wrote ${posts.length} sample threads.`);
}

/* ---------- Thread counts per space, and the hall screen ---------- */
for (const [slug, id] of Object.entries(spaceIds)) {
  const count = await db
    .collection('posts')
    .where('spaceId', '==', id)
    .where('status', '==', 'visible')
    .count()
    .get();
  await db.doc(`spaces/${id}`).update({ postCount: count.data().count });
  void slug;
}

if (questionPostId) {
  const question = posts.find((p) => p.extra?.questionOfTheDay)!;
  const options = (question.extra!.poll as { options: { id: string; label: string; count: number }[] })
    .options;
  await db
    .doc('config/board')
    .set({ questionPostId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  // Written here as well, so /board works even when the functions emulator is not running.
  await db.doc('boardFeed/current').set({
    questionPostId,
    questionText: question.title,
    spaceName: spaceName(question.slug),
    pollOptions: options,
    counts: {
      weighedIn: options.reduce((sum, o) => sum + o.count, 0),
      replies: questionComments.length,
    },
    approvedReplies: questionComments
      .filter((c) => c.board)
      .reverse()
      .map((c) => ({
        displayName: c.author.name,
        ...(c.author.role ? { role: c.author.role } : {}),
        text: c.body,
      })),
    nobleman: [
      { title: 'Lacrosse opens the season with a one-goal win', url: '', minutes: 4, sample: true },
      { title: 'Inside the new student-run film festival', url: '', minutes: 6, sample: true },
      { title: 'Club fair moves to the Gleason lobby', url: '', minutes: 3, sample: true },
    ],
    updatedAt: FieldValue.serverTimestamp(),
  });
}

console.log('Seeding finished. All sample content is marked sample: true.');
process.exit(0);
