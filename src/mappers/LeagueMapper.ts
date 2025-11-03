import { type RiotLeagueEntry } from '../models/riot/RiotLeagueModels';

/**
 * Map Riot league entry to player update format for database
 * Note: Uses camelCase field names (leaguePoints, freshBlood, hotStreak) 
 * which match the database column names directly.
 * 
 * @param league_entry - League data from Riot API
 * @returns Object with league fields for database update
 */
export function mapRiotLeagueToPlayerUpdate(league_entry: RiotLeagueEntry) {
    return {
        puuid: league_entry.puuid,
        tier: league_entry.tier,
        rank: league_entry.rank,
        leaguePoints: league_entry.leaguePoints,
        wins: league_entry.wins,
        losses: league_entry.losses,
        veteran: league_entry.veteran,
        inactive: league_entry.inactive,
        freshBlood: league_entry.freshBlood,
        hotStreak: league_entry.hotStreak
    };
}

/**
 * Map multiple Riot league entries to player update format
 * Batch version of mapRiotLeagueToPlayerUpdate().
 * 
 * @param league_entries - Array of league data from Riot API
 * @returns Array of update objects
 */
export function mapRiotLeaguesToPlayerUpdates(league_entries: RiotLeagueEntry[]) {
    return league_entries.map(entry => mapRiotLeagueToPlayerUpdate(entry));
}
