import {
  PAGE_SIZE,
  commentKey,
  compareHot,
  postKey,
  queryTokens,
  type BoardFeed,
  type Comment,
  type MyContentItem,
  type Sort,
  type Space,
} from '@commons/shared';
import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api';
import type { PostView } from '../components/Post';
import { db } from '../firebase';

export type Load = 'loading' | 'ready' | 'error';
export type SpaceView = Space & { id: string };
export type CommentView = Comment & { id: string };

interface SpacesValue {
  spaces: SpaceView[];
  load: Load;
  bySlug(slug: string): SpaceView | undefined;
  byId(id: string): SpaceView | undefined;
}
const SpacesContext = createContext<SpacesValue>({
  spaces: [],
  load: 'loading',
  bySlug: () => undefined,
  byId: () => undefined,
});

export function SpacesProvider({ children }: { children: ReactNode }) {
  const [spaces, setSpaces] = useState<SpaceView[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'spaces'), orderBy('order', 'asc')),
      (snap) => {
        setSpaces(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Space) })));
        setLoad('ready');
      },
      () => setLoad('error'),
    );
  }, []);
  const value = useMemo<SpacesValue>(
    () => ({
      spaces,
      load,
      bySlug: (slug) => spaces.find((s) => s.slug === slug),
      byId: (id) => spaces.find((s) => s.id === id),
    }),
    [spaces, load],
  );
  return <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>;
}
export const useSpaces = () => useContext(SpacesContext);

const toPost = (d: DocumentSnapshot): PostView => ({ id: d.id, ...(d.data() as Omit<PostView, 'id'>) });

/** The most pages a URL can ask for on load, so a hand-edited ?page=500 can't pull the whole collection. */
export const MAX_START_PAGES = 10;

/** Pinned first, then most thoughtful marks, then hot score. */
function rankTop(posts: PostView[]): PostView[] {
  return [...posts].sort((a, b) =>
    a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.thoughtfulCount - a.thoughtfulCount || compareHot(a, b),
  );
}

/**
 * Real pagination over the posts collection, PAGE_SIZE at a time, with a
 * Firestore cursor. `startPages` comes from ?page= in the URL, so a refresh
 * loads as many pages as you had. Posts are de-duplicated by id because hot
 * scores can change between fetches.
 *
 * "Top this week" can't be ordered by score in one Firestore query, so it
 * fetches the week's posts (up to 200) once and pages through that list.
 */
