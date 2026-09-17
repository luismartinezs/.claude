import { db, waitlistEntries, sql } from '@repo/db';
import type { WaitlistEntry } from '@repo/api-types';
import type { WaitlistResult } from './types';

export async function upsertWaitlistEntry(input: WaitlistEntry): Promise<WaitlistResult> {
  await db
    .insert(waitlistEntries)
    .values({
      email: input.email,
      restrictions: input.restrictions,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
    })
    .onConflictDoUpdate({
      target: waitlistEntries.email,
      set: {
        restrictions: sql`excluded.restrictions`,
        utmSource: sql`excluded.utm_source`,
        utmMedium: sql`excluded.utm_medium`,
        utmCampaign: sql`excluded.utm_campaign`,
        updatedAt: new Date(),
      },
    });

  return { success: true, message: "You're on the list! We'll be in touch soon." };
}
