import { z } from 'zod';

/**
 * Riot TFT League Entry API Response Model
 * GET /tft/league/v1/entries/by-puuid/{puuid}
 * Returns array of league entries (có thể có nhiều queue types: RANKED_TFT, RANKED_TFT_TURBO, etc.)
 */
export const RiotLeagueEntrySchema = z.object({
    puuid: z.string(),
    leagueId: z.string(),
    queueType: z.string(), // RANKED_TFT, RANKED_TFT_TURBO, etc.
    tier: z.string(), // CHALLENGER, GRANDMASTER, MASTER, DIAMOND, etc.
    rank: z.string(), // I, II, III, IV
    leaguePoints: z.number(),
    wins: z.number(),
    losses: z.number(),
    veteran: z.boolean(),
    inactive: z.boolean(),
    freshBlood: z.boolean(),
    hotStreak: z.boolean()
});

export type RiotLeagueEntry = z.infer<typeof RiotLeagueEntrySchema>;

/**
 * Array of league entries (API trả về array)
 */
export const RiotLeagueEntriesSchema = z.array(RiotLeagueEntrySchema);
export type RiotLeagueEntries = z.infer<typeof RiotLeagueEntriesSchema>;
