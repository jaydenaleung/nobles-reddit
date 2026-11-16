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

/* ---------- Spaces: loaded once for the signed-in shell, kept live ---------- */

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

/* ---------- The feed ---------- */

const toPost = (d: DocumentSnapshot): PostView => ({ id: d.id, ...(d.data() as Omit<PostView, 'id'>) });

/**
 * One page of the feed at a time, 20 threads a page, with a cursor.
 * Pinned threads come first in every sort. Only visible threads are asked
 * for: the rules reject any query that does not say so.
 */
export function useFeed(spaceId: string | undefined, sort: Sort) {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<DocumentSnapshot | null>(null);
  const shown = useRef(PAGE_SIZE);
  const weekPool = useRef<PostView[]>([]);
  const [version, setVersion] = useState(0);

  const fetchPage = useCallback(
    async (after: DocumentSnapshot | null) => {
      const constraints: QueryConstraint[] = [];
      if (sort === 'unanswered') constraints.push(where('commentCount', '==', 0));
      if (spaceId) constraints.push(where('spaceId', '==', spaceId));
      constraints.push(where('status', '==', 'visible'));
      if (sort === 'top') {
        // "Top this week": the week's threads, ranked on this device. Fine at school scale; see docs/DECISIONS.md.
        const weekAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
        constraints.push(where('createdAt', '>=', weekAgo), orderBy('createdAt', 'desc'), limit(200));
      } else {
        constraints.push(
          orderBy('pinned', 'desc'),
          orderBy(sort === 'hot' ? 'hotScore' : 'createdAt', 'desc'),
        );
        if (after) constraints.push(startAfter(after));
        constraints.push(limit(PAGE_SIZE + 1));
      }
      return getDocs(query(collection(db, 'posts'), ...constraints));
    },
    [spaceId, sort],
  );

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    setPosts([]);
    cursor.current = null;
    shown.current = PAGE_SIZE;
    fetchPage(null).then(
      (snap) => {
        if (cancelled) return;
        if (sort === 'top') {
          weekPool.current = snap.docs
            .map(toPost)
            .sort((a, b) =>
              a.pinned !== b.pinned
                ? a.pinned
                  ? -1
                  : 1
                : b.thoughtfulCount - a.thoughtfulCount || compareHot(a, b),
            );
          setPosts(weekPool.current.slice(0, PAGE_SIZE));
          setHasMore(weekPool.current.length > PAGE_SIZE);
        } else {
          const page = snap.docs.slice(0, PAGE_SIZE);
          cursor.current = page[page.length - 1] ?? null;
          setPosts(page.map(toPost));
          setHasMore(snap.docs.length > PAGE_SIZE);
        }
        setLoad('ready');
      },
      () => !cancelled && setLoad('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [fetchPage, sort, version]);

  const loadMore = useCallback(async () => {
    if (sort === 'top') {
      shown.current += PAGE_SIZE;
      setPosts(weekPool.current.slice(0, shown.current));
      setHasMore(weekPool.current.length > shown.current);
      return;
    }
    if (!cursor.current) return;
    setLoadingMore(true);
    try {
      const snap = await fetchPage(cursor.current);
      const page = snap.docs.slice(0, PAGE_SIZE);
      cursor.current = page[page.length - 1] ?? cursor.current;
      setPosts((current) => [...current, ...page.map(toPost)]);
      setHasMore(snap.docs.length > PAGE_SIZE);
    } catch {
      setLoad('error');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, sort]);

  const patch = useCallback((id: string, change: (post: PostView) => PostView) => {
    setPosts((current) => current.map((p) => (p.id === id ? change(p) : p)));
  }, []);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { posts, load, hasMore, loadMore, loadingMore, reload, patch };
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

/* ---------- My own marks ("Thoughtful") and poll votes ---------- */

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

/* ---------- One thread, live ---------- */

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

/* ---------- Which content is mine (so I can edit or delete it) ---------- */

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

/* ---------- The hall screen feed (the one public document) ---------- */

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
