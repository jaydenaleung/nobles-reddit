import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * These tests prove the access rules that the anonymity guarantee rests on.
 * They run against the Firestore emulator with the real firestore.rules file.
 */
let env: RulesTestEnvironment;

const member = (uid: string, role: string, email = `${uid}@nobles.edu`) =>
  env.authenticatedContext(uid, { email, email_verified: true, role }).firestore();

const student = () => member('studentA', 'student');
const otherStudent = () => member('studentB', 'student');
const faculty = () => member('facultyA', 'faculty');
const moderator = () => member('modA', 'moderator');
const admin = () => member('adminA', 'admin');
const anonymous = () => env.unauthenticatedContext().firestore();
/** Signed in with a Nobles address, but the email is not verified. */
const unverified = () =>
  env
    .authenticatedContext('unverified', {
      email: 'unverified@nobles.edu',
      email_verified: false,
      role: 'student',
    })
    .firestore();
/** Signed in with a verified address from somewhere else. Even a forged role claim must not help. */
const offDomain = () =>
  env
    .authenticatedContext('outsider', { email: 'outsider@example.com', email_verified: true, role: 'admin' })
    .firestore();
/** A look-alike domain. */
const lookalike = () =>
  env
    .authenticatedContext('lookalike', {
      email: 'someone@nobles.edu.example.com',
      email_verified: true,
      role: 'student',
    })
    .firestore();
/** A Nobles address that has signed in but has not been onboarded, so has no role claim. */
const notOnboarded = () =>
  env.authenticatedContext('newbie', { email: 'newbie@nobles.edu', email_verified: true }).firestore();

const post = (status: string) => ({
  spaceId: 'space1',
  spaceName: 'School news',
  kind: 'text',
  title: 'A sample thread',
  body: 'Sample body',
  authorDisplay: { mode: 'anonymous', anonLabel: 'Anonymous A' },
  thoughtfulCount: 0,
  commentCount: 0,
  hotScore: 1,
  pinned: false,
  status,
  createdAt: new Date(),
});

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-nobles-commons',
    firestore: {
      rules: readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: host!,
      port: Number(port),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/studentA'), {
      email: 'studentA@nobles.edu',
      displayName: 'Sample A.',
      role: 'student',
    });
    await setDoc(doc(db, 'users/studentB'), {
      email: 'studentB@nobles.edu',
      displayName: 'Sample B.',
      role: 'student',
    });
    await setDoc(doc(db, 'spaces/space1'), { name: 'School news', slug: 'school-news', order: 1 });
    await setDoc(doc(db, 'posts/visible1'), post('visible'));
    await setDoc(doc(db, 'posts/held1'), post('held'));
    await setDoc(doc(db, 'posts/removed1'), post('removed'));
    await setDoc(doc(db, 'posts/visible1/comments/c1'), {
      body: 'Hi',
      status: 'visible',
      createdAt: new Date(),
    });
    await setDoc(doc(db, 'posts/visible1/comments/c2'), {
      body: 'Held',
      status: 'held',
      createdAt: new Date(),
    });
    await setDoc(doc(db, 'authorship/post:visible1'), { contentKey: 'post:visible1', authorUid: 'studentA' });
    await setDoc(doc(db, 'authorship/comment:visible1:c1'), {
      contentKey: 'comment:visible1:c1',
      authorUid: 'studentA',
    });
    await setDoc(doc(db, 'threadAnon/visible1'), { count: 1 });
    await setDoc(doc(db, 'threadAnon/visible1/members/studentA'), { index: 0 });
    await setDoc(doc(db, 'votes/visible1/by/studentA'), {
      uid: 'studentA',
      postId: 'visible1',
      kind: 'post',
    });
    await setDoc(doc(db, 'votes/visible1/comments/c1/by/studentA'), {
      uid: 'studentA',
      postId: 'visible1',
      kind: 'comment',
    });
    await setDoc(doc(db, 'pollVotes/visible1/by/studentA'), {
      uid: 'studentA',
      postId: 'visible1',
      kind: 'poll',
      optionId: 'a',
    });
    await setDoc(doc(db, 'reports/r1'), {
      contentKey: 'post:visible1',
      reporterUid: 'studentB',
      status: 'open',
    });
    await setDoc(doc(db, 'moderationQueue/q1'), {
      contentKey: 'post:held1',
      reason: 'ai-flag',
      status: 'open',
    });
    await setDoc(doc(db, 'auditLog/a1'), {
      actorUid: 'adminA',
      action: 'revealAuthor',
      reason: 'A sample reason',
    });
    await setDoc(doc(db, 'dailyQuestions/2026-11-16-1'), { text: 'A sample question?', status: 'proposed' });
    await setDoc(doc(db, 'config/roles'), { emailToRole: {} });
    await setDoc(doc(db, 'config/ai'), { bannedTopics: [] });
    await setDoc(doc(db, 'boardFeed/current'), { questionText: 'A sample question?', approvedReplies: [] });
    await setDoc(doc(db, 'usage/2026-11-16'), { calls: 1 });
    await setDoc(doc(db, 'rateLimits/studentA'), { posts: { tokens: 1 } });
    await setDoc(doc(db, 'mail/m1'), { to: 'sample.wellbeing@nobles.edu' });
  });
});

