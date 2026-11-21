import { queryTokens } from '@commons/shared';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminDb,
  allStrings,
  assignRoles,
  closeAll,
  comment,
  expectError,
  member,
  post,
  refill,
  resetEmulators,
  seedSpaces,
  waitFor,
  type Persona,
} from './helpers';

/**
 * Neddit has no anonymous posting. New posts and comments must go up under the
 * writer's name, and the server refuses anything else.
 *
 * Content written before that changed still reads "Anonymous". Student A has
 * such legacy posts; student B then looks everywhere a student can look: the
 * post, the thread, the feed, search, the hall screen feed and every function
 * response. Nothing B receives may contain A's uid, name, email or class year.
 */
let spaces: Record<string, string>;
let a: Persona;
let b: Persona;
let moderator: Persona;

// Distinctive values, so that finding them anywhere is unambiguous.
const A_FIRST = 'Zephyrine';
const A_INITIAL = 'Q';
const A_YEAR = 2031;
const A_EMAIL = 'anon.zephyrine@nobles.edu';

let secrets: string[];
let thread: { postId: string; contentKey: string };
let reply: { postId: string; commentId: string; contentKey: string };

function assertNoTrace(label: string, value: unknown) {
  const haystack = allStrings(value).join(' | ').toLowerCase();
  for (const secret of secrets) {
    expect(haystack, `${label} must not contain "${secret}"`).not.toContain(secret.toLowerCase());
  }
}

/** Turns a document into one written before anonymous posting was turned off. */
async function makeLegacyAnonymous(path: string): Promise<void> {
  await adminDb.doc(path).update({ authorDisplay: { mode: 'anonymous', anonLabel: 'Anonymous A' } });
}

beforeAll(async () => {
  await resetEmulators();
  spaces = await seedSpaces();
  await assignRoles({ 'anon.mod@nobles.edu': 'moderator' });
  a = await member(A_EMAIL, { firstName: A_FIRST, lastInitial: A_INITIAL, classYear: A_YEAR });
  b = await member('anon.other@nobles.edu', { firstName: 'Bystander', lastInitial: 'B', classYear: 2028 });
  moderator = await member('anon.mod@nobles.edu', { firstName: 'Modsample', lastInitial: 'M' });
  secrets = [
    a.uid,
    A_FIRST,
    `${A_FIRST} ${A_INITIAL}.`,
    A_EMAIL,
    'anon.zephyrine',
    String(A_YEAR),
    `’${String(A_YEAR).slice(-2)}`,
  ];

  // Legacy content: written by A, then stored as anonymous, as it was before the change.
  thread = await post(a, spaces['middle-school']!, {
    title: 'Quokka question about asking for help',
    body: 'I am new this year and do not know who to ask.',
  });
  await makeLegacyAnonymous(`posts/${thread.postId}`);
  reply = await comment(a, thread.postId, { body: 'Adding a quokka detail to my own thread.' });
  await makeLegacyAnonymous(`posts/${thread.postId}/comments/${reply.commentId}`);
  await comment(b, thread.postId, { body: 'A named reply from someone else.' });
  await waitFor(
    async () => (await adminDb.doc(`posts/${thread.postId}`).get()).data()!.commentCount,
    (n) => n === 2,
    'comments to be counted',
  );
});
afterAll(closeAll);

describe('anonymous posting is refused', () => {
  it('createPost refuses identityMode "anonymous" and writes nothing', async () => {
    await refill(a);
    const before = (await adminDb.collection('posts').get()).size;
    for (const kind of [
      { kind: 'text', body: 'Trying to hide my name.' },
      { kind: 'link', url: 'https://example.org/story' },
      { kind: 'poll', options: ['Yes', 'No'] },
    ]) {
      const message = await expectError(
        a.call('createPost', {
          spaceId: spaces['clubs'],
          identityMode: 'anonymous',
          title: 'An attempt at an anonymous post',
          ...kind,
        }),
        'invalid-argument',
      );
      expect(message).toMatch(/under your name/);
    }
    expect((await adminDb.collection('posts').get()).size).toBe(before);
    const authorship = await adminDb.collection('authorship').get();
    expect(authorship.docs.filter((d) => d.data().authorUid === a.uid)).toHaveLength(2);
  });

  it('createComment refuses identityMode "anonymous" and writes nothing', async () => {
    await refill(a);
    const message = await expectError(
      a.call('createComment', {
        postId: thread.postId,
        parentId: null,
        identityMode: 'anonymous',
        body: 'An attempt at an anonymous comment.',
      }),
      'invalid-argument',
    );
    expect(message).toMatch(/under your name/);
    const comments = await adminDb.collection(`posts/${thread.postId}/comments`).get();
    expect(comments.size).toBe(2);
  });

  it('nothing new is written to the old per-thread letters', async () => {
    await post(a, spaces['clubs']!, { title: 'A named post after the change' });
    expect((await adminDb.collection('threadAnon').get()).size).toBe(0);
  });
});

