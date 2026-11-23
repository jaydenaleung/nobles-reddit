import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminAuth,
  adminDb,
  assignRoles,
  closeAll,
  expectError,
  member,
  post,
  resetEmulators,
  seedSpaces,
  signIn,
} from './helpers';

let spaces: Record<string, string>;

beforeAll(async () => {
  await resetEmulators();
  spaces = await seedSpaces();
  await assignRoles({ 'sample.teacher@nobles.edu': 'faculty', 'sample.mod@nobles.edu': 'moderator' });
});
afterAll(closeAll);

const valid = { firstName: 'Sample', lastInitial: 's', classYear: 2028, understood: true };

describe('onboard', () => {
  it('turns a Nobles student into a member with the student role and a custom claim', async () => {
    const p = await signIn('onboard.student@nobles.edu');
    const result = await p.call<{ role: string; displayName: string }>('onboard', valid);
    expect(result).toEqual({ role: 'student', displayName: 'Sample S.' });
    const claims = (await adminAuth.getUser(p.uid)).customClaims;
    expect(claims).toEqual({ role: 'student' });
    const profile = (await adminDb.doc(`users/${p.uid}`).get()).data()!;
    expect(profile).toMatchObject({ email: 'onboard.student@nobles.edu', classYear: 2028, role: 'student' });
    // After a token refresh the member can read their own profile, and nothing before it.
    await p.refresh();
    expect((await getDoc(doc(p.db, `users/${p.uid}`))).exists()).toBe(true);
  });

  it('gives the role an admin assigned to that email, and no class year to faculty', async () => {
    const p = await signIn('sample.teacher@nobles.edu');
    const result = await p.call<{ role: string }>('onboard', valid);
    expect(result.role).toBe('faculty');
    expect((await adminDb.doc(`users/${p.uid}`).get()).data()!.classYear).toBeNull();
  });

  it('makes the bootstrap admin an admin', async () => {
    const p = await signIn('sample.admin@nobles.edu');
    expect((await p.call<{ role: string }>('onboard', valid)).role).toBe('admin');
  });

  it('cannot be used to choose your own role', async () => {
    const p = await signIn('sneaky.student@nobles.edu');
    await expectError(p.call('onboard', { ...valid, role: 'admin' }), 'invalid-argument');
  });

  it('is safe to call twice', async () => {
    const p = await signIn('twice.student@nobles.edu');
    await p.call('onboard', valid);
    const again = await p.call<{ role: string }>('onboard', { ...valid, firstName: 'Changed' });
    expect(again.role).toBe('student');
    expect((await adminDb.doc(`users/${p.uid}`).get()).data()!.firstName).toBe('Sample');
  });

  it('rejects an account from another domain, on the server', async () => {
    const p = await signIn('someone@example.com');
    const message = await expectError(p.call('onboard', valid), 'permission-denied');
    expect(message).toMatch(/nobles.edu accounts/);
    expect((await adminDb.doc(`users/${p.uid}`).get()).exists).toBe(false);
  });

  it('rejects a look-alike domain', async () => {
    const p = await signIn('someone@nobles.edu.example.com');
    await expectError(p.call('onboard', valid), 'permission-denied');
  });

  it('rejects an unverified email', async () => {
    const p = await signIn('unverified.student@nobles.edu', { verified: false });
    await expectError(p.call('onboard', valid), 'permission-denied');
  });

  it('rejects a class year outside the range, and a missing "I understand"', async () => {
    const p = await signIn('range.student@nobles.edu');
    await expectError(p.call('onboard', { ...valid, classYear: 2040 }), 'invalid-argument');
    await expectError(p.call('onboard', { ...valid, understood: false }), 'invalid-argument');
    await expectError(p.call('onboard', { firstName: 'Sample', lastInitial: 'S' }), 'invalid-argument');
  });
});

describe('every other function needs an onboarded member', () => {
  it('refuses someone who signed in but did not finish onboarding', async () => {
    const p = await signIn('not.onboarded@nobles.edu');
    await expectError(
      p.call('createPost', {
        spaceId: spaces['clubs'],
        kind: 'text',
        title: 'Hello there',
        body: '',
      }),
      'failed-precondition',
    );
    await expectError(p.call('listMyContent', {}), 'failed-precondition');
  });

  it('refuses another domain everywhere', async () => {
    const p = await signIn('outsider@example.com');
    for (const [name, data] of [
      ['createPost', { spaceId: spaces['clubs'], kind: 'text', title: 'Hello there', body: '' }],
      ['toggleThoughtful', { contentKey: 'post:abc' }],
      ['modAction', { contentKey: 'post:abc', action: 'remove' }],
      ['requestSummary', { postId: 'abc' }],
    ] as const) {
      await expectError(p.call(name, data), 'permission-denied');
    }
  });
});

