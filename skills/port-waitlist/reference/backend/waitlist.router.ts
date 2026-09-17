import express from 'express';
import { route } from '@shared/routes/adapter';
import { validate } from '@shared/routes/validate';
import { WaitlistEntrySchema } from '@repo/api-types';
import { waitlistLimit } from './rate-limit';
import { handleWaitlistPost } from './handler';

const waitlistRouter = express.Router();

waitlistRouter.post(
  '/',
  waitlistLimit,
  validate({ body: WaitlistEntrySchema }),
  route(handleWaitlistPost),
);

export { waitlistRouter };
