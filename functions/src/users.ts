import {
  FORMER_MEMBER_LABEL,
  emptySchema,
  formatDisplayName,
  onboardSchema,
  parseContentKey,
  contentPath,
  setRoleSchema,
  type MyContentItem,
  type OnboardResult,
  type Role,
  type UserProfile,
} from '@commons/shared';
import { FieldPath, FieldValue, auth, db } from './admin';
import { auditIn, auditNow } from './audit';
import { env, isAllowedEmail } from './env';
import { AppError, errors } from './errors';
import { ADMIN_ROLES, callable } from './guard';

/** The role an email should have: bootstrap admins, then the admin-managed list, then student. */
export async function roleForEmail(email: string): Promise<Role> {
  if (env.bootstrapAdmins.includes(email)) return 'admin';
  const snap = await db.doc('config/roles').get();
  const assigned = (snap.data()?.emailToRole ?? {}) as Record<string, Role>;
  return assigned[email] ?? 'student';
}

/**
 * First sign-in. Creates the private profile, assigns the role and sets the
 * `role` custom claim that the Firestore rules read. The email domain was
 * already checked on the server by the guard; other domains never get here.
 */
export const onboard = callable(
  { name: 'onboard', schema: onboardSchema, roles: 'onboarding' },
  async (data, caller): Promise<OnboardResult> => {
    const ref = db.doc(`users/${caller.uid}`);
    if (caller.profile && !caller.profile.deleted) {
      // Already onboarded: make sure the claim matches the profile, and stop.
      await auth.setCustomUserClaims(caller.uid, { role: caller.profile.role });
      await ref.update({ lastSeenAt: FieldValue.serverTimestamp() });
      return { role: caller.profile.role, displayName: caller.profile.displayName };
    }

    const role = await roleForEmail(caller.email);
    let classYear: number | null = data.classYear ?? null;
    if (role !== 'student') classYear = null;
    if (classYear !== null && (classYear < env.classYearMin || classYear > env.classYearMax)) {
      throw errors.invalid(`Class years run from ${env.classYearMin} to ${env.classYearMax}.`);
    }

    const profile = {
      email: caller.email,
      firstName: data.firstName,
      lastInitial: data.lastInitial.toUpperCase(),
      displayName: formatDisplayName(data.firstName, data.lastInitial),
      classYear,
      role,
      divisions: [...new Set(data.divisions ?? [])],
      agreedToGroundRulesAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    };
    await ref.set(profile);
    await auth.setCustomUserClaims(caller.uid, { role });
    return { role, displayName: profile.displayName };
  },
);