describe('legacy anonymous content: what student B can fetch contains no trace of A', () => {
  it('the post document', async () => {
    const snap = await getDoc(doc(b.db, `posts/${thread.postId}`));
    expect(snap.exists()).toBe(true);
    expect(snap.data()!.authorDisplay).toEqual({ mode: 'anonymous', anonLabel: 'Anonymous A' });
    assertNoTrace('post document', { id: snap.id, data: snap.data() });
  });

  it('the thread: every comment', async () => {
    const snap = await getDocs(
      query(
        collection(b.db, `posts/${thread.postId}/comments`),
        where('status', '==', 'visible'),
        orderBy('createdAt', 'asc'),
      ),
    );
    expect(snap.size).toBe(2);
    const mine = snap.docs.find((d) => d.id === reply.commentId)!;
    expect(mine.data().authorDisplay).toEqual({ mode: 'anonymous', anonLabel: 'Anonymous A' });
    assertNoTrace('anonymous comment', { id: mine.id, data: mine.data() });
    // Nothing in the whole thread carries A's uid, even next to a named comment.
    expect(allStrings(snap.docs.map((d) => d.data())).join(' | ')).not.toContain(a.uid);
  });

  it('the feed, in every sort order', async () => {
    const base = [where('status', '==', 'visible')];
    const queries = [
      query(
        collection(b.db, 'posts'),
        ...base,
        orderBy('pinned', 'desc'),
        orderBy('hotScore', 'desc'),
        limit(20),
      ),
      query(
        collection(b.db, 'posts'),
        ...base,
        orderBy('pinned', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
      query(
        collection(b.db, 'posts'),
        where('spaceId', '==', spaces['middle-school']),
        ...base,
        orderBy('pinned', 'desc'),
        orderBy('hotScore', 'desc'),
        limit(20),
      ),
    ];
    for (const q of queries) {
      const snap = await getDocs(q);
      const row = snap.docs.find((d) => d.id === thread.postId);
      expect(row, 'the anonymous post should be in the feed').toBeTruthy();
      assertNoTrace('feed row', { id: row!.id, data: row!.data() });
    }
  });

  it('search finds the post by its words and never by its author', async () => {
    const find = async (text: string) =>
      getDocs(
        query(
          collection(b.db, 'posts'),
          where('searchTokens', 'array-contains-any', queryTokens(text)),
          where('status', '==', 'visible'),
          orderBy('hotScore', 'desc'),
          limit(20),
        ),
      );
    const byWord = await find('quokka');
    const row = byWord.docs.find((d) => d.id === thread.postId);
    expect(row).toBeTruthy();
    assertNoTrace('search result', { id: row!.id, data: row!.data() });
    // Searching for A's name, email or class year finds nothing: authorship is never indexed.
    for (const text of [A_FIRST, 'zephyrine', 'anon.zephyrine@nobles.edu', String(A_YEAR)]) {
      const snap = await find(text);
      expect(
        snap.docs.some((d) => d.id === thread.postId),
        `search for "${text}"`,
      ).toBe(false);
    }
  });

  it('the hall screen feed, after a moderator approves the anonymous reply for it', async () => {
    await moderator.call('modAction', { contentKey: thread.contentKey, action: 'approveForBoard' });
    await moderator.call('modAction', { contentKey: reply.contentKey, action: 'approveForBoard' });
    const board = await waitFor(
      async () => (await getDoc(doc(b.db, 'boardFeed/current'))).data() ?? {},
      (feed) => feed.questionPostId === thread.postId && (feed.approvedReplies ?? []).length === 1,
      'the hall screen feed to show the approved reply',
    );
    expect(board.approvedReplies[0]).toEqual({
      displayName: 'Anonymous',
      anonymous: true,
      text: 'Adding a quokka detail to my own thread.',
    });
    assertNoTrace('hall screen feed', board);
    // The public document holds no uid of anyone.
    for (const uid of [a.uid, b.uid, moderator.uid]) {
      expect(allStrings(board).join(' | ')).not.toContain(uid);
    }
  });

  it('every function response B can get about the thread', async () => {
    await refill(b);
    const responses: Record<string, unknown> = {};
    responses.createComment = await b.call('createComment', {
      postId: thread.postId,
      parentId: reply.commentId,
      identityMode: 'named',
      body: 'Replying directly to the anonymous comment.',
    });
    responses.toggleThoughtful = await b.call('toggleThoughtful', { contentKey: reply.contentKey });
    responses.toggleThoughtfulPost = await b.call('toggleThoughtful', { contentKey: thread.contentKey });
    responses.reportContent = await b.call('reportContent', {
      contentKey: reply.contentKey,
      reason: 'other',
    });
    responses.requestSummary = await b.call('requestSummary', { postId: thread.postId });
    responses.listMyContent = await b.call('listMyContent', {});
    responses.exportMyData = await b.call('exportMyData', {});
    for (const [name, value] of Object.entries(responses)) assertNoTrace(`${name} response`, value);
  });

  it('error messages give nothing away either', async () => {
    const messages = [
      await expectError(
        b.call('editOwnContent', { contentKey: thread.contentKey, body: 'Mine now' }),
        'permission-denied',
      ),
      await expectError(b.call('deleteOwnContent', { contentKey: reply.contentKey }), 'permission-denied'),
      await expectError(b.call('getMyContentStatus', { contentKey: thread.contentKey }), 'permission-denied'),
      await expectError(
        b.call('revealAuthor', { contentKey: thread.contentKey, reason: 'I would really like to know' }),
        'permission-denied',
      ),
    ];
    assertNoTrace('error messages', messages);
  });

  it('a moderator sees the queue and the content, and still no author', async () => {
    const queue = await getDocs(collection(moderator.db, 'moderationQueue'));
    assertNoTrace(
      'moderation queue',
      queue.docs.map((d) => d.data()),
    );
    const reports = await getDocs(collection(moderator.db, 'reports'));
    assertNoTrace(
      'reports',
      reports.docs.map((d) => d.data()),
    );
    await expect(getDoc(doc(moderator.db, `authorship/${thread.contentKey}`))).rejects.toBeTruthy();
    await expect(getDoc(doc(moderator.db, `users/${a.uid}`))).rejects.toBeTruthy();
  });
});

describe('the places that do know the author are closed to B', () => {
  it('authorship, votes and profiles cannot be read', async () => {
    await expect(getDoc(doc(b.db, `authorship/${thread.contentKey}`))).rejects.toBeTruthy();
    await expect(getDoc(doc(b.db, `authorship/${reply.contentKey}`))).rejects.toBeTruthy();
    await expect(getDocs(collection(b.db, 'authorship'))).rejects.toBeTruthy();
    await expect(getDoc(doc(b.db, `users/${a.uid}`))).rejects.toBeTruthy();
    await expect(
      getDocs(query(collection(b.db, 'users'), where('email', '==', A_EMAIL))),
    ).rejects.toBeTruthy();
    await expect(
      getDocs(query(collectionGroup(b.db, 'by'), where('postId', '==', thread.postId))),
    ).rejects.toBeTruthy();
    await expect(getDoc(doc(b.db, `rateLimits/${a.uid}`))).rejects.toBeTruthy();
  });
});

describe('the administration can always see, and it is logged', () => {
  it('reveals the legacy anonymous author to an admin and writes the audit entry', async () => {
    const admin = await member('sample.admin@nobles.edu');
    const result = await admin.call<{ author: { email: string; displayName: string; classYear: number } }>(
      'revealAuthor',
      {
        contentKey: thread.contentKey,
        reason: 'End-to-end check of the reveal flow',
      },
    );
    expect(result.author).toMatchObject({
      email: A_EMAIL,
      displayName: `${A_FIRST} ${A_INITIAL}.`,
      classYear: A_YEAR,
    });
    const audit = await adminDb
      .collection('auditLog')
      .where('contentKey', '==', thread.contentKey)
      .where('action', '==', 'revealAuthor')
      .get();
    expect(audit.size).toBe(1);
    // A still sees their own legacy anonymous posts in "my content".
    const mine = await a.call<{ items: { contentKey: string; identityMode: string }[] }>('listMyContent', {});
    const item = mine.items.find((i) => i.contentKey === thread.contentKey);
    expect(item?.identityMode).toBe('anonymous');
  });
});
