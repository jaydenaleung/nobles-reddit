import {
  DEFAULT_WELLBEING_RESOURCES,
  EDIT_WINDOW_MS,
  LIMITS,
  buildAuthorDisplay,
  buildSearchTokens,
  commentKey,
  contentKeyOnlySchema,
  contentPath,
  createCommentSchema,
  createPostSchema,
  deleteOwnContentSchema,
  editOwnContentSchema,
  hotScore,
  parseContentKey,
  postKey,
  type ContentStatusResult,
  type CreateContentResult,
  type ParsedContentKey,
  type Space,
  type WellbeingResources,
} from '@commons/shared';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { FieldValue, db } from './admin';
import { AppError, errors } from './errors';
import { callable } from './guard';

/**
 * Gives an anonymous author their letter in this thread ("Anonymous B").
 * The same person keeps the same letter within one thread, so a conversation
 * can be followed; in another thread they get a different one.
 * Must run inside a transaction, before any write.
 */
async function anonIndexFor(tx: Transaction, postId: string, uid: string): Promise<{ index: number; writes: () => void }> {
  const threadRef = db.doc(`threadAnon/${postId}`);
  const memberRef = threadRef.collection('members').doc(uid);
  const [member, thread] = await Promise.all([tx.get(memberRef), tx.get(threadRef)]);
  if (member.exists) return { index: member.data()!.index as number, writes: () => undefined };
  const index = (thread.data()?.count as number | undefined) ?? 0;
  return {
    index,
    writes: () => {
      tx.set(threadRef, { count: index + 1 }, { merge: true });
      tx.set(memberRef, { index });
    },
  };
}

export const createPost = callable(
  { name: 'createPost', schema: createPostSchema, rate: 'posts' },
  async (data, caller): Promise<CreateContentResult> => {
    const spaceRef = db.doc(`spaces/${data.spaceId}`);
    const postRef = db.collection('posts').doc();
    const key = postKey(postRef.id);

    await db.runTransaction(async (tx) => {
      const spaceSnap = await tx.get(spaceRef);
      if (!spaceSnap.exists) throw errors.notFound('That space');
      const space = spaceSnap.data() as Space;
      if (!space.postingRoles.includes(caller.role)) {
        throw new AppError('permission-denied', 'You cannot post in that space.');
      }

      // The author gets letter A in their own thread if they post anonymously.
      const authorDisplay = buildAuthorDisplay(caller.profile, data.identityMode, 0);
      const now = FieldValue.serverTimestamp();
      const body = data.body ?? '';

      const post: Record<string, unknown> = {
        spaceId: data.spaceId,
        spaceName: space.name,
        kind: data.kind,
        title: data.title,
        body,
        authorDisplay,
        thoughtfulCount: 0,
        commentCount: 0,
        anonCommentCount: 0,
        hotScore: hotScore(0, 0, Math.floor(Date.now() / 1000)),
        pinned: false,
        // New content is held until the screening check has run (see triggers.ts).
        status: 'held',
        screening: 'pending',
        searchTokens: buildSearchTokens(data.title, body, space.name),
        createdAt: now,
      };
      if (data.kind === 'link') {
        const url = new URL(data.url);
        // The link is stored and shown. The server never fetches it.
        post.link = { url: url.href, domain: url.hostname.replace(/^www\./, ''), source: 'other' };
      }
      if (data.kind === 'poll') {
        post.poll = { options: data.options.map((label, i) => ({ id: `o${i + 1}`, label, count: 0 })) };
      }

      tx.create(postRef, post);
      // Who wrote it, in a collection no client can read. Same commit, same timestamp.
      tx.create(db.doc(`authorship/${key}`), { contentKey: key, authorUid: caller.uid, createdAt: now });
      if (data.identityMode === 'anonymous') {
        tx.set(db.doc(`threadAnon/${postRef.id}`), { count: 1 });
        tx.set(db.doc(`threadAnon/${postRef.id}/members/${caller.uid}`), { index: 0 });
      }
    });

    // Only safe fields go back: never a uid.
    return { postId: postRef.id, contentKey: key };
  },
);

export const createComment = callable(
  { name: 'createComment', schema: createCommentSchema, rate: 'comments' },
  async (data, caller): Promise<CreateContentResult> => {
    const postRef = db.doc(`posts/${data.postId}`);
    const commentRef = postRef.collection('comments').doc();
    const key = commentKey(data.postId, commentRef.id);

    await db.runTransaction(async (tx) => {
      const postSnap = await tx.get(postRef);
      if (!postSnap.exists || postSnap.data()!.status !== 'visible') throw errors.notFound('That thread');

      let depth = 0;
      if (data.parentId) {
        const parent = await tx.get(postRef.collection('comments').doc(data.parentId));
        if (!parent.exists || parent.data()!.status !== 'visible') throw errors.notFound('That comment');
        depth = (parent.data()!.depth as number) + 1;
        if (depth > LIMITS.maxDepth) {
          throw errors.invalid('This conversation is as deep as it goes. Reply one level up.');
        }
      }

      const anon = data.identityMode === 'anonymous' ? await anonIndexFor(tx, data.postId, caller.uid) : null;
      const authorDisplay = buildAuthorDisplay(caller.profile, data.identityMode, anon?.index ?? 0);
      const now = FieldValue.serverTimestamp();

      tx.create(commentRef, {
        postId: data.postId,
        parentId: data.parentId,
        depth,
        body: data.body,
        authorDisplay,
        thoughtfulCount: 0,
        status: 'held',
        screening: 'pending',
        createdAt: now,
      });
      tx.create(db.doc(`authorship/${key}`), { contentKey: key, authorUid: caller.uid, createdAt: now });
      anon?.writes();
    });

    return { postId: data.postId, commentId: commentRef.id, contentKey: key };
  },
);

