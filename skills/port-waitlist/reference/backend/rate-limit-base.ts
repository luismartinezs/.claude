import type { Request, Response, NextFunction } from 'express';
import { err } from '@shared/routes/error';
import type { RateLimitConfig } from './types';

/**
 * Creates a standard rate limit error handler
 */
export const createRateLimitHandler = (
  message: string,
  defaultRetryAfterSec: number = 60
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const retryAfterSec = req.rateLimit?.resetTime
      ? Math.round((req.rateLimit.resetTime - Date.now()) / 1000)
      : defaultRetryAfterSec;

    next(err('rate_limited', message, { retryAfterSec }));
  };
};

/**
 * Environment-aware rate limiting base configuration
 */
export const getBaseConfig = (): RateLimitConfig => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Base configuration with our AppError integration
  const baseConfig = {
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: createRateLimitHandler(
      'Too many requests from this IP, please try again later.'
    ),
  };

  if (nodeEnv === 'production') {
    return {
      ...baseConfig,
      windowMs: 60 * 1000, // 1 minute
      limit: 30, // 30 requests per minute in production
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
  } else if (nodeEnv === 'development') {
    return {
      ...baseConfig,
      windowMs: 60 * 1000, // 1 minute
      limit: 1000, // Very lenient for development
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
  } else {
    // Test environment - very restrictive
    return {
      ...baseConfig,
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 5, // Very restrictive for tests
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
  }
};
