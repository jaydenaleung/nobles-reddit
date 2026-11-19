import type {
  AiUsageResult,
  ContentStatusResult,
  CreateCommentInput,
  CreateContentResult,
  CreatePostInput,
  DailyQuestionActionInput,
  EditOwnContentInput,
  ManageSpaceInput,
  ModActionInput,
  MyContentItem,
  OnboardInput,
  OnboardResult,
  ReportContentInput,
  RevealAuthorInput,
  RevealAuthorResult,
  SetRoleInput,
  SummaryResult,
  UpdateConfigInput,
} from '@commons/shared';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { USE_EMULATORS, config } from './config';
import { app } from './firebase';

const functions = getFunctions(app, config.region);
if (USE_EMULATORS) connectFunctionsEmulator(functions, '127.0.0.1', 5001);

// App Check is optional: it turns on when a reCAPTCHA Enterprise site key is configured.
if (!USE_EMULATORS && config.recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(config.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

/**
 * Removes keys whose value is undefined. The callable client would otherwise
 * send them as null, which the server's strict input checks reject.
 */
function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, withoutUndefined(v)]),
    ) as T;
  }
  return value;
}

function fn<In, Out>(name: string) {
  const callable = httpsCallable<In, Out>(functions, name);
  return async (data: In): Promise<Out> => {
    // Nothing is queued while offline: say so plainly instead.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('You’re offline, so nothing was sent.');
    }
    return (await callable(withoutUndefined(data))).data;
  };
}

/** A message that is safe and useful to show. Functions already return plain sentences. */
export function errorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e?.code === 'functions/unavailable' || e?.code === 'functions/deadline-exceeded') {
    return 'Couldn’t reach the site. Check your wifi and try again.';
  }
  if (e?.code === 'functions/internal' || !e?.message) {
    return 'Something broke on our end. Try again.';
  }
  // Some SDK versions add the HTTP status to the end of the message.
  return e.message.replace(/\s*\[\d{3}\]$/, '');
}

type Empty = Record<string, never>;

/** Every write in the app is one of these calls. There are no direct database writes. */
export const api = {
  onboard: fn<OnboardInput, OnboardResult>('onboard'),
  createPost: fn<CreatePostInput, CreateContentResult>('createPost'),
  createComment: fn<CreateCommentInput, CreateContentResult>('createComment'),
  editOwnContent: fn<EditOwnContentInput, { contentKey: string }>('editOwnContent'),
  deleteOwnContent: fn<{ contentKey: string }, { contentKey: string }>('deleteOwnContent'),
  getMyContentStatus: fn<{ contentKey: string }, ContentStatusResult>('getMyContentStatus'),
  listMyContent: fn<Empty, { items: MyContentItem[] }>('listMyContent'),
  exportMyData: fn<Empty, unknown>('exportMyData'),
  deleteMyAccount: fn<Empty, { deleted: true; anonymised: number }>('deleteMyAccount'),
  toggleThoughtful: fn<{ contentKey: string }, { thoughtful: boolean }>('toggleThoughtful'),
  votePoll: fn<{ postId: string; optionId: string }, { optionId: string }>('votePoll'),
  reportContent: fn<ReportContentInput, { received: true }>('reportContent'),
  resolveReport: fn<{ id: string; kind: 'report' | 'queue'; note?: string }, { resolved: true }>(
    'resolveReport',
  ),
  modAction: fn<ModActionInput, { contentKey: string }>('modAction'),
  revealAuthor: fn<RevealAuthorInput, RevealAuthorResult>('revealAuthor'),
  setRole: fn<SetRoleInput, { email: string; role: string; applied: boolean }>('setRole'),
  manageSpace: fn<ManageSpaceInput, { spaceId: string }>('manageSpace'),
  exportAuditLog: fn<{ limit?: number }, { exportedAt: string; entries: unknown[] }>('exportAuditLog'),
  updateConfig: fn<UpdateConfigInput, { saved: true }>('updateConfig'),
  getAiUsage: fn<Empty, AiUsageResult>('getAiUsage'),
  requestSummary: fn<{ postId: string }, SummaryResult>('requestSummary'),
  proposeDailyQuestionNow: fn<Empty, { proposed: number; reason?: string }>('proposeDailyQuestionNow'),
  proposeHumanQuestion: fn<{ text: string }, { id: string }>('proposeHumanQuestion'),
  approveDailyQuestion: fn<DailyQuestionActionInput, { status: string; postId?: string }>(
    'approveDailyQuestion',
  ),
};

/**
 * Waits for the screening check on something just posted. Resolves with
 * 'pending' if it is still running after a few seconds; the content will
 * appear on its own when the check finishes.
 */
export async function waitForOutcome(contentKey: string, tries = 12): Promise<ContentStatusResult> {
  for (let i = 0; i < tries; i++) {
    await new Promise((resolve) => setTimeout(resolve, i < 3 ? 500 : 1000));
    try {
      const result = await api.getMyContentStatus({ contentKey });
      if (result.outcome !== 'pending') return result;
    } catch {
      return { outcome: 'pending' };
    }
  }
  return { outcome: 'pending' };
}
