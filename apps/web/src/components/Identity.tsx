import {
  APP_NAME,
  initials,
  isStaffRole,
  shortClassYear,
  type AuthorDisplay,
  type Role,
  FORMER_MEMBER_LABEL,
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
  const staff = isStaffRole(author.role) ? ' nb-avatar--staff' : '';
  return (
    <span className={`nb-avatar${staff}${size}`} aria-hidden="true">
      {initials(author.name || FORMER_MEMBER_LABEL)}
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
 * (or "Administration"), so colour is never the only cue.
 */
export function Byline({
  author,
  when,
  avatar = true,
}: {
  author: AuthorDisplay;
  when?: string;
  avatar?: boolean;
}) {
  return (
    <div className="nb-byline">
      {avatar && <Avatar author={author} small />}
      <b>{author.name || FORMER_MEMBER_LABEL}</b>
      {author.classYear !== undefined && <span>{shortClassYear(author.classYear)}</span>}
      <StaffBadge role={author.role} />
      {when && <span className="nb-meta">{when}</span>}
    </div>
  );
}
