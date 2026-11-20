import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PublicFrame } from '../components/Layout';
import { Loading } from '../components/Ui';
import { enablePalette } from './palette';

// Emulator builds only. Signs in as the sample admin, finishes onboarding if needed,
// turns on the color palette and opens the front page.
export default function DevEntry() {
  const { state, signInForDevelopment, completeOnboarding } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const signedIn = useRef(false);
  const onboarded = useRef(false);

  useEffect(() => {
    enablePalette();
  }, []);

  useEffect(() => {
    const fail = (err: unknown) => setError(err instanceof Error ? err.message : 'Something went wrong.');
    if (state.status === 'signedOut' && signInForDevelopment && !signedIn.current) {
      signedIn.current = true;
      signInForDevelopment('sample.admin@nobles.edu', 'Sample Admin').catch(fail);
    } else if (state.status === 'needsOnboarding' && !onboarded.current) {
      onboarded.current = true;
      completeOnboarding({
        firstName: 'Sample',
        lastInitial: 'A',
        classYear: null,
        divisions: [],
        understood: true,
      }).catch(fail);
    }
  }, [state.status, signInForDevelopment, completeOnboarding]);

  if (state.status === 'member') return <Navigate to="/" replace />;
  return (
    <PublicFrame>
      {error ? <p className="err">{error}. Are the emulators running?</p> : <Loading />}
    </PublicFrame>
  );
}
