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
  screened,
  seedSpaces,
  waitFor,
  type Persona,
} from './helpers';

let spaces: Record<string, string>;
let student: Persona;
let other: Persona;
let moderator: Persona;
let admin: Persona;

beforeAll(async () => {
  await resetEmulators();
  spaces = await seedSpaces();
  await assignRoles({ 'mod.sample@nobles.edu': 'moderator' });
  student = await member('mod.student@nobles.edu', {
    firstName: 'Studentsample',
    lastInitial: 'A',
    classYear: 2029,
  });
  other = await member('mod.other@nobles.edu', { firstName: 'Othersample', lastInitial: 'B' });
  moderator = await member('mod.sample@nobles.edu', { firstName: 'Modsample', lastInitial: 'M' });
  admin = await member('sample.admin@nobles.edu', { firstName: 'Adminsample', lastInitial: 'Z' });
});
afterAll(closeAll);

const queueFor = async (contentKey: string) =>
  (await adminDb.collection('moderationQueue').where('contentKey', '==', contentKey).get()).docs.map((d) =>
    d.data(),
  );
const auditFor = async (contentKey: string) =>
  (await adminDb.collection('auditLog').where('contentKey', '==', contentKey).get()).docs.map((d) =>
    d.data(),
  );

describe('votes', () => {
  it('marks a thread thoughtful once per person, and takes it back', async () => {
    const thread = await post(student, spaces['clubs']!, { title: 'Vote on this thread' });
    const count = async () => (await adminDb.doc(`posts/${thread.postId}`).get()).data()!.thoughtfulCount;

    expect(await other.call('toggleThoughtful', { contentKey: thread.contentKey })).toEqual({
      thoughtful: true,
    });
    expect(await count()).toBe(1);
    expect(await student.call('toggleThoughtful', { contentKey: thread.contentKey })).toEqual({
      thoughtful: true,
    });
    expect(await count()).toBe(2);
    // The same person again takes their mark back: one per person, never two.
    expect(await other.call('toggleThoughtful', { contentKey: thread.contentKey })).toEqual({
      thoughtful: false,
    });
    expect(await count()).toBe(1);
    expect(await student.call('toggleThoughtful', { contentKey: thread.contentKey })).toEqual({
      thoughtful: false,
    });
    expect(await count()).toBe(0);

    // The trigger recounts from the vote documents and agrees, and the score never goes negative.
    const settled = await waitFor(
      async () => (await adminDb.doc(`posts/${thread.postId}`).get()).data()!,
      (p) => p.thoughtfulCount === 0,
      'vote count to settle',
    );
    expect(settled.thoughtfulCount).toBeGreaterThanOrEqual(0);
    expect((await adminDb.collection(`votes/${thread.postId}/by`).get()).size).toBe(0);
  });

  it('marks comments thoughtful too', async () => {
    const thread = await post(student, spaces['clubs']!, { title: 'Vote on a comment' });
    const reply = await comment(other, thread.postId, { body: 'A thoughtful comment' });
    await student.call('toggleThoughtful', { contentKey: reply.contentKey });
    const data = (await adminDb.doc(`posts/${thread.postId}/comments/${reply.commentId}`).get()).data()!;
    expect(data.thoughtfulCount).toBe(1);
    const vote = (
      await adminDb.doc(`votes/${thread.postId}/comments/${reply.commentId}/by/${student.uid}`).get()
    ).data()!;
    expect(vote).toMatchObject({ uid: student.uid, postId: thread.postId, kind: 'comment' });
  });

  it('refuses votes on content that is missing or not visible', async () => {
    await expectError(student.call('toggleThoughtful', { contentKey: 'post:missingPost' }), 'not-found');
    await expectError(student.call('toggleThoughtful', { contentKey: 'nonsense' }), 'invalid-argument');
    const held = await post(other, spaces['clubs']!, { title: 'This one gets held [mock:hold]' });
    await expectError(student.call('toggleThoughtful', { contentKey: held.contentKey }), 'not-found');
  });

  it('counts one poll vote per person and lets them change it', async () => {
    const poll = await post(student, spaces['current-events']!, {
      kind: 'poll',
      title: 'Later start to the day?',
      options: ['Yes', 'No'],
      body: undefined,
    });
    const options = async () => (await adminDb.doc(`posts/${poll.postId}`).get()).data()!.poll.options;
    await other.call('votePoll', { postId: poll.postId, optionId: 'o1' });
    await student.call('votePoll', { postId: poll.postId, optionId: 'o1' });
    expect((await options()).map((o: { count: number }) => o.count)).toEqual([2, 0]);
    await other.call('votePoll', { postId: poll.postId, optionId: 'o1' });
    expect((await options()).map((o: { count: number }) => o.count)).toEqual([2, 0]);
    await other.call('votePoll', { postId: poll.postId, optionId: 'o2' });
    expect((await options()).map((o: { count: number }) => o.count)).toEqual([1, 1]);
    await expectError(other.call('votePoll', { postId: poll.postId, optionId: 'o9' }), 'invalid-argument');
    const notAPoll = await post(student, spaces['clubs']!, { title: 'Not a poll at all' });
    await expectError(other.call('votePoll', { postId: notAPoll.postId, optionId: 'o1' }), 'not-found');
  });
});

