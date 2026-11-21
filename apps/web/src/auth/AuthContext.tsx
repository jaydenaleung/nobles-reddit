import type { OnboardInput, Role, UserProfile } from '@commons/shared';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import { USE_EMULATORS, config, isAllowedEmail } from '../config';
import { app, db } from '../firebase';
import { EMULATOR_HOST } from '../lib/emulatorHost';

const auth = getAuth(app);
if (USE_EMULATORS) connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsOnboarding'; user: User }
  | { status: 'member'; user: User; role: Role; profile: UserProfile };

interface AuthValue {
  state: AuthState;
  /** A kind message for someone who was signed out (wrong account, deleted account). */
  notice: string | null;
  signIn(): Promise<void>;
  /** Emulator builds only: sign in as a made-up person without a Google popup. */
  signInForDevelopment?: (email: string, name: string) => Promise<void>;
  signOut(): Promise<void>;
  completeOnboarding(input: OnboardInput): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const NOT_NOBLES =
  'That isn’t a nobles.edu account, so you got signed back out. Try again with your school Google account.';

async function resolve(user: User): Promise<AuthState> {
  const token = await user.getIdTokenResult();
  const claimRole = token.claims.role as Role | undefined;
  if (!claimRole) return { status: 'needsOnboarding', user };
  let snap;
  try {
    snap = await getDoc(doc(db, 'users', user.uid));
  } catch {
    return { status: 'needsOnboarding', user };
  }
  const profile = snap.data() as UserProfile | undefined;
  if (!profile || profile.deleted) return { status: 'needsOnboarding', user };
  if (profile.role !== claimRole) {
    // An admin changed this person's role: pick up the new claim straight away.
    await user.getIdToken(true);
  }
  return { status: 'member', user, role: profile.role, profile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState({ status: 'signedOut' });
        return;
      }
      // The server enforces the domain too. This is the friendly version of the same rule.
      if (!isAllowedEmail(user.email) || !user.emailVerified) {
        setNotice(NOT_NOBLES);
        void firebaseSignOut(auth);
        return;
      }
      resolve(user).then(setState, () => setState({ status: 'signedOut' }));
    });
  }, []);

  const signIn = useCallback(async () => {
    setNotice(null);
    const provider = new GoogleAuthProvider();
    // Asks Google to show school accounts first. It is a hint, not the check.
    provider.setCustomParameters({ hd: config.allowedDomains[0] ?? 'nobles.edu', prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  }, []);

  const signInForDevelopment = useMemo(() => {
    if (!USE_EMULATORS) return undefined;
    return async (email: string, name: string) => {
      setNotice(null);
      const fakeToken = JSON.stringify({ sub: `google-${email}`, email, email_verified: true, name });
      await signInWithCredential(auth, GoogleAuthProvider.credential(fakeToken));
    };
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const completeOnboarding = useCallback(async (input: OnboardInput) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in first.');
    await api.onboard(input);
    await user.getIdToken(true);
    setState(await resolve(user));
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ state, notice, signIn, signInForDevelopment, signOut, completeOnboarding }),
    [state, notice, signIn, signInForDevelopment, signOut, completeOnboarding],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}

/** For pages that only render for members. */
export function useMember() {
  const { state } = useAuth();
  if (state.status !== 'member') throw new Error('This page is for signed-in members.');
  return state;
}
