import { z } from 'zod';

/**
 * Riot Account API Response Model
 * GET /riot/account/v1/accounts/by-puuid/{puuid}
 */
export const RiotAccountSchema = z.object({
    puuid: z.string(),
    gameName: z.string(),
    tagLine: z.string()
});

export type RiotAccount = z.infer<typeof RiotAccountSchema>;
