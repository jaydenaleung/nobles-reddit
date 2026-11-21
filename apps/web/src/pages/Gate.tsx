import {
  APP_NAME,
  CORE_VALUES,
  DIVISIONS,
  DIVISION_LABELS,
  SCHOOL_NAME,
  type Division,
} from '@commons/shared';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';
import { USE_EMULATORS, config } from '../config';
import { LogoMarkSvg } from '../components/Logo';
import { PublicFrame } from '../components/Layout';
import { Loading } from '../components/Ui';

/**
 * Emulator builds only: made-up people for local development and tests.
 * It is rendered behind a build-time constant, so production builds leave it out entirely.
 */
function DevelopmentSignIn() {
  const { signInForDevelopment } = useAuth();
  const [email, setEmail] = useState('sample.student@nobles.edu');
  const [error, setError] = useState<string | null>(null);
  if (!signInForDevelopment) return null;
  const go = async (address: string, name: string) => {
    setError(null);
    try {
      await signInForDevelopment(address, name);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <section className="panel" aria-label="Local development sign-in">
      <h2>Local development</h2>
      <p className="muted">
        Only shows up when the site runs on the Firebase emulators. These are test accounts.
      </p>
      <div className="row">
        <button
          className="nb-btn nb-btn--sm"
          type="button"
          onClick={() => void go('sample.student@nobles.edu', 'Sample Student')}
        >
          Sample student
        </button>
        <button
          className="nb-btn nb-btn--sm"
          type="button"
          onClick={() => void go('sample.teacher@nobles.edu', 'Sample Teacher')}
        >
          Sample teacher
        </button>
        <button
          className="nb-btn nb-btn--sm"
          type="button"
          onClick={() => void go('sample.moderator@nobles.edu', 'Sample Moderator')}
        >
          Sample moderator
        </button>
        <button
          className="nb-btn nb-btn--sm"
          type="button"
          onClick={() => void go('sample.admin@nobles.edu', 'Sample Admin')}
        >
          Sample admin
        </button>
      </div>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          void go(email.trim(), 'Sample Person');
        }}
      >
        <label className="nb-sr" htmlFor="dev-email">
          Any email address
        </label>
        <input
          className="nb-input"
          id="dev-email"
          style={{ flex: 1, minWidth: 220 }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="nb-btn nb-btn--sm" type="submit">
          Sign in as this address
        </button>
      </form>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const LANDING_TITLE = 'Join the Noblest place on the internet';
const LANDING_SUBTITLE = 'The school discussion board for Noble and Greenough School students and faculty';

/** Google's "G", for the sign-in button (the multicolour mark Google asks sign-in buttons to use). */
function GoogleMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function SignIn() {
  const { state, notice, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Sign in  | ${APP_NAME}`;
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
            ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
            : 'Sign-in didn’t work. Try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicFrame>
      <div className="welcome">
        <LogoMarkSvg size={64} />
        <h1 className="welcome__title">{LANDING_TITLE}</h1>
        <p className="welcome__sub">{LANDING_SUBTITLE}</p>
        {notice && (
          <div className="nb-notice" role="alert">
            <div>{notice}</div>
          </div>
        )}
        {state.status === 'loading' ? (
          <Loading label="Checking if you’re signed in" />
        ) : (
          <div className="welcome__cta">
            <button className="welcome__google" type="button" onClick={() => void go()} disabled={busy}>
              <GoogleMark />
              <span>{busy ? 'Opening Google…' : 'Continue with Google'}</span>
            </button>
            {error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            <p className="welcome__hint">
              Use your <b>@{config.allowedDomains.join(' or @')}</b> Google account. Personal Gmail won’t
              work.
            </p>
          </div>
        )}
        <ul className="welcome__values" aria-label="Our core values">
          {CORE_VALUES.map((value) => (
            <li key={value.name}>{value.name}</li>
          ))}
        </ul>
        {USE_EMULATORS && (
          <div className="welcome__dev">
            <DevelopmentSignIn />
          </div>
        )}
        <div className="welcome__fine">
          <p>
            We only get your name and school email from Google. There are no ads or trackers. Everything you
            post on {APP_NAME} goes up under your name. <Link to="/values">Our community values</Link>
          </p>
          <p>
            {APP_NAME} is a student-run site and is not affiliated with {SCHOOL_NAME}.
          </p>
        </div>
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
    document.title = `Welcome  | ${APP_NAME}`;
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
    if (!who) return setError('Tell us whether you are a student or faculty.');
    if (who === 'student' && !classYear) return setError('Choose your class year.');
    if (!understood) return setError('Please tick the box to say you’ll stick to the community values.');
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

  return (
    <PublicFrame>
      <form
        className="gate__card"
        style={{ justifySelf: 'center' }}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <h1>Set up your account</h1>
        <p className="page-lede">Signed in as {state.user.email}.</p>

        <section className="panel">
          <h2>Your name</h2>
          <div className="field-row">
            <div className="field">
              <label className="nb-label" htmlFor={`${id}-first`}>
                First name
              </label>
              <input
                className="nb-input"
                id={`${id}-first`}
                value={firstName}
                maxLength={40}
                autoComplete="given-name"
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: '0 1 160px' }}>
              <label className="nb-label" htmlFor={`${id}-last`}>
                Last initial
              </label>
              <input
                className="nb-input"
                id={`${id}-last`}
                value={lastInitial}
                maxLength={1}
                onChange={(e) => setLastInitial(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <p className="nb-help">
            Posts with your name show “{firstName.trim() || 'First'} {lastInitial.trim() || 'L'}.” and nothing
            else.
          </p>

          <fieldset className="radio-list">
            <legend>I am</legend>
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
            <div className="field" style={{ maxWidth: 220 }}>
              <label className="nb-label" htmlFor={`${id}-year`}>
                Class year
              </label>
              <select
                className="nb-select"
                id={`${id}-year`}
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
              >
                <option value="">Choose a year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}
          {who === 'faculty' && (
            <p className="nb-help">
              An admin adds the Faculty badge. Until then you can still read and post.
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

        <section className="nb-box">
          <h2 className="nb-box__head" style={{ margin: 0 }}>
            Community values
          </h2>
          <div className="nb-box__body">
            <p>
              Neddit is about learning to disagree respectfully. Everything here should hold up to our core
              values:
            </p>
            <ol className="fp-rules">
              {CORE_VALUES.map((value) => (
                <li key={value.name}>{value.name}</li>
              ))}
            </ol>
            <p>
              <Link to="/values" target="_blank">
                Read the community values
              </Link>
            </p>
          </div>
        </section>

        <p className="muted">
          Everything you post goes up under your name. Remember that what you say here maintains a permanent
          digital footprint.
        </p>

        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>I read the community values and I’ll stick to them.</span>
        </label>

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="row row--between">
          <button className="nb-btn nb-btn--quiet" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
          <button className="nb-btn nb-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Setting up' : 'Done'}
          </button>
        </div>
      </form>
    </PublicFrame>
  );
}

export function NotFound() {
  useEffect(() => {
    document.title = `Not found  | ${APP_NAME}`;
  }, []);
  return (
    <PublicFrame>
      <div className="state">
        <h1 className="page-h">That page is not here</h1>
        <p>The link might be old, or the thread got removed.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="nb-btn nb-btn--primary" to="/">
            Go to the front page
          </Link>
          <Link className="nb-btn" to="/values">
            Community values
          </Link>
        </div>
      </div>
    </PublicFrame>
  );
}