/** Admin only. Changes someone's role, now if they have an account and at first sign-in if not. */
export const setRole = callable(
  { name: 'setRole', schema: setRoleSchema, roles: ADMIN_ROLES, rate: 'admin' },
  async (data, caller): Promise<{ email: string; role: Role; applied: boolean }> => {
    if (!isAllowedEmail(data.email)) throw errors.invalid('That email is not in an allowed domain.');
    if (data.email === caller.email) {
      throw new AppError('failed-precondition', 'Ask another admin to change your own role.');
    }
    if (env.bootstrapAdmins.includes(data.email) && data.role !== 'admin') {
      throw new AppError(
        'failed-precondition',
        'That person is a bootstrap admin. Remove them from BOOTSTRAP_ADMIN_EMAILS first.',
      );
    }

    const existing = await db.collection('users').where('email', '==', data.email).limit(1).get();
    const userDoc = existing.docs.find((d) => !d.data().deleted);

    const batch = db.batch();
    const rolesRef = db.doc('config/roles');
    const path = new FieldPath('emailToRole', data.email);
    batch.set(rolesRef, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.update(rolesRef, path, data.role === 'student' ? FieldValue.delete() : data.role);
    if (userDoc) {
      batch.update(userDoc.ref, { role: data.role, ...(data.role === 'student' ? {} : { classYear: null }) });
    }
    auditIn(batch, {
      actorUid: caller.uid,
      actorEmail: caller.email,
      action: 'setRole',
      target: data.email,
      reason: `${data.role}: ${data.reason}`,
    });
    await batch.commit();
    if (userDoc) await auth.setCustomUserClaims(userDoc.id, { role: data.role });
    return { email: data.email, role: data.role, applied: !!userDoc };
  },
);

/** Every authorship record for one person, newest first. Server-side only. */
async function authoredKeys(uid: string, limit: number): Promise<string[]> {
  const snap = await db
    .collection('authorship')
    .where('authorUid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.id);
}

async function loadMyContent(uid: string, limit: number): Promise<MyContentItem[]> {
  const keys = await authoredKeys(uid, limit);
  const parsed = keys.flatMap((key) => {
    const p = parseContentKey(key);
    return p ? [{ key, p }] : [];
  });
  if (parsed.length === 0) return [];
  const snaps = await db.getAll(...parsed.map(({ p }) => db.doc(contentPath(p))));
  const items: MyContentItem[] = [];
  snaps.forEach((snap, i) => {
    const data = snap.data();
    const { key, p } = parsed[i]!;
    if (!data) return;
    items.push({
      contentKey: key,
      postId: p.postId,
      commentId: p.commentId,
      kind: p.kind,
      title: p.kind === 'post' ? data.title : undefined,
      body: data.body ?? '',
      status: data.status,
      createdAtMs: data.createdAt?.toMillis?.() ?? 0,
    });
  });
  return items;
}

/** A person's own posts and comments. Only ever returns the caller's own. */
export const listMyContent = callable(
  { name: 'listMyContent', schema: emptySchema, rate: 'reads' },
  async (_data, caller): Promise<{ items: MyContentItem[] }> => {
    return { items: await loadMyContent(caller.uid, 200) };
  },
);

/** "Download my data": everything the app holds that is tied to the caller. */
export const exportMyData = callable(
  { name: 'exportMyData', schema: emptySchema, rate: 'reads' },
  async (_data, caller) => {
    const [content, votes, reports] = await Promise.all([
      loadMyContent(caller.uid, 2000),
      db.collectionGroup('by').where('uid', '==', caller.uid).limit(5000).get(),
      db.collection('reports').where('reporterUid', '==', caller.uid).limit(1000).get(),
    ]);
    const p = caller.profile;
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        email: p.email,
        displayName: p.displayName,
        firstName: p.firstName,
        lastInitial: p.lastInitial,
        classYear: p.classYear,
        role: p.role,
        divisions: p.divisions,
        createdAt: (p.createdAt as unknown as { toDate(): Date })?.toDate?.().toISOString() ?? null,
      },
      postsAndComments: content,
      thoughtfulMarksAndPollVotes: votes.docs.map((d) => {
        const v = d.data();
        return {
          kind: v.kind,
          postId: v.postId,
          commentId: v.commentId ?? null,
          optionId: v.optionId ?? null,
          at: v.createdAt?.toDate?.().toISOString() ?? null,
        };
      }),
      reportsYouMade: reports.docs.map((d) => {
        const r = d.data();
        return { contentKey: r.contentKey, reason: r.reason, note: r.note ?? null, status: r.status };
      }),
      note: 'The school keeps a record of who wrote every post. Other students never see that record.',
    };
  },
);

/**
 * "Delete my account". Posts and comments stop showing the person's
 * name. The record of who wrote what is kept, as school policy requires, and
 * the page says so before the person confirms.
 */
export const deleteMyAccount = callable(
  { name: 'deleteMyAccount', schema: emptySchema, rate: 'admin' },
  async (_data, caller): Promise<{ deleted: true; renamed: number }> => {
    const keys = await authoredKeys(caller.uid, 5000);
    let renamed = 0;
    for (let i = 0; i < keys.length; i += 300) {
      const chunk = keys.slice(i, i + 300);
      const refs = chunk.flatMap((key) => {
        const p = parseContentKey(key);
        return p ? [db.doc(contentPath(p))] : [];
      });
      if (refs.length === 0) continue;
      const snaps = await db.getAll(...refs);
      const batch = db.batch();
      for (const snap of snaps) {
        if (snap.exists && snap.data()?.authorDisplay?.name !== FORMER_MEMBER_LABEL) {
          batch.update(snap.ref, { authorDisplay: { name: FORMER_MEMBER_LABEL } });
          renamed += 1;
        }
      }
      await batch.commit();
    }

    const p: UserProfile = caller.profile;
    const batch = db.batch();
    // A small tombstone stays so that the administration can still answer
    // "who wrote this?" for content that remains. Everything else goes.
    batch.set(db.doc(`users/${caller.uid}`), {
      email: p.email,
      displayName: p.displayName,
      firstName: p.firstName,
      lastInitial: p.lastInitial,
      classYear: p.classYear,
      role: p.role,
      divisions: [],
      createdAt: p.createdAt,
      lastSeenAt: p.lastSeenAt,
      deleted: true,
      deletedAt: FieldValue.serverTimestamp(),
    });
    batch.delete(db.doc(`rateLimits/${caller.uid}`));
    auditIn(batch, {
      actorUid: caller.uid,
      actorEmail: caller.email,
      action: 'deleteOwnAccount',
      reason: `Account deleted by its owner. ${renamed} items renamed to the former-member label.`,
    });
    await batch.commit();
    await auth.deleteUser(caller.uid);
    return { deleted: true, renamed };
  },
);

export { auditNow };