describe('authorship: nobody reads it from a client, ever', () => {
  const paths = ['authorship/post:visible1', 'authorship/comment:visible1:c1'];
  it('a student cannot read authorship, including for their own post', async () => {
    for (const p of paths) {
      await assertFails(getDoc(doc(student(), p)));
      await assertFails(getDoc(doc(otherStudent(), p)));
    }
  });
  it('faculty cannot read authorship', async () => {
    for (const p of paths) await assertFails(getDoc(doc(faculty(), p)));
  });
  it('a moderator cannot read authorship', async () => {
    for (const p of paths) await assertFails(getDoc(doc(moderator(), p)));
  });
  it('an admin cannot read authorship directly either (only through the logged revealAuthor function)', async () => {
    for (const p of paths) await assertFails(getDoc(doc(admin(), p)));
  });
  it('nobody can list or query authorship', async () => {
    for (const db of [student(), moderator(), admin()]) {
      await assertFails(getDocs(collection(db, 'authorship')));
      await assertFails(getDocs(query(collection(db, 'authorship'), where('authorUid', '==', 'studentA'))));
    }
  });
  it('nobody can write authorship', async () => {
    for (const db of [student(), moderator(), admin()]) {
      await assertFails(setDoc(doc(db, 'authorship/post:new'), { authorUid: 'studentB' }));
      await assertFails(updateDoc(doc(db, 'authorship/post:visible1'), { authorUid: 'studentB' }));
      await assertFails(deleteDoc(doc(db, 'authorship/post:visible1')));
    }
  });
});

describe('threadAnon: the per-thread letters stay private', () => {
  it('nobody can read who holds which letter', async () => {
    for (const db of [student(), otherStudent(), moderator(), admin()]) {
      await assertFails(getDoc(doc(db, 'threadAnon/visible1')));
      await assertFails(getDoc(doc(db, 'threadAnon/visible1/members/studentA')));
      await assertFails(getDocs(collection(db, 'threadAnon/visible1/members')));
      await assertFails(getDocs(collectionGroup(db, 'members')));
    }
  });
  it('nobody can write it', async () => {
    await assertFails(setDoc(doc(student(), 'threadAnon/visible1/members/studentA'), { index: 5 }));
    await assertFails(setDoc(doc(admin(), 'threadAnon/visible1/members/x'), { index: 5 }));
  });
});