describe('screening', () => {
  it('publishes ordinary posts', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'An ordinary, friendly post' });
    const data = (await adminDb.doc(`posts/${created.postId}`).get()).data()!;
    expect(data).toMatchObject({ status: 'visible', screening: 'clear' });
    expect(await queueFor(created.contentKey)).toEqual([]);
  });

  it('holds medium-risk posts for a moderator and tells the author', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'A post the screen flags [mock:hold]' });
    const data = (await adminDb.doc(`posts/${created.postId}`).get()).data()!;
    expect(data).toMatchObject({ status: 'held', screening: 'flagged' });
    const [item] = await queueFor(created.contentKey);
    expect(item).toMatchObject({ reason: 'ai-flag', priority: 1, status: 'open', labels: ['harassment'] });
    expect(await student.call('getMyContentStatus', { contentKey: created.contentKey })).toEqual({
      outcome: 'held',
    });
  });

  it('never publishes or deletes a wellbeing flag: it goes to the top of the queue and the school is emailed', async () => {
    const before = (await adminDb.collection('mail').get()).size;
    const created = await post(student, spaces['clubs']!, {
      title: 'I need to tell someone something',
      body: 'Some days I want to hurt myself.',
    });
    const data = (await adminDb.doc(`posts/${created.postId}`).get()).data()!;
    expect(data).toMatchObject({ status: 'held', screening: 'wellbeing' });
    expect(data.body).toBe('Some days I want to hurt myself.');

    const [item] = await queueFor(created.contentKey);
    expect(item).toMatchObject({ reason: 'wellbeing', priority: 2, status: 'open' });
    // The queue shows what was written, never who wrote it.
    expect(allStrings(item).join(' | ')).not.toContain(student.uid);
    expect(allStrings(item).join(' | ')).not.toContain('Studentsample');

    const mail = await waitFor(
      async () => (await adminDb.collection('mail').get()).docs.map((d) => d.data()),
      (docs) => docs.length === before + 1,
      'the wellbeing email to be queued',
    );
    const message = mail.find((m) => m.postId === created.postId)!;
    expect(message.to).toEqual(['sample.wellbeing@nobles.edu']);
    // The email says "please look"; it carries no student text and no author.
    expect(JSON.stringify(message)).not.toContain('hurt myself');
    expect(JSON.stringify(message)).not.toContain(student.uid);

    const status = await student.call<{ outcome: string; resources: { message: string; items: unknown[] } }>(
      'getMyContentStatus',
      { contentKey: created.contentKey },
    );
    expect(status.outcome).toBe('wellbeing');
    expect(status.resources.message).toMatch(/not in trouble/);
    expect(status.resources.items.length).toBeGreaterThan(0);
  });

  it('still catches the clearest safety signals when the model is down, and publishes everything else', async () => {
    const worrying = await post(student, spaces['clubs']!, {
      title: 'The model is down for this one [mock:down]',
      body: 'I have been thinking about suicide.',
    });
    expect((await adminDb.doc(`posts/${worrying.postId}`).get()).data()).toMatchObject({
      status: 'held',
      screening: 'wellbeing',
    });
    const fine = await post(student, spaces['clubs']!, {
      title: 'The model is down but this is fine [mock:down]',
    });
    expect((await adminDb.doc(`posts/${fine.postId}`).get()).data()).toMatchObject({
      status: 'visible',
      screening: 'skipped',
    });
    const malformed = await post(student, spaces['clubs']!, {
      title: 'The model answers nonsense [mock:malformed]',
    });
    expect((await adminDb.doc(`posts/${malformed.postId}`).get()).data()).toMatchObject({
      status: 'visible',
      screening: 'skipped',
    });
  });

  it('screens comments the same way', async () => {
    const thread = await post(student, spaces['clubs']!, { title: 'A thread with a flagged comment' });
    const flagged = await comment(other, thread.postId, { body: 'This comment gets flagged [mock:hold]' });
    const data = (await adminDb.doc(`posts/${thread.postId}/comments/${flagged.commentId}`).get()).data()!;
    expect(data).toMatchObject({ status: 'held', screening: 'flagged' });
    expect((await adminDb.doc(`posts/${thread.postId}`).get()).data()!.commentCount).toBe(0);
  });
});

