import { z } from 'zod';

/**
 * Riot API player entry models
 * Represents player data from League V1 API endpoints
 */

// --- BASE PLAYER SCHEMA ---
// Common fields across all tier levels
export const PlayerBaseSchema = z.object({
    puuid: z.string(),
    leaguePoints: z.number(),
    rank: z.string(),
    wins: z.number(),
    losses: z.number(),
    veteran: z.boolean(),
    inactive: z.boolean(),
    freshBlood: z.boolean(),
    hotStreak: z.boolean()
});

// --- HIGH TIER PLAYER ---
// Challenger, Grandmaster, Master
// API doesn't return 'tier' field, we add it manually after fetch

const RiotHighTierEntryRawSchema = PlayerBaseSchema;

export const RiotHighTierEntrySchema = RiotHighTierEntryRawSchema.extend({
    tier: z.string() // Added manually after API fetch
});

export type RiotHighTierEntry = z.infer<typeof RiotHighTierEntrySchema>;

// --- LOW TIER PLAYER ---
// Diamond, Emerald, Platinum, Gold, Silver, Bronze, Iron
// API returns tier, leagueId, queueType

export const RiotLowTierEntrySchema = PlayerBaseSchema.extend({
    leagueId: z.string(),
    queueType: z.string(),
    tier: z.string()
});

export type RiotLowTierEntry = z.infer<typeof RiotLowTierEntrySchema>;

// --- API RESPONSE SCHEMAS ---

// High Tier API response (nested structure)
export const RiotHighTierResponseSchema = z.object({
    tier: z.string(),
    leagueId: z.string(),
    queue: z.string(),
    name: z.string(),
    entries: z.array(RiotHighTierEntryRawSchema)
});

export type RiotHighTierResponse = z.infer<typeof RiotHighTierResponseSchema>;

// Low Tier API response (direct array)
export const RiotLowTierResponseSchema = z.array(RiotLowTierEntrySchema);

export type RiotLowTierResponse = z.infer<typeof RiotLowTierResponseSchema>;

// --- UNION TYPE ---
export type RiotPlayerEntry = RiotHighTierEntry | RiotLowTierEntry;
