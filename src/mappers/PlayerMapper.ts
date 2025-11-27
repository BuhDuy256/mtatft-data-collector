import type { RiotHighTierPlayer, RiotLowTierPlayer } from '../models/riot/RiotPlayerModels';
import { PlayerDBSchema, type PlayerDB } from '../models/database/PlayerDBModel';

export function mapRiotPlayerToDatabase<T extends RiotHighTierPlayer | RiotLowTierPlayer>(
    player: T
): PlayerDB {
    const mapped = {
        puuid: player.puuid,
        tier: player.tier.toUpperCase(),
        league_points: player.leaguePoints,
        rank: player.rank,
        wins: player.wins,
        losses: player.losses,
        veteran: player.veteran,
        inactive: player.inactive,
        fresh_blood: player.freshBlood,
        hot_streak: player.hotStreak
    };
    return PlayerDBSchema.parse(mapped);
}

export function mapRiotPlayersToDatabase<T extends RiotHighTierPlayer | RiotLowTierPlayer>(
    players: T[]
): PlayerDB[] {
    return players.map(mapRiotPlayerToDatabase);
}
