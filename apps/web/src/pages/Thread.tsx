import {
  APP_NAME,
  EDIT_WINDOW_MS,
  LIMITS,
  buildAuthorDisplay,
  commentKey,
  isModeratorRole,
  postKey,
  relativeTime,
  type AuthorDisplay,
  type SummaryResult,
} from '@commons/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useMember } from '../auth/AuthContext';
import { ReplyComposer, type PendingComment } from '../components/Composer';
import { ModDialog, ReportDialog, RevealDialog, type ModTarget } from '../components/Dialogs';
import { Icon } from '../components/Icon';
import { Avatar, Byline } from '../components/Identity';
import { Page, Sidebar } from '../components/Layout';
import { SummaryBox, pollPercents, pollTotal, type PostView } from '../components/Post';
import { SafeText } from '../components/SafeText';
import { Empty, Loading, useToast } from '../components/Ui';
import { useMine, useMyVotes, useSpaces, useThread, type CommentView } from '../data/hooks';
import { markOpened } from '../lib/storage';

interface Node {
  comment: CommentView | null;
  id: string;
  children: Node[];
}

/** Builds the reply tree. A reply whose parent is gone hangs under a "removed" placeholder. */
function buildTree(comments: CommentView[]): Node[] {
  const nodes = new Map<string, Node>();
  for (const comment of comments) nodes.set(comment.id, { comment, id: comment.id, children: [] });
  const roots: Node[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    if (!comment.parentId) {
      roots.push(node);
      continue;
    }
    let parent = nodes.get(comment.parentId);
    if (!parent) {
      parent = { comment: null, id: comment.parentId, children: [] };
      nodes.set(comment.parentId, parent);
      roots.push(parent);
    }
    parent.children.push(node);
  }
  return roots;
}

function PollVote({
  post,
  mine,
  onVote,
}: {
  post: PostView;
  mine: string | undefined;
  onVote: (id: string) => void;
}) {
  const options = post.poll?.options ?? [];
  const percents = pollPercents(options);
  const total = pollTotal(options);
  return (
    <fieldset className="poll">
      <legend>{total === 1 ? '1 vote' : `${total} votes`}. You can change yours.</legend>
      {options.map((option, i) => (
        <label className="poll__opt" key={option.id}>
          <input
            type="radio"
            name={`poll-${post.id}`}
            checked={mine === option.id}
            onChange={() => onVote(option.id)}
          />
          <span>{option.label}</span>
          <span>{percents[i]}%</span>
          <span className="poll__track" aria-hidden="true">
            <span className="poll__fill" style={{ width: `${percents[i]}%` }} />
          </span>
        </label>
      ))}
      {mine && <span className="muted">Voted. Nobody can see what you picked.</span>}
    </fieldset>
  );
}

