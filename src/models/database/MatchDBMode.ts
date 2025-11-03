import { z } from 'zod';

/**
 * Database model for matches table
 * Snake_case naming to match PostgreSQL conventions
 */
export const MatchDBSchema = z.object({
    match_id: z.string(),
    data: z.record(z.string(), z.any()), // JSONB column - stores full match JSON
    is_processed: z.boolean().default(false),
    region: z.string()
});

export type MatchDB = z.infer<typeof MatchDBSchema>;

/**
 * Link table between players and matches
 */
export const PlayerMatchLinkDBSchema = z.object({
    puuid: z.string(),
    match_id: z.string()
});

export type PlayerMatchLinkDB = z.infer<typeof PlayerMatchLinkDBSchema>;