import {
  APP_NAME,
  initials,
  isStaffRole,
  shortClassYear,
  type AuthorDisplay,
  type Role,
} from '@commons/shared';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { LogoMarkSvg } from './Logo';

/** The logo mark, then "Neddit" in type. */
export function Wordmark({ to = '/', asText = false }: { to?: string; asText?: boolean }) {
  const inner = (
    <>
      <LogoMarkSvg />
      <span>{APP_NAME}</span>
    </>
  );
  if (asText) return <span className="nb-wordmark">{inner}</span>;
  return (
    <Link className="nb-wordmark" to={to}>
      {inner}
    </Link>
  );
}

export function Avatar({ author, small = false }: { author: AuthorDisplay; small?: boolean }) {
  const size = small ? ' nb-avatar--sm' : '';
  if (author.mode === 'anonymous') {
    return (
      <span className={`nb-avatar nb-avatar--anon${size}`} aria-hidden="true">
        <Icon name="mask" />
      </span>
    );
  }
  const staff = isStaffRole(author.role) ? ' nb-avatar--staff' : '';
  return (
    <span className={`nb-avatar${staff}${size}`} aria-hidden="true">
      {initials(author.name)}
    </span>
  );
}

export function StaffBadge({ role }: { role: Role | undefined }) {
  if (!isStaffRole(role)) return null;
  const word = role === 'admin' ? 'Administration' : role === 'moderator' ? 'Moderator' : 'Faculty';
  return (
    <span className={`nb-badge nb-badge--staff${role === 'admin' ? ' nb-badge--admin' : ''}`}>
      <Icon name="shield" /> {word}
    </span>
  );
}

/**
 * Who wrote something, as other people see it. Staff get the word "Faculty"
 * (or "Administration"), so colour is never the only cue. New posts are always
 * named; the anonymous branch only covers posts written before that changed.
 */
export function Byline({
  author,
  when,
  showLetter = true,
  avatar = true,
}: {
  author: AuthorDisplay;
  when?: string;
  /** In a thread the per-thread letter is shown ("Anonymous B"). In the feed it is just "Anonymous". */
  showLetter?: boolean;
  avatar?: boolean;
}) {
  if (author.mode === 'anonymous') {
    return (
      <div className="nb-byline nb-byline--anon">
        {avatar && <Avatar author={author} small />}
        <b>{showLetter ? author.anonLabel : 'Anonymous'}</b>
        {when && <span className="nb-meta">{when}</span>}
      </div>
    );
  }
  return (
    <div className="nb-byline">
      {avatar && <Avatar author={author} small />}
      <b>{author.name}</b>
      {author.classYear !== undefined && <span>{shortClassYear(author.classYear)}</span>}
      <StaffBadge role={author.role} />
      {when && <span className="nb-meta">{when}</span>}
    </div>
  );
}
