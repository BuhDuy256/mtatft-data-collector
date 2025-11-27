import { z } from 'zod'

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

export const RiotHighTierPlayerSchema = PlayerBaseSchema.extend({
    tier: z.string()
});

export const RiotLowTierPlayerSchema = PlayerBaseSchema.extend({
    leagueId: z.string(),
    queueType: z.string(),
    tier: z.string()
});

// Response Schema for Riot API: /tft/league/v1/challenger | /tft/league/v1/grandmaster | /tft/league/v1/master
export const RiotHighTierResponseSchema = z.object({
    tier: z.string(),
    leagueId: z.string(),
    queue: z.string(),
    name: z.string(),
    entries: z.array(PlayerBaseSchema)
});

// Response Schema for Riot API: /tft/league/v1/entries/{tier}/{division}
export const RiotLowTierResponseSchema = z.array(RiotLowTierPlayerSchema);

export type RiotLowTierPlayer = z.infer<typeof RiotLowTierPlayerSchema>;
export type RiotHighTierPlayer = z.infer<typeof RiotHighTierPlayerSchema>;
export type RiotHighTierResponse = z.infer<typeof RiotHighTierResponseSchema>;
export type RiotLowTierResponse = z.infer<typeof RiotLowTierResponseSchema>;
