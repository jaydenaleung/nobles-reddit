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
  held: 'With a mod',
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
    document.title = `You | ${APP_NAME}`;
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
      toast('Downloaded.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim().toLowerCase() !== 'delete') {
      setDeleteError('Type delete to confirm.');
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
          <h2 id="me-profile">Account</h2>
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
                <dt>School</dt>
                <dd>{p.divisions.map((d) => DIVISION_LABELS[d]).join(', ')}</dd>
              </>
            )}
          </dl>
          <p className="muted">Only you and the admins can see these details.</p>
          <div className="row">
            <button className="btn" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </section>

        <section className="panel" aria-labelledby="me-theme">
          <h2 id="me-theme">Theme</h2>
          <fieldset className="radio-list">
            <legend className="nb-sr">Theme</legend>
            {(
              [
                ['system', 'Same as my device'],
                ['paper', 'Light'],
                ['night', 'Dark'],
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
          <h2 id="me-posts">Your posts</h2>
          <p className="muted">
            Your anonymous posts are in this list too. Only you can see that they’re yours.
          </p>
          {mine.load === 'loading' ? (
            <Loading label="Loading" />
          ) : mine.load === 'error' ? (
            <ErrorState title="Your posts didn’t load" onRetry={mine.refresh} />
          ) : mine.items.length === 0 ? (
            <Empty title="Nothing yet">
              <p>
                Your posts and replies show up here. <Link to="/new">Write a post</Link>
              </p>
            </Empty>
          ) : (
            <div
              className="tbl-wrap"
              tabIndex={0}
              role="group"
              aria-label="Your posts. Scroll sideways for more columns."
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Post</th>
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
                        <div className="muted">{item.kind === 'post' ? 'Post' : 'Reply'}</div>
                      </td>
                      <td>
                        {item.identityMode === 'anonymous' ? (
                          <span className="role">
                            <Icon name="mask" />
                            Anonymous
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
          <h2 id="me-saved">Saved</h2>
          {saved.length === 0 ? (
            <p className="muted">Hit Save on a post and it shows up here. Saves stay on this device.</p>
          ) : (
            <ul className="plain-list">
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
          <p>Download a file with everything this site has stored about you.</p>
          <div className="row">
            <button className="btn" type="button" onClick={() => void download()} disabled={exporting}>
              {exporting ? 'Getting it ready' : 'Download my data'}
            </button>
            <button className="btn" type="button" onClick={() => setConfirming(true)}>
              Delete my account
            </button>
          </div>
        </section>

        <SpacesTiles />
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete your account?">
        <form className="stack" onSubmit={(event) => void deleteAccount(event)}>
          <p style={{ margin: 0 }}>
            Your account goes away. Posts you made under your name stay up, but they say “Former member”
            instead of your name.
          </p>
          <p style={{ margin: 0 }}>
            <b>The school still keeps its record of who wrote every post, yours too.</b> Admins can look that
            up, and each lookup is logged. You can’t undo this.
          </p>
          <div className="field">
            <label className="label" htmlFor="delete-confirm">
              Type delete to confirm
            </label>
            <input
              className="input"
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
            <button className="btn btn--quiet" type="button" onClick={() => setConfirming(false)}>
              Keep my account
            </button>
            <button className="btn" type="submit" disabled={deleting}>
              {deleting ? 'Deleting' : 'Delete my account'}
            </button>
          </div>
        </form>
      </Dialog>
    </Page>
  );
}

/** On phones the left column is hidden, so mods get their links here. */
function SpacesTiles() {
  const member = useMember();
  if (member.role !== 'moderator' && member.role !== 'admin') return null;
  return (
    <section className="panel ph-only" aria-label="Moderation">
      <h2>Mods</h2>
      <div className="row">
        <Link className="btn" to="/mod">
          Mod queue
        </Link>
        {member.role === 'admin' && (
          <Link className="btn" to="/admin">
            Admin
          </Link>
        )}
      </div>
    </section>
  );
}

/** The Spaces tab on phones. */
export function Spaces() {
  const { spaces, load } = useSpaces();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  useEffect(() => {
    document.title = `Spaces | ${APP_NAME}`;
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
            Search posts
          </label>
          <input
            className="input"
            id="spaces-search"
            type="search"
            style={{ flex: 1 }}
            placeholder="Search posts"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
        {load === 'loading' ? (
          <Loading label="Loading" />
        ) : load === 'error' ? (
          <ErrorState title="Spaces didn’t load" />
        ) : spaces.length === 0 ? (
          <Empty title="No spaces yet">
            <p>An admin has to add them first.</p>
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
