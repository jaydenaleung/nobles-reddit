import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminDb,
  allStrings,
  closeAll,
  comment,
  expectError,
  member,
  post,
  refill,
  resetEmulators,
  screened,
  seedSpaces,
  waitFor,
  type Persona,
} from './helpers';

let spaces: Record<string, string>;
let priya: Persona;
let dev: Persona;

beforeAll(async () => {
  await resetEmulators();
  spaces = await seedSpaces();
  priya = await member('content.priya@nobles.edu', { firstName: 'Priyasample', lastInitial: 'N', classYear: 2027 });
  dev = await member('content.dev@nobles.edu', { firstName: 'Devsample', lastInitial: 'S', classYear: 2028 });
});
afterAll(closeAll);

describe('createPost', () => {
  it('publishes a named post with the name, class year and role the author chose to show', async () => {
    const created = await post(priya, spaces['school-news']!, { title: 'Named thread about lunch' });
    const data = (await adminDb.doc(`posts/${created.postId}`).get()).data()!;
    expect(data.status).toBe('visible');
    expect(data.authorDisplay).toEqual({ mode: 'named', name: 'Priyasample N.', classYear: 2027, role: 'student' });
    expect(data.spaceName).toBe('School news');
    expect(data.searchTokens).toContain('lunch');
    expect(data.thoughtfulCount).toBe(0);
    expect(typeof data.hotScore).toBe('number');
  });

  it('stores an anonymous post with a label and nothing else about the author', async () => {
    const created = await post(priya, spaces['middle-school']!, { identityMode: 'anonymous', title: 'Anonymous thread' });
    const data = (await adminDb.doc(`posts/${created.postId}`).get()).data()!;
    expect(data.authorDisplay).toEqual({ mode: 'anonymous', anonLabel: 'Anonymous A' });
    const everything = allStrings(data).join(' | ');
    expect(everything).not.toContain(priya.uid);
    expect(everything).not.toContain('Priyasample');
    expect(everything).not.toContain('content.priya');
    expect(everything).not.toContain('2027');
  });

  it('never puts a uid on any post, named or anonymous, and never returns one', async () => {
    await refill(priya);
    const raw = await priya.call<Record<string, unknown>>('createPost', {
      spaceId: spaces['clubs'],
      kind: 'text',
      identityMode: 'named',
      title: 'What does the callable return?',
      body: '',
    });
    expect(Object.keys(raw).sort()).toEqual(['contentKey', 'postId']);
    expect(JSON.stringify(raw)).not.toContain(priya.uid);
    const data = await screened(`posts/${raw.postId}`);
    expect(allStrings(data).join(' | ')).not.toContain(priya.uid);
  });

  it('writes the authorship record in the same commit, with the same timestamp', async () => {
    const created = await post(priya, spaces['clubs']!, { identityMode: 'anonymous', title: 'Authorship timing check' });
    const [content, authorship] = await Promise.all([
      adminDb.doc(`posts/${created.postId}`).get(),
      adminDb.doc(`authorship/${created.contentKey}`).get(),
    ]);
    expect(authorship.data()!.authorUid).toBe(priya.uid);
    expect(authorship.data()!.createdAt.isEqual(content.data()!.createdAt)).toBe(true);
    expect(authorship.createTime!.isEqual(content.createTime!)).toBe(true);
    // The document id is random: it says nothing about who wrote it.
    expect(created.postId).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(created.postId).not.toContain(priya.uid.slice(0, 6));
  });

  it('creates link and poll posts', async () => {
    const link = await post(dev, spaces['school-news']!, {
      kind: 'link',
      title: 'An article worth reading',
      url: 'https://www.example.org/story?id=7',
      body: undefined,
    });
    const linkData = (await adminDb.doc(`posts/${link.postId}`).get()).data()!;
    expect(linkData.link).toEqual({ url: 'https://www.example.org/story?id=7', domain: 'example.org', source: 'other' });

    const poll = await post(dev, spaces['current-events']!, {
      kind: 'poll',
      title: 'Should lunch be longer?',
      options: ['Yes', 'Not sure', 'No'],
      body: undefined,
    });
    const pollData = (await adminDb.doc(`posts/${poll.postId}`).get()).data()!;
    expect(pollData.poll.options).toEqual([
      { id: 'o1', label: 'Yes', count: 0 },
      { id: 'o2', label: 'Not sure', count: 0 },
      { id: 'o3', label: 'No', count: 0 },
    ]);
  });

  it('rejects bad input with a plain message', async () => {
    const base = { spaceId: spaces['clubs'], kind: 'text', identityMode: 'named', title: 'A fine title', body: '' };
    expect(await expectError(priya.call('createPost', { ...base, title: 'Hey' }), 'invalid-argument')).toMatch(
      /at least 5/,
    );
    await expectError(priya.call('createPost', { ...base, body: 'x'.repeat(10_001) }), 'invalid-argument');
    await expectError(priya.call('createPost', { ...base, identityMode: undefined }), 'invalid-argument');
    await expectError(priya.call('createPost', { ...base, identityMode: 'secret' }), 'invalid-argument');
    await expectError(priya.call('createPost', { ...base, kind: 'link', url: 'http://example.org' }), 'invalid-argument');
    await expectError(
      priya.call('createPost', { ...base, kind: 'link', url: 'javascript:alert(1)' }),
      'invalid-argument',
    );
    await expectError(priya.call('createPost', { ...base, kind: 'poll', options: ['Only one'] }), 'invalid-argument');
    await expectError(priya.call('createPost', { ...base, authorUid: dev.uid }), 'invalid-argument');
    await expectError(priya.call('createPost', { ...base, status: 'visible' }), 'invalid-argument');
    await expectError(priya.call('createPost', { ...base, spaceId: 'doesNotExist' }), 'not-found');
    await expectError(priya.call('createPost', { ...base, body: 'x'.repeat(30_000) }), 'invalid-argument');
  });

  it('keeps people out of spaces they may not post in', async () => {
    const staffOnly = adminDb.collection('spaces').doc();
    await refill(priya);
    await staffOnly.set({ name: 'Staff notes', slug: 'staff-notes', description: '', order: 9, postingRoles: ['admin'], isPublic: true, postCount: 0 });
    await expectError(
      priya.call('createPost', { spaceId: staffOnly.id, kind: 'text', identityMode: 'named', title: 'Let me in please', body: '' }),
      'permission-denied',
    );
  });

  it('stores HTML as plain text, exactly as typed', async () => {
    const created = await post(dev, spaces['clubs']!, {
      title: '<script>alert(1)</script> is just text',
      body: '<img src=x onerror=alert(1)>',
    });
    const data = (await adminDb.doc(`posts/${created.postId}`).get()).data()!;
    expect(data.title).toBe('<script>alert(1)</script> is just text');
    expect(data.body).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('createComment', () => {
  it('adds comments, counts them and tracks how many are anonymous', async () => {
    const thread = await post(priya, spaces['clubs']!, { title: 'A thread to comment on' });
    const first = await comment(dev, thread.postId, { body: 'First comment' });
    await comment(priya, thread.postId, { identityMode: 'anonymous', body: 'Second, anonymous' });
    const firstData = (await adminDb.doc(`posts/${thread.postId}/comments/${first.commentId}`).get()).data()!;
    expect(firstData).toMatchObject({ depth: 0, parentId: null, status: 'visible' });
    expect(firstData.authorDisplay).toEqual({ mode: 'named', name: 'Devsample S.', classYear: 2028, role: 'student' });
    const counted = await waitFor(
      async () => (await adminDb.doc(`posts/${thread.postId}`).get()).data()!,
      (p) => p.commentCount === 2,
      'comment count',
    );
    expect(counted.anonCommentCount).toBe(1);
    expect(counted.hotScore).toBeGreaterThan(0);
  });

  it('gives each anonymous author a stable letter within a thread', async () => {
    const thread = await post(priya, spaces['clubs']!, { identityMode: 'anonymous', title: 'Letters in a thread' });
    const label = async (id: string) =>
      (await adminDb.doc(`posts/${thread.postId}/comments/${id}`).get()).data()!.authorDisplay.anonLabel;
    const d1 = await comment(dev, thread.postId, { identityMode: 'anonymous', body: 'Dev, anonymous, first' });
    const p1 = await comment(priya, thread.postId, { identityMode: 'anonymous', body: 'Original poster replies' });
    const d2 = await comment(dev, thread.postId, { identityMode: 'anonymous', body: 'Dev, anonymous, again' });
    // The original poster is A in their own thread and stays A; Dev is B both times.
    expect(await label(p1.commentId)).toBe('Anonymous A');
    expect(await label(d1.commentId)).toBe('Anonymous B');
    expect(await label(d2.commentId)).toBe('Anonymous B');

    // In another thread the letters start again, so they cannot be linked across threads.
    const other = await post(dev, spaces['clubs']!, { title: 'A different thread' });
    const p2 = await comment(priya, other.postId, { identityMode: 'anonymous', body: 'Priya elsewhere' });
    expect(
      (await adminDb.doc(`posts/${other.postId}/comments/${p2.commentId}`).get()).data()!.authorDisplay.anonLabel,
    ).toBe('Anonymous A');
  });

  it('nests replies up to the depth limit and no further', async () => {
    const thread = await post(priya, spaces['clubs']!, { title: 'How deep can replies go?' });
    let parentId: string | null = null;
    for (let depth = 0; depth <= 4; depth++) {
      const created = await comment(dev, thread.postId, { parentId, body: `Depth ${depth}` });
      const data = (await adminDb.doc(`posts/${thread.postId}/comments/${created.commentId}`).get()).data()!;
      expect(data.depth).toBe(depth);
      parentId = created.commentId;
    }
    await expectError(
      dev.call('createComment', { postId: thread.postId, parentId, identityMode: 'named', body: 'Too deep' }),
      'invalid-argument',
    );
  });

  it('rejects comments on missing threads, missing parents and bad input', async () => {
    const thread = await post(priya, spaces['clubs']!, { title: 'Comment validation' });
    const base = { postId: thread.postId, parentId: null, identityMode: 'named', body: 'Hello' };
    await expectError(dev.call('createComment', { ...base, postId: 'missingPost' }), 'not-found');
    await expectError(dev.call('createComment', { ...base, parentId: 'missingParent' }), 'not-found');
    await expectError(dev.call('createComment', { ...base, body: '   ' }), 'invalid-argument');
    await expectError(dev.call('createComment', { ...base, body: 'x'.repeat(4001) }), 'invalid-argument');
    await expectError(dev.call('createComment', { ...base, identityMode: undefined }), 'invalid-argument');
  });
});

describe('editing and deleting your own content', () => {
  it('lets the author edit within 10 minutes, and screens the new text again', async () => {
    const created = await post(priya, spaces['clubs']!, { title: 'Before the edit', body: 'Old body' });
    await priya.call('editOwnContent', { contentKey: created.contentKey, title: 'After the edit', body: 'New body' });
    const data = await waitFor(
      async () => (await adminDb.doc(`posts/${created.postId}`).get()).data()!,
      (p) => p.screening !== 'pending' && p.title === 'After the edit',
      'edited post to be screened',
    );
    expect(data.body).toBe('New body');
    expect(data.status).toBe('visible');
    expect(data.editedAt).toBeTruthy();
    expect(data.searchTokens).toContain('edit');
  });

  it('refuses edits after the 10-minute window', async () => {
    const created = await post(priya, spaces['clubs']!, { title: 'Too old to edit' });
    const eleven = new Date(Date.now() - 11 * 60 * 1000);
    await adminDb.doc(`posts/${created.postId}`).update({ createdAt: eleven });
    const message = await expectError(
      priya.call('editOwnContent', { contentKey: created.contentKey, body: 'Late change' }),
      'failed-precondition',
    );
    expect(message).toMatch(/10 minutes/);
  });

  it('refuses to edit or delete somebody else’s content, with the same error for content that does not exist', async () => {
    const created = await post(priya, spaces['clubs']!, { identityMode: 'anonymous', title: 'Not yours to change' });
    const forOthers = await expectError(
      dev.call('editOwnContent', { contentKey: created.contentKey, body: 'Hijacked' }),
      'permission-denied',
    );
    const forMissing = await expectError(
      dev.call('editOwnContent', { contentKey: 'post:doesNotExist', body: 'Hijacked' }),
      'permission-denied',
    );
    // Same message either way, so the error cannot be used to probe who wrote what.
    expect(forOthers).toBe(forMissing);
    expect(forOthers).not.toContain(priya.uid);
    await expectError(dev.call('deleteOwnContent', { contentKey: created.contentKey }), 'permission-denied');
    await expectError(dev.call('getMyContentStatus', { contentKey: created.contentKey }), 'permission-denied');
  });

  it('soft-deletes: the content disappears and the authorship record stays', async () => {
    const thread = await post(priya, spaces['clubs']!, { title: 'A thread with a deleted comment' });
    const created = await comment(dev, thread.postId, { body: 'I will delete this' });
    await waitFor(
      async () => (await adminDb.doc(`posts/${thread.postId}`).get()).data()!.commentCount,
      (count) => count === 1,
      'count to reach 1',
    );
    await dev.call('deleteOwnContent', { contentKey: created.contentKey });
    const data = (await adminDb.doc(`posts/${thread.postId}/comments/${created.commentId}`).get()).data()!;
    expect(data.status).toBe('removed');
    expect(data.removedBy).toBe('author');
    expect((await adminDb.doc(`authorship/${created.contentKey}`).get()).exists).toBe(true);
    await waitFor(
      async () => (await adminDb.doc(`posts/${thread.postId}`).get()).data()!.commentCount,
      (count) => count === 0,
      'count to drop to 0',
    );
    expect(await dev.call('getMyContentStatus', { contentKey: created.contentKey })).toEqual({ outcome: 'removed' });
  });

  it('tells an author what happened to their post', async () => {
    const created = await post(priya, spaces['clubs']!, { title: 'Did my post go up?' });
    expect(await priya.call('getMyContentStatus', { contentKey: created.contentKey })).toEqual({ outcome: 'visible' });
  });
});

describe('rate limits', () => {
  it('allows 5 posts an hour and then says to wait', async () => {
    const eager = await member('content.eager@nobles.edu');
    const base = { spaceId: spaces['clubs'], kind: 'text', identityMode: 'named', body: '' };
    for (let i = 1; i <= 5; i++) {
      await eager.call('createPost', { ...base, title: `Eager post number ${i}` });
    }
    const message = await expectError(
      eager.call('createPost', { ...base, title: 'Eager post number 6' }),
      'resource-exhausted',
    );
    expect(message).toMatch(/Try again in about \d+ minute/);
    // The bucket refills: an hour later a post goes through again.
    await adminDb.doc(`rateLimits/${eager.uid}`).set(
      { buckets: { posts: { tokens: 0, updatedAtMs: Date.now() - 60 * 60 * 1000 } } },
      { merge: true },
    );
    await eager.call('createPost', { ...base, title: 'An hour later this works' });
  });
});
