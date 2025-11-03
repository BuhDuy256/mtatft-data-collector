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

export async function fetchHighTierPlayers(tier: HighTier): Promise<RiotHighTierEntry[]> {
    try {
        const response = await retryOnRateLimit(() => HighTierLeagueApi.get(`/tft/league/v1/${tier}`));
        await sleep(RATE_LIMIT_DELAY);
        const validatedData = RiotHighTierResponseSchema.parse(response.data);
        
        // Add tier field to each player (API doesn't provide it)
        const players = validatedData.entries.map((player) => ({
            ...player,
            tier: tier.toUpperCase() // CHALLENGER, GRANDMASTER, MASTER
        }));
        
        return players;
    } catch (error) {
        console.error(`Error fetching ${tier} players:`, error);
        throw error;
    }
} 

export async function fetchLowTierPlayers(
    tier: LowTier, 
    division: Division, 
    page: number = 1
): Promise<RiotLowTierEntry[]> {
    try {
        // Tier must be UPPERCASE for API
        const tierUpper = tier.toUpperCase();
        
        // Division must be Roman numerals (I, II, III, IV)
        const divisionMap: Record<Division, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
        const divisionRoman = divisionMap[division];
        
        const response = await retryOnRateLimit(() => 
            LowTierLeagueApi.get(`/tft/league/v1/entries/${tierUpper}/${divisionRoman}`, {
                params: { page }  // Add page as query parameter
            })
        );
        await sleep(RATE_LIMIT_DELAY);
        
        // Low Tier API returns array directly
        const validatedData = RiotLowTierResponseSchema.parse(response.data);
        
        // Normalize tier to uppercase (even though API already returns uppercase)
        const normalizedPlayers = validatedData.map((player) => ({
            ...player,
            tier: player.tier.toUpperCase()
        }));
        
        return normalizedPlayers;
    } catch (error) {
        console.error(`(ERORR) Error fetching ${tier} ${division} page ${page} players:`, error);
        throw error;
    }
}

export async function fecthPlayersBasedTier(
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
      const allPlayers: RiotLowTierEntry[] = [];
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
            allPlayers.push(...players);
          } catch (error) {
            console.warn(`    ... Page ${page}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Continue with next page instead of breaking
          }
        }
      }

      console.log(`(OK) Total ${tier} players: ${allPlayers.length}`);
      return allPlayers;
    }

    throw new Error(`(ERROR) Invalid tier: ${tier}`);
  } catch (error) {
    console.error(`(ERROR) Error fetching tier-based players for ${tier}:`, error);
    throw error;
  }
}
