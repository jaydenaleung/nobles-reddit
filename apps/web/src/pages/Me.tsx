import { APP_NAME, DIVISION_LABELS, excerpt, relativeTime, shortClassYear } from '@commons/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useAuth, useMember } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { Dialog, Empty, ErrorState, Loading, downloadJson, useToast } from '../components/Ui';
import { useMine, useSpaces } from '../data/hooks';
import { applyTheme, savedThreads, themeChoice, type ThemeChoice } from '../lib/storage';

const STATUS_WORDS = {
  visible: 'Visible',
  held: 'With a moderator',
  removed: 'Removed',
} as const;

export default function Me() {
  const member = useMember();
  const { signOut } = useAuth();
  const mine = useMine();
  const toast = useToast();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeChoice>(() => themeChoice());
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saved] = useState(() => savedThreads());
  const [now] = useState(() => Date.now());
  const p = member.profile;

  useEffect(() => {
    document.title = `You · ${APP_NAME}`;
    mine.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    applyTheme(choice);
  };

  const download = async () => {
    setExporting(true);
    try {
      downloadJson('nobles-commons-my-data.json', await api.exportMyData({}));
      toast('Your data was downloaded.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim().toLowerCase() !== 'delete') {
      setDeleteError('Type the word delete to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMyAccount({});
      await signOut();
      navigate('/sign-in');
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeleting(false);
    }
  };

  return (
    <Page>
      <div className="page">
        <h1 className="page-h">You</h1>

        <section className="panel" aria-labelledby="me-profile">
          <h2 id="me-profile">Your account</h2>
          <dl className="kv">
            <dt>Shown as</dt>
            <dd>
              {p.displayName}
              {p.classYear ? ` ${shortClassYear(p.classYear)}` : ''}
            </dd>
            <dt>School email</dt>
            <dd>{p.email}</dd>
            <dt>Role</dt>
            <dd>{member.role}</dd>
            {p.divisions?.length > 0 && (
              <>
                <dt>Part of school</dt>
                <dd>{p.divisions.map((d) => DIVISION_LABELS[d]).join(', ')}</dd>
              </>
            )}
          </dl>
          <p className="muted">Only you and the administration can see this page’s details.</p>
          <div className="row">
            <button className="nb-btn" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </section>

        <section className="panel" aria-labelledby="me-theme">
          <h2 id="me-theme">How it looks</h2>
          <fieldset className="radio-list">
            <legend>Theme</legend>
            {(
              [
                ['system', 'Match my device'],
                ['paper', 'Paper (light)'],
                ['night', 'Night (dark)'],
              ] as [ThemeChoice, string][]
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="theme"
                  checked={theme === value}
                  onChange={() => chooseTheme(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="panel" aria-labelledby="me-posts">
          <h2 id="me-posts">Your posts and comments</h2>
          <p className="muted">
            This list includes what you posted as Anonymous. Only you see it here; other students still see
            “Anonymous”.
          </p>
          {mine.load === 'loading' ? (
            <Loading label="Loading your posts" />
          ) : mine.load === 'error' ? (
            <ErrorState title="Your posts did not load" onRetry={mine.refresh} />
          ) : mine.items.length === 0 ? (
            <Empty title="Nothing yet">
              <p>When you post or comment, it shows up here.</p>
              <Link className="nb-btn nb-btn--primary" to="/new">
                Start a thread
              </Link>
            </Empty>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">What you wrote</th>
                    <th scope="col">Posted as</th>
                    <th scope="col">Status</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.items.map((item) => (
                    <tr key={item.contentKey}>
                      <td>
                        {item.status === 'visible' ? (
                          <Link to={`/t/${item.postId}`}>{item.title ?? excerpt(item.body, 90)}</Link>
                        ) : (
                          (item.title ?? excerpt(item.body, 90))
                        )}
                        <div className="nb-meta">{item.kind === 'post' ? 'Thread' : 'Comment'}</div>
                      </td>
                      <td>
                        {item.identityMode === 'anonymous' ? (
                          <span className="nb-badge nb-badge--anon">
                            <Icon name="mask" /> Anonymous
                          </span>
                        ) : (
                          'Your name'
                        )}
                      </td>
                      <td>{STATUS_WORDS[item.status]}</td>
                      <td className="num">{relativeTime(item.createdAtMs, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="me-saved">
          <h2 id="me-saved">Saved on this device</h2>
          {saved.length === 0 ? (
            <p className="muted">
              Press Save on a thread to keep it here. Saved threads stay on this device only.
            </p>
          ) : (
            <ul className="stack" style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
              {saved.map((thread) => (
                <li key={thread.id}>
                  <Link to={`/t/${thread.id}`}>{thread.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="me-data">
          <h2 id="me-data">Your data</h2>
          <p>
            You can download everything the app holds about you: your profile, what you wrote, what you marked
            thoughtful and what you reported.
          </p>
          <div className="row">
            <button className="nb-btn" type="button" onClick={() => void download()} disabled={exporting}>
              {exporting ? 'Preparing' : 'Download my data'}
            </button>
            <button className="nb-btn nb-btn--danger" type="button" onClick={() => setConfirming(true)}>
              Delete my account
            </button>
          </div>
        </section>

        <SpacesTiles />
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete your account?">
        <form className="stack" onSubmit={(event) => void deleteAccount(event)}>
          <p>Here is exactly what happens:</p>
          <ul className="stack" style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
            <li>Your profile and sign-in are removed.</li>
            <li>Posts and comments under your name stay, but show “Former member” instead of your name.</li>
            <li>
              <b>The school keeps its record of who wrote each post</b>, including yours, as school policy
              requires. The administration can still look that up, and each lookup is logged.
            </li>
            <li>This cannot be undone.</li>
          </ul>
          <div className="field">
            <label className="nb-label" htmlFor="delete-confirm">
              Type the word delete to confirm
            </label>
            <input
              className="nb-input"
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
          {deleteError && (
            <p className="err" role="alert">
              {deleteError}
            </p>
          )}
          <div className="row row--between">
            <button className="nb-btn nb-btn--quiet" type="button" onClick={() => setConfirming(false)}>
              Keep my account
            </button>
            <button className="nb-btn nb-btn--danger" type="submit" disabled={deleting}>
              {deleting ? 'Deleting' : 'Delete my account'}
            </button>
          </div>
        </form>
      </Dialog>
    </Page>
  );
}

/** Links for moderators and admins on phones, where the left column is hidden. */
function SpacesTiles() {
  const member = useMember();
  if (member.role !== 'moderator' && member.role !== 'admin') return null;
  return (
    <section className="panel ph-only" aria-label="Moderation">
      <h2>For moderators</h2>
      <div className="row">
        <Link className="nb-btn" to="/mod">
          Moderation queue
        </Link>
        {member.role === 'admin' && (
          <Link className="nb-btn" to="/admin">
            Administration
          </Link>
        )}
      </div>
    </section>
  );
}

/** The Spaces tab on phones: search, then a door for each space. */
export function Spaces() {
  const { spaces, load } = useSpaces();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  useEffect(() => {
    document.title = `Spaces · ${APP_NAME}`;
  }, []);
  return (
    <Page>
      <div className="page">
        <h1 className="page-h">Spaces</h1>
        <form
          role="search"
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) navigate(`/search?q=${encodeURIComponent(text.trim())}`);
          }}
        >
          <label className="nb-sr" htmlFor="spaces-search">
            Search threads and spaces
          </label>
          <input
            className="nb-input"
            id="spaces-search"
            type="search"
            style={{ flex: 1 }}
            placeholder="Search threads and spaces"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="nb-btn" type="submit">
            Search
          </button>
        </form>
        {load === 'loading' ? (
          <Loading label="Loading spaces" />
        ) : load === 'error' ? (
          <ErrorState title="The spaces did not load" />
        ) : spaces.length === 0 ? (
          <Empty title="No spaces yet">
            <p>An administrator can add the first one.</p>
          </Empty>
        ) : (
          <nav className="doors" aria-label="All spaces">
            {spaces.map((space) => (
              <Link className="door" key={space.id} to={`/s/${space.slug}`}>
                <b>{space.postCount ?? 0}</b>
                <span>{space.name}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </Page>
  );
}
