import { describe, expect, it } from 'vitest';
import {
  cleanText,
  contentKeySchema,
  createCommentSchema,
  createPostSchema,
  httpsUrlSchema,
  modActionSchema,
  onboardSchema,
  reportContentSchema,
  revealAuthorSchema,
  setRoleSchema,
  votePollSchema,
} from './schemas';

const basePost = { spaceId: 'space1', identityMode: 'named', title: 'A perfectly good title' };

describe('cleanText', () => {
  it('removes control and bidi-override characters and trims', () => {
    expect(cleanText('  hi\u0000\u202Ethere\u200B  ')).toBe('hithere');
  });
  it('normalises line endings and collapses long runs of blank lines', () => {
    expect(cleanText('a\r\nb\n\n\n\n\n\nc')).toBe('a\nb\n\n\nc');
  });
});

describe('createPostSchema', () => {
  it('accepts a text post', () => {
    const parsed = createPostSchema.parse({ ...basePost, kind: 'text', body: 'Hello' });
    expect(parsed.kind).toBe('text');
  });
  it('rejects a title that is too short or too long', () => {
    expect(createPostSchema.safeParse({ ...basePost, kind: 'text', body: '', title: 'Hey' }).success).toBe(
      false,
    );
    expect(
      createPostSchema.safeParse({ ...basePost, kind: 'text', body: '', title: 'x'.repeat(141) }).success,
    ).toBe(false);
  });
  it('measures the title after cleaning whitespace', () => {
    expect(
      createPostSchema.safeParse({ ...basePost, kind: 'text', body: '', title: '  a   b  ' }).success,
    ).toBe(false);
  });
  it('rejects a body over 10,000 characters', () => {
    expect(createPostSchema.safeParse({ ...basePost, kind: 'text', body: 'x'.repeat(10_001) }).success).toBe(
      false,
    );
  });
  it('requires an identity mode and never defaults it', () => {
    const { identityMode: _omit, ...rest } = basePost;
    expect(createPostSchema.safeParse({ ...rest, kind: 'text', body: 'Hello' }).success).toBe(false);
  });
  it('rejects unknown fields such as a smuggled author', () => {
    expect(
      createPostSchema.safeParse({ ...basePost, kind: 'text', body: 'x', authorUid: 'someone' }).success,
    ).toBe(false);
    expect(
      createPostSchema.safeParse({ ...basePost, kind: 'text', body: 'x', status: 'visible' }).success,
    ).toBe(false);
  });
  it('accepts https links only', () => {
    expect(
      createPostSchema.safeParse({ ...basePost, kind: 'link', url: 'https://example.org/a' }).success,
    ).toBe(true);
    for (const url of [
      'http://example.org',
      'javascript:alert(1)',
      'data:text/html,hi',
      'https://user:pw@example.org',
      'https://localhost',
      'ftp://example.org',
      'not a url',
    ]) {
      expect(createPostSchema.safeParse({ ...basePost, kind: 'link', url }).success, url).toBe(false);
    }
  });
  it('accepts polls with 2 to 6 different options of up to 80 characters', () => {
    const ok = (options: string[]) =>
      createPostSchema.safeParse({ ...basePost, kind: 'poll', options }).success;
    expect(ok(['Yes', 'No'])).toBe(true);
    expect(ok(['Only one'])).toBe(false);
    expect(ok(['1', '2', '3', '4', '5', '6', '7'])).toBe(false);
    expect(ok(['Same', 'same'])).toBe(false);
    expect(ok(['x'.repeat(81), 'No'])).toBe(false);
    expect(ok(['', 'No'])).toBe(false);
  });
});

describe('anonymous posts', () => {
  it('are refused for new threads', () => {
    expect(
      createPostSchema.safeParse({ ...basePost, identityMode: 'anonymous', kind: 'text', body: 'Hi' })
        .success,
    ).toBe(false);
  });
});