export function useFeed(spaceId: string | undefined, sort: Sort, startPages: number) {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [pages, setPages] = useState(1);
  const [version, setVersion] = useState(0);
  const cursor = useRef<DocumentSnapshot | null>(null);
  const weekPool = useRef<PostView[]>([]);
  const busy = useRef(false);
  const start = useRef(startPages);
  start.current = startPages;

  const fetchPosts = useCallback(
    (count: number, after: DocumentSnapshot | null) => {
      const constraints: QueryConstraint[] = [];
      if (sort === 'unanswered') constraints.push(where('commentCount', '==', 0));
      if (spaceId) constraints.push(where('spaceId', '==', spaceId));
      constraints.push(where('status', '==', 'visible'));
      if (sort === 'top') {
        const weekAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
        constraints.push(where('createdAt', '>=', weekAgo), orderBy('createdAt', 'desc'), limit(200));
      } else {
        constraints.push(
          orderBy('pinned', 'desc'),
          orderBy(sort === 'hot' ? 'hotScore' : 'createdAt', 'desc'),
        );
        if (after) constraints.push(startAfter(after));
        constraints.push(limit(count + 1));
      }
      return getDocs(query(collection(db, 'posts'), ...constraints));
    },
    [spaceId, sort],
  );

  useEffect(() => {
    let cancelled = false;
    const wanted = Math.min(Math.max(1, start.current), MAX_START_PAGES);
    setLoad('loading');
    setPosts([]);
    setMoreFailed(false);
    cursor.current = null;
    fetchPosts(wanted * PAGE_SIZE, null).then(
      (snap) => {
        if (cancelled) return;
        let shown: PostView[];
        if (sort === 'top') {
          weekPool.current = rankTop(snap.docs.map(toPost));
          shown = weekPool.current.slice(0, wanted * PAGE_SIZE);
          setHasMore(weekPool.current.length > shown.length);
        } else {
          const docs = snap.docs.slice(0, wanted * PAGE_SIZE);
          cursor.current = docs[docs.length - 1] ?? null;
          shown = docs.map(toPost);
          setHasMore(snap.docs.length > docs.length);
        }
        setPosts(shown);
        setPages(Math.max(1, Math.ceil(shown.length / PAGE_SIZE)));
        setLoad('ready');
      },
      () => !cancelled && setLoad('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [fetchPosts, sort, version]);

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      let fresh: PostView[];
      let more: boolean;
      if (sort === 'top') {
        const next = (pages + 1) * PAGE_SIZE;
        fresh = weekPool.current.slice(pages * PAGE_SIZE, next);
        more = weekPool.current.length > next;
      } else {
        const snap = await fetchPosts(PAGE_SIZE, cursor.current);
        const docs = snap.docs.slice(0, PAGE_SIZE);
        if (docs.length > 0) cursor.current = docs[docs.length - 1]!;
        fresh = docs.map(toPost);
        more = snap.docs.length > docs.length;
      }
      setPosts((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...fresh.filter((p) => !seen.has(p.id))];
      });
      setHasMore(more);
      setPages((n) => n + 1);
    } catch {
      setMoreFailed(true);
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [fetchPosts, hasMore, pages, sort]);

  const patch = useCallback((id: string, change: (post: PostView) => PostView) => {
    setPosts((current) => current.map((p) => (p.id === id ? change(p) : p)));
  }, []);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { posts, load, hasMore, loadMore, loadingMore, moreFailed, pages, reload, patch };
}

/** Server-side search on the `searchTokens` index. Finds threads by their words, never by author. */
export function useSearch(text: string) {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [load, setLoad] = useState<Load>('ready');
  const tokens = useMemo(() => queryTokens(text), [text]);
  const key = tokens.join(' ');
  useEffect(() => {
    if (tokens.length === 0) {
      setPosts([]);
      setLoad('ready');
      return;
    }
    let cancelled = false;
    setLoad('loading');
    getDocs(
      query(
        collection(db, 'posts'),
        where('searchTokens', 'array-contains-any', tokens),
        where('status', '==', 'visible'),
        orderBy('hotScore', 'desc'),
        limit(40),
      ),
    ).then(
      (snap) => {
        if (cancelled) return;
        setPosts(snap.docs.map(toPost));
        setLoad('ready');
      },
      () => !cancelled && setLoad('error'),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const patch = useCallback((id: string, change: (post: PostView) => PostView) => {
    setPosts((current) => current.map((p) => (p.id === id ? change(p) : p)));
  }, []);
  return { posts, load, tokens, patch };
}

export interface MyVotes {
  thoughtful: Set<string>;
  poll: Record<string, string>;
}

/**
 * Which of these threads (and their comments) I have marked. One query per
 * 30 threads; the rules only allow asking about your own marks.
 */
export function useMyVotes(uid: string, postIds: string[]) {
  const [votes, setVotes] = useState<MyVotes>({ thoughtful: new Set(), poll: {} });
  const key = [...postIds].sort().join(',');
  useEffect(() => {
    if (postIds.length === 0) return;
    let cancelled = false;
    const chunks: string[][] = [];
    for (let i = 0; i < postIds.length; i += 30) chunks.push(postIds.slice(i, i + 30));
    Promise.all(
      chunks.map((chunk) =>
        getDocs(query(collectionGroup(db, 'by'), where('uid', '==', uid), where('postId', 'in', chunk))),
      ),
    ).then(
      (snaps) => {
        if (cancelled) return;
        const thoughtful = new Set<string>();
        const poll: Record<string, string> = {};
        for (const snap of snaps) {
          for (const d of snap.docs) {
            const v = d.data();
            if (v.kind === 'poll') poll[v.postId] = v.optionId;
            else if (v.kind === 'comment') thoughtful.add(commentKey(v.postId, v.commentId));
            else thoughtful.add(postKey(v.postId));
          }
        }
        setVotes((current) => ({
          thoughtful: new Set([...current.thoughtful, ...thoughtful]),
          poll: { ...current.poll, ...poll },
        }));
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);

  const setThoughtful = useCallback((contentKey: string, on: boolean) => {
    setVotes((current) => {
      const thoughtful = new Set(current.thoughtful);
      if (on) thoughtful.add(contentKey);
      else thoughtful.delete(contentKey);
      return { ...current, thoughtful };
    });
  }, []);
  const setPoll = useCallback((postId: string, optionId: string | undefined) => {
    setVotes((current) => {
      const poll = { ...current.poll };
      if (optionId) poll[postId] = optionId;
      else delete poll[postId];
      return { ...current, poll };
    });
  }, []);
  return { votes, setThoughtful, setPoll };
}

export function useThread(postId: string, seeAll: boolean) {
  const [post, setPost] = useState<PostView | null>(null);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [commentsReady, setCommentsReady] = useState(false);

  useEffect(() => {
    setLoad('loading');
    setPost(null);
    setComments([]);
    setCommentsReady(false);
    const stopPost = onSnapshot(
      doc(db, 'posts', postId),
      (snap) => {
        setPost(snap.exists() ? toPost(snap) : null);
        setLoad('ready');
      },
      // Held, removed and missing threads all look the same to a member: not available.
      () => {
        setPost(null);
        setLoad('ready');
      },
    );
    const base = collection(db, 'posts', postId, 'comments');
    const q = seeAll
      ? query(base, orderBy('createdAt', 'asc'), limit(500))
      : query(base, where('status', '==', 'visible'), orderBy('createdAt', 'asc'), limit(500));
    const stopComments = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Comment) })),
        );
        setCommentsReady(true);
      },
      () => setCommentsReady(true),
    );
    return () => {
      stopPost();
      stopComments();
    };
  }, [postId, seeAll]);

  return { post, comments, load, commentsReady };
}

interface MineValue {
  items: MyContentItem[];
  keys: Set<string>;
  load: Load;
  refresh(): void;
}
const MineContext = createContext<MineValue>({
  items: [],
  keys: new Set(),
  load: 'loading',
  refresh: () => undefined,
});

/** The server tells each person which posts are theirs. Nobody is told about anyone else's. */
export function MineProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MyContentItem[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api.listMyContent({}).then(
      (result) => {
        if (cancelled) return;
        setItems(result.items);
        setLoad('ready');
      },
      () => !cancelled && setLoad('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [version]);
  const value = useMemo<MineValue>(
    () => ({
      items,
      keys: new Set(items.map((i) => i.contentKey)),
      load,
      refresh: () => setVersion((v) => v + 1),
    }),
    [items, load],
  );
  return <MineContext.Provider value={value}>{children}</MineContext.Provider>;
}
export const useMine = () => useContext(MineContext);

export function useBoardFeed() {
  const [feed, setFeed] = useState<BoardFeed | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    const stop = onSnapshot(
      doc(db, 'boardFeed', 'current'),
      (snap) => {
        setFeed(snap.exists() ? (snap.data() as BoardFeed) : null);
        setLoad('ready');
      },
      () => {
        // The listener reconnects by itself after a network drop. If it fails outright, start again shortly.
        setLoad('error');
        retry = setTimeout(() => setAttempt((n) => n + 1), 10_000);
      },
    );
    return () => {
      stop();
      if (retry) clearTimeout(retry);
    };
  }, [attempt]);
  return { feed, load };
}
