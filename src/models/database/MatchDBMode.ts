import { z } from 'zod';

/**
 * Database model for raw_matches table (RAW DATA LAYER)
 * Snake_case naming to match PostgreSQL conventions
 * Stores raw JSON from Riot API to avoid data loss
 */
export const MatchDBSchema = z.object({
    match_id: z.string(),
    data: z.record(z.string(), z.any()), // JSONB column - stores full match JSON
    region: z.string().optional(),
    is_processed: z.boolean().default(false),
    created_at: z.string().optional() // Timestamp, handled by DB
});

export type MatchDB = z.infer<typeof MatchDBSchema>;