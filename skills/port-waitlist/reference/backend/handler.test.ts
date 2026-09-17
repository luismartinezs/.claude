import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Request } from 'express';

// ────────────────────────────────────────────────
// Mock: ./service
// ────────────────────────────────────────────────

const mockUpsert = mock();

mock.module('./service', () => ({
  upsertWaitlistEntry: mockUpsert,
}));

import { handleWaitlistPost } from './handler';

// ────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────

const VALID_BODY = {
  email: 'parent@example.com',
  restrictions: ['dairy-free'],
  utmSource: 'google',
  utmMedium: null,
  utmCampaign: null,
};

const SUCCESS_RESULT = {
  success: true as const,
  message: "You're on the list! We'll be in touch soon.",
};

function fakeRequest(body: unknown): Request {
  return { body } as Request;
}

describe('handleWaitlistPost', () => {
  beforeEach(() => {
    mockUpsert.mockClear();
    mockUpsert.mockResolvedValue(SUCCESS_RESULT);
  });

  // ────────────────────────────────────────────────
  // 1. Happy Path — delegates to service
  // ────────────────────────────────────────────────

  it('passes req.body to upsertWaitlistEntry', async () => {
    await handleWaitlistPost(fakeRequest(VALID_BODY));

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(VALID_BODY);
  });

  it('returns the service result directly', async () => {
    const result = await handleWaitlistPost(fakeRequest(VALID_BODY));

    expect(result).toEqual(SUCCESS_RESULT);
  });

  // ────────────────────────────────────────────────
  // 2. Error Propagation — no swallowing
  // ────────────────────────────────────────────────

  it('propagates service errors to caller (route adapter catches)', async () => {
    mockUpsert.mockRejectedValue(new Error('DB down'));

    await expect(handleWaitlistPost(fakeRequest(VALID_BODY))).rejects.toThrow('DB down');
  });

  // ────────────────────────────────────────────────
  // 3. Passthrough — no transformation
  // ────────────────────────────────────────────────

  it('does not modify or validate req.body (validation is middleware)', async () => {
    const rawBody = { anything: 'goes', at: 'handler-level' };
    await handleWaitlistPost(fakeRequest(rawBody));

    expect(mockUpsert).toHaveBeenCalledWith(rawBody);
  });
});
