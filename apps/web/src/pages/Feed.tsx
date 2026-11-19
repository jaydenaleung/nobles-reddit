import { APP_NAME, SORTS, SORT_LABELS, initials, postKey, type Sort } from '@commons/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useMember } from '../auth/AuthContext';
import { Page, Sidebar } from '../components/Layout';
import { FeedSkeleton, PostRow, type PostView } from '../components/Post';
import { Empty, ErrorState, useToast } from '../components/Ui';
import { useFeed, useMyVotes, useSearch, useSpaces, type MyVotes } from '../data/hooks';
import { openedThreads, savedThreads, toggleSaved } from '../lib/storage';

/** The list of threads with voting, saving and sharing. Shared by the feed and search. */
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
      /* the person closed the share sheet */
    }
  };

  return (
    <section className="nb-feed" aria-label="Threads">
      <h2 className="nb-sr">Threads</h2>
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
          onSave={() => {
            const isSaved = toggleSaved({ id: post.id, title: post.title });
            setSaved((current) => {
              const next = new Set(current);
              if (isSaved) next.add(post.id);
              else next.delete(post.id);
              return next;
            });
            toast(isSaved ? 'Saved on this device. Find it under You.' : 'Removed from your saved threads.');
          }}
          onShare={() => void share(post)}
        />
      ))}
    </section>
  );
}

/** Optimistic "Thoughtful" on a feed row: the count moves at once and rolls back if the server says no. */
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

export default function Feed() {
  const { slug } = useParams();
  const member = useMember();
  const { spaces, bySlug, load: spacesLoad } = useSpaces();
  const [params, setParams] = useSearchParams();
  const sortParam = params.get('sort') as Sort | null;
  const sort: Sort = sortParam && SORTS.includes(sortParam) ? sortParam : 'hot';
  const space = slug ? bySlug(slug) : undefined;
  const unknownSpace = !!slug && spacesLoad === 'ready' && !space;
  const waitingForSpace = !!slug && !space && !unknownSpace;

  const feed = useFeed(waitingForSpace || unknownSpace ? '__none__' : space?.id, sort);
  const { votes, onVote } = useFeedVoting(member.user.uid, feed.posts, feed.patch);

  useEffect(() => {
    document.title = space ? `${space.name}  | ${APP_NAME}` : APP_NAME;
  }, [space]);

  const sidebar = <Sidebar spaceName={space?.name} spaceDescription={space?.description} />;

  if (unknownSpace) {
    return (
      <Page sidebar={sidebar}>
        <Empty title="That space doesn’t exist">
          <p>It might have been renamed. The spaces are listed on the left.</p>
          <Link className="nb-btn" to="/">
            Go to the front page
          </Link>
        </Empty>
      </Page>
    );
  }

  return (
    <Page sidebar={sidebar}>
      {space ? (
        <header className="sp-head">
          <h1>{space.name}</h1>
          <p>{space.description}</p>
        </header>
      ) : (
        <h1 className="nb-sr">Front page</h1>
      )}

      <nav className="nb-chips ph-only" aria-label="Spaces">
        <Link className="nb-chip" to="/" aria-current={!slug ? 'page' : undefined}>
          All
        </Link>
        {spaces.map((s) => (
          <Link
            className="nb-chip"
            key={s.id}
            to={`/s/${s.slug}`}
            aria-current={slug === s.slug ? 'page' : undefined}
          >
            {s.name}
          </Link>
        ))}
      </nav>

      <div className="fp-start">
        <span className="nb-avatar" aria-hidden="true">
          {initials(member.profile.displayName)}
        </span>
        <Link className="in" to={space ? `/new?space=${space.slug}` : '/new'}>
          Start a thread
        </Link>
        <Link className="nb-btn nb-btn--sm" to={space ? `/new?space=${space.slug}` : '/new'}>
          Post
        </Link>
      </div>

      <nav className="nb-sort" aria-label="Sort">
        {SORTS.map((s) => (
          <a
            key={s}
            href={`?sort=${s}`}
            aria-current={sort === s ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault();
              setParams(s === 'hot' ? {} : { sort: s });
            }}
          >
            {SORT_LABELS[s]}
          </a>
        ))}
        <span className="end">{space ? space.name : 'All spaces'}</span>
      </nav>

      {feed.load === 'loading' || waitingForSpace ? (
        <FeedSkeleton />
      ) : feed.load === 'error' ? (
        <ErrorState title="The feed didn’t load" onRetry={feed.reload} />
      ) : feed.posts.length === 0 ? (
        <Empty title={sort === 'unanswered' ? 'Every thread has a reply' : 'No threads here yet'}>
          <p>{sort === 'unanswered' ? 'Check Hot or New instead.' : 'Hit Post to start the first one.'}</p>
          <Link className="nb-btn nb-btn--primary" to={space ? `/new?space=${space.slug}` : '/new'}>
            Start a thread
          </Link>
        </Empty>
      ) : (
        <>
          <ThreadList posts={feed.posts} votes={votes} onVote={(post) => void onVote(post)} />
          {feed.hasMore && (
            <div className="more">
              <button
                className="nb-btn"
                type="button"
                onClick={() => void feed.loadMore()}
                disabled={feed.loadingMore}
              >
                {feed.loadingMore ? 'Loading more' : 'More threads'}
              </button>
            </div>
          )}
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
    document.title = `Search  | ${APP_NAME}`;
  }, []);

  return (
    <Page sidebar={<Sidebar />}>
      <header className="sp-head">
        <h1>Search</h1>
        <p>{text ? `Threads and spaces that mention “${text}”.` : 'Type a word or two in the search box.'}</p>
      </header>
      {matchingSpaces.length > 0 && (
        <nav className="nb-chips" aria-label="Matching spaces" style={{ flexWrap: 'wrap' }}>
          {matchingSpaces.map((s) => (
            <Link className="nb-chip" key={s.id} to={`/s/${s.slug}`}>
              {s.name}
            </Link>
          ))}
        </nav>
      )}
      {search.load === 'loading' ? (
        <FeedSkeleton rows={3} />
      ) : search.load === 'error' ? (
        <ErrorState title="Search didn’t work" />
      ) : search.tokens.length === 0 ? (
        text ? (
          <Empty title="Try a more specific word">
            <p>Search skips common words like “the” and “what”.</p>
          </Empty>
        ) : null
      ) : search.posts.length === 0 ? (
        <Empty title="No threads match that">
          <p>Search checks titles, the start of each post and space names. It never searches by author.</p>
        </Empty>
      ) : (
        <ThreadList posts={search.posts} votes={votes} onVote={(post) => void onVote(post)} />
      )}
    </Page>
  );
}