describe('votes: you can see your own, nobody else can', () => {
  it('a student can read their own votes', async () => {
    await assertSucceeds(getDoc(doc(student(), 'votes/visible1/by/studentA')));
    await assertSucceeds(getDoc(doc(student(), 'votes/visible1/comments/c1/by/studentA')));
    await assertSucceeds(getDoc(doc(student(), 'pollVotes/visible1/by/studentA')));
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(student(), 'by'),
          where('uid', '==', 'studentA'),
          where('postId', '==', 'visible1'),
        ),
      ),
    );
  });
  it('a student cannot read another person’s votes', async () => {
    await assertFails(getDoc(doc(otherStudent(), 'votes/visible1/by/studentA')));
    await assertFails(getDoc(doc(otherStudent(), 'votes/visible1/comments/c1/by/studentA')));
    await assertFails(getDoc(doc(otherStudent(), 'pollVotes/visible1/by/studentA')));
    await assertFails(getDocs(collection(otherStudent(), 'votes/visible1/by')));
    await assertFails(getDocs(query(collectionGroup(otherStudent(), 'by'), where('uid', '==', 'studentA'))));
    await assertFails(
      getDocs(query(collectionGroup(otherStudent(), 'by'), where('postId', '==', 'visible1'))),
    );
    await assertFails(getDocs(collectionGroup(otherStudent(), 'by')));
  });
  it('moderators and admins cannot read who voted either', async () => {
    await assertFails(getDoc(doc(moderator(), 'votes/visible1/by/studentA')));
    await assertFails(getDocs(collection(admin(), 'votes/visible1/by')));
  });
  it('nobody can write a vote directly, not even their own', async () => {
    await assertFails(setDoc(doc(student(), 'votes/visible1/by/studentA'), { uid: 'studentA' }));
    await assertFails(
      setDoc(doc(otherStudent(), 'votes/visible1/by/studentB'), { uid: 'studentB', postId: 'visible1' }),
    );
    await assertFails(deleteDoc(doc(student(), 'votes/visible1/by/studentA')));
    await assertFails(setDoc(doc(student(), 'pollVotes/visible1/by/studentA'), { optionId: 'b' }));
    await assertFails(setDoc(doc(student(), 'votes/visible1/comments/c1/by/studentA'), { uid: 'studentA' }));
  });
});

describe('posts and comments: read what is visible, write nothing', () => {
  it('a member can read visible posts and comments', async () => {
    await assertSucceeds(getDoc(doc(student(), 'posts/visible1')));
    await assertSucceeds(getDoc(doc(student(), 'posts/visible1/comments/c1')));
    await assertSucceeds(getDocs(query(collection(student(), 'posts'), where('status', '==', 'visible'))));
    await assertSucceeds(
      getDocs(query(collection(student(), 'posts/visible1/comments'), where('status', '==', 'visible'))),
    );
  });
  it('a member cannot read held or removed content', async () => {
    await assertFails(getDoc(doc(student(), 'posts/held1')));
    await assertFails(getDoc(doc(student(), 'posts/removed1')));
    await assertFails(getDoc(doc(student(), 'posts/visible1/comments/c2')));
    await assertFails(getDocs(collection(student(), 'posts')));
    await assertFails(getDocs(query(collection(student(), 'posts'), where('status', '==', 'held'))));
    await assertFails(getDocs(collection(student(), 'posts/visible1/comments')));
  });
  it('moderators and admins can read held and removed content', async () => {
    await assertSucceeds(getDoc(doc(moderator(), 'posts/held1')));
    await assertSucceeds(getDoc(doc(admin(), 'posts/removed1')));
    await assertSucceeds(getDocs(collection(moderator(), 'posts')));
    await assertSucceeds(getDoc(doc(moderator(), 'posts/visible1/comments/c2')));
  });
  it('a student cannot create a post or comment directly', async () => {
    await assertFails(addDoc(collection(student(), 'posts'), post('visible')));
    await assertFails(setDoc(doc(student(), 'posts/mine'), post('visible')));
    await assertFails(
      addDoc(collection(student(), 'posts/visible1/comments'), { body: 'x', status: 'visible' }),
    );
  });
  it('a student cannot edit or delete a post or comment directly', async () => {
    await assertFails(updateDoc(doc(student(), 'posts/visible1'), { title: 'Changed' }));
    await assertFails(updateDoc(doc(student(), 'posts/visible1'), { thoughtfulCount: 999 }));
    await assertFails(updateDoc(doc(student(), 'posts/visible1'), { status: 'removed' }));
    await assertFails(deleteDoc(doc(student(), 'posts/visible1')));
    await assertFails(updateDoc(doc(student(), 'posts/visible1/comments/c1'), { body: 'Changed' }));
    await assertFails(deleteDoc(doc(student(), 'posts/visible1/comments/c1')));
  });
  it('faculty, moderators and admins cannot write content directly either', async () => {
    for (const db of [faculty(), moderator(), admin()]) {
      await assertFails(setDoc(doc(db, 'posts/direct'), post('visible')));
      await assertFails(updateDoc(doc(db, 'posts/held1'), { status: 'visible' }));
      await assertFails(deleteDoc(doc(db, 'posts/visible1')));
    }
  });
});

