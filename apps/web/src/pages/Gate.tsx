import {
  ANONYMITY_NOTICE,
  APP_NAME,
  DIVISIONS,
  DIVISION_LABELS,
  GROUND_RULES,
  SCHOOL_NAME,
  type Division,
} from '@commons/shared';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';
import { USE_EMULATORS, config } from '../config';
import { Icon } from '../components/Icon';
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
        This box only exists when the app runs against the Firebase emulators. These are made-up people.
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

export function SignIn() {
  const { state, notice, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Sign in · ${APP_NAME}`;
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
            : 'Sign-in did not work. Please try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicFrame>
      <div className="gate__card" style={{ justifySelf: 'center' }}>
        <h1>A place for all of us to talk.</h1>
        <p className="page-lede">
          {APP_NAME} is a discussion board for students and faculty at {SCHOOL_NAME}: school news, what’s
          going on in the world, and whatever else is on our minds. Kind and honest, both.
        </p>
        {notice && (
          <div className="nb-notice" role="alert">
            <div>{notice}</div>
          </div>
        )}
        {state.status === 'loading' ? (
          <Loading label="Checking whether you are signed in" />
        ) : (
          <section className="panel">
            <h2>Sign in</h2>
            <p>
              Anyone with a <b>@{config.allowedDomains.join(' or @')}</b> Google account can join. Other
              accounts, including personal Gmail, cannot.
            </p>
            <div className="row">
              <button
                className="nb-btn nb-btn--primary"
                type="button"
                onClick={() => void go()}
                disabled={busy}
              >
                {busy ? 'Opening Google' : 'Sign in with your Nobles Google account'}
              </button>
            </div>
            {error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            <p className="muted">
              We ask Google for your name and school email, nothing else. No ads and no trackers.{' '}
              <Link to="/about">How it works and who can see what</Link>.
            </p>
          </section>
        )}
        {USE_EMULATORS && <DevelopmentSignIn />}
        <div className="nb-notice nb-notice--staff">
          <Icon name="shield" />
          <div>
            <b>Who can see what.</b> {ANONYMITY_NOTICE}
          </div>
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
    document.title = `Welcome · ${APP_NAME}`;
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
    if (!understood) return setError('Please tick the box to say you understand how it works.');
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
        <h1>Welcome. Two minutes, then you’re in.</h1>
        <p className="page-lede">Signed in as {state.user.email}.</p>

        <section className="panel">
          <h2>How your name will show</h2>
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
            When you post under your name, people see “{firstName.trim() || 'First'}{' '}
            {lastInitial.trim() || 'L'}.” We do not show your full last name or your photo.
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
              The “Faculty” badge is added by the administration, not by this form. Until then you can read
              and post like everyone else.
            </p>
          )}
          <fieldset className="radio-list">
            <legend>Which part of the school? (optional)</legend>
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
            Ground rules
          </h2>
          <div className="nb-box__body">
            <ol className="fp-rules">
              {GROUND_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </div>
        </section>

        <div className="nb-notice nb-notice--staff">
          <Icon name="shield" />
          <div>
            <b>Who can see what.</b> {ANONYMITY_NOTICE} Moderators can remove posts but cannot see who wrote
            them. Each time the administration looks up an author, it is logged.
          </div>
        </div>

        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>
            I understand: I will follow the ground rules, and anonymous posts are hidden from students but not
            from the school.
          </span>
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
            {busy ? 'Setting up' : 'Join the conversation'}
          </button>
        </div>
      </form>
    </PublicFrame>
  );
}

export function NotFound() {
  useEffect(() => {
    document.title = `Not found · ${APP_NAME}`;
  }, []);
  return (
    <PublicFrame>
      <div className="state">
        <h1 className="page-h">That page is not here</h1>
        <p>The link may be old, or the thread may have been removed. Nothing is broken on your end.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="nb-btn nb-btn--primary" to="/">
            Go to the front page
          </Link>
          <Link className="nb-btn" to="/about">
            How it works
          </Link>
        </div>
      </div>
    </PublicFrame>
  );
}
