import { DEFAULT_SPACES } from '@commons/shared';
import { getApps as getAdminApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { expect } from 'vitest';

export const PROJECT_ID = 'demo-nobles-commons';
const REGION = 'us-east1';
const hostPort = (value: string | undefined, fallback: string): [string, number] => {
  const [host, port] = (value ?? fallback).split(':');
  return [host!, Number(port)];
};
const [FS_HOST, FS_PORT] = hostPort(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
const [AUTH_HOST, AUTH_PORT] = hostPort(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
const FUNCTIONS_PORT = 5001;

process.env.FIRESTORE_EMULATOR_HOST ??= `${FS_HOST}:${FS_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${AUTH_HOST}:${AUTH_PORT}`;
process.env.GCLOUD_PROJECT ??= PROJECT_ID;

if (getAdminApps().length === 0) initializeAdminApp({ projectId: PROJECT_ID });
/** The Admin SDK: used only to set a scene and to look at what clients cannot see. */
export const adminDb = getAdminFirestore();
export const adminAuth = getAdminAuth();
export { FieldValue };

export interface Persona {
  uid: string;
  email: string;
  user: User;
  db: Firestore;
  /** Calls a Cloud Function as this person and returns its data. */
  call<T = unknown>(name: string, data?: unknown): Promise<T>;
  /** Fetches a fresh ID token so new custom claims reach Firestore. */
  refresh(): Promise<void>;
  close(): Promise<void>;
}

let counter = 0;
const apps: FirebaseApp[] = [];

/** Signs someone in through the Auth emulator's Google provider. No onboarding yet. */
export async function signIn(
  email: string,
  options: { verified?: boolean; name?: string } = {},
): Promise<Persona> {
  counter += 1;
  const app = initializeApp(
    { projectId: PROJECT_ID, apiKey: 'emulator-fake-web-key', appId: 'test' },
    `persona-${counter}`,
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}:${AUTH_PORT}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST, FS_PORT);
  const functions: Functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', FUNCTIONS_PORT);

  const idToken = JSON.stringify({
    sub: `google-${email}`,
    email,
    email_verified: options.verified ?? true,
    name: options.name ?? 'Sample Person',
  });
  const credential = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  const user = credential.user;
  return {
    uid: user.uid,
    email,
    user,
    db,
    async call<T>(name: string, data: unknown = {}) {
      const result = await httpsCallable(functions, name)(data);
      return result.data as T;
    },
    async refresh() {
      await user.getIdToken(true);
    },
    async close() {
      await deleteApp(app);
    },
  };
}

/** Signs in and completes onboarding. */
export async function member(
  email: string,
  profile: { firstName?: string; lastInitial?: string; classYear?: number | null } = {},
): Promise<Persona> {
  const persona = await signIn(email);
  await persona.call('onboard', {
    firstName: profile.firstName ?? 'Sample',
    lastInitial: profile.lastInitial ?? 'S',
    classYear: profile.classYear === undefined ? 2028 : profile.classYear,
    understood: true,
  });
  await persona.refresh();
  return persona;
}

export async function resetEmulators(): Promise<void> {
  await fetch(
    `http://${FS_HOST}:${FS_PORT}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    {
      method: 'DELETE',
    },
  );
  await fetch(`http://${AUTH_HOST}:${AUTH_PORT}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
}

export async function closeAll(): Promise<void> {
  await Promise.all(apps.splice(0).map((app) => deleteApp(app).catch(() => undefined)));
}

/** Creates the default spaces and returns their ids by slug. */
export async function seedSpaces(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  const batch = adminDb.batch();
  for (const space of DEFAULT_SPACES) {
    const ref = adminDb.collection('spaces').doc();
    ids[space.slug] = ref.id;
    batch.set(ref, { ...space, isPublic: true, postCount: 0, createdAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  return ids;
}

/** Gives roles to emails before those people sign in (what an admin does in the console). */
export async function assignRoles(emailToRole: Record<string, string>): Promise<void> {
  await adminDb.doc('config/roles').set({ emailToRole }, { merge: true });
}

export async function waitFor<T>(
  read: () => Promise<T>,
  ok: (value: T) => boolean,
  what = 'condition',
  timeoutMs = 20_000,
): Promise<T> {
  const start = Date.now();
  let last: T | undefined;
  while (Date.now() - start < timeoutMs) {
    last = await read();
    if (ok(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${what}. Last value: ${JSON.stringify(last)}`);
}

/** Waits for the screening trigger to finish with a post or comment and returns the document. */
export async function screened(path: string): Promise<FirebaseFirestore.DocumentData> {
  return waitFor(
    async () => (await adminDb.doc(path).get()).data() ?? {},
    (data) => data.screening !== undefined && data.screening !== 'pending',
    `screening of ${path}`,
  );
}

/** Removes keys whose value is undefined (the callable client would send them as null). */
function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** Empties a person's rate-limit buckets, so tests that are not about rate limits are not slowed by them. */
export async function refill(persona: Persona): Promise<void> {
  await adminDb.doc(`rateLimits/${persona.uid}`).delete();
}

export interface CreatedPost {
  postId: string;
  contentKey: string;
}
export async function post(
  persona: Persona,
  spaceId: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedPost> {
  await refill(persona);
  const created = await persona.call<CreatedPost>(
    'createPost',
    compact({
      spaceId,
      kind: 'text',
      identityMode: 'named',
      title: 'A sample thread for testing',
      body: 'Sample body text.',
      ...overrides,
    }),
  );
  await screened(`posts/${created.postId}`);
  return created;
}
export async function comment(
  persona: Persona,
  postId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ postId: string; commentId: string; contentKey: string }> {
  await refill(persona);
  const created = await persona.call<{ postId: string; commentId: string; contentKey: string }>(
    'createComment',
    compact({ postId, parentId: null, identityMode: 'named', body: 'A sample comment.', ...overrides }),
  );
  await screened(`posts/${postId}/comments/${created.commentId}`);
  return created;
}

/** Asserts that a callable fails with the given code, and returns the error message. */
export async function expectError(promise: Promise<unknown>, code: string): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; message?: string };
    expect(e.code).toBe(`functions/${code}`);
    return e.message ?? '';
  }
  throw new Error(`Expected the call to fail with ${code}, but it succeeded.`);
}

/** Every string anywhere inside a value, for "this must not appear anywhere" checks. */
export function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'number') out.push(String(value));
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(k);
      allStrings(v, out);
    }
  }
  return out;
}
