import type { Role } from './constants';
import type { AuthorDisplay } from './types';

export function formatDisplayName(firstName: string, lastInitial: string): string {
  return `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`;
}

export interface AuthorProfileForDisplay {
  firstName: string;
  lastInitial: string;
  classYear: number | null;
  role: Role;
}

/** What other people see about an author: name, class year (students) and role. */
export function buildAuthorDisplay(profile: AuthorProfileForDisplay): AuthorDisplay {
  const display: AuthorDisplay = {
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
