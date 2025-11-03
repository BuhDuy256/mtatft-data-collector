import { z } from 'zod'; // For runtime validation. Docs: https://zod.dev/api
import { leagueApi } from '../../service/api';
import { sleep, retryOnRateLimit } from '../../helper/helper';
import { RATE_LIMIT_DELAY } from '../../utils/constant';

const RiotLeagueEntrySchema = z.object({
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

type RiotLeagueEntry = z.infer<typeof RiotLeagueEntrySchema>;

const RiotLeagueSchema = z.object({
    tier: z.string(),
    leagueId: z.string(),
    queue: z.string(),
    name: z.string(),
    entries: z.array(RiotLeagueEntrySchema)
});

type RiotLeague = z.infer<typeof RiotLeagueSchema>;

// Tier Schemas
export const HighTierSchema = z.enum(['challenger', 'grandmaster', 'master']);
export const LowTierSchema = z.enum(['diamond', 'platinum', 'gold', 'silver', 'bronze', 'iron']);
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

export async function fetchHighTierPlayers(tier: HighTier): Promise<Array<RiotLeagueEntry>> {
    try {
        const response = await retryOnRateLimit(() => leagueApi.get(`/tft/league/v1/${tier}`));
        await sleep(RATE_LIMIT_DELAY);
        const validatedData = RiotLeagueSchema.parse(response.data);
        const players = validatedData.entries;
        return players;
    } catch (error) {
        console.error(`Error fetching ${tier} players:`, error);
        throw error;
    }
} 

export async function fetchLowTierPlayers(tier: LowTier, division: Division): Promise<Array<RiotLeagueEntry>> {
    try {
        const response = await retryOnRateLimit(() => leagueApi.get(`/tft/league/v1/entries/TFT/${tier}/${division}`));
        await sleep(RATE_LIMIT_DELAY);
        const validatedData = RiotLeagueSchema.parse(response.data);
        const players = validatedData.entries;
        return players;
    } catch (error) {
        console.error(`Error fetching ${tier} ${division} players:`, error);
        throw error;
    }
}