import { APP_NAME, SORTS, SORT_LABELS, postKey, type Sort } from '@commons/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useMember } from '../auth/AuthContext';
import { Page, Sidebar } from '../components/Layout';
import { PostRow, type PostView } from '../components/Post';
import { Empty, ErrorState, Loading, useToast } from '../components/Ui';
import { MAX_START_PAGES, useFeed, useMyVotes, useSearch, useSpaces, type MyVotes } from '../data/hooks';
import { openedThreads, readScroll, savedThreads, toggleSaved, writeScroll } from '../lib/storage';

export function ThreadList({
  posts,
  votes,
  onVote,
}: {
  posts: PostView[];
  votes: MyVotes;
  onVote: (post: PostView) => void;
}) {
  const { byId } = useSpaces();
  const toast = useToast();
  const opened = useMemo(() => openedThreads(), []);
  const [saved, setSaved] = useState(() => new Set(savedThreads().map((t) => t.id)));
  const [now] = useState(() => Date.now());

  const share = async (post: PostView) => {
    const url = `${window.location.origin}/t/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied.');
      }
    } catch {
      /* share sheet closed */
    }
  };

  const save = (post: PostView) => {
    const isSaved = toggleSaved({ id: post.id, title: post.title });
    setSaved((current) => {
      const next = new Set(current);
      if (isSaved) next.add(post.id);
      else next.delete(post.id);
      return next;
    });
    toast(isSaved ? 'Saved on this device. It’s under You.' : 'Unsaved.');
  };

  return (
    <section className="feed" aria-label="Posts">
      {posts.map((post) => (
        <PostRow
          key={post.id}
          post={post}
          spaceSlug={byId(post.spaceId)?.slug}
          nowMs={now}
          voted={votes.thoughtful.has(postKey(post.id))}
          onVote={() => onVote(post)}
          read={opened.has(post.id)}
          saved={saved.has(post.id)}
          onSave={() => save(post)}
          onShare={() => void share(post)}
        />
      ))}
    </section>
  );
}

/** The count moves right away and goes back if the server says no. */
export function useFeedVoting(
  uid: string,
  posts: PostView[],
  patch: (id: string, change: (post: PostView) => PostView) => void,
) {
  const toast = useToast();
  const { votes, setThoughtful } = useMyVotes(
    uid,
    posts.map((p) => p.id),
  );
  const onVote = async (post: PostView) => {
    const key = postKey(post.id);
    const was = votes.thoughtful.has(key);
    const delta = was ? -1 : 1;
    setThoughtful(key, !was);
    patch(post.id, (p) => ({ ...p, thoughtfulCount: Math.max(0, p.thoughtfulCount + delta) }));
    try {
      await api.toggleThoughtful({ contentKey: key });
    } catch (error) {
      setThoughtful(key, was);
      patch(post.id, (p) => ({ ...p, thoughtfulCount: Math.max(0, p.thoughtfulCount - delta) }));
      toast(errorMessage(error));
    }
  };
  return { votes, onVote };
}

/** Asks for the next page when this comes within about a screen of the viewport. */
function LoadNext({
  count,
  hasMore,
  loading,
  failed,
  onLoad,
  newHref,
}: {
  count: number;
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onLoad: () => void;
  newHref: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || failed) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoad();
      },
      { rootMargin: '900px 0px' },
    );
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [count, hasMore, failed, onLoad]);

  if (failed) {
    return (
      <div className="feed-foot" role="alert">
        Couldn’t load more posts.{' '}
        <button className="btn btn--sm" type="button" onClick={onLoad}>
          Try again
        </button>
      </div>
    );
  }
  if (!hasMore) {
    return (
      <p className="feed-foot">
        That’s every post. <Link to={newHref}>Post something</Link>
      </p>
    );
  }
  return (
    <div className="feed-foot" ref={ref}>
      <button className="btn btn--sm" type="button" onClick={onLoad} disabled={loading}>
        {loading ? 'Loading' : 'More posts'}
      </button>
    </div>
  );
}

function startPage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? Math.min(n, MAX_START_PAGES) : 1;
}

export default function Feed() {
  const { slug } = useParams();
  const member = useMember();
  const location = useLocation();
  const { spaces, bySlug, load: spacesLoad } = useSpaces();
  const [params, setParams] = useSearchParams();
  const sortParam = params.get('sort') as Sort | null;
  const sort: Sort = sortParam && SORTS.includes(sortParam) ? sortParam : 'hot';
  const space = slug ? bySlug(slug) : undefined;
  const unknownSpace = !!slug && spacesLoad === 'ready' && !space;
  const waitingForSpace = !!slug && !space && !unknownSpace;
  const newHref = space ? `/new?space=${space.slug}` : '/new';

  const feed = useFeed(
    waitingForSpace || unknownSpace ? '__none__' : space?.id,
    sort,
    startPage(params.get('page')),
  );
  const { votes, onVote } = useFeedVoting(member.user.uid, feed.posts, feed.patch);

  useEffect(() => {
    document.title = space ? `${space.name} | ${APP_NAME}` : APP_NAME;
  }, [space]);

  // Keep ?page= in step with how far down you've loaded, without adding history entries.
  useEffect(() => {
    if (feed.load !== 'ready') return;
    const current = params.get('page');
    const wanted = feed.pages > 1 ? String(feed.pages) : null;
    if (current === wanted) return;
    const next = new URLSearchParams(params);
    if (wanted) next.set('page', wanted);
    else next.delete('page');
    setParams(next, { replace: true });
  }, [feed.load, feed.pages, params, setParams]);

  const scrollKey = `${location.pathname}?sort=${sort}`;
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => writeScroll(scrollKey, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scrollKey]);

  // After a refresh or coming back from a thread, go back to where you were. Only on the first load.
  const restored = useRef(false);
  useEffect(() => {
    if (feed.load !== 'ready' || restored.current) return;
    restored.current = true;
    const y = readScroll(scrollKey);
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [feed.load, scrollKey]);

  const sidebar = <Sidebar spaceDescription={space?.description} />;

  if (unknownSpace) {
    return (
      <Page sidebar={sidebar}>
        <Empty title="No space with that name">
          <p>
            It might have been renamed. <Link to="/">Go to all posts</Link>
          </p>
        </Empty>
      </Page>
    );
  }

  return (
    <Page sidebar={sidebar}>
      {space ? (
        <header className="space-head">
          <h1>{space.name}</h1>
        </header>
      ) : (
        <h1 className="nb-sr">All posts</h1>
      )}

      <nav className="chips" aria-label="Spaces">
        <Link to="/" aria-current={!slug ? 'page' : undefined}>
          All
        </Link>
        {spaces.map((s) => (
          <Link key={s.id} to={`/s/${s.slug}`} aria-current={slug === s.slug ? 'page' : undefined}>
            {s.name}
          </Link>
        ))}
      </nav>

      <nav className="sortbar" aria-label="Sort">
        {SORTS.map((s) => (
          <a
            key={s}
            href={`?sort=${s}`}
            aria-current={sort === s ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault();
              setParams(s === 'hot' ? {} : { sort: s });
              window.scrollTo(0, 0);
            }}
          >
            {SORT_LABELS[s]}
          </a>
        ))}
        <Link className="btn btn--primary btn--sm" to={newHref}>
          Post
        </Link>
      </nav>

      {feed.load === 'loading' || waitingForSpace ? (
        <Loading label="Loading posts" />
      ) : feed.load === 'error' ? (
        <ErrorState title="The feed didn’t load" onRetry={feed.reload} />
      ) : feed.posts.length === 0 ? (
        <Empty title={sort === 'unanswered' ? 'Everything here has a reply' : 'No posts here yet'}>
          <p>
            {sort === 'unanswered' ? (
              <Link to="?sort=new">See the newest posts</Link>
            ) : (
              <Link to={newHref}>Write the first one</Link>
            )}
          </p>
        </Empty>
      ) : (
        <>
          <ThreadList posts={feed.posts} votes={votes} onVote={(post) => void onVote(post)} />
          <LoadNext
            count={feed.posts.length}
            hasMore={feed.hasMore}
            loading={feed.loadingMore}
            failed={feed.moreFailed}
            onLoad={() => void feed.loadMore()}
            newHref={newHref}
          />
        </>
      )}
    </Page>
  );
}

export function Search() {
  const member = useMember();
  const [params] = useSearchParams();
  const text = params.get('q') ?? '';
  const { spaces } = useSpaces();
  const search = useSearch(text);
  const { votes, onVote } = useFeedVoting(member.user.uid, search.posts, search.patch);
  const matchingSpaces = spaces.filter(
    (s) => text.trim() && s.name.toLowerCase().includes(text.trim().toLowerCase()),
  );

  useEffect(() => {
    document.title = `Search | ${APP_NAME}`;
  }, []);

  return (
    <Page sidebar={<Sidebar />}>
      <header className="space-head">
        <h1>{text ? `“${text}”` : 'Search'}</h1>
      </header>
      {matchingSpaces.length > 0 && (
        <nav className="chips" aria-label="Matching spaces" style={{ display: 'flex' }}>
          {matchingSpaces.map((s) => (
            <Link key={s.id} to={`/s/${s.slug}`}>
              {s.name}
            </Link>
          ))}
        </nav>
      )}
      {search.load === 'loading' ? (
        <Loading label="Searching" />
      ) : search.load === 'error' ? (
        <ErrorState title="Search didn’t work" />
      ) : search.tokens.length === 0 ? (
        <Empty title={text ? 'Try a more specific word' : 'Type something in the search box'}>
          {text && <p>Words like “the” and “what” get skipped.</p>}
        </Empty>
      ) : search.posts.length === 0 ? (
        <Empty title="Nothing matches that">
          <p>Search checks titles and the start of each post. It never searches by who wrote it.</p>
        </Empty>
      ) : (
        <ThreadList posts={search.posts} votes={votes} onVote={(post) => void onVote(post)} />
      )}
    </Page>
  );
}
