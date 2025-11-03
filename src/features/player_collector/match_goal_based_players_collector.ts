import { z } from 'zod';

import {
    type RiotHighTierEntry, 
    type RiotLowTierEntry,
} from './tier_based_players_collector';

import { MATCHES_PER_PLAYER } from '../../utils/constant';

export function randomPlayersBasedOnMatchGoal<T extends RiotHighTierEntry | RiotLowTierEntry>(
    players: T[], 
    matchGoal: number
): T[] {    
    // Calculate how many players needed
    const playersNeeded = Math.ceil(matchGoal / MATCHES_PER_PLAYER);
    
    console.log(`(INFO) Match goal: ${matchGoal}`);
    console.log(`(INFO) Players available: ${players.length}`);
    console.log(`(INFO) Players needed (${matchGoal} / ${MATCHES_PER_PLAYER}): ${playersNeeded}`);
    
    // If we need more players than available, return all
    if (playersNeeded >= players.length) {
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
    const selected = shuffled.slice(0, playersNeeded);
    console.log(`(OK) Selected ${selected.length} random players`);
    
    return selected;
}

export function selectTopPlayersByMatchGoal<T extends RiotHighTierEntry | RiotLowTierEntry>(
    players: T[], 
    matchGoal: number
): T[] {
    const playersNeeded = Math.ceil(matchGoal / MATCHES_PER_PLAYER);
    
    console.log(`(INFO) Match goal: ${matchGoal}`);
    console.log(`(INFO) Players available: ${players.length}`);
    console.log(`(INFO) Players needed: ${playersNeeded}`);
    
    if (playersNeeded >= players.length) {
        console.log(`(INFO) Using all ${players.length} players`);
        return players;
    }
    
    // Sort by league points (descending)
    const sorted = [...players].sort((a, b) => b.leaguePoints - a.leaguePoints);
    
    // Return top N players
    const selected = sorted.slice(0, playersNeeded);
    console.log(`(INFO) Selected top ${selected.length} players (${selected[0].leaguePoints} - ${selected[selected.length - 1].leaguePoints} LP)`);
    
    return selected;
}