describe('reports', () => {
  it('puts a reported post in the queue, once per reporter', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'A post somebody reports' });
    expect(
      await other.call('reportContent', {
        contentKey: created.contentKey,
        reason: 'unkind',
        note: 'Feels mean',
      }),
    ).toEqual({ received: true });
    await other.call('reportContent', { contentKey: created.contentKey, reason: 'spam' });
    const reports = await adminDb.collection('reports').where('contentKey', '==', created.contentKey).get();
    expect(reports.size).toBe(1);
    const [item] = await queueFor(created.contentKey);
    expect(item).toMatchObject({ reason: 'reported', priority: 1, status: 'open' });
    expect(item!.snapshotText).toContain('A post somebody reports');
  });

  it('treats "I am worried about someone’s safety" as a wellbeing flag', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'A post a friend is worried about' });
    await other.call('reportContent', { contentKey: created.contentKey, reason: 'safety' });
    const [item] = await queueFor(created.contentKey);
    expect(item).toMatchObject({ reason: 'wellbeing', priority: 2 });
    // A worried report does not hide the post by itself. A person decides.
    expect((await adminDb.doc(`posts/${created.postId}`).get()).data()!.status).toBe('visible');
  });

  it('rejects unknown reasons and missing content, and limits reports to 10 an hour', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'Report validation' });
    await expectError(
      other.call('reportContent', { contentKey: created.contentKey, reason: 'dislike' }),
      'invalid-argument',
    );
    await expectError(
      other.call('reportContent', { contentKey: 'post:missingPost', reason: 'spam' }),
      'not-found',
    );
    await refill(other);
    for (let i = 0; i < 10; i++)
      await other.call('reportContent', { contentKey: created.contentKey, reason: 'spam' });
    await expectError(
      other.call('reportContent', { contentKey: created.contentKey, reason: 'spam' }),
      'resource-exhausted',
    );
  });
});

describe('moderator actions', () => {
  it('students and faculty cannot moderate', async () => {
    const created = await post(other, spaces['clubs']!, { title: 'Students cannot moderate this' });
    for (const action of ['hold', 'remove', 'restore', 'pin', 'approveForBoard']) {
      await expectError(
        student.call('modAction', { contentKey: created.contentKey, action }),
        'permission-denied',
      );
    }
    await expectError(student.call('resolveReport', { id: 'x', kind: 'report' }), 'permission-denied');
  });

  it('a moderator can hold, restore, remove and pin, and each action is logged', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'A post for the moderator' });
    const status = async () => (await adminDb.doc(`posts/${created.postId}`).get()).data()!;

    await moderator.call('modAction', {
      contentKey: created.contentKey,
      action: 'hold',
      note: 'Checking this',
    });
    expect(await status()).toMatchObject({ status: 'held', screening: 'flagged' });
    await moderator.call('modAction', {
      contentKey: created.contentKey,
      action: 'restore',
      note: 'It is fine',
    });
    expect(await status()).toMatchObject({ status: 'visible', screening: 'clear' });
    await moderator.call('modAction', { contentKey: created.contentKey, action: 'pin' });
    expect(await status()).toMatchObject({ pinned: true, pinnedBy: 'administration' });
    await moderator.call('modAction', { contentKey: created.contentKey, action: 'unpin' });
    expect((await status()).pinned).toBe(false);
    await moderator.call('modAction', {
      contentKey: created.contentKey,
      action: 'remove',
      note: 'Breaks rule 2',
    });
    expect(await status()).toMatchObject({ status: 'removed', removedBy: 'moderator' });

    const actions = (await auditFor(created.contentKey)).map((e) => e.action).sort();
    expect(actions).toEqual(['hold', 'pin', 'remove', 'restore', 'unpin']);
    expect((await auditFor(created.contentKey)).every((e) => e.actorUid === moderator.uid)).toBe(true);
    // The authorship record survives removal.
    expect((await adminDb.doc(`authorship/${created.contentKey}`).get()).exists).toBe(true);
  });

  it('moderating closes the queue item, and returns nothing about the author', async () => {
    const created = await post(student, spaces['clubs']!, {
      title: 'A post that is held [mock:hold]',
    });
    const result = await moderator.call<Record<string, unknown>>('modAction', {
      contentKey: created.contentKey,
      action: 'restore',
      note: 'False alarm',
    });
    expect(Object.keys(result).sort()).toEqual(['action', 'contentKey']);
    expect(JSON.stringify(result)).not.toContain(student.uid);
    const [item] = await queueFor(created.contentKey);
    expect(item).toMatchObject({ status: 'resolved', resolvedBy: moderator.uid });
    expect((await adminDb.doc(`posts/${created.postId}`).get()).data()!.status).toBe('visible');
  });

  it('a moderator can resolve a report', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'A report to resolve' });
    await refill(other);
    await other.call('reportContent', { contentKey: created.contentKey, reason: 'other' });
    const queue = await adminDb
      .collection('moderationQueue')
      .where('contentKey', '==', created.contentKey)
      .get();
    await moderator.call('resolveReport', { id: queue.docs[0]!.id, kind: 'queue', note: 'Nothing wrong' });
    expect((await queue.docs[0]!.ref.get()).data()!.status).toBe('resolved');
    const reports = await adminDb.collection('reports').where('contentKey', '==', created.contentKey).get();
    expect(reports.docs.every((d) => d.data().status === 'resolved')).toBe(true);
  });

  it('only threads can be pinned', async () => {
    const thread = await post(student, spaces['clubs']!, { title: 'Pin rules' });
    const reply = await comment(other, thread.postId);
    await expectError(
      moderator.call('modAction', { contentKey: reply.contentKey, action: 'pin' }),
      'invalid-argument',
    );
    await expectError(
      moderator.call('modAction', { contentKey: 'post:missingPost', action: 'hold' }),
      'not-found',
    );
  });
});

