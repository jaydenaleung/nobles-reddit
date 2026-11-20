import { z } from 'zod';
import { ASSIGNABLE_ROLES, DIVISIONS, LIMITS, MOD_ACTIONS, REPORT_REASONS, ROLES } from './constants';

/** Collapses stray whitespace and strips control characters that have no business in a post. */
// Control characters and invisible direction-override characters.
/* eslint-disable no-control-regex */
const UNWANTED_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
/* eslint-enable no-control-regex */

export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(UNWANTED_CHARS, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}
function cleanLine(input: string): string {
  return cleanText(input).replace(/\s+/g, ' ');
}

const firestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Not a valid id');

/** "post:{postId}" or "comment:{postId}:{commentId}" */
export const contentKeySchema = z
  .string()
  .max(160)
  .regex(
    /^(post:[A-Za-z0-9_-]{1,64}|comment:[A-Za-z0-9_-]{1,64}:[A-Za-z0-9_-]{1,64})$/,
    'Not a valid content key',
  );

export const identityModeSchema = z.enum(['named', 'anonymous']);
/**
 * Neddit has no anonymous posting: everything new goes up under the writer's
 * name. Older anonymous content still reads as "Anonymous".
 */
export const newContentIdentitySchema = z.literal('named', {
  error: 'Anonymous posting is off. Everything goes up under your name.',
});

export const titleSchema = z
  .string()
  .transform(cleanLine)
  .pipe(
    z
      .string()
      .min(LIMITS.titleMin, `Titles need at least ${LIMITS.titleMin} characters`)
      .max(LIMITS.titleMax, `Titles can be up to ${LIMITS.titleMax} characters`),
  );
export const bodySchema = z
  .string()
  .transform(cleanText)
  .pipe(z.string().max(LIMITS.bodyMax, `Posts can be up to ${LIMITS.bodyMax} characters`));
export const commentBodySchema = z
  .string()
  .transform(cleanText)
  .pipe(
    z
      .string()
      .min(1, 'Write something first')
      .max(LIMITS.commentMax, `Comments can be up to ${LIMITS.commentMax} characters`),
  );

/** Links must be https. They are stored and shown, never fetched by the server. */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.');
    } catch {
      return false;
    }
  }, 'Links must start with https://');

export const pollOptionsSchema = z
  .array(
    z
      .string()
      .transform(cleanLine)
      .pipe(z.string().min(1, 'Options cannot be empty').max(LIMITS.pollOptionMax)),
  )
  .min(LIMITS.pollMinOptions, `Polls need at least ${LIMITS.pollMinOptions} options`)
  .max(LIMITS.pollMaxOptions, `Polls can have up to ${LIMITS.pollMaxOptions} options`)
  .refine(
    (options) => new Set(options.map((o) => o.toLowerCase())).size === options.length,
    'Options must be different',
  );

export const onboardSchema = z
  .object({
    firstName: z.string().transform(cleanLine).pipe(z.string().min(1).max(LIMITS.nameMax)),
    lastInitial: z
      .string()
      .transform(cleanLine)
      .pipe(z.string().regex(/^\p{L}$/u, 'One letter')),
    classYear: z.number().int().min(2000).max(2100).nullable().optional(),
    divisions: z.array(z.enum(DIVISIONS)).max(DIVISIONS.length).optional(),
    understood: z.literal(true, { error: 'Please confirm you have read how it works' }),
  })
  .strict();

const postBase = {
  spaceId: firestoreId,
  identityMode: newContentIdentitySchema,
  title: titleSchema,
};
export const createPostSchema = z.discriminatedUnion('kind', [
  z.object({ ...postBase, kind: z.literal('text'), body: bodySchema }).strict(),
  z
    .object({
      ...postBase,
      kind: z.literal('link'),
      body: bodySchema.optional().default(''),
      url: httpsUrlSchema,
    })
    .strict(),
  z
    .object({
      ...postBase,
      kind: z.literal('poll'),
      body: bodySchema.optional().default(''),
      options: pollOptionsSchema,
    })
    .strict(),
]);

export const createCommentSchema = z
  .object({
    postId: firestoreId,
    parentId: firestoreId.nullable(),
    identityMode: newContentIdentitySchema,
    body: commentBodySchema,
  })
  .strict();

export const editOwnContentSchema = z
  .object({
    contentKey: contentKeySchema,
    title: titleSchema.optional(),
    body: z.string().transform(cleanText).pipe(z.string().max(LIMITS.bodyMax)),
  })
  .strict();

