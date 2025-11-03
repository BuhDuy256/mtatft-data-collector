import { z } from 'zod';

/**
 * Tier type definitions and schemas
 * Based on Riot Games TFT ranked system
 */

// --- TIER SCHEMAS ---
export const HighTierSchema = z.enum(['challenger', 'grandmaster', 'master']);
export const LowTierSchema = z.enum(['diamond', 'emerald', 'platinum', 'gold', 'silver', 'bronze', 'iron']);
export const TierSchema = z.union([HighTierSchema, LowTierSchema]);
export const DivisionSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

// --- TIER TYPES ---
export type HighTier = z.infer<typeof HighTierSchema>;
export type LowTier = z.infer<typeof LowTierSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type Division = z.infer<typeof DivisionSchema>;

// --- CONSTANTS ---
export const HIGH_TIERS = HighTierSchema.options;
export const LOW_TIERS = LowTierSchema.options;

// --- TYPE GUARDS ---
export const isHighTier = (tier: Tier): tier is HighTier => {
    return HighTierSchema.safeParse(tier).success;
};

export const isLowTier = (tier: Tier): tier is LowTier => {
    return LowTierSchema.safeParse(tier).success;
};
