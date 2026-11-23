import { describe, expect, it } from 'vitest';
import { buildAuthorDisplay, formatDisplayName, initials, shortClassYear } from './authorDisplay';
import { commentKey, contentPath, parseContentKey, postKey } from './contentKey';
import { RATE_LIMITS } from './constants';
import { takeToken } from './rateLimit';
import { decideScreening, fallbackScreen } from './screening';
import { buildSearchTokens, queryTokens, tokenize } from './search';
import { isSchoolDay, relativeTime, schoolDate, shortRelativeTime } from './time';

describe('authorDisplay', () => {
  const student = { firstName: 'Priya', lastInitial: 'n', classYear: 2027, role: 'student' as const };
  const faculty = { firstName: 'Maya', lastInitial: 'H', classYear: null, role: 'faculty' as const };

  it('named students show name, class year and role', () => {
    expect(buildAuthorDisplay(student)).toEqual({
      name: 'Priya N.',
      classYear: 2027,
      role: 'student',
    });
  });
  it('named faculty show name and role, no class year', () => {
    expect(buildAuthorDisplay(faculty)).toEqual({
      name: 'Maya H.',
      role: 'faculty',
    });
  });
  it('formats names, initials and class years', () => {
    expect(formatDisplayName(' Dev ', 's')).toBe('Dev S.');
    expect(initials('Priya N.')).toBe('PN');
    expect(initials('Administration')).toBe('A');
    expect(shortClassYear(2028)).toBe('’28');
  });
});

describe('contentKey', () => {
  it('round-trips post and comment keys', () => {
    expect(parseContentKey(postKey('abc'))).toEqual({ kind: 'post', postId: 'abc' });
    expect(parseContentKey(commentKey('abc', 'def'))).toEqual({
      kind: 'comment',
      postId: 'abc',
      commentId: 'def',
    });
  });
  it('rejects anything else', () => {
    expect(parseContentKey('post:a/b')).toBeNull();
    expect(parseContentKey('comment:abc')).toBeNull();
    expect(parseContentKey('users:abc')).toBeNull();
  });
  it('maps to the Firestore path', () => {
    expect(contentPath({ kind: 'comment', postId: 'p', commentId: 'c' })).toBe('posts/p/comments/c');
  });
});

describe('rate limiter (token bucket)', () => {
  const config = { capacity: 5, perHour: 5 };
  it('starts full and allows up to capacity in a burst', () => {
    let bucket;
    for (let i = 0; i < 5; i++) {
      const result = takeToken(bucket, config, 1000);
      expect(result.allowed).toBe(true);
      bucket = result.bucket;
    }
    const sixth = takeToken(bucket, config, 1000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
  });
  it('refills steadily: one token every 12 minutes at 5 per hour', () => {
    const empty = { tokens: 0, updatedAtMs: 0 };
    expect(takeToken(empty, config, 11 * 60_000).allowed).toBe(false);
    expect(takeToken(empty, config, 12 * 60_000).allowed).toBe(true);
  });
  it('never holds more than its capacity', () => {
    const result = takeToken({ tokens: 5, updatedAtMs: 0 }, config, 1000 * 60 * 60 * 24);
    expect(result.bucket.tokens).toBe(4);
  });
  it('reports how long to wait', () => {
    const result = takeToken({ tokens: 0.5, updatedAtMs: 0 }, config, 0);
    expect(result.retryAfterMs).toBe(6 * 60_000);
  });
  it('is not confused by a clock that goes backwards', () => {
    const result = takeToken({ tokens: 2, updatedAtMs: 5000 }, config, 1000);
    expect(result.allowed).toBe(true);
    expect(result.bucket.tokens).toBe(1);
  });
  it('uses the limits from the spec', () => {
    expect(RATE_LIMITS.posts.perHour).toBe(5);
    expect(RATE_LIMITS.comments.perHour).toBe(40);
    expect(RATE_LIMITS.votes.perHour).toBe(200);
    expect(RATE_LIMITS.reports.perHour).toBe(10);
  });
});

describe('search tokens', () => {
  it('lowercases, removes stop words and repeats', () => {
    expect(tokenize('The Lacrosse team and THE lacrosse game')).toEqual(['lacrosse', 'team', 'game']);
  });
  it('indexes the title, the start of the body and the space name', () => {
    const tokens = buildSearchTokens('Club fair ideas', 'x '.repeat(150) + 'hidden', 'Clubs');
    expect(tokens).toContain('club');
    expect(tokens).toContain('clubs');
    expect(tokens).not.toContain('hidden');
  });
  it('limits a query to ten tokens', () => {
    expect(queryTokens('one two three four five six seven eight nine ten eleven twelve').length).toBe(10);
  });
});

describe('screening policy', () => {
  it('publishes when nothing is confident', () => {
    expect(decideScreening([{ label: 'harassment', confidence: 0.2 }])).toEqual({ outcome: 'publish' });
    expect(decideScreening([])).toEqual({ outcome: 'publish' });
  });
  it('holds medium and high risk for review', () => {
    expect(decideScreening([{ label: 'harassment', confidence: 0.7 }])).toEqual({
      outcome: 'hold',
      labels: ['harassment'],
      score: 0.7,
    });
  });
  it('routes self-harm and harm to others to wellbeing, never to delete', () => {
    const decision = decideScreening([
      { label: 'self_harm', confidence: 0.6 },
      { label: 'harassment', confidence: 0.9 },
    ]);
    expect(decision.outcome).toBe('wellbeing');
    expect(decideScreening([{ label: 'harm_to_others', confidence: 0.8 }]).outcome).toBe('wellbeing');
  });
  it('the fallback phrase check catches the clearest signals only', () => {
    expect(fallbackScreen('I want to hurt myself').map((f) => f.label)).toEqual(['self_harm']);
    expect(fallbackScreen('That test killed me, I am dying of laughter')).toEqual([]);
  });
});

describe('time', () => {
  it('gives the school date in Eastern time', () => {
    // 03:30 UTC on Nov 17 is still Nov 16 in Massachusetts.
    expect(schoolDate(new Date('2026-11-17T03:30:00Z'))).toBe('2026-11-16');
  });
  it('knows school days', () => {
    expect(isSchoolDay(new Date('2026-11-16T15:00:00Z'))).toBe(true); // Monday
    expect(isSchoolDay(new Date('2026-11-14T15:00:00Z'))).toBe(false); // Saturday
  });
  it('writes relative times in plain words', () => {
    const now = 1_000_000_000_000;
    expect(relativeTime(now - 10_000, now)).toBe('just now');
    expect(relativeTime(now - 6 * 3_600_000, now)).toBe('6 hours ago');
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2 days ago');
    expect(shortRelativeTime(now - 3 * 3_600_000, now)).toBe('3h');
  });
});
