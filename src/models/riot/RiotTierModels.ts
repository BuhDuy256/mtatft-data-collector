import { z } from 'zod';

export const HighTierSchema = z.enum(['challenger', 'grandmaster', 'master']);
export const LowTierSchema = z.enum(['diamond', 'emerald', 'platinum', 'gold', 'silver', 'bronze', 'iron']);
export const TierSchema = z.union([HighTierSchema, LowTierSchema]);
export const DivisionSchema = z.enum(['I', 'II', 'III', 'IV']);

export type HighTier = z.infer<typeof HighTierSchema>;
export type LowTier = z.infer<typeof LowTierSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type Division = z.infer<typeof DivisionSchema>;

export const HIGH_TIERS = HighTierSchema.options;
export const LOW_TIERS = LowTierSchema.options;
export const DIVISIONS = DivisionSchema.options;

export const isHighTier = (tier: Tier): tier is HighTier => {
    return HighTierSchema.safeParse(tier).success;
};

export const isLowTier = (tier: Tier): tier is LowTier => {
    return LowTierSchema.safeParse(tier).success;
};