describe('setRole', () => {
  it('lets an admin change a role, updates the claim at once and writes the audit log', async () => {
    const admin = await member('sample.admin@nobles.edu');
    const student = await member('promote.me@nobles.edu');
    const result = await admin.call<{ applied: boolean }>('setRole', {
      email: 'Promote.Me@nobles.edu',
      role: 'moderator',
      reason: 'Nominated by the dean',
    });
    expect(result.applied).toBe(true);
    expect((await adminAuth.getUser(student.uid)).customClaims).toEqual({ role: 'moderator' });
    expect((await adminDb.doc(`users/${student.uid}`).get()).data()!.role).toBe('moderator');
    const audit = await adminDb.collection('auditLog').where('action', '==', 'setRole').get();
    expect(audit.docs.some((d) => d.data().target === 'promote.me@nobles.edu')).toBe(true);
    // The new role works straight away, with no new sign-in.
    await expect(student.call('resolveReport', { id: 'missing', kind: 'report' })).rejects.toMatchObject({
      code: 'functions/not-found',
    });
  });

  it('remembers a role for someone who has not signed in yet', async () => {
    const admin = await member('sample.admin@nobles.edu');
    const result = await admin.call<{ applied: boolean }>('setRole', {
      email: 'future.teacher@nobles.edu',
      role: 'faculty',
      reason: 'New hire',
    });
    expect(result.applied).toBe(false);
    const later = await signIn('future.teacher@nobles.edu');
    expect((await later.call<{ role: string }>('onboard', valid)).role).toBe('faculty');
  });

  it('is refused for students and moderators', async () => {
    const student = await member('plain.student@nobles.edu');
    const mod = await member('sample.mod@nobles.edu');
    const input = { email: 'plain.student@nobles.edu', role: 'admin', reason: 'Because' };
    await expectError(student.call('setRole', input), 'permission-denied');
    await expectError(mod.call('setRole', input), 'permission-denied');
  });

  it('will not let an admin change their own role, or set a role outside the domain', async () => {
    const admin = await member('sample.admin@nobles.edu');
    await expectError(
      admin.call('setRole', { email: 'sample.admin@nobles.edu', role: 'student', reason: 'Oops' }),
      'failed-precondition',
    );
    await expectError(
      admin.call('setRole', { email: 'friend@example.com', role: 'moderator', reason: 'Friend' }),
      'invalid-argument',
    );
  });
});

describe('my data', () => {
  it('lists and exports only my own content', async () => {
    const me = await member('export.me@nobles.edu', { firstName: 'Exporta' });
    const other = await member('export.other@nobles.edu', { firstName: 'Otherly' });
    const mine = await post(me, spaces['clubs']!, { title: 'My own thread' });
    await post(other, spaces['clubs']!, { title: 'Somebody else wrote this' });

    const list = await me.call<{ items: { contentKey: string }[] }>('listMyContent', {});
    expect(list.items.map((i) => i.contentKey)).toEqual([mine.contentKey]);

    const exported = await me.call<{ profile: { email: string }; postsAndComments: unknown[] }>(
      'exportMyData',
      {},
    );
    expect(exported.profile.email).toBe('export.me@nobles.edu');
    expect(exported.postsAndComments).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain('Somebody else wrote this');
  });

  it('deleting an account relabels posts as Former member and keeps the authorship record', async () => {
    const leaver = await member('leaving.student@nobles.edu', { firstName: 'Leaver' });
    const named = await post(leaver, spaces['clubs']!, { title: 'A named thread before leaving' });
    const result = await leaver.call<{ deleted: boolean; renamed: number }>('deleteMyAccount', {});
    expect(result).toEqual({ deleted: true, renamed: 1 });

    const after = (await adminDb.doc(`posts/${named.postId}`).get()).data()!;
    expect(after.authorDisplay).toEqual({ name: 'Former member' });
    expect(JSON.stringify(after)).not.toContain('Leaver');
    // The record of who wrote it stays, as the school requires, and the page says so.
    expect((await adminDb.doc(`authorship/${named.contentKey}`).get()).data()!.authorUid).toBe(leaver.uid);
    expect((await adminDb.doc(`users/${leaver.uid}`).get()).data()!.deleted).toBe(true);
    await expect(adminAuth.getUser(leaver.uid)).rejects.toBeTruthy();
  });
});
