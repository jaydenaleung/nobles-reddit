import { contentPath, modActionSchema, parseContentKey, type ModAction } from '@commons/shared';
import { FieldValue, db } from './admin';
import { auditIn } from './audit';
import { AppError, errors } from './errors';
import { MOD_ROLES, callable } from './guard';

const AUDIT_NAMES: Record<ModAction, string> = {
  hold: 'hold',
  remove: 'remove',
  restore: 'restore',
  pin: 'pin',
  unpin: 'unpin',
  approveForBoard: 'approveForBoard',
  removeFromBoard: 'removeFromBoard',
};

/**
 * What moderators can do: hold, remove, restore, pin, and choose what goes on
 * the hall screen. Every action is written to the audit log.
 *
 * Moderators never see who wrote something. This function reads no authorship
 * and returns none; to find an author a moderator must ask an admin.
 */
export const modAction = callable(
  { name: 'modAction', schema: modActionSchema, roles: MOD_ROLES, rate: 'admin' },
  async (data, caller): Promise<{ contentKey: string; action: ModAction }> => {
    const parsed = parseContentKey(data.contentKey);
    if (!parsed) throw errors.invalid('That doesn’t look right.');
    const ref = db.doc(contentPath(parsed));
    const isPost = parsed.kind === 'post';

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw errors.notFound('That');
      const current = snap.data()!;
      const openQueue = await tx.get(
        db
          .collection('moderationQueue')
          .where('contentKey', '==', data.contentKey)
          .where('status', '==', 'open'),
      );

      const closeQueue = () => {
        for (const item of openQueue.docs) {
          tx.update(item.ref, {
            status: 'resolved',
            resolvedBy: caller.uid,
            resolvedAt: FieldValue.serverTimestamp(),
            resolutionNote: `${data.action}${data.note ? `: ${data.note}` : ''}`,
          });
        }
      };

      switch (data.action) {
        case 'hold':
          // `flagged` stops the screening trigger from publishing it again.
          tx.update(ref, { status: 'held', screening: 'flagged', boardApproved: false });
          break;
        case 'remove':
          tx.update(ref, {
            status: 'removed',
            screening: 'flagged',
            removedBy: 'moderator',
            removedAt: FieldValue.serverTimestamp(),
            boardApproved: false,
            ...(isPost ? { pinned: false } : {}),
          });
          closeQueue();
          break;
        case 'restore':
          tx.update(ref, {
            status: 'visible',
            screening: 'clear',
            removedBy: FieldValue.delete(),
            removedAt: FieldValue.delete(),
          });
          closeQueue();
          break;
        case 'pin':
        case 'unpin':
          if (!isPost) throw errors.invalid('Only posts can be pinned, not replies.');
          if (data.action === 'pin' && current.status !== 'visible') {
            throw new AppError('failed-precondition', 'Only a visible post can be pinned.');
          }
          tx.update(
            ref,
            data.action === 'pin'
              ? { pinned: true, pinnedBy: 'administration' }
              : { pinned: false, pinnedBy: FieldValue.delete() },
          );
          break;
        case 'approveForBoard':
          if (current.status !== 'visible') {
            throw new AppError('failed-precondition', 'Only visible posts can go on the Gleason TV.');
          }
          if (isPost) {
            // A thread becomes the question shown on the hall screen.
            tx.set(
              db.doc('config/board'),
              { questionPostId: parsed.postId, updatedAt: FieldValue.serverTimestamp() },
              { merge: true },
            );
          } else {
            tx.update(ref, { boardApproved: true, boardApprovedAt: FieldValue.serverTimestamp() });
          }
          break;
        case 'removeFromBoard':
          if (isPost) {
            tx.set(
              db.doc('config/board'),
              { questionPostId: null, updatedAt: FieldValue.serverTimestamp() },
              { merge: true },
            );
          } else {
            tx.update(ref, { boardApproved: false });
          }
          break;
      }

      auditIn(tx, {
        actorUid: caller.uid,
        actorEmail: caller.email,
        action: AUDIT_NAMES[data.action],
        contentKey: data.contentKey,
        reason: data.note || '(no note)',
      });
    });

    return { contentKey: data.contentKey, action: data.action };
  },
);
