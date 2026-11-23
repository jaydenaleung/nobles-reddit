import {
  excerpt,
  isStaffRole,
  relativeTime,
  shortClassYear,
  type PollOption,
  type Post,
} from '@commons/shared';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { StaffBadge } from './Identity';

export type PostView = Post & { id: string };

export function pollTotal(options: PollOption[]): number {
  return options.reduce((sum, option) => sum + option.count, 0);
}
export function pollPercents(options: PollOption[]): number[] {
  const total = pollTotal(options);
  if (total === 0) return options.map(() => 0);
  return options.map((option) => Math.round((option.count / total) * 100));
}
function pollLabel(options: PollOption[]): string {
  const percents = pollPercents(options);
  return `Poll: ${options.map((o, i) => `${o.label} ${percents[i]} percent`).join(', ')}`;
}

/** Read-only poll bars, as on the front page. Every other bar is hatched so colour is not the only cue. */
export function PollBars({ options }: { options: PollOption[] }) {
  const percents = pollPercents(options);
  const top = Math.max(...percents);
  return (
    <div className="fp-poll" role="img" aria-label={pollLabel(options)}>
      {options.map((option, i) => (
        <div
          className={`fp-opt${i % 2 === 1 ? ' alt' : ''}${top > 0 && percents[i] === top ? ' lead' : ''}`}
          key={option.id}
        >
          <span>{option.label}</span>
          <span>{percents[i]}%</span>
          <div className="t">
            <i style={{ width: `${percents[i]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The line above a title: space, who posted, when. */
function PostTop({ post, nowMs, spaceSlug }: { post: PostView; nowMs: number; spaceSlug?: string }) {
  const when = relativeTime(post.createdAt.toMillis(), nowMs);
  const author = post.authorDisplay;
  const space = spaceSlug ? (
    <Link className="nb-space" to={`/s/${spaceSlug}`}>
      {post.spaceName}
    </Link>
  ) : (
    <span className="nb-space">{post.spaceName}</span>
  );
  if (author.mode === 'named' && author.role === 'admin' && post.pinnedBy === 'administration') {
    return (
      <div className="nb-post__top">
        {space}
        {post.questionOfTheDay && <span className="nb-qotd">Question of the day</span>}
        <span className="nb-badge nb-badge--staff nb-badge--admin">Administration</span>
        <span>{when}</span>
      </div>
    );
  }
  return (
    <div className="nb-post__top">
      {space}
      {post.questionOfTheDay && <span className="nb-qotd">Question of the day</span>}
      {author.mode === 'anonymous' ? (
        <span>Anonymous</span>
      ) : (
        <>
          <b>{author.name}</b>
          {isStaffRole(author.role) && <StaffBadge role={author.role} />}
        </>
      )}
      {author.mode === 'named' && author.classYear !== undefined && (
        <span>{shortClassYear(author.classYear)}</span>
      )}
      <span>{when}</span>
    </div>
  );
}

export interface PostRowProps {
  post: PostView;
  spaceSlug?: string;
  nowMs: number;
  voted: boolean;
  onVote?: () => void;
  read?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onShare?: () => void;
}

/** One row of the feed: vote rail on the left, then the thread. On phones the rail moves into the foot. */
export function PostRow({
  post,
  spaceSlug,
  nowMs,
  voted,
  onVote,
  read,
  saved,
  onSave,
  onShare,
}: PostRowProps) {
  const href = `/t/${post.id}`;
  const body = post.body ? excerpt(post.body) : '';
  const voteLabel = voted ? 'Upvoted, press again to undo' : 'Upvote';
  return (
    <article className={`nb-post${read ? ' nb-post--read' : ''}`}>
      <div className="nb-votes">
        <button
          className="nb-vote"
          type="button"
          aria-pressed={voted}
          aria-label={voteLabel}
          onClick={onVote}
        >
          <Icon name="up" />
        </button>
        <span aria-label={plural(post.thoughtfulCount, 'upvote', 'upvotes')}>{post.thoughtfulCount}</span>
      </div>
      <div>
        {post.pinned && (
          <div className="nb-post__pin">
            <Icon name="pin" />{' '}
            {post.pinnedBy === 'administration' ? 'Pinned by the administration' : 'Pinned'}
          </div>
        )}
        <PostTop post={post} nowMs={nowMs} spaceSlug={spaceSlug} />
        <h3 className="nb-post__title">
          <Link to={href}>{post.title}</Link>
        </h3>
        {post.kind === 'poll' && post.poll ? (
          <PollBars options={post.poll.options} />
        ) : (
          body && <p className="nb-post__excerpt">{body}</p>
        )}
        {post.kind === 'link' && post.link && (
          <a className="fp-link" href={post.link.url} target="_blank" rel="noopener noreferrer nofollow">
            <Icon name="ext" />
            <span>
              {post.link.source === 'nobleman' ? 'From the Nobleman' : post.link.domain}
              {post.sample ? ' (sample link)' : ''}
            </span>
          </a>
        )}
        <div className="nb-post__foot">
          <button
            className="nb-act nb-act--vote"
            type="button"
            aria-pressed={voted}
            aria-label={`${voteLabel}. ${post.thoughtfulCount} so far`}
            onClick={onVote}
          >
            <Icon name="up" /> {post.thoughtfulCount}
          </button>
          <Link to={href}>
            <Icon name="comment" />{' '}
            {post.commentCount === 0 ? 'No comments yet' : plural(post.commentCount, 'comment', 'comments')}
          </Link>
          {onSave && (
            <button className="nb-act" type="button" aria-pressed={!!saved} onClick={onSave}>
              {saved ? 'Saved' : 'Save'}
            </button>
          )}
          {onShare && (
            <button className="nb-act" type="button" onClick={onShare}>
              Share
            </button>
          )}
          {post.kind === 'poll' && post.poll && (
            <span className="nb-meta">{plural(pollTotal(post.poll.options), 'vote', 'votes')}</span>
          )}
          {read && <span className="nb-meta">Opened</span>}
          {post.sample && <span className="nb-meta">Sample</span>}
        </div>
      </div>
    </article>
  );
}

/** Computer-written text is tinted and carries a small "Auto-summary" tag. */
export function SummaryBox({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <section className="nb-ai" aria-label="Summary">
      <div className="nb-ai__head">
        <span className="nb-badge nb-badge--ai">Auto-summary</span>
      </div>
      <p className="nb-ai__text">{text}</p>
      {children && <div className="nb-ai__foot">{children}</div>}
    </section>
  );
}

export function FeedSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="nb-feed" aria-busy="true" aria-label="Loading threads">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skel" key={i}>
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}
