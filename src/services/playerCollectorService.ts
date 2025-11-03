 import { HighTierLeagueApi, LowTierLeagueApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';

// Import models
import { 
    type HighTier, 
    type LowTier, 
    type Tier, 
    type Division,
    isHighTier,
    isLowTier
} from '../models/riot/RiotTierModels';

import {
    type RiotHighTierEntry,
    type RiotLowTierEntry,
    RiotHighTierResponseSchema,
    RiotLowTierResponseSchema
} from '../models/riot/RiotPlayerModels';

// Re-export types for convenience
export type { HighTier, LowTier, Tier, Division };
export type { RiotHighTierEntry, RiotLowTierEntry };

/**
 * Fetch players from high tier leagues (CHALLENGER, GRANDMASTER, MASTER)
 * High tier API returns single endpoint per tier without pagination.
 * 
 * @param tier - High tier rank (CHALLENGER, GRANDMASTER, or MASTER)
 * @returns Array of high tier player entries with tier field added
 */
export async function fetchHighTierPlayers(tier: HighTier): Promise<RiotHighTierEntry[]> {
    try {
        const response = await retryOnRateLimit(() => HighTierLeagueApi.get(`/tft/league/v1/${tier}`));
        await sleep(RATE_LIMIT_DELAY);
        const validated_data = RiotHighTierResponseSchema.parse(response.data);
        
        // Add tier field to each player (API doesn't provide it)
        const players = validated_data.entries.map((player) => ({
            ...player,
            tier: tier.toUpperCase() // CHALLENGER, GRANDMASTER, MASTER
        }));
        
        return players;
    } catch (error) {
        console.error(`Error fetching ${tier} players:`, error);
        throw error;
    }
} 

/**
 * Fetch players from low tier leagues (DIAMOND, EMERALD, PLATINUM, GOLD, etc.)
 * Low tier API is paginated and requires division specification.
 * 
 * @param tier - Low tier rank (DIAMOND, EMERALD, PLATINUM, etc.)
 * @param division - Division within tier (1=I, 2=II, 3=III, 4=IV)
 * @param page - Page number for pagination (default: 1)
 * @returns Array of low tier player entries
 */
export async function fetchLowTierPlayers(
    tier: LowTier, 
    division: Division, 
    page: number = 1
): Promise<RiotLowTierEntry[]> {
    try {
        // Tier must be UPPERCASE for API
        const tier_upper = tier.toUpperCase();
        
        // Division must be Roman numerals (I, II, III, IV)
        const division_map: Record<Division, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
        const division_roman = division_map[division];
        
        const response = await retryOnRateLimit(() => 
            LowTierLeagueApi.get(`/tft/league/v1/entries/${tier_upper}/${division_roman}`, {
                params: { page }  // Add page as query parameter
            })
        );
        await sleep(RATE_LIMIT_DELAY);
        
        // Low Tier API returns array directly
        const validated_data = RiotLowTierResponseSchema.parse(response.data);
        
        // Normalize tier to uppercase (even though API already returns uppercase)
        const normalized_players = validated_data.map((player) => ({
            ...player,
            tier: player.tier.toUpperCase()
        }));
        
        return normalized_players;
    } catch (error) {
        console.error(`(ERROR) Error fetching ${tier} ${division} page ${page} players:`, error);
        throw error;
    }
}

/**
 * Fetch players from specified tier with pagination support
 * Automatically handles high tier (single endpoint) vs low tier (paginated) logic.
 * 
 * @param tier - Tier to fetch (any valid TFT rank)
 * @param divisions - Array of divisions to fetch (1-4, only used for low tiers)
 * @param pages - Array of page numbers to fetch (only used for low tiers)
 * @returns Array of player entries (type depends on tier)
 */
export async function fetchPlayersFromTier(
  tier: Tier,
  divisions: Division[] = [1, 2, 3, 4],
  pages: number[] = [1]  // Default: only page 1
): Promise<RiotLowTierEntry[] | RiotHighTierEntry[]> {
  try {
    if (isHighTier(tier)) {
      console.log(`(INFO) Fetching high tier players: ${tier}`);
      return await fetchHighTierPlayers(tier);
    }

    if (isLowTier(tier)) {
      console.log(`(INFO) Fetching low tier players: ${tier} (all divisions, pages: [${pages.join(', ')}])`);
      const all_players: RiotLowTierEntry[] = [];
      for (const division of divisions) {
        console.log(`(INFO) Fetching ${tier} division ${division}`);
        
        // Fetch specified pages for this division
        for (const page of pages) {
          try {
            const players = await fetchLowTierPlayers(tier, division, page);
            
            if (players.length === 0) {
              console.log(`    ... Page ${page}: No players found`);
              continue;
            }
            
            console.log(`    ... Page ${page}: ${players.length} players`);
            all_players.push(...players);
          } catch (error) {
            console.warn(`    ... Page ${page}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Continue with next page instead of breaking
          }
        }
      }

      console.log(`(OK) Total ${tier} players: ${all_players.length}`);
      return all_players;
    }

    throw new Error(`(ERROR) Invalid tier: ${tier}`);
  } catch (error) {
    console.error(`(ERROR) Error fetching tier-based players for ${tier}:`, error);
    throw error;
  }
}