export const contentKeyOnlySchema = z.object({ contentKey: contentKeySchema }).strict();
export const toggleThoughtfulSchema = contentKeyOnlySchema;
export const deleteOwnContentSchema = contentKeyOnlySchema;

export const votePollSchema = z
  .object({ postId: firestoreId, optionId: z.string().regex(/^[a-z0-9]{1,8}$/) })
  .strict();

export const reportContentSchema = z
  .object({
    contentKey: contentKeySchema,
    reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]),
    note: z.string().transform(cleanText).pipe(z.string().max(LIMITS.reportNoteMax)).optional(),
  })
  .strict();

export const modActionSchema = z
  .object({
    contentKey: contentKeySchema,
    action: z.enum(MOD_ACTIONS),
    note: z.string().transform(cleanText).pipe(z.string().max(LIMITS.reasonMax)).optional().default(''),
  })
  .strict();

export const resolveReportSchema = z
  .object({
    id: firestoreId,
    kind: z.enum(['report', 'queue']),
    note: z.string().max(LIMITS.reasonMax).optional(),
  })
  .strict();

export const revealAuthorSchema = z
  .object({
    contentKey: contentKeySchema,
    reason: z
      .string()
      .transform(cleanText)
      .pipe(
        z
          .string()
          .min(LIMITS.revealReasonMin, `Give a reason of at least ${LIMITS.revealReasonMin} characters`)
          .max(LIMITS.reasonMax),
      ),
  })
  .strict();

export const emailSchema = z.string().trim().toLowerCase().email().max(200);

export const setRoleSchema = z
  .object({
    email: emailSchema,
    role: z.enum(ASSIGNABLE_ROLES),
    reason: z.string().transform(cleanText).pipe(z.string().min(3).max(LIMITS.reasonMax)),
  })
  .strict();

export const manageSpaceSchema = z
  .object({
    action: z.enum(['create', 'update']),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')
      .min(2)
      .max(40),
    name: z.string().transform(cleanLine).pipe(z.string().min(2).max(40)),
    description: z.string().transform(cleanLine).pipe(z.string().max(200)),
    order: z.number().int().min(0).max(999),
    postingRoles: z.array(z.enum(ROLES)).min(1),
  })
  .strict();

export const dailyQuestionActionSchema = z
  .object({
    id: firestoreId,
    action: z.enum(['approve', 'reject']),
    pollOptions: pollOptionsSchema.optional(),
  })
  .strict();

export const proposeHumanQuestionSchema = z.object({ text: titleSchema }).strict();

export const requestSummarySchema = z.object({ postId: firestoreId }).strict();
export const emptySchema = z.object({}).strict();

export const exportAuditLogSchema = z
  .object({ limit: z.number().int().min(1).max(1000).optional() })
  .strict();

export const updateConfigSchema = z.discriminatedUnion('doc', [
  z
    .object({
      doc: z.literal('ai'),
      bannedTopics: z.array(z.string().transform(cleanLine).pipe(z.string().min(1).max(80))).max(50),
    })
    .strict(),
  z
    .object({
      doc: z.literal('calendar'),
      notes: z.array(z.string().transform(cleanLine).pipe(z.string().min(1).max(200))).max(30),
    })
    .strict(),
  z
    .object({
      doc: z.literal('resources'),
      message: z.string().transform(cleanText).pipe(z.string().min(10).max(600)),
      items: z
        .array(
          z.object({
            label: z.string().transform(cleanLine).pipe(z.string().min(1).max(80)),
            detail: z.string().transform(cleanLine).pipe(z.string().min(1).max(200)),
          }),
        )
        .max(8),
    })
    .strict(),
]);

export type OnboardInput = z.input<typeof onboardSchema>;
export type CreatePostInput = z.input<typeof createPostSchema>;
export type CreateCommentInput = z.input<typeof createCommentSchema>;
export type EditOwnContentInput = z.input<typeof editOwnContentSchema>;
export type ReportContentInput = z.input<typeof reportContentSchema>;
export type ModActionInput = z.input<typeof modActionSchema>;
export type RevealAuthorInput = z.input<typeof revealAuthorSchema>;
export type SetRoleInput = z.input<typeof setRoleSchema>;
export type ManageSpaceInput = z.input<typeof manageSpaceSchema>;
export type DailyQuestionActionInput = z.input<typeof dailyQuestionActionSchema>;
export type UpdateConfigInput = z.input<typeof updateConfigSchema>;
