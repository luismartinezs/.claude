import { rateLimit } from 'express-rate-limit';
import { getBaseConfig, createRateLimitHandler } from '@shared/rate-limit';

export const waitlistLimit = rateLimit({
  ...getBaseConfig(),
  windowMs: 60 * 1000,
  limit: 5,
  handler: createRateLimitHandler(
    'Too many waitlist requests, please try again later.',
    60
  ),
});
