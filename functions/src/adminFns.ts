import {
  emptySchema,
  exportAuditLogSchema,
  manageSpaceSchema,
  schoolDate,
  updateConfigSchema,
  type AiUsageResult,
} from '@commons/shared';
import { FieldValue, db } from './admin';
import { tokensUsedToday } from './ai';
import { auditIn, auditNow } from './audit';
import { env } from './env';
import { AppError, errors } from './errors';
import { ADMIN_ROLES, callable } from './guard';

/** Admin only. Adds a space or changes one. Spaces are never deleted, so old threads keep their home. */
export const manageSpace = callable(
  { name: 'manageSpace', schema: manageSpaceSchema, roles: ADMIN_ROLES, rate: 'admin' },
  async (data, caller): Promise<{ spaceId: string }> => {
    const existing = await db.collection('spaces').where('slug', '==', data.slug).limit(1).get();
    const batch = db.batch();
    let ref;
    if (data.action === 'create') {
      if (!existing.empty) throw new AppError('already-exists', 'A space with that address already exists.');
      ref = db.collection('spaces').doc();
      batch.create(ref, {
        name: data.name,
        slug: data.slug,
        description: data.description,
        order: data.order,
        postingRoles: data.postingRoles,
        isPublic: true,
        postCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      if (existing.empty) throw errors.notFound('That space');
      ref = existing.docs[0]!.ref;
      batch.update(ref, {
        name: data.name,
        description: data.description,
        order: data.order,
        postingRoles: data.postingRoles,
      });
    }
    auditIn(batch, {
      actorUid: caller.uid,
      actorEmail: caller.email,
      action: data.action === 'create' ? 'createSpace' : 'updateSpace',
      target: data.slug,
      reason: data.name,
    });
    await batch.commit();
    return { spaceId: ref.id };
  },
);

/** Admin only. The audit log as plain data, for the school's records. Exporting it is itself logged. */
export const exportAuditLog = callable(
  { name: 'exportAuditLog', schema: exportAuditLogSchema, roles: ADMIN_ROLES, rate: 'admin' },
  async (data, caller) => {
    const snap = await db
      .collection('auditLog')
      .orderBy('createdAt', 'desc')
      .limit(data.limit ?? 500)
      .get();
    await auditNow({
      actorUid: caller.uid,
      actorEmail: caller.email,
      action: 'exportAuditLog',
      reason: `Exported ${snap.size} entries`,
    });
    return {
      exportedAt: new Date().toISOString(),
      entries: snap.docs.map((d) => {
        const e = d.data();
        return {
          id: d.id,
          at: e.createdAt?.toDate?.().toISOString() ?? null,
          actorEmail: e.actorEmail,
          action: e.action,
          contentKey: e.contentKey ?? null,
          target: e.target ?? null,
          reason: e.reason,
        };
      }),
    };
  },
);

/** Admin only. The settings a school edits: banned AI topics, calendar notes, wellbeing resources. */
export const updateConfig = callable(
  { name: 'updateConfig', schema: updateConfigSchema, roles: ADMIN_ROLES, rate: 'admin' },
  async (data, caller): Promise<{ saved: true }> => {
    const { doc, ...fields } = data;
    const batch = db.batch();
    batch.set(
      db.doc(`config/${doc}`),
      { ...fields, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    auditIn(batch, {
      actorUid: caller.uid,
      actorEmail: caller.email,
      action: 'updateConfig',
      target: `config/${doc}`,
      reason: 'Settings changed',
    });
    await batch.commit();
    return { saved: true };
  },
);

/** Admin only. Today's AI spend against the daily budget, and the last two weeks. */
export const getAiUsage = callable(
  { name: 'getAiUsage', schema: emptySchema, roles: ADMIN_ROLES, rate: 'admin' },
  async (): Promise<AiUsageResult> => {
    // The last 14 school dates, read by id (no index needed).
    const dates = Array.from({ length: 14 }, (_, i) =>
      schoolDate(new Date(Date.now() - i * 24 * 60 * 60 * 1000)),
    );
    const [{ used, calls }, recent] = await Promise.all([
      tokensUsedToday(),
      db.getAll(...dates.map((date) => db.doc(`usage/${date}`))),
    ]);
    return {
      date: schoolDate(),
      budget: env.aiDailyTokenBudget,
      used,
      calls,
      provider: env.aiProvider,
      days: recent
        .filter((d) => d.exists)
        .map((d) => ({
          date: d.id,
          input: d.data()?.anthropicInputTokens ?? 0,
          output: d.data()?.anthropicOutputTokens ?? 0,
          calls: d.data()?.calls ?? 0,
        })),
    };
  },
);

/**
 * Admin only, and it refuses.
 *
 * Training data for the hand-built model may come only from threads whose
 * every author consented, that a moderator approved, and that were anonymised
 * first. None of that exists yet, so this stub says no. See ml/data/README.md
 * for what has to be true before anyone turns it on.
 */
export const exportTrainingData = callable(
  { name: 'exportTrainingData', schema: emptySchema, roles: ADMIN_ROLES, rate: 'admin' },
  async (_data, caller): Promise<never> => {
    await auditNow({
      actorUid: caller.uid,
      actorEmail: caller.email,
      action: 'exportTrainingDataRefused',
      reason: 'Training-data export is switched off',
    });
    throw new AppError(
      'failed-precondition',
      'Training-data export is switched off until the school sets up consent and review. See ml/data/README.md.',
    );
  },
);
