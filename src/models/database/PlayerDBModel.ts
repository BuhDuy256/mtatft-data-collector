import { z } from 'zod';

/**
 * Database model for players table
 * Snake_case naming to match PostgreSQL conventions
 */

export const PlayerDBSchema = z.object({
    puuid: z.string(),
    tier: z.string(), // CHALLENGER, GRANDMASTER, MASTER, DIAMOND, EMERALD, PLATINUM, GOLD, SILVER, BRONZE, IRON
    league_points: z.number(),
    rank: z.string(), // I, II, III, IV
    wins: z.number(),
    losses: z.number(),
    veteran: z.boolean(),
    inactive: z.boolean(),
    fresh_blood: z.boolean(),
    hot_streak: z.boolean()
});

export type PlayerDB = z.infer<typeof PlayerDBSchema>;
