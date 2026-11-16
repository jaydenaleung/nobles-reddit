import type { Role } from './constants';
import type { AuthorDisplay, IdentityMode } from './types';

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function anonLetter(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}
export function anonLabel(index: number): string {
  return `Anonymous ${anonLetter(index)}`;
}

export function formatDisplayName(firstName: string, lastInitial: string): string {
  return `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`;
}

export interface AuthorProfileForDisplay {
  firstName: string;
  lastInitial: string;
  classYear: number | null;
  role: Role;
}

/**
 * Builds what other people see about an author.
 *
 * Named: name, class year and role.
 * Anonymous: only the per-thread label. No name, no class year and no role,
 * so a faculty member posting anonymously is just "Anonymous", on purpose.
 */
export function buildAuthorDisplay(
  profile: AuthorProfileForDisplay,
  mode: IdentityMode,
  anonIndex: number,
): AuthorDisplay {
  if (mode === 'anonymous') {
    return { mode: 'anonymous', anonLabel: anonLabel(anonIndex) };
  }
  const display: AuthorDisplay = {
    mode: 'named',
    name: formatDisplayName(profile.firstName, profile.lastInitial),
    role: profile.role,
  };
  if (profile.classYear !== null && profile.role === 'student') display.classYear = profile.classYear;
  return display;
}

/** "PN" for "Priya N." */
export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** "’27" for 2027. */
export function shortClassYear(year: number): string {
  return `’${String(year).slice(-2)}`;
}

export function isStaffRole(role: Role | undefined): boolean {
  return role === 'faculty' || role === 'moderator' || role === 'admin';
}
export function isModeratorRole(role: Role | undefined | null): boolean {
  return role === 'moderator' || role === 'admin';
}
