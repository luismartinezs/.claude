import { describe, it, expect } from 'bun:test';
import {
  SCROLL_THRESHOLDS,
  getScrollPercent,
  getNewThresholds,
  allThresholdsFired,
} from './scroll-tracking.logic';

// ────────────────────────────────────────────────
// 1. getScrollPercent
// ────────────────────────────────────────────────

describe('getScrollPercent', () => {
  it('returns 100 when page is not scrollable (scrollableHeight = 0)', () => {
    expect(getScrollPercent(0, 0)).toBe(100);
  });

  it('returns 100 when scrollableHeight is negative', () => {
    expect(getScrollPercent(0, -100)).toBe(100);
  });

  it('returns 0 at the top of the page', () => {
    expect(getScrollPercent(0, 1000)).toBe(0);
  });

  it('returns 50 at the midpoint', () => {
    expect(getScrollPercent(500, 1000)).toBe(50);
  });

  it('returns 100 at the bottom', () => {
    expect(getScrollPercent(1000, 1000)).toBe(100);
  });

  it('rounds down fractional percentages (33.3 → 33)', () => {
    expect(getScrollPercent(333, 1000)).toBe(33);
  });

  it('rounds up fractional percentages (33.5 → 34)', () => {
    expect(getScrollPercent(335, 1000)).toBe(34);
  });

  it('handles overscroll (scrollTop > scrollableHeight)', () => {
    expect(getScrollPercent(1200, 1000)).toBe(120);
  });

  it('handles very small scrollable height', () => {
    expect(getScrollPercent(1, 1)).toBe(100);
  });
});

// ────────────────────────────────────────────────
// 2. getNewThresholds
// ────────────────────────────────────────────────

describe('getNewThresholds', () => {
  it('returns empty array when scroll is 0%', () => {
    expect(getNewThresholds(0, new Set())).toEqual([]);
  });

  it('returns [25] when scroll hits exactly 25%', () => {
    expect(getNewThresholds(25, new Set())).toEqual([25]);
  });

  it('returns [25, 50] when scroll hits exactly 50% with nothing fired', () => {
    expect(getNewThresholds(50, new Set())).toEqual([25, 50]);
  });

  it('returns all thresholds when scroll hits 100% with nothing fired', () => {
    expect(getNewThresholds(100, new Set())).toEqual([25, 50, 75, 100]);
  });

  it('skips already-fired thresholds', () => {
    expect(getNewThresholds(50, new Set([25]))).toEqual([50]);
  });

  it('returns empty when all applicable thresholds already fired', () => {
    expect(getNewThresholds(50, new Set([25, 50]))).toEqual([]);
  });

  it('returns empty when all thresholds already fired', () => {
    expect(getNewThresholds(100, new Set([25, 50, 75, 100]))).toEqual([]);
  });

  it('returns empty when just below a threshold (24%)', () => {
    expect(getNewThresholds(24, new Set())).toEqual([]);
  });

  it('returns empty when just below next threshold (74%, 25+50 fired)', () => {
    expect(getNewThresholds(74, new Set([25, 50]))).toEqual([]);
  });

  it('handles overscroll (120%) with nothing fired', () => {
    expect(getNewThresholds(120, new Set())).toEqual([25, 50, 75, 100]);
  });
});

// ────────────────────────────────────────────────
// 3. allThresholdsFired
// ────────────────────────────────────────────────

describe('allThresholdsFired', () => {
  it('returns false for empty set', () => {
    expect(allThresholdsFired(new Set())).toBe(false);
  });

  it('returns false when partially fired', () => {
    expect(allThresholdsFired(new Set([25, 50, 75]))).toBe(false);
  });

  it('returns true when all four thresholds are fired', () => {
    expect(allThresholdsFired(new Set([25, 50, 75, 100]))).toBe(true);
  });

  it('returns true when set has more entries than thresholds', () => {
    expect(allThresholdsFired(new Set([10, 25, 50, 75, 100]))).toBe(true);
  });
});

// ────────────────────────────────────────────────
// 4. SCROLL_THRESHOLDS constant
// ────────────────────────────────────────────────

describe('SCROLL_THRESHOLDS', () => {
  it('contains exactly [25, 50, 75, 100]', () => {
    expect([...SCROLL_THRESHOLDS]).toEqual([25, 50, 75, 100]);
  });

  it('is sorted in ascending order', () => {
    for (let i = 1; i < SCROLL_THRESHOLDS.length; i++) {
      expect(SCROLL_THRESHOLDS[i]! > SCROLL_THRESHOLDS[i - 1]!).toBe(true);
    }
  });
});
