import { describe, expect, it } from 'vitest';
import { HOT_EPOCH_SECONDS } from './constants';
import { compareHot, engagementScore, hotScore } from './hot';

describe('engagementScore', () => {
  it('counts thoughtful marks fully and comments half', () => {
    expect(engagementScore(10, 4)).toBe(12);
  });
  it('never goes below zero', () => {
    expect(engagementScore(-5, -2)).toBe(0);
  });
});

describe('hotScore', () => {
  it('is zero for a brand-new post at the epoch with no engagement', () => {
    expect(hotScore(0, 0, HOT_EPOCH_SECONDS)).toBe(0);
  });
  it('matches the formula in the spec', () => {
    // score = 100 + 0.5 * 0 = 100 -> log10 = 2; age = 45000 / 45000 = 1
    expect(hotScore(100, 0, HOT_EPOCH_SECONDS + 45_000)).toBe(3);
    // score = 6 + 0.5 * 8 = 10 -> log10 = 1
    expect(hotScore(6, 8, HOT_EPOCH_SECONDS)).toBe(1);
  });
  it('treats scores below one as one, so quiet posts are not punished', () => {
    expect(hotScore(0, 1, HOT_EPOCH_SECONDS)).toBe(0);
    expect(hotScore(0, 0, HOT_EPOCH_SECONDS + 90_000)).toBe(2);
  });
  it('ranks a newer post above an older one with the same engagement', () => {
    const older = hotScore(5, 2, HOT_EPOCH_SECONDS + 1000);
    const newer = hotScore(5, 2, HOT_EPOCH_SECONDS + 9000);
    expect(newer).toBeGreaterThan(older);
  });
  it('needs ten times the engagement to make up 12.5 hours', () => {
    const fresh = hotScore(10, 0, HOT_EPOCH_SECONDS + 45_000);
    const old = hotScore(100, 0, HOT_EPOCH_SECONDS);
    expect(fresh).toBe(old);
  });
  it('increases with engagement', () => {
    const t = HOT_EPOCH_SECONDS + 5000;
    expect(hotScore(50, 0, t)).toBeGreaterThan(hotScore(5, 0, t));
    expect(hotScore(5, 20, t)).toBeGreaterThan(hotScore(5, 0, t));
  });
  it('is a finite number with stable rounding', () => {
    const value = hotScore(3, 7, HOT_EPOCH_SECONDS + 123_457);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBe(Math.round(value * 1e7) / 1e7);
  });
});

describe('compareHot', () => {
  it('puts pinned posts first regardless of score', () => {
    const items = [
      { id: 'a', pinned: false, hotScore: 99 },
      { id: 'b', pinned: true, hotScore: 1 },
      { id: 'c', pinned: false, hotScore: 50 },
    ];
    expect(items.sort(compareHot).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});
