import { describe, it, expect } from 'bun:test';
import { parseUtmParams, extractFirstErrorMessage } from './waitlist.logic';

// ────────────────────────────────────────────────
// 1. parseUtmParams — Happy Path
// ────────────────────────────────────────────────

describe('parseUtmParams', () => {
  it('parses all three UTM params from a query string', () => {
    const result = parseUtmParams('?utm_source=google&utm_medium=cpc&utm_campaign=launch');
    expect(result).toEqual({
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'launch',
    });
  });

  it('returns nulls when no UTM params are present', () => {
    const result = parseUtmParams('');
    expect(result).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });

  it('returns nulls for empty query string with question mark', () => {
    const result = parseUtmParams('?');
    expect(result).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });

  // ────────────────────────────────────────────────
  // 2. parseUtmParams — Partial Params
  // ────────────────────────────────────────────────

  it('returns null for missing UTM params (only source present)', () => {
    const result = parseUtmParams('?utm_source=twitter');
    expect(result).toEqual({
      utmSource: 'twitter',
      utmMedium: null,
      utmCampaign: null,
    });
  });

  it('returns null for missing UTM params (only campaign present)', () => {
    const result = parseUtmParams('?utm_campaign=spring-2026');
    expect(result).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: 'spring-2026',
    });
  });

  // ────────────────────────────────────────────────
  // 3. parseUtmParams — Edge Cases
  // ────────────────────────────────────────────────

  it('normalizes empty string values to null', () => {
    const result = parseUtmParams('?utm_source=&utm_medium=&utm_campaign=');
    expect(result).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });

  it('ignores non-UTM params', () => {
    const result = parseUtmParams('?ref=homepage&utm_source=google&foo=bar');
    expect(result).toEqual({
      utmSource: 'google',
      utmMedium: null,
      utmCampaign: null,
    });
  });

  it('handles URL-encoded values', () => {
    const result = parseUtmParams('?utm_source=face%20book&utm_campaign=spring%262026');
    expect(result.utmSource).toBe('face book');
    expect(result.utmCampaign).toBe('spring&2026');
  });

  it('takes first value when UTM param is duplicated', () => {
    const result = parseUtmParams('?utm_source=first&utm_source=second');
    expect(result.utmSource).toBe('first');
  });

  it('is case-sensitive (UTM_SOURCE is not utm_source)', () => {
    const result = parseUtmParams('?UTM_SOURCE=google');
    expect(result.utmSource).toBeNull();
  });
});

// ────────────────────────────────────────────────
// 4. extractFirstErrorMessage
// ────────────────────────────────────────────────

describe('extractFirstErrorMessage', () => {
  it('returns the first issue message', () => {
    const issues = [{ message: 'Invalid email' }, { message: 'Too short' }];
    expect(extractFirstErrorMessage(issues)).toBe('Invalid email');
  });

  it('returns single message from single-issue array', () => {
    const issues = [{ message: 'Required' }];
    expect(extractFirstErrorMessage(issues)).toBe('Required');
  });

  it('returns "Invalid input" for empty issues array', () => {
    expect(extractFirstErrorMessage([])).toBe('Invalid input');
  });
});
