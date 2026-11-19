import {
  ADMIN_DISPLAY_NAME,
  AI_SUMMARY_LABEL,
  excerpt,
  relativeTime,
  shortClassYear,
  type PollOption,
  type Post,
} from '@commons/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { RoleTag } from './Identity';

export type PostView = Post & { id: string };

export function pollTotal(options: PollOption[]): number {
  return options.reduce((sum, option) => sum + option.count, 0);
}

export function pollPercents(options: PollOption[]): number[] {
  const total = pollTotal(options);
  if (total === 0) return options.map(() => 0);
  return options.map((option) => Math.round((option.count / total) * 100));
}

export function pollDescription(options: PollOption[]): string {
  const percents = pollPercents(options);
  return `Poll results: ${options.map((o, i) => `${o.label} ${percents[i]} percent`).join(', ')}`;
}

export function PollBars({ options }: { options: PollOption[] }) {
  const percents = pollPercents(options);
  return (
    <div className="bars" role="img" aria-label={pollDescription(options)}>
      {options.map((option, i) => (
        <div className="bar" key={option.id}>
          <span>{option.label}</span>
          <span>{percents[i]}%</span>
          <span className="bar__track">
            <span className="bar__fill" style={{ width: `${percents[i]}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function PostMeta({ post, nowMs, spaceSlug }: { post: PostView; nowMs: number; spaceSlug?: string }) {
  const author = post.authorDisplay;
  return (
    <div className="post__meta">
      {post.pinned && (
        <span className="pin">
          <Icon name="pin" />
          Pinned
        </span>
      )}
      {spaceSlug ? <Link to={`/s/${spaceSlug}`}>{post.spaceName}</Link> : <b>{post.spaceName}</b>}
      {post.questionOfTheDay && <span className="who">Question of the day</span>}
      {author.mode === 'anonymous' ? (
        <span className="who">
          <i>Anonymous</i>
        </span>
      ) : (
        <span className="who">
          {author.name}
          {author.classYear !== undefined && ` ${shortClassYear(author.classYear)}`}
        </span>
      )}
      {author.mode === 'named' && author.name !== ADMIN_DISPLAY_NAME && <RoleTag role={author.role} />}
      <span>{relativeTime(post.createdAt.toMillis(), nowMs)}</span>
    </div>
  );
}

export interface PostRowProps {
  post: PostView;
  spaceSlug?: string;
  nowMs: number;
  voted: boolean;
  onVote: () => void;
  read: boolean;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
}

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
  const body = post.body ? excerpt(post.body, post.pinned ? 120 : 260) : '';
  const voteLabel = voted ? 'Thoughtful, press to undo' : 'Mark thoughtful';
  const shape = post.pinned
    ? ' post--pinned'
    : post.questionOfTheDay
      ? ' post--qotd'
      : !body && post.kind === 'text'
        ? ' post--bare'
        : '';
  return (
    <article className={`post${shape}${read ? ' post--read' : ''}`}>
      <div className="votes">
        <button className="vote" type="button" aria-pressed={voted} aria-label={voteLabel} onClick={onVote}>
          <Icon name="up" />
        </button>
        <span aria-label={plural(post.thoughtfulCount, 'thoughtful mark', 'thoughtful marks')}>
          {post.thoughtfulCount}
        </span>
      </div>
      <div className="post__main">
        <PostMeta post={post} nowMs={nowMs} spaceSlug={spaceSlug} />
        <h3 className="post__title">
          <Link to={href}>
            {post.questionOfTheDay ? <span className="hl">{post.title}</span> : post.title}
          </Link>
        </h3>
        {post.kind === 'poll' && post.poll ? (
          <PollBars options={post.poll.options} />
        ) : (
          body && <p className="post__excerpt">{body}</p>
        )}
        {post.kind === 'link' && post.link && (
          <a className="post__link" href={post.link.url} target="_blank" rel="noopener noreferrer nofollow">
            <Icon name="ext" />
            <span>{post.link.source === 'nobleman' ? 'The Nobleman' : post.link.domain}</span>
          </a>
        )}
        <div className="post__foot">
          <button
            className="act act--vote"
            type="button"
            aria-pressed={voted}
            aria-label={`${voteLabel}, ${post.thoughtfulCount} so far`}
            onClick={onVote}
          >
            <Icon name="up" />
            {post.thoughtfulCount}
          </button>
          <Link to={href}>
            <Icon name="comment" />
            {post.commentCount === 0 ? 'Reply' : plural(post.commentCount, 'reply', 'replies')}
          </Link>
          <button className="act" type="button" aria-pressed={saved} onClick={onSave}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button className="act" type="button" onClick={onShare}>
            Share
          </button>
          {post.kind === 'poll' && post.poll && (
            <span className="meta">{plural(pollTotal(post.poll.options), 'vote', 'votes')}</span>
          )}
          {read && <span className="meta">Opened</span>}
        </div>
      </div>
    </article>
  );
}

export function SummaryBox({
  text,
  bullets,
  basedOn,
  children,
}: {
  text: string;
  bullets: string[];
  basedOn?: number;
  children?: ReactNode;
}) {
  return (
    <section className="summary" aria-label="Summary">
      <div className="summary__head">
        <b>Summary</b>
        <span>{AI_SUMMARY_LABEL}</span>
      </div>
      <p className="summary__text">{text}</p>
      {bullets.length > 0 && (
        <ul className="summary__list">
          {bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      )}
      {(basedOn !== undefined || children) && (
        <div className="summary__foot">
          {basedOn !== undefined && <span>From the first {basedOn} replies.</span>}
          {children}
        </div>
      )}
    </section>
  );
}
