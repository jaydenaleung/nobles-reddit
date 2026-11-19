import { useId } from 'react';
import {
  ANONYMITY_NOTICE,
  APP_NAME_PARTS,
  initials,
  isStaffRole,
  shortClassYear,
  type AuthorDisplay,
  type IdentityMode,
  type Role,
} from '@commons/shared';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/** The wordmark is plain type. There is no logo. */
export function Wordmark({ to = '/', asText = false }: { to?: string; asText?: boolean }) {
  const inner = (
    <>
      {APP_NAME_PARTS.first} <em>{APP_NAME_PARTS.second}</em>
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
    <span className="nb-badge nb-badge--staff">
      <Icon name="shield" /> {word}
    </span>
  );
}

/**
 * Who wrote something, as other people see it. Colour is never the only cue:
 * anonymous authors get a dashed ring and the word "Anonymous"; staff get the
 * word "Faculty".
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

/**
 * "Post as": your name or Anonymous. Nothing is preselected, and the notice
 * about what the administration can see is shown every time.
 */
export function IdentityToggle({
  value,
  onChange,
  firstName,
  displayName,
  label = 'Post as',
  staff = false,
  invalid = false,
}: {
  value: IdentityMode | null;
  onChange: (mode: IdentityMode) => void;
  firstName: string;
  displayName: string;
  label?: string;
  staff?: boolean;
  invalid?: boolean;
}) {
  const name = useId();
  const noticeId = `${name}-notice`;
  return (
    <div className="stack">
      <div>
        <span className="nb-label" id={`${name}-label`}>
          {label}
        </span>
        <div
          className="nb-identity"
          role="radiogroup"
          aria-labelledby={`${name}-label`}
          aria-describedby={noticeId}
        >
          <label className="nb-identity__opt">
            <input
              type="radio"
              name={name}
              value="named"
              checked={value === 'named'}
              onChange={() => onChange('named')}
              aria-invalid={invalid || undefined}
            />
            <span>
              <b className={`nb-avatar${staff ? ' nb-avatar--staff' : ''}`} aria-hidden="true">
                {initials(displayName)}
              </b>{' '}
              {firstName}
            </span>
          </label>
          <label className="nb-identity__opt nb-identity__opt--anon">
            <input
              type="radio"
              name={name}
              value="anonymous"
              checked={value === 'anonymous'}
              onChange={() => onChange('anonymous')}
              aria-invalid={invalid || undefined}
            />
            <span>
              <b className="nb-avatar nb-avatar--anon" aria-hidden="true">
                <Icon name="mask" />
              </b>{' '}
              Anonymous
            </span>
          </label>
        </div>
        {invalid && (
          <p className="err" role="alert">
            Pick your name or Anonymous.
          </p>
        )}
      </div>
      <AdminNotice id={noticeId} />
    </div>
  );
}

/** Shown on the composer every time, in plain words. */
export function AdminNotice({ id }: { id?: string }) {
  return (
    <div className="nb-notice nb-notice--staff" id={id}>
      <Icon name="shield" />
      <div>{ANONYMITY_NOTICE}</div>
    </div>
  );
}
