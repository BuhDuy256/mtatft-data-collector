import { z } from 'zod'

export const PlayerDBSchema = z.object({
    puuid: z.string(),
    game_name: z.string().optional(),
    tag_line: z.string().optional(),
    tier: z.string(),
    league_points: z.number(),
    rank: z.string(),
    wins: z.number(),
    losses: z.number(),
    veteran: z.boolean(),
    inactive: z.boolean(),
    fresh_blood: z.boolean(),
    hot_streak: z.boolean(),
    updated_at: z.string().optional()
})

export type PlayerDB = z.infer<typeof PlayerDBSchema>

export const PlayerAccountUpdateSchema = z.object({
    puuid: z.string(),
    game_name: z.string(),
    tag_line: z.string()
})

export type PlayerAccountUpdate = z.infer<typeof PlayerAccountUpdateSchema>
