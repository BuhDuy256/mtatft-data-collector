import { z } from 'zod'

export const RiotLeagueEntrySchema = z.object({
    puuid: z.string(),
    leagueId: z.string(),
    queueType: z.string(),
    tier: z.string(),
    rank: z.string(),
    leaguePoints: z.number(),
    wins: z.number(),
    losses: z.number(),
    veteran: z.boolean(),
    inactive: z.boolean(),
    freshBlood: z.boolean(),
    hotStreak: z.boolean()
})

export type RiotLeagueEntry = z.infer<typeof RiotLeagueEntrySchema>

export const RiotLeagueEntriesSchema = z.array(RiotLeagueEntrySchema)
export type RiotLeagueEntries = z.infer<typeof RiotLeagueEntriesSchema>
