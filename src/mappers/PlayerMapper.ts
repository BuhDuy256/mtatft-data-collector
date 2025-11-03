import type { RiotHighTierEntry, RiotLowTierEntry } from '../models/riot/RiotPlayerModels';
import { PlayerDBSchema, type PlayerDB } from '../models/database/PlayerDBModel';

/**
 * Mapper for converting Riot API player models to database models
 * Handles camelCase → snake_case transformation and validation
 */

/**
 * Map single Riot player entry to database format
 * Transforms field names from camelCase (API) to snake_case (DB).
 * Validates output against PlayerDBSchema.
 * 
 * @param player - Riot API player entry (High or Low tier)
 * @returns Database player model
 * @throws ZodError if validation fails
 */
export function mapRiotPlayerToDatabase<T extends RiotHighTierEntry | RiotLowTierEntry>(
    player: T
): PlayerDB {
    const mapped = {
        puuid: player.puuid,
        tier: player.tier.toUpperCase(), // Ensure uppercase consistency
        league_points: player.leaguePoints,
        rank: player.rank,
        wins: player.wins,
        losses: player.losses,
        veteran: player.veteran,
        inactive: player.inactive,
        fresh_blood: player.freshBlood,
        hot_streak: player.hotStreak
    };
    
    // Validate against schema and return
    return PlayerDBSchema.parse(mapped);
}

/**
 * Map array of Riot player entries to database format
 * Batch version of mapRiotPlayerToDatabase().
 * 
 * @param players - Array of Riot API player entries
 * @returns Array of database player models
 */
export function mapRiotPlayersToDatabase<T extends RiotHighTierEntry | RiotLowTierEntry>(
    players: T[]
): PlayerDB[] {
    return players.map(mapRiotPlayerToDatabase);
}