describe('other admin functions', () => {
  it('exports the audit log to admins only, and logs the export', async () => {
    await expectError(moderator.call('exportAuditLog', {}), 'permission-denied');
    const exported = await admin.call<{ entries: { action: string }[] }>('exportAuditLog', { limit: 50 });
    expect(exported.entries.length).toBeGreaterThan(0);
    const logged = await adminDb.collection('auditLog').where('action', '==', 'exportAuditLog').get();
    expect(logged.size).toBeGreaterThan(0);
  });

  it('lets an admin add and change a space', async () => {
    const created = await admin.call<{ spaceId: string }>('manageSpace', {
      action: 'create',
      slug: 'robotics',
      name: 'Robotics',
      description: 'Build season and beyond.',
      order: 20,
      postingRoles: ['student', 'faculty', 'moderator', 'admin'],
    });
    expect((await adminDb.doc(`spaces/${created.spaceId}`).get()).data()).toMatchObject({
      slug: 'robotics',
      postCount: 0,
    });
    await expectError(
      admin.call('manageSpace', {
        action: 'create',
        slug: 'robotics',
        name: 'Again',
        description: '',
        order: 1,
        postingRoles: ['admin'],
      }),
      'already-exists',
    );
    await admin.call('manageSpace', {
      action: 'update',
      slug: 'robotics',
      name: 'Robotics team',
      description: 'New words.',
      order: 21,
      postingRoles: ['student', 'admin'],
    });
    expect((await adminDb.doc(`spaces/${created.spaceId}`).get()).data()!.name).toBe('Robotics team');
    await expectError(
      moderator.call('manageSpace', {
        action: 'create',
        slug: 'mods',
        name: 'Mods',
        description: '',
        order: 1,
        postingRoles: ['admin'],
      }),
      'permission-denied',
    );
  });

  it('keeps a count of visible threads on each space', async () => {
    const before = (await adminDb.doc(`spaces/${spaces['athletics']}`).get()).data()!.postCount;
    const created = await post(student, spaces['athletics']!, { title: 'Counting threads in a space' });
    await waitFor(
      async () => (await adminDb.doc(`spaces/${spaces['athletics']}`).get()).data()!.postCount,
      (count) => count === before + 1,
      'space count to go up',
    );
    await moderator.call('modAction', { contentKey: created.contentKey, action: 'remove' });
    await waitFor(
      async () => (await adminDb.doc(`spaces/${spaces['athletics']}`).get()).data()!.postCount,
      (count) => count === before,
      'space count to go back down',
    );
  });

  it('saves settings, and refuses to export training data', async () => {
    await admin.call('updateConfig', { doc: 'ai', bannedTopics: ['college admissions results'] });
    expect((await adminDb.doc('config/ai').get()).data()!.bannedTopics).toEqual([
      'college admissions results',
    ]);
    await expectError(student.call('updateConfig', { doc: 'ai', bannedTopics: [] }), 'permission-denied');
    const message = await expectError(admin.call('exportTrainingData', {}), 'failed-precondition');
    expect(message).toMatch(/switched off/);
  });

  it('screened() helper sees edits re-screened into a hold', async () => {
    const created = await post(student, spaces['clubs']!, { title: 'Fine at first', body: 'Nothing to see' });
    await student.call('editOwnContent', {
      contentKey: created.contentKey,
      body: 'Now it is not fine [mock:hold]',
    });
    const data = await waitFor(
      async () => (await adminDb.doc(`posts/${created.postId}`).get()).data()!,
      (p) => p.screening === 'flagged',
      'the edit to be held',
    );
    expect(data.status).toBe('held');
    expect(await screened(`posts/${created.postId}`)).toBeTruthy();
  });
});
