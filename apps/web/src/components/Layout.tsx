import { ANONYMITY_NOTICE, APP_NAME, GROUND_RULES, initials, isModeratorRole } from '@commons/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useBoardFeed, useSpaces } from '../data/hooks';
import { Icon, IconSprite } from './Icon';
import { Wordmark } from './Identity';

function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) navigate(`/search?q=${encodeURIComponent(text.trim())}`);
  };
  return (
    <form className="nb-top__search" role="search" onSubmit={submit}>
      <Icon name="search" />
      <input
        type="search"
        aria-label="Search threads and spaces"
        placeholder="Search threads and spaces"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={120}
      />
    </form>
  );
}

export function TopBar() {
  const { state } = useAuth();
  const member = state.status === 'member' ? state : null;
  return (
    <header className="nb-top">
      <Wordmark />
      {member && <SearchBox />}
      <div className="nb-top__right">
        {member ? (
          <>
            <Link className="nb-top__icon" to="/spaces" aria-label="Search and spaces">
              <Icon name="search" />
            </Link>
            <Link className="nb-btn nb-btn--primary nb-btn--sm" to="/new">
              Start a thread
            </Link>
            <Link className="nb-top__me" to="/me">
              <span className="nb-avatar">{initials(member.profile.displayName)}</span>
              <span className="nb-sr">Your account, {member.profile.displayName}</span>
            </Link>
          </>
        ) : (
          <>
            <Link className="nb-btn nb-btn--sm" to="/about">
              About
            </Link>
            {state.status === 'signedOut' && (
              <Link
                className="nb-btn nb-btn--primary nb-btn--sm"
                to="/sign-in"
                style={{ display: 'inline-flex' }}
              >
                Sign in
              </Link>
            )}
          </>
        )}
      </div>
    </header>
  );
}

/** Left column: the list of spaces. */
export function SpaceNav() {
  const { spaces } = useSpaces();
  const { state } = useAuth();
  const { pathname } = useLocation();
  const total = spaces.reduce((sum, space) => sum + (space.postCount ?? 0), 0);
  const mod = state.status === 'member' && isModeratorRole(state.role);
  const admin = state.status === 'member' && state.role === 'admin';
  return (
    <aside className="fp-side" aria-label="Spaces">
      <nav aria-label="Spaces">
        <h2 className="fp-side__h">Spaces</h2>
        <ul className="nb-spaces">
          <li>
            <Link to="/" aria-current={pathname === '/' ? 'page' : undefined}>
              <span>Front page</span>
              <span>{total}</span>
            </Link>
          </li>
          {spaces.map((space) => (
            <li key={space.id}>
              <Link
                to={`/s/${space.slug}`}
                aria-current={pathname === `/s/${space.slug}` ? 'page' : undefined}
              >
                <span>{space.name}</span>
                <span>{space.postCount ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {(mod || admin) && (
        <nav aria-label="Moderation">
          <h2 className="fp-side__h">For moderators</h2>
          <ul className="nb-spaces">
            <li>
              <Link to="/mod" aria-current={pathname === '/mod' ? 'page' : undefined}>
                <span>Moderation queue</span>
                <span />
              </Link>
            </li>
            {admin && (
              <li>
                <Link to="/admin" aria-current={pathname.startsWith('/admin') ? 'page' : undefined}>
                  <span>Administration</span>
                  <span />
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
      <p className="fp-foot">
        Need a space for your team or club? Ask a moderator and it will usually be up by the next day.
      </p>
      <p className="fp-foot">
        <Link to="/about">How {APP_NAME} works</Link>
      </p>
    </aside>
  );
}

/** Right column: about, ground rules, who can see what, the hall screen, the Nobleman. */
export function Sidebar({ spaceName, spaceDescription }: { spaceName?: string; spaceDescription?: string }) {
  const { feed } = useBoardFeed();
  return (
    <aside className="fp-side" aria-label="About">
      <section className="nb-box">
        <h2 className="nb-box__head" style={{ margin: 0 }}>
          {spaceName ? `About ${spaceName}` : `About ${APP_NAME}`}
        </h2>
        <div className="nb-box__body">
          <p>
            {spaceDescription ??
              'A place for all of us, students and faculty, to talk about school news, what’s going on in the world, and whatever else is on our minds.'}
          </p>
          <Link className="nb-btn nb-btn--primary" to="/new" style={{ width: '100%' }}>
            Start a thread
          </Link>
        </div>
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
        <div>
          <b>Who can see what.</b> {ANONYMITY_NOTICE}
        </div>
      </div>
      <section className="nb-box">
        <h2 className="nb-box__head" style={{ margin: 0 }}>
          On the Gleason Hall screen
        </h2>
        <div className="nb-box__body fp-tv">
          <Link className="scr" data-theme="board" to="/board">
            <span className="nb-badge nb-badge--live">
              <Icon name="tv" /> Live now
            </span>
            <p>{feed?.questionText || 'Today’s question will show here.'}</p>
          </Link>
          <span className="nb-meta">Comment from your phone and it can show up on the hall screen.</span>
        </div>
      </section>
      {feed && feed.nobleman.length > 0 && (
        <section className="nb-box">
          <h2 className="nb-box__head" style={{ margin: 0 }}>
            From the Nobleman
          </h2>
          <div className="nb-box__body fp-src">
            {feed.nobleman.map((item) => {
              const inner = (
                <>
                  <div className="nb-source__title">{item.title}</div>
                  <div className="nb-source__meta">
                    {item.sample ? 'Sample headline' : 'The Nobleman'}
                    {item.minutes ? ` · ${item.minutes} min read` : ''}
                  </div>
                </>
              );
              return item.url ? (
                <a
                  className="nb-source"
                  key={item.title}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {inner}
                </a>
              ) : (
                <div className="nb-source" key={item.title}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </aside>
  );
}

/** Bottom tab bar on phones: Home, Spaces, Post, Board, You. */
export function TabBar() {
  const tab = ({ isActive }: { isActive: boolean }) => `ph-tab${isActive ? ' on' : ''}`;
  return (
    <nav className="ph-tabs" aria-label="Main">
      <NavLink className={tab} to="/" end>
        <Icon name="home" />
        Home
      </NavLink>
      <NavLink className={tab} to="/spaces">
        <Icon name="grid" />
        Spaces
      </NavLink>
      <NavLink className={({ isActive }) => `ph-tab plus${isActive ? ' on' : ''}`} to="/new">
        <span className="fab">
          <Icon name="plus" />
        </span>
        Post
      </NavLink>
      <NavLink className={tab} to="/board">
        <Icon name="tv" />
        Board
      </NavLink>
      <NavLink className={tab} to="/me">
        <Icon name="user" />
        You
      </NavLink>
    </nav>
  );
}

/**
 * The page frame for members: top bar, spaces on the left, the page in the
 * middle, and (when a page asks for one) the sidebar on the right.
 */
export function Page({
  children,
  sidebar,
  label,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  label?: string;
}) {
  return (
    <div className={sidebar ? 'fp-grid' : 'fp-grid fp-grid--wide'}>
      <SpaceNav />
      <main className="fp-col" id="main" tabIndex={-1} aria-label={label}>
        {children}
      </main>
      {sidebar}
    </div>
  );
}

export function Shell() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to the content
      </a>
      <IconSprite />
      <TopBar />
      <Outlet />
      <TabBar />
    </>
  );
}

/** A plain frame for public pages (sign-in, about, not found). */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to the content
      </a>
      <IconSprite />
      <TopBar />
      <div className="fp-grid fp-grid--solo">
        <main className="fp-col" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}
