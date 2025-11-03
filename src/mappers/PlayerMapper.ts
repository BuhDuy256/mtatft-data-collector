import type { RiotHighTierEntry, RiotLowTierEntry } from '../models/riot/RiotPlayerModels';
import { PlayerDBSchema, type PlayerDB } from '../models/database/PlayerDBModel';

/**
 * Mapper for converting Riot API player models to database models
 * Handles camelCase → snake_case transformation and validation
 */

/**
 * Map a single Riot player entry to database format
 * @param player - Riot API player entry (High or Low tier)
 * @returns Database player model
 * @throws ZodError if validation fails
 */
export function mapRiotPlayerToDB<T extends RiotHighTierEntry | RiotLowTierEntry>(
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
 * @param players - Array of Riot API player entries
 * @returns Array of database player models
 */
export function mapRiotPlayersToDB<T extends RiotHighTierEntry | RiotLowTierEntry>(
    players: T[]
): PlayerDB[] {
    return players.map(mapRiotPlayerToDB);
}
