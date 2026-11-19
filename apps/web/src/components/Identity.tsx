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

export function Wordmark({ asText = false }: { asText?: boolean }) {
  const inner = (
    <>
      {APP_NAME_PARTS.first} <em>{APP_NAME_PARTS.second}</em>
    </>
  );
  if (asText) return <span className="wordmark">{inner}</span>;
  return (
    <Link className="wordmark" to="/">
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
  return (
    <span className={`nb-avatar${size}`} aria-hidden="true">
      {initials(author.name)}
    </span>
  );
}

const ROLE_WORDS: Partial<Record<Role, string>> = {
  faculty: 'faculty',
  moderator: 'faculty',
  admin: 'admin',
};

export function RoleTag({ role }: { role: Role | undefined }) {
  if (!isStaffRole(role) || !role) return null;
  return (
    <span className="role">
      <Icon name="shield" />
      {ROLE_WORDS[role]}
    </span>
  );
}

/**
 * Anonymous authors get a dashed ring and the word, so color is never the only sign.
 * In a thread they also get their letter for that thread ("Anonymous B").
 */
export function Byline({
  author,
  when,
  showLetter = true,
  avatar = true,
}: {
  author: AuthorDisplay;
  when?: string;
  showLetter?: boolean;
  avatar?: boolean;
}) {
  if (author.mode === 'anonymous') {
    return (
      <div className="byline byline--anon">
        {avatar && <Avatar author={author} small />}
        <b>{showLetter ? author.anonLabel : 'Anonymous'}</b>
        {when && <span>{when}</span>}
      </div>
    );
  }
  return (
    <div className="byline">
      {avatar && <Avatar author={author} small />}
      <b>{author.name}</b>
      {author.classYear !== undefined && <span>{shortClassYear(author.classYear)}</span>}
      <RoleTag role={author.role} />
      {when && <span>{when}</span>}
    </div>
  );
}

/** Nothing is preselected, and the notice shows every time. */
export function IdentityToggle({
  value,
  onChange,
  firstName,
  displayName,
  label = 'Post as',
  invalid = false,
}: {
  value: IdentityMode | null;
  onChange: (mode: IdentityMode) => void;
  firstName: string;
  displayName: string;
  label?: string;
  invalid?: boolean;
}) {
  const name = useId();
  const noticeId = `${name}-notice`;
  return (
    <div className="stack">
      <div>
        <span className="label" id={`${name}-label`}>
          {label}
        </span>
        <div
          className="identity"
          role="radiogroup"
          aria-labelledby={`${name}-label`}
          aria-describedby={noticeId}
        >
          <label className="identity__opt">
            <input
              type="radio"
              name={name}
              value="named"
              checked={value === 'named'}
              onChange={() => onChange('named')}
              aria-invalid={invalid || undefined}
            />
            <span>
              <b className="nb-avatar" aria-hidden="true">
                {initials(displayName)}
              </b>
              {firstName}
            </span>
          </label>
          <label className="identity__opt identity__opt--anon">
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
              </b>
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

export function AdminNotice({ id }: { id?: string }) {
  return (
    <div className="notice" id={id}>
      <Icon name="shield" />
      <div>{ANONYMITY_NOTICE}</div>
    </div>
  );
}
