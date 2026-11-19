import { ANONYMITY_NOTICE, GROUND_RULES, initials, isModeratorRole } from '@commons/shared';
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
        aria-label="Search posts"
        placeholder="Search posts"
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
            <Link className="nb-top__icon" to="/spaces" aria-label="Search">
              <Icon name="search" />
            </Link>
            <Link className="btn btn--primary btn--sm" to="/new">
              Post
            </Link>
            <Link className="nb-top__me" to="/me">
              <span className="nb-avatar">{initials(member.profile.displayName)}</span>
              <span className="nb-sr">You, {member.profile.displayName}</span>
            </Link>
          </>
        ) : (
          <Link className="btn btn--sm" to="/about">
            How this works
          </Link>
        )}
      </div>
    </header>
  );
}

export function SpaceNav() {
  const { spaces } = useSpaces();
  const { state } = useAuth();
  const { pathname } = useLocation();
  const total = spaces.reduce((sum, space) => sum + (space.postCount ?? 0), 0);
  const mod = state.status === 'member' && isModeratorRole(state.role);
  const admin = state.status === 'member' && state.role === 'admin';
  return (
    <aside className="side" aria-label="Spaces">
      <nav aria-label="Spaces">
        <h2 className="side__h">Spaces</h2>
        <ul className="spaces">
          <li>
            <Link to="/" aria-current={pathname === '/' ? 'page' : undefined}>
              <span>All</span>
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
      {mod && (
        <nav aria-label="Moderation">
          <h2 className="side__h">Mods</h2>
          <ul className="spaces">
            <li>
              <Link to="/mod" aria-current={pathname === '/mod' ? 'page' : undefined}>
                <span>Mod queue</span>
              </Link>
            </li>
            {admin && (
              <li>
                <Link to="/admin" aria-current={pathname.startsWith('/admin') ? 'page' : undefined}>
                  <span>Admin</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
      <p className="side__note">Want a space for your team or club? Ask an admin.</p>
      <p className="side__note">
        <Link to="/about">How anonymous works</Link>
      </p>
    </aside>
  );
}

export function Sidebar({ spaceDescription }: { spaceDescription?: string }) {
  const { feed } = useBoardFeed();
  return (
    <aside className="aside" aria-label="Sidebar">
      {spaceDescription && (
        <section className="box">
          <p>{spaceDescription}</p>
        </section>
      )}
      <section className="box">
        <h2>On the Gleason TV</h2>
        <Link className="tv" to="/board">
          {feed?.questionText || 'Nothing up yet. A mod picks the question each morning.'}
        </Link>
        <p className="muted">Reply from your phone. A mod can put your reply on the screen.</p>
      </section>
      <section className="box">
        <h2>Rules</h2>
        <ol className="rules">
          {GROUND_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </section>
      <p className="muted">{ANONYMITY_NOTICE}</p>
      {feed && feed.nobleman.length > 0 && (
        <section className="box">
          <h2>In the Nobleman</h2>
          <ul className="spaces">
            {feed.nobleman.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

export function TabBar() {
  return (
    <nav className="ph-tabs" aria-label="Main">
      <NavLink className="ph-tab" to="/" end>
        <Icon name="home" />
        Feed
      </NavLink>
      <NavLink className="ph-tab" to="/spaces">
        <Icon name="grid" />
        Spaces
      </NavLink>
      <NavLink className="ph-tab plus" to="/new">
        <Icon name="plus" />
        Post
      </NavLink>
      <NavLink className="ph-tab" to="/board">
        <Icon name="tv" />
        TV
      </NavLink>
      <NavLink className="ph-tab" to="/me">
        <Icon name="user" />
        You
      </NavLink>
    </nav>
  );
}

export function Page({ children, sidebar }: { children: ReactNode; sidebar?: ReactNode }) {
  return (
    <div className={sidebar ? 'grid' : 'grid grid--wide'}>
      <SpaceNav />
      <main className="col" id="main" tabIndex={-1}>
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
        Skip to content
      </a>
      <IconSprite />
      <TopBar />
      <Outlet />
      <TabBar />
    </>
  );
}

export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <IconSprite />
      <TopBar />
      <div className="grid grid--solo">
        <main className="col" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}
