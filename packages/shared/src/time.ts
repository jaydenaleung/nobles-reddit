import { SCHOOL_TIME_ZONE } from './constants';

/** The calendar date at school, as yyyy-mm-dd. */
export function schoolDate(now: Date = new Date(), timeZone: string = SCHOOL_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Monday to Friday at school. */
export function isSchoolDay(now: Date = new Date(), timeZone: string = SCHOOL_TIME_ZONE): boolean {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  return day !== 'Sat' && day !== 'Sun';
}

/** "just now", "6 hours ago", "2 days ago". */
export function relativeTime(thenMs: number, nowMs: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** "3h", "2d": the short form used on phones. */
export function shortRelativeTime(thenMs: number, nowMs: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((nowMs - thenMs) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 365) return `${days}d`;
  return `${Math.round(days / 365)}y`;
}