/** Loads a piece of content and checks that the caller wrote it. The error is the same whether it exists or not. */
async function ownContent(
  tx: Transaction,
  contentKey: string,
  uid: string,
): Promise<{ parsed: ParsedContentKey; ref: DocumentReference; data: FirebaseFirestore.DocumentData }> {
  const parsed = parseContentKey(contentKey);
  if (!parsed) throw errors.invalid('That does not look right.');
  const ref = db.doc(contentPath(parsed));
  const [authorship, content] = await Promise.all([tx.get(db.doc(`authorship/${contentKey}`)), tx.get(ref)]);
  if (!authorship.exists || !content.exists || authorship.data()!.authorUid !== uid) {
    throw new AppError('permission-denied', 'You can only change your own posts and comments.');
  }
  return { parsed, ref, data: content.data()! };
}

export const editOwnContent = callable(
  { name: 'editOwnContent', schema: editOwnContentSchema, rate: 'comments' },
  async (data, caller): Promise<{ contentKey: string }> => {
    await db.runTransaction(async (tx) => {
      const { parsed, ref, data: current } = await ownContent(tx, data.contentKey, caller.uid);
      if (current.status === 'removed') throw errors.notFound('That');
      const createdMs = current.createdAt?.toMillis?.() ?? 0;
      if (Date.now() - createdMs > EDIT_WINDOW_MS) {
        throw new AppError('failed-precondition', 'You can edit for 10 minutes after posting. That time has passed.');
      }
      const update: Record<string, unknown> = {
        body: data.body,
        editedAt: FieldValue.serverTimestamp(),
        // Edited text is screened again before it is shown.
        status: 'held',
        screening: 'pending',
      };
      if (parsed.kind === 'post') {
        const title = data.title ?? current.title;
        update.title = title;
        update.searchTokens = buildSearchTokens(title, data.body, current.spaceName ?? '');
      } else {
        if (data.body.length === 0) throw errors.invalid('Write something first');
        if (data.body.length > LIMITS.commentMax) {
          throw errors.invalid(`Comments can be up to ${LIMITS.commentMax} characters`);
        }
      }
      tx.update(ref, update);
    });
    return { contentKey: data.contentKey };
  },
);

/** Soft delete. The content disappears for everyone; the authorship record stays. */
export const deleteOwnContent = callable(
  { name: 'deleteOwnContent', schema: deleteOwnContentSchema, rate: 'comments' },
  async (data, caller): Promise<{ contentKey: string }> => {
    await db.runTransaction(async (tx) => {
      const { ref } = await ownContent(tx, data.contentKey, caller.uid);
      tx.update(ref, {
        status: 'removed',
        screening: 'clear',
        removedBy: 'author',
        removedAt: FieldValue.serverTimestamp(),
        pinned: false,
        boardApproved: false,
      });
    });
    return { contentKey: data.contentKey };
  },
);

export async function wellbeingResources(): Promise<WellbeingResources> {
  const snap = await db.doc('config/resources').get();
  const data = snap.data();
  if (data && typeof data.message === 'string' && Array.isArray(data.items)) {
    return { message: data.message, items: data.items };
  }
  return DEFAULT_WELLBEING_RESOURCES;
}

/**
 * Lets an author find out what happened to something they just posted:
 * still being checked, published, held for a moderator, or a wellbeing flag
 * (which comes back with a caring message and the school's resources).
 */
export const getMyContentStatus = callable(
  { name: 'getMyContentStatus', schema: contentKeyOnlySchema, rate: 'reads' },
  async (data, caller): Promise<ContentStatusResult> => {
    const parsed = parseContentKey(data.contentKey);
    if (!parsed) throw errors.invalid('That does not look right.');
    const [authorship, content] = await db.getAll(
      db.doc(`authorship/${data.contentKey}`),
      db.doc(contentPath(parsed)),
    );
    if (!authorship?.exists || !content?.exists || authorship.data()!.authorUid !== caller.uid) {
      throw new AppError('permission-denied', 'You can only check your own posts and comments.');
    }
    const c = content.data()!;
    if (c.screening === 'pending') return { outcome: 'pending' };
    if (c.screening === 'wellbeing') return { outcome: 'wellbeing', resources: await wellbeingResources() };
    if (c.status === 'visible') return { outcome: 'visible' };
    if (c.status === 'removed') return { outcome: 'removed' };
    return { outcome: 'held' };
  },
);