export default function Thread() {
  const { postId = '' } = useParams();
  const member = useMember();
  const toast = useToast();
  const isMod = isModeratorRole(member.role);
  const isAdmin = member.role === 'admin';
  const { post, comments, load, commentsReady } = useThread(postId, isMod);
  const { byId } = useSpaces();
  const mine = useMine();
  const { votes, setThoughtful, setPoll } = useMyVotes(member.user.uid, postId ? [postId] : []);

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingComment[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [modTarget, setModTarget] = useState<ModTarget | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [countDelta, setCountDelta] = useState<Record<string, number>>({});
  const [pollOverride, setPollOverride] = useState<PostView['poll'] | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | ${APP_NAME}`;
      markOpened(post.id);
    }
  }, [post]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setPollOverride(null);
  }, [post?.poll]);
  useEffect(() => {
    setCountDelta({});
  }, [post?.thoughtfulCount, comments]);

  // Screen readers hear when new replies come in.
  useEffect(() => {
    if (!commentsReady) return;
    const visible = comments.filter((c) => c.status === 'visible');
    if (seen.current === null) {
      seen.current = new Set(visible.map((c) => c.id));
      return;
    }
    const fresh = visible.filter((c) => !seen.current!.has(c.id));
    if (fresh.length > 0) {
      for (const c of fresh) seen.current.add(c.id);
      setAnnouncement(fresh.length === 1 ? '1 new reply.' : `${fresh.length} new replies.`);
    }
  }, [comments, commentsReady]);

  const tree = useMemo(() => buildTree(comments), [comments]);
  const space = post ? byId(post.spaceId) : undefined;

  if (load === 'loading') {
    return (
      <Page sidebar={<Sidebar />}>
        <Loading label="Loading" />
      </Page>
    );
  }
  if (!post) {
    return (
      <Page sidebar={<Sidebar />}>
        <Empty title="This post isn’t available">
          <p>
            It was removed, or a mod is looking at it. <Link to="/">Back to all posts</Link>
          </p>
        </Empty>
      </Page>
    );
  }

  const toggle = async (contentKey: string) => {
    const was = votes.thoughtful.has(contentKey);
    const delta = was ? -1 : 1;
    setThoughtful(contentKey, !was);
    setCountDelta((d) => ({ ...d, [contentKey]: (d[contentKey] ?? 0) + delta }));
    try {
      await api.toggleThoughtful({ contentKey });
    } catch (error) {
      setThoughtful(contentKey, was);
      setCountDelta((d) => ({ ...d, [contentKey]: (d[contentKey] ?? 0) - delta }));
      toast(errorMessage(error));
    }
  };

  const vote = async (optionId: string) => {
    if (!post.poll) return;
    const previous = votes.poll[post.id];
    if (previous === optionId) return;
    const current = pollOverride ?? post.poll;
    setPoll(post.id, optionId);
    setPollOverride({
      ...current,
      options: current.options.map((o) => ({
        ...o,
        count: Math.max(0, o.count + (o.id === optionId ? 1 : 0) - (o.id === previous ? 1 : 0)),
      })),
    });
    try {
      await api.votePoll({ postId: post.id, optionId });
    } catch (error) {
      setPoll(post.id, previous);
      setPollOverride(null);
      toast(errorMessage(error));
    }
  };

  const askSummary = async () => {
    setSummaryBusy(true);
    try {
      setSummary(await api.requestSummary({ postId: post.id }));
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSummaryBusy(false);
    }
  };

  const remove = async (contentKey: string) => {
    if (
      !window.confirm(
        'Delete this? It disappears for everyone. The school still keeps its record of who wrote it.',
      )
    )
      return;
    try {
      await api.deleteOwnContent({ contentKey });
      toast('Deleted.');
      mine.refresh();
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  const saveEdit = async (contentKey: string) => {
    try {
      await api.editOwnContent({ contentKey, body: editText });
      setEditing(null);
      toast('Saved. It’ll show again once it’s been checked.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  const canEdit = (contentKey: string, createdMs: number) =>
    mine.keys.has(contentKey) && now - createdMs < EDIT_WINDOW_MS;

  const thoughtfulLabel = (contentKey: string, count: number) => {
    const shown = Math.max(0, count + (countDelta[contentKey] ?? 0));
    return `Thoughtful ${shown}`;
  };

  const pendingDisplay = (mode: PendingComment['mode']): AuthorDisplay =>
    mode === 'anonymous'
      ? { mode: 'anonymous', anonLabel: 'Anonymous' }
      : buildAuthorDisplay(member.profile, 'named', 0);

  const renderPending = (parentId: string | null) =>
    pending
      .filter((p) => p.parentId === parentId)
      .map((p) => (
        <div className="nb-comment nb-comment--pending" key={p.key} aria-busy="true">
          <Avatar author={pendingDisplay(p.mode)} />
          <div>
            <Byline author={pendingDisplay(p.mode)} when="posting" avatar={false} showLetter={false} />
            <SafeText className="nb-comment__body" text={p.body} />
          </div>
        </div>
      ));

  const renderNode = (node: Node): JSX.Element => {
    const c = node.comment;
    if (!c) {
      return (
        <div className="nb-comment nb-comment--gone" key={node.id}>
          <span className="nb-avatar nb-avatar--sm" aria-hidden="true" />
          <div>
            <p className="nb-comment__body">Deleted.</p>
            <div className="nb-comment__replies">{node.children.map(renderNode)}</div>
          </div>
        </div>
      );
    }
    const key = commentKey(post.id, c.id);
    const created = c.createdAt?.toMillis?.() ?? now;
    const hidden = c.status !== 'visible';
    return (
      <div className="nb-comment" key={c.id} id={`c-${c.id}`}>
        <Avatar author={c.authorDisplay} />
        <div>
          <Byline author={c.authorDisplay} when={relativeTime(created, now)} avatar={false} />
          {hidden && (
            <span className="flag">{c.status === 'held' ? 'Hidden, mods only' : 'Removed, mods only'}</span>
          )}
          {editing === key ? (
            <div className="stack nb-comment__form">
              <label className="label" htmlFor={`edit-${c.id}`}>
                Edit
              </label>
              <textarea
                className="textarea"
                id={`edit-${c.id}`}
                value={editText}
                maxLength={LIMITS.commentMax}
                onChange={(event) => setEditText(event.target.value)}
              />
              <div className="row">
                <button className="btn btn--primary btn--sm" type="button" onClick={() => void saveEdit(key)}>
                  Save
                </button>
                <button className="btn btn--quiet btn--sm" type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <SafeText className="nb-comment__body" text={c.body} />
          )}
          <div className="nb-comment__actions">
            {!hidden && (
              <button type="button" aria-pressed={votes.thoughtful.has(key)} onClick={() => void toggle(key)}>
                <Icon name="up" />
                {thoughtfulLabel(key, c.thoughtfulCount)}
              </button>
            )}
            {!hidden && c.depth < LIMITS.maxDepth && (
              <button
                type="button"
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                aria-expanded={replyTo === c.id}
              >
                <Icon name="comment" />
                Reply
              </button>
            )}
            {!hidden && (
              <button type="button" onClick={() => setReport(key)}>
                <Icon name="flag" />
                Report
              </button>
            )}
            {canEdit(key, created) && (
              <button
                type="button"
                onClick={() => {
                  setEditing(key);
                  setEditText(c.body);
                }}
              >
                Edit
              </button>
            )}
            {mine.keys.has(key) && (
              <button type="button" onClick={() => void remove(key)}>
                Delete
              </button>
            )}
            {isMod && (
              <button
                type="button"
                onClick={() =>
                  setModTarget({
                    contentKey: key,
                    kind: 'comment',
                    status: c.status,
                    onBoard: !!c.boardApproved,
                  })
                }
              >
                <Icon name="shield" />
                Moderate
              </button>
            )}
            {isAdmin && (
              <button type="button" onClick={() => setReveal(key)}>
                Who wrote this?
              </button>
            )}
          </div>
          {replyTo === c.id && (
            <div className="nb-comment__form">
              <ReplyComposer
                postId={post.id}
                parentId={c.id}
                autoFocus
                onCancel={() => setReplyTo(null)}
                onPending={(p) => setPending((list) => [...list, p])}
                onSettled={(k) => setPending((list) => list.filter((p) => p.key !== k))}
                onSent={(outcome) => {
                  mine.refresh();
                  if (outcome.outcome === 'visible' || outcome.outcome === 'pending') setReplyTo(null);
                }}
              />
            </div>
          )}
          {(node.children.length > 0 || pending.some((p) => p.parentId === c.id)) && (
            <div className="nb-comment__replies">
              {node.children.map(renderNode)}
              {renderPending(c.id)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const pKey = postKey(post.id);
  const createdMs = post.createdAt?.toMillis?.() ?? now;
  const shownPoll = pollOverride ?? post.poll;
  const shownSummary = summary?.summary ?? (post.summary ? { ...post.summary } : null);
  const canSummarise = post.commentCount >= LIMITS.summaryMinComments;
  const summaryStale =
    !!post.summary &&
    Math.floor(post.commentCount / LIMITS.summaryBucket) * LIMITS.summaryBucket >
      post.summary.commentCountAtGeneration;
  const visibleCount = comments.filter((c) => c.status === 'visible').length;

  return (
    <Page sidebar={<Sidebar spaceDescription={space?.description} />}>
      <article className="th">
        <div className="th-card">
          <Link className="th-back" to={space ? `/s/${space.slug}` : '/'}>
            <Icon name="left" />
            {post.spaceName}
          </Link>
          {post.pinned && (
            <span className="pin">
              <Icon name="pin" />
              Pinned
            </span>
          )}
          {post.status !== 'visible' && (
            <p className="flag" role="status">
              {post.status === 'held'
                ? 'Hidden. Only mods can see this.'
                : 'Removed. Only mods can see this.'}
            </p>
          )}
          <h1 className="th-title">
            {post.questionOfTheDay ? <span className="hl">{post.title}</span> : post.title}
          </h1>
          <Byline author={post.authorDisplay} when={relativeTime(createdMs, now)} />
          {post.questionOfTheDay && <span className="muted">Question of the day</span>}

          {editing === pKey ? (
            <div className="stack">
              <label className="label" htmlFor="edit-post">
                Edit
              </label>
              <textarea
                className="textarea"
                id="edit-post"
                value={editText}
                maxLength={LIMITS.bodyMax}
                onChange={(event) => setEditText(event.target.value)}
              />
              <div className="row">
                <button
                  className="btn btn--primary btn--sm"
                  type="button"
                  onClick={() => void saveEdit(pKey)}
                >
                  Save
                </button>
                <button className="btn btn--quiet btn--sm" type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            post.body && <SafeText className="th-body" text={post.body} />
          )}

          {post.kind === 'link' && post.link && (
            <a className="post__link" href={post.link.url} target="_blank" rel="noopener noreferrer nofollow">
              <Icon name="ext" />
              <span>{post.link.url}</span>
            </a>
          )}

          {post.kind === 'poll' && shownPoll && post.status === 'visible' && (
            <PollVote
              post={{ ...post, poll: shownPoll }}
              mine={votes.poll[post.id]}
              onVote={(id) => void vote(id)}
            />
          )}

          <div className="th-actions">
            {post.status === 'visible' && (
              <button
                className="btn btn--sm th-vote"
                type="button"
                aria-pressed={votes.thoughtful.has(pKey)}
                onClick={() => void toggle(pKey)}
              >
                <Icon name="up" />
                {thoughtfulLabel(pKey, post.thoughtfulCount)}
              </button>
            )}
            {post.status === 'visible' && (
              <button className="btn btn--quiet btn--sm" type="button" onClick={() => setReport(pKey)}>
                <Icon name="flag" />
                Report
              </button>
            )}
            {canEdit(pKey, createdMs) && (
              <button
                className="btn btn--quiet btn--sm"
                type="button"
                onClick={() => {
                  setEditing(pKey);
                  setEditText(post.body);
                }}
              >
                Edit
              </button>
            )}
            {mine.keys.has(pKey) && (
              <button className="btn btn--quiet btn--sm" type="button" onClick={() => void remove(pKey)}>
                Delete
              </button>
            )}
            {isMod && (
              <button
                className="btn btn--quiet btn--sm"
                type="button"
                onClick={() =>
                  setModTarget({ contentKey: pKey, kind: 'post', status: post.status, pinned: post.pinned })
                }
              >
                <Icon name="shield" />
                Moderate
              </button>
            )}
            {isAdmin && (
              <button className="btn btn--quiet btn--sm" type="button" onClick={() => setReveal(pKey)}>
                Who wrote this?
              </button>
            )}
          </div>
        </div>

        {shownSummary ? (
          <SummaryBox
            text={shownSummary.text}
            bullets={shownSummary.bullets}
            basedOn={shownSummary.commentCountAtGeneration}
          >
            {summaryStale && !summary && (
              <button
                className="btn btn--sm"
                type="button"
                onClick={() => void askSummary()}
                disabled={summaryBusy}
              >
                {summaryBusy ? 'Updating' : 'Update summary'}
              </button>
            )}
          </SummaryBox>
        ) : (
          canSummarise && (
            <section className="summary" aria-label="Summary">
              {summary && !summary.available ? (
                <p className="summary__head" role="status" style={{ margin: 0 }}>
                  {summary.reason === 'unavailable-today'
                    ? 'Summaries are off for the rest of today.'
                    : 'Couldn’t get a summary right now.'}
                </p>
              ) : (
                <div className="summary__foot" style={{ marginTop: 0 }}>
                  <span>Long thread. A computer model can sum it up.</span>
                  <button
                    className="btn btn--sm"
                    type="button"
                    onClick={() => void askSummary()}
                    disabled={summaryBusy}
                  >
                    {summaryBusy ? 'Working' : 'Summarize'}
                  </button>
                </div>
              )}
            </section>
          )
        )}

        <section className="th-card" aria-labelledby="comments-h">
          <h2 className="th-h" id="comments-h">
            {visibleCount === 0 ? 'Replies' : `${visibleCount} ${visibleCount === 1 ? 'reply' : 'replies'}`}
          </h2>
          <div className="nb-sr" aria-live="polite" role="status">
            {announcement}
          </div>
          {!commentsReady ? (
            <p className="muted">Loading replies</p>
          ) : tree.length === 0 && pending.length === 0 ? (
            <p className="muted">No replies yet.</p>
          ) : (
            <div className="th-comments">
              {tree.map(renderNode)}
              {renderPending(null)}
            </div>
          )}
        </section>

        {post.status === 'visible' && (
          <section className="composer composer--reply" aria-label="Reply">
            <ReplyComposer
              postId={post.id}
              parentId={null}
              onPending={(p) => setPending((list) => [...list, p])}
              onSettled={(k) => setPending((list) => list.filter((p) => p.key !== k))}
              onSent={() => mine.refresh()}
            />
          </section>
        )}
      </article>

      <ReportDialog contentKey={report} onClose={() => setReport(null)} />
      <ModDialog target={modTarget} onClose={() => setModTarget(null)} />
      <RevealDialog contentKey={reveal} onClose={() => setReveal(null)} />
    </Page>
  );
}
