import {
  ANONYMITY_NOTICE,
  APP_NAME,
  DIVISIONS,
  DIVISION_LABELS,
  GROUND_RULES,
  type Division,
} from '@commons/shared';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';
import { USE_EMULATORS, config } from '../config';
import { PublicFrame } from '../components/Layout';
import { Loading } from '../components/Ui';

/** Emulator builds only, compiled out of production. Signs in as any address through the Auth emulator. */
function EmulatorSignIn() {
  const { signInForDevelopment } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!signInForDevelopment) return null;
  const go = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await signInForDevelopment(email.trim(), 'Emulator User');
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form className="panel" onSubmit={(event) => void go(event)}>
      <h2>Emulator</h2>
      <div className="field">
        <label className="label" htmlFor="dev-email">
          Any email address
        </label>
        <input className="input" id="dev-email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="row">
        <button className="btn btn--sm" type="submit">
          Sign in as this address
        </button>
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function SignIn() {
  const { state, notice, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Sign in | ${APP_NAME}`;
  }, []);

  if (state.status === 'member') return <Navigate to="/" replace />;
  if (state.status === 'needsOnboarding') return <Navigate to="/onboarding" replace />;

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(
          code === 'auth/popup-blocked'
            ? 'Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.'
            : 'Sign-in didn’t work. Try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicFrame>
      <div className="gate">
        {notice && (
          <p className="notice" role="alert">
            {notice}
          </p>
        )}
        {state.status === 'loading' ? (
          <Loading />
        ) : (
          <section className="panel">
            <h1 className="page-h">Sign in</h1>
            <p>Use your @{config.allowedDomains.join(' or @')} Google account. Personal Gmail won’t work.</p>
            <div className="row">
              <button className="btn btn--primary" type="button" onClick={() => void go()} disabled={busy}>
                {busy ? 'Opening Google' : 'Sign in with Google'}
              </button>
            </div>
            {error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            <p className="muted">
              {ANONYMITY_NOTICE} <Link to="/about">How this works</Link>
            </p>
          </section>
        )}
        {USE_EMULATORS && <EmulatorSignIn />}
      </div>
    </PublicFrame>
  );
}

export function Onboarding() {
  const { state, completeOnboarding, signOut } = useAuth();
  const id = useId();
  const googleName = state.status === 'needsOnboarding' ? (state.user.displayName ?? '') : '';
  const parts = googleName.trim().split(/\s+/).filter(Boolean);
  const [firstName, setFirstName] = useState(parts[0] ?? '');
  const [lastInitial, setLastInitial] = useState(
    parts.length > 1 ? parts[parts.length - 1]![0]!.toUpperCase() : '',
  );
  const [who, setWho] = useState<'student' | 'faculty' | null>(null);
  const [classYear, setClassYear] = useState('');
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Set up | ${APP_NAME}`;
  }, []);

  if (state.status === 'loading') {
    return (
      <PublicFrame>
        <Loading />
      </PublicFrame>
    );
  }
  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status === 'member') return <Navigate to="/" replace />;

  const years: number[] = [];
  for (let year = config.classYearMin; year <= config.classYearMax; year++) years.push(year);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!firstName.trim()) return setError('Add your first name.');
    if (!/^\p{L}$/u.test(lastInitial.trim())) return setError('Add the first letter of your last name.');
    if (!who) return setError('Pick student or faculty.');
    if (who === 'student' && !classYear) return setError('Pick your class year.');
    if (!understood) return setError('Check the box at the bottom first.');
    setBusy(true);
    try {
      await completeOnboarding({
        firstName: firstName.trim(),
        lastInitial: lastInitial.trim(),
        classYear: who === 'student' ? Number(classYear) : null,
        divisions,
        understood: true,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const preview = `${firstName.trim() || 'First'} ${lastInitial.trim() || 'L'}.`;

  return (
    <PublicFrame>
      <form className="gate" onSubmit={(event) => void submit(event)} noValidate>
        <h1 className="page-h">Set up your account</h1>
        <p className="muted" style={{ margin: 0 }}>
          Signed in as {state.user.email}
        </p>

        <section className="panel">
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor={`${id}-first`}>
                First name
              </label>
              <input
                className="input"
                id={`${id}-first`}
                value={firstName}
                maxLength={40}
                autoComplete="given-name"
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: '0 1 120px' }}>
              <label className="label" htmlFor={`${id}-last`}>
                Last initial
              </label>
              <input
                className="input"
                id={`${id}-last`}
                value={lastInitial}
                maxLength={1}
                onChange={(e) => setLastInitial(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <p className="help">Posts with your name show “{preview}” and nothing else.</p>

          <fieldset className="radio-list">
            <legend>You are</legend>
            <label>
              <input
                type="radio"
                name={`${id}-who`}
                checked={who === 'student'}
                onChange={() => setWho('student')}
              />
              A student
            </label>
            <label>
              <input
                type="radio"
                name={`${id}-who`}
                checked={who === 'faculty'}
                onChange={() => setWho('faculty')}
              />
              Faculty or staff
            </label>
          </fieldset>
          {who === 'student' && (
            <div className="field" style={{ maxWidth: 200 }}>
              <label className="label" htmlFor={`${id}-year`}>
                Class year
              </label>
              <select
                className="select"
                id={`${id}-year`}
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
              >
                <option value="">Pick one</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}
          {who === 'faculty' && (
            <p className="help">
              An admin adds the faculty label to your account. Until then you post like anyone else.
            </p>
          )}
          <fieldset className="radio-list">
            <legend>Upper or middle school (optional)</legend>
            {DIVISIONS.map((division) => (
              <label key={division}>
                <input
                  type="checkbox"
                  checked={divisions.includes(division)}
                  onChange={(e) =>
                    setDivisions((current) =>
                      e.target.checked ? [...current, division] : current.filter((d) => d !== division),
                    )
                  }
                />
                {DIVISION_LABELS[division]}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ol className="rules">
            {GROUND_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
          <p className="muted">{ANONYMITY_NOTICE} Mods can take posts down but can’t see who wrote them.</p>
        </section>

        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>
            I read the rules. I get that anonymous posts are hidden from students, not from the school.
          </span>
        </label>

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="row row--between">
          <button className="btn btn--quiet" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Setting up' : 'Done'}
          </button>
        </div>
      </form>
    </PublicFrame>
  );
}

export function NotFound() {
  useEffect(() => {
    document.title = `Not found | ${APP_NAME}`;
  }, []);
  return (
    <PublicFrame>
      <div className="state">
        <h1 className="page-h">Page not found</h1>
        <p>
          The link might be old, or the post got removed. <Link to="/">Go to the feed</Link>
        </p>
      </div>
    </PublicFrame>
  );
}
