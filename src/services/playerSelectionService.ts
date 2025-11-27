import { type RiotHighTierPlayer, type RiotLowTierPlayer } from '../models/riot/RiotPlayerModels';
import { MATCHES_PER_PLAYER } from '../utils/constant';

export function selectRandomPlayers<T extends RiotHighTierPlayer | RiotLowTierPlayer>(
    players: T[],
    match_goal: number
): T[] {
    const players_needed = Math.ceil(match_goal / MATCHES_PER_PLAYER);

    console.log(`(INFO) Match goal: ${match_goal}`);
    console.log(`(INFO) Players available: ${players.length}`);
    console.log(`(INFO) Players needed (${match_goal} / ${MATCHES_PER_PLAYER}): ${players_needed}`);

    if (players_needed >= players.length) {
        console.log(`(INFO) Using all ${players.length} players`);
        return players;
    }

    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, players_needed);
    console.log(`(OK) Selected ${selected.length} random players`);

    return selected;
}

export function selectTopPlayers<T extends RiotHighTierPlayer | RiotLowTierPlayer>(
    players: T[],
    match_goal: number
): T[] {
    const players_needed = Math.ceil(match_goal / MATCHES_PER_PLAYER);

    console.log(`(INFO) Match goal: ${match_goal}`);
    console.log(`(INFO) Players available: ${players.length}`);
    console.log(`(INFO) Players needed: ${players_needed}`);

    if (players_needed >= players.length) {
        console.log(`(INFO) Using all ${players.length} players`);
        return players;
    }

    const sorted = [...players].sort((a, b) => b.leaguePoints - a.leaguePoints);

    const selected = sorted.slice(0, players_needed);
    console.log(`(INFO) Selected top ${selected.length} players (${selected[0].leaguePoints} - ${selected[selected.length - 1].leaguePoints} LP)`);

    return selected;
}
