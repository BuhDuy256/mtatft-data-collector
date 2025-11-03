import { z } from 'zod'; // For runtime validation. Docs: https://zod.dev/api
import { HighTierLeagueApi, LowTierLeagueApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';

// --- BASE SCHEMA: Common fields for all player entries ---
export const PlayerBaseSchema = z.object({
    puuid: z.string(),
    leaguePoints: z.number(),
    rank: z.string(),
    wins: z.number(),
    losses: z.number(),
    veteran: z.boolean(),
    inactive: z.boolean(),
    freshBlood: z.boolean(),
    hotStreak: z.boolean()
});

// --- HIGH TIER ENTRY SCHEMA (from API) ---
// High tier API doesn't return 'tier' field, we add it manually
const RiotHighTierEntryRawSchema = PlayerBaseSchema;

export const RiotHighTierEntrySchema = RiotHighTierEntryRawSchema.extend({
    tier: z.string() // Added manually after API fetch
});

export type RiotHighTierEntry = z.infer<typeof RiotHighTierEntrySchema>;

// --- LOW TIER ENTRY SCHEMA ---
// Low tier = Base schema + extra fields (tier, leagueId, queueType)
export const RiotLowTierEntrySchema = PlayerBaseSchema.extend({
    leagueId: z.string(),
    queueType: z.string(),
    tier: z.string()
});

export type RiotLowTierEntry = z.infer<typeof RiotLowTierEntrySchema>; 

// Low Tier API returns array directly (no wrapper object)
const RiotLowTierSchema = z.array(RiotLowTierEntrySchema);

const RiotHighTierSchema = z.object({
    tier: z.string(),
    leagueId: z.string(),
    queue: z.string(),
    name: z.string(),
    entries: z.array(RiotHighTierEntryRawSchema) // API returns without tier field
});

type RiotHighTier = z.infer<typeof RiotHighTierSchema>;

// Tier Schemas
export const HighTierSchema = z.enum(['challenger', 'grandmaster', 'master']);
export const LowTierSchema = z.enum(['diamond', 'emerald', 'platinum', 'gold', 'silver', 'bronze', 'iron']);
export const TierSchema = z.union([HighTierSchema, LowTierSchema]);
export const DivisionSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

// Infer types from schemas
export type HighTier = z.infer<typeof HighTierSchema>;
export type LowTier = z.infer<typeof LowTierSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type Division = z.infer<typeof DivisionSchema>;

// Export constant arrays (extracted from schemas)
export const HIGH_TIERS = HighTierSchema.options;
export const LOW_TIERS = LowTierSchema.options;

// Type guard functions
export const isHighTier = (tier: Tier): tier is HighTier => {
    return HighTierSchema.safeParse(tier).success;
};

export const isLowTier = (tier: Tier): tier is LowTier => {
    return LowTierSchema.safeParse(tier).success;
};

export async function fetchHighTierPlayers(tier: HighTier): Promise<RiotHighTierEntry[]> {
    try {
        const response = await retryOnRateLimit(() => HighTierLeagueApi.get(`/tft/league/v1/${tier}`));
        await sleep(RATE_LIMIT_DELAY);
        const validatedData = RiotHighTierSchema.parse(response.data);
        
        // Add tier field to each player (API doesn't provide it)
        const players = validatedData.entries.map(player => ({
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
        const validatedData = RiotLowTierSchema.parse(response.data);
        
        // Normalize tier to uppercase (even though API already returns uppercase)
        const normalizedPlayers = validatedData.map(player => ({
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
