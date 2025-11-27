import { type RiotLeagueEntry } from '../models/riot/RiotLeagueModels';

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

export function mapRiotLeaguesToPlayerUpdates(league_entries: RiotLeagueEntry[]) {
    return league_entries.map(entry => mapRiotLeagueToPlayerUpdate(entry));
}