describe('createCommentSchema', () => {
  const base = { postId: 'p1', parentId: null, identityMode: 'named' };
  it('refuses anonymous comments', () => {
    expect(createCommentSchema.safeParse({ ...base, identityMode: 'anonymous', body: 'Hi' }).success).toBe(
      false,
    );
  });
  it('accepts a comment and rejects empty or oversized ones', () => {
    expect(createCommentSchema.safeParse({ ...base, body: 'I agree' }).success).toBe(true);
    expect(createCommentSchema.safeParse({ ...base, body: '   ' }).success).toBe(false);
    expect(createCommentSchema.safeParse({ ...base, body: 'x'.repeat(4001) }).success).toBe(false);
  });
  it('rejects ids that could reach into another path', () => {
    expect(createCommentSchema.safeParse({ ...base, postId: 'a/b', body: 'x' }).success).toBe(false);
    expect(createCommentSchema.safeParse({ ...base, parentId: '../x', body: 'x' }).success).toBe(false);
  });
});

describe('contentKeySchema', () => {
  it('accepts post and comment keys only', () => {
    expect(contentKeySchema.safeParse('post:abc123').success).toBe(true);
    expect(contentKeySchema.safeParse('comment:abc:def').success).toBe(true);
    expect(contentKeySchema.safeParse('user:abc').success).toBe(false);
    expect(contentKeySchema.safeParse('post:a/b').success).toBe(false);
    expect(contentKeySchema.safeParse('comment:abc').success).toBe(false);
  });
});

describe('httpsUrlSchema', () => {
  it('trims and accepts a normal link', () => {
    expect(httpsUrlSchema.parse('  https://www.example.org/story?id=1  ')).toBe(
      'https://www.example.org/story?id=1',
    );
  });
});

describe('other inputs', () => {
  it('reveal needs a reason of at least 10 characters', () => {
    expect(revealAuthorSchema.safeParse({ contentKey: 'post:a', reason: 'because' }).success).toBe(false);
    expect(
      revealAuthorSchema.safeParse({ contentKey: 'post:a', reason: 'Safety concern raised by a dean' })
        .success,
    ).toBe(true);
  });
  it('onboarding needs the "I understand" box and a one-letter initial', () => {
    const ok = { firstName: 'Priya', lastInitial: 'N', classYear: 2027, understood: true };
    expect(onboardSchema.safeParse(ok).success).toBe(true);
    expect(onboardSchema.safeParse({ ...ok, understood: false }).success).toBe(false);
    expect(onboardSchema.safeParse({ ...ok, lastInitial: 'Na' }).success).toBe(false);
    expect(onboardSchema.safeParse({ ...ok, role: 'admin' }).success).toBe(false);
  });
  it('reports accept known reasons only', () => {
    expect(reportContentSchema.safeParse({ contentKey: 'post:a', reason: 'unkind' }).success).toBe(true);
    expect(reportContentSchema.safeParse({ contentKey: 'post:a', reason: 'because' }).success).toBe(false);
  });
  it('moderation actions are a closed list', () => {
    expect(modActionSchema.safeParse({ contentKey: 'post:a', action: 'hold' }).success).toBe(true);
    expect(modActionSchema.safeParse({ contentKey: 'post:a', action: 'reveal' }).success).toBe(false);
  });
  it('setRole lowercases the email and needs a known role', () => {
    const parsed = setRoleSchema.parse({
      email: ' Sample.Teacher@Nobles.edu ',
      role: 'faculty',
      reason: 'Joined staff',
    });
    expect(parsed.email).toBe('sample.teacher@nobles.edu');
    expect(setRoleSchema.safeParse({ email: 'x@nobles.edu', role: 'owner', reason: 'abc' }).success).toBe(
      false,
    );
  });
  it('poll votes need a short option id', () => {
    expect(votePollSchema.safeParse({ postId: 'p1', optionId: 'o1' }).success).toBe(true);
    expect(votePollSchema.safeParse({ postId: 'p1', optionId: 'O 1' }).success).toBe(false);
  });
});
