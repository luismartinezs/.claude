import { z } from 'zod';

export const WaitlistEntrySchema = z.object({
  email: z.string().email(),
  restrictions: z.array(z.string()).default([]),
  utmSource: z.string().nullable().default(null),
  utmMedium: z.string().nullable().default(null),
  utmCampaign: z.string().nullable().default(null),
});

export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;

export const WaitlistResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type WaitlistResponse = z.infer<typeof WaitlistResponseSchema>;
