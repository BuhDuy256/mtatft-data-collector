import { z } from 'zod';

import {
    type RiotHighTierEntry, 
    type RiotLowTierEntry,
} from './playerCollectorService';

// --- DB SCHEMA ---
// For database insertion: Map camelCase to snake_case
export const PlayerForDBSchema = z.object({
    puuid: z.string(),
    tier: z.string(), // CHALLENGER, GRANDMASTER, MASTER, DIAMOND, EMERALD, PLATINUM, GOLD, SILVER, BRONZE, IRON
    league_points: z.number(),
    rank: z.string(),
    wins: z.number(),
    losses: z.number(),
    veteran: z.boolean(),
    inactive: z.boolean(),
    fresh_blood: z.boolean(),
    hot_streak: z.boolean()
});

export type PlayerForDB = z.infer<typeof PlayerForDBSchema>;

export function mapPlayerForDB<T extends RiotHighTierEntry | RiotLowTierEntry>(
    player: T
): PlayerForDB {
    const mapped = {
        puuid: player.puuid,
        tier: player.tier.toUpperCase(), // Ensure uppercase for consistency
        league_points: player.leaguePoints,
        rank: player.rank,
        wins: player.wins,
        losses: player.losses,
        veteran: player.veteran,
        inactive: player.inactive,
        fresh_blood: player.freshBlood,
        hot_streak: player.hotStreak
    };
    
    return PlayerForDBSchema.parse(mapped);
}

export function mapPlayersForDB<T extends RiotHighTierEntry | RiotLowTierEntry>(
    players: T[]
): PlayerForDB[] {
    return players.map(mapPlayerForDB);
}
