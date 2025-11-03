import { type RiotLeagueEntry } from '../models/riot/RiotLeagueModels';

/**
 * Map RiotLeagueEntry từ API sang format để update vào DB
 * @param leagueEntry - League data từ Riot API
 * @returns Object với league fields để update
 */
export function mapRiotLeagueToPlayerUpdate(leagueEntry: RiotLeagueEntry) {
    return {
        puuid: leagueEntry.puuid,
        tier: leagueEntry.tier,
        rank: leagueEntry.rank,
        leaguePoints: leagueEntry.leaguePoints,
        wins: leagueEntry.wins,
        losses: leagueEntry.losses,
        veteran: leagueEntry.veteran,
        inactive: leagueEntry.inactive,
        freshBlood: leagueEntry.freshBlood,
        hotStreak: leagueEntry.hotStreak
    };
}

/**
 * Map multiple RiotLeagueEntries sang DB update format
 * @param leagueEntries - Array of league data từ Riot API
 * @returns Array of update objects
 */
export function mapRiotLeaguesToPlayerUpdates(leagueEntries: RiotLeagueEntry[]) {
    return leagueEntries.map(entry => mapRiotLeagueToPlayerUpdate(entry));
}
