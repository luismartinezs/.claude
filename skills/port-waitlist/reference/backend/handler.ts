import type { Request } from 'express';
import type { WaitlistResponse } from '@repo/api-types';
import { upsertWaitlistEntry } from './service';

export async function handleWaitlistPost(req: Request): Promise<WaitlistResponse> {
  return upsertWaitlistEntry(req.body);
}
