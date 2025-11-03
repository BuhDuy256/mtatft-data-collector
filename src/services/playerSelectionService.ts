import { type RiotHighTierEntry, type RiotLowTierEntry } from '../models/riot/RiotPlayerModels';
import { MATCHES_PER_PLAYER } from '../utils/constant';

/**
 * Select random players to meet match collection goal
 * Uses Fisher-Yates shuffle algorithm for unbiased randomization.
 * 
 * @param players - Array of player entries to select from
 * @param match_goal - Target number of matches to collect
 * @returns Randomly selected subset of players sufficient to reach match goal
 */
export function selectRandomPlayers<T extends RiotHighTierEntry | RiotLowTierEntry>(
    players: T[], 
    match_goal: number
): T[] {    
    // Calculate how many players needed
    const players_needed = Math.ceil(match_goal / MATCHES_PER_PLAYER);
    
    console.log(`(INFO) Match goal: ${match_goal}`);
    console.log(`(INFO) Players available: ${players.length}`);
    console.log(`(INFO) Players needed (${match_goal} / ${MATCHES_PER_PLAYER}): ${players_needed}`);
    
    // If we need more players than available, return all
    if (players_needed >= players.length) {
        console.log(`(INFO) Using all ${players.length} players`);
        return players;
    }
    
    // Shuffle array using Fisher-Yates algorithm
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Return first N players
    const selected = shuffled.slice(0, players_needed);
    console.log(`(OK) Selected ${selected.length} random players`);
    
    return selected;
}

/**
 * Select top-ranked players to meet match collection goal
 * Sorts players by league points and takes the highest-ranked subset.
 * 
 * @param players - Array of player entries to select from
 * @param match_goal - Target number of matches to collect
 * @returns Top-ranked players sufficient to reach match goal
 */
export function selectTopPlayers<T extends RiotHighTierEntry | RiotLowTierEntry>(
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
    
    // Sort by league points (descending)
    const sorted = [...players].sort((a, b) => b.leaguePoints - a.leaguePoints);
    
    // Return top N players
    const selected = sorted.slice(0, players_needed);
    console.log(`(INFO) Selected top ${selected.length} players (${selected[0].leaguePoints} - ${selected[selected.length - 1].leaguePoints} LP)`);
    
    return selected;
}