describe('users: private profiles', () => {
  it('a member can read their own profile', async () => {
    await assertSucceeds(getDoc(doc(student(), 'users/studentA')));
  });
  it('a member cannot read anyone else’s profile or list users', async () => {
    await assertFails(getDoc(doc(student(), 'users/studentB')));
    await assertFails(getDocs(collection(student(), 'users')));
    await assertFails(
      getDocs(query(collection(student(), 'users'), where('email', '==', 'studentB@nobles.edu'))),
    );
  });
  it('a moderator cannot read profiles (so cannot work out authors)', async () => {
    await assertFails(getDoc(doc(moderator(), 'users/studentA')));
    await assertFails(getDocs(collection(moderator(), 'users')));
  });
  it('an admin can read profiles', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'users/studentA')));
  });
  it('nobody can write a profile from a client, including their own role', async () => {
    await assertFails(updateDoc(doc(student(), 'users/studentA'), { role: 'admin' }));
    await assertFails(setDoc(doc(student(), 'users/studentA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(admin(), 'users/studentA'), { role: 'moderator' }));
    await assertFails(deleteDoc(doc(student(), 'users/studentA')));
  });
});

describe('people who are not members get nothing', () => {
  const everything = [
    'posts/visible1',
    'posts/visible1/comments/c1',
    'spaces/space1',
    'users/unverified',
    'users/outsider',
    'authorship/post:visible1',
    'reports/r1',
    'moderationQueue/q1',
    'auditLog/a1',
    'config/roles',
    'dailyQuestions/2026-11-16-1',
    'votes/visible1/by/studentA',
    'usage/2026-11-16',
  ];
  it('an unverified email is denied everything', async () => {
    for (const p of everything) await assertFails(getDoc(doc(unverified(), p)));
    await assertFails(getDocs(query(collection(unverified(), 'posts'), where('status', '==', 'visible'))));
    await assertFails(setDoc(doc(unverified(), 'posts/x'), post('visible')));
  });
  it('an off-domain account is denied everything, even with a forged admin claim', async () => {
    for (const p of everything) await assertFails(getDoc(doc(offDomain(), p)));
    await assertFails(getDocs(query(collection(offDomain(), 'posts'), where('status', '==', 'visible'))));
    await assertFails(setDoc(doc(offDomain(), 'posts/x'), post('visible')));
  });
  it('a look-alike domain is denied', async () => {
    await assertFails(getDoc(doc(lookalike(), 'posts/visible1')));
    await assertFails(getDoc(doc(lookalike(), 'spaces/space1')));
  });
  it('a Nobles account that has not been onboarded is denied until it has a role', async () => {
    await assertFails(getDoc(doc(notOnboarded(), 'posts/visible1')));
    await assertFails(getDoc(doc(notOnboarded(), 'spaces/space1')));
  });
  it('someone who is not signed in is denied everything except the hall screen feed', async () => {
    for (const p of everything) await assertFails(getDoc(doc(anonymous(), p)));
    await assertFails(getDocs(query(collection(anonymous(), 'posts'), where('status', '==', 'visible'))));
  });
});

describe('the hall screen feed', () => {
  it('is readable without signing in', async () => {
    await assertSucceeds(getDoc(doc(anonymous(), 'boardFeed/current')));
    await assertSucceeds(getDoc(doc(student(), 'boardFeed/current')));
  });
  it('is not writable by anyone', async () => {
    for (const db of [anonymous(), student(), moderator(), admin()]) {
      await assertFails(setDoc(doc(db, 'boardFeed/current'), { questionText: 'Defaced' }));
      await assertFails(updateDoc(doc(db, 'boardFeed/current'), { questionText: 'Defaced' }));
      await assertFails(deleteDoc(doc(db, 'boardFeed/current')));
    }
  });
  it('only the one document is public', async () => {
    await assertFails(getDoc(doc(anonymous(), 'boardFeed/other')));
    await assertFails(getDocs(collection(anonymous(), 'boardFeed')));
  });
});

describe('moderation, audit and configuration', () => {
  it('students and faculty cannot read reports or the moderation queue', async () => {
    for (const db of [student(), faculty()]) {
      await assertFails(getDoc(doc(db, 'reports/r1')));
      await assertFails(getDocs(collection(db, 'reports')));
      await assertFails(getDoc(doc(db, 'moderationQueue/q1')));
      await assertFails(getDoc(doc(db, 'dailyQuestions/2026-11-16-1')));
    }
  });
  it('moderators and admins can read reports, the queue and proposed questions', async () => {
    for (const db of [moderator(), admin()]) {
      await assertSucceeds(getDocs(collection(db, 'reports')));
      await assertSucceeds(getDocs(collection(db, 'moderationQueue')));
      await assertSucceeds(getDocs(collection(db, 'dailyQuestions')));
    }
  });
  it('nobody can write reports, the queue or questions directly', async () => {
    await assertFails(addDoc(collection(student(), 'reports'), { contentKey: 'post:visible1' }));
    await assertFails(updateDoc(doc(moderator(), 'reports/r1'), { status: 'resolved' }));
    await assertFails(deleteDoc(doc(admin(), 'moderationQueue/q1')));
    await assertFails(updateDoc(doc(admin(), 'dailyQuestions/2026-11-16-1'), { status: 'approved' }));
  });
  it('only admins can read the audit log, and nobody can change it', async () => {
    await assertFails(getDoc(doc(student(), 'auditLog/a1')));
    await assertFails(getDoc(doc(moderator(), 'auditLog/a1')));
    await assertSucceeds(getDoc(doc(admin(), 'auditLog/a1')));
    await assertFails(updateDoc(doc(admin(), 'auditLog/a1'), { reason: 'Rewritten' }));
    await assertFails(deleteDoc(doc(admin(), 'auditLog/a1')));
    await assertFails(addDoc(collection(admin(), 'auditLog'), { action: 'fake' }));
  });
  it('only admins can read configuration, and nobody can write it directly', async () => {
    await assertFails(getDoc(doc(student(), 'config/roles')));
    await assertFails(getDoc(doc(moderator(), 'config/roles')));
    await assertSucceeds(getDoc(doc(admin(), 'config/roles')));
    await assertSucceeds(getDoc(doc(admin(), 'config/ai')));
    await assertFails(setDoc(doc(admin(), 'config/roles'), { emailToRole: { 'x@nobles.edu': 'admin' } }));
    await assertFails(
      setDoc(doc(student(), 'config/roles'), { emailToRole: { 'studentA@nobles.edu': 'admin' } }),
    );
  });
  it('function-only collections are closed to every client', async () => {
    for (const db of [student(), moderator(), admin()]) {
      await assertFails(getDoc(doc(db, 'usage/2026-11-16')));
      await assertFails(getDoc(doc(db, 'rateLimits/studentA')));
      await assertFails(getDoc(doc(db, 'mail/m1')));
      await assertFails(setDoc(doc(db, 'rateLimits/studentA'), { posts: { tokens: 99 } }));
    }
  });
  it('spaces are readable by members and writable by nobody', async () => {
    await assertSucceeds(getDocs(collection(student(), 'spaces')));
    await assertFails(setDoc(doc(student(), 'spaces/new'), { name: 'Mine' }));
    await assertFails(setDoc(doc(admin(), 'spaces/new'), { name: 'Mine' }));
  });
  it('anything not named in the rules is denied', async () => {
    await assertFails(getDoc(doc(admin(), 'somethingElse/doc')));
    await assertFails(setDoc(doc(admin(), 'somethingElse/doc'), { a: 1 }));
  });
});
