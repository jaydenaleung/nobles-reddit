import { CORE_VALUES, initials, isModeratorRole } from '@commons/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSpaces } from '../data/hooks';
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
            <Link className="nb-btn nb-btn--sm" to="/values">
              Community values
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
              <span>My feed</span>
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
      <ValuesReminder />
      <p className="fp-foot">Want a space for your team or club? Ask a moderator.</p>
    </aside>
  );
}

/** Left column, under the spaces: a short reminder of the Nobles core values. */
export function ValuesReminder() {
  return (
    <section className="fp-values" aria-labelledby="fp-values-h">
      <h2 className="fp-side__h" id="fp-values-h">
        Community values
      </h2>
      <p>Everything here should hold up to the Nobles community values and our core values:</p>
      <ul>
        {CORE_VALUES.map((value) => (
          <li key={value.name}>{value.name}</li>
        ))}
      </ul>
      <Link to="/values">Read the community values</Link>
    </section>
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

/** The page frame for members: top bar, spaces and values on the left, the page filling the rest. */
export function Page({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="fp-grid">
      <SpaceNav />
      <main className="fp-col" id="main" tabIndex={-1} aria-label={label}>
        {children}
      </main>
    </div>
  );
}

export function Shell() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
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
        Skip to content
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
