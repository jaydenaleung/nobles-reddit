import { LIMITS, type RateLimitAction, type Role, type UserProfile } from '@commons/shared';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import type { defineSecret } from 'firebase-functions/params';
import type { z } from 'zod';
import { db } from './admin';
import { env, isAllowedEmail } from './env';
import { errors, toHttpsError } from './errors';
import { consumeRateLimit } from './rateLimiter';

export interface Caller {
  uid: string;
  email: string;
  /** Null only for `onboard`, which runs before a profile exists. */
  role: Role | null;
  profile: UserProfile | null;
}
export interface MemberCaller extends Caller {
  role: Role;
  profile: UserProfile;
}

interface GuardOptions<S extends z.ZodTypeAny> {
  name: string;
  schema: S;
  /** Which roles may call. 'onboarding' lets a signed-in person with no profile through. */
  roles?: Role[] | 'member' | 'onboarding';
  rate?: RateLimitAction;
  secrets?: ReturnType<typeof defineSecret>[];
  timeoutSeconds?: number;
}

/**
 * Every check a callable needs, in one place and in a fixed order:
 * signed in, verified email, allowed domain, App Check (when enabled, enforced
 * by the platform), onboarded with a current role, payload size, input schema,
 * rate limit. The role comes from the profile in Firestore, not from the token,
 * so a role change takes effect immediately.
 */
async function authorise(
  request: CallableRequest<unknown>,
  roles: GuardOptions<z.ZodTypeAny>['roles'],
): Promise<Caller> {
  const token = request.auth?.token;
  if (!request.auth || !token) throw errors.signIn();
  const email = typeof token.email === 'string' ? token.email.toLowerCase() : '';
  if (!email || token.email_verified !== true || !isAllowedEmail(email)) throw errors.notMember();

  const uid = request.auth.uid;
  const snap = await db.doc(`users/${uid}`).get();
  const profile = snap.exists ? (snap.data() as UserProfile) : null;
  if (roles === 'onboarding') {
    return { uid, email, role: profile && !profile.deleted ? profile.role : null, profile };
  }
  if (!profile || profile.deleted) throw errors.notOnboarded();
  if (Array.isArray(roles) && !roles.includes(profile.role)) throw errors.notAllowed();
  return { uid, email, role: profile.role, profile };
}

export function callable<S extends z.ZodTypeAny, R>(
  options: GuardOptions<S> & { roles: 'onboarding' },
  handler: (data: z.output<S>, caller: Caller) => Promise<R>,
): ReturnType<typeof onCall>;
export function callable<S extends z.ZodTypeAny, R>(
  options: GuardOptions<S>,
  handler: (data: z.output<S>, caller: MemberCaller) => Promise<R>,
): ReturnType<typeof onCall>;
export function callable<S extends z.ZodTypeAny, R>(
  options: GuardOptions<S>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (data: z.output<S>, caller: any) => Promise<R>,
) {
  return onCall(
    {
      region: env.region,
      enforceAppCheck: env.enforceAppCheck,
      secrets: options.secrets ?? [],
      timeoutSeconds: options.timeoutSeconds ?? 30,
      memory: '256MiB',
      maxInstances: 20,
      cors: true,
    },
    async (request) => {
      try {
        const caller = await authorise(request, options.roles ?? 'member');
        const raw = request.data ?? {};
        if (JSON.stringify(raw).length > LIMITS.payloadMax) throw errors.tooLarge();
        const data = options.schema.parse(raw);
        if (options.rate) await consumeRateLimit(caller.uid, options.rate);
        return await handler(data, caller);
      } catch (error) {
        throw toHttpsError(error, options.name);
      }
    },
  );
}

export const MOD_ROLES: Role[] = ['moderator', 'admin'];
export const ADMIN_ROLES: Role[] = ['admin'];
