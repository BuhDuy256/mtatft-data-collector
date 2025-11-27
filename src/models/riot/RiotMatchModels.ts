import { z } from 'zod'

export const MatchIdListSchema = z.array(z.string());
export type MatchIdList = z.infer<typeof MatchIdListSchema>;

const CompanionSchema = z.object({
    content_ID: z.string(),
    item_ID: z.number(),
    skin_ID: z.number(),
    species: z.string()
});

const TraitSchema = z.object({
    name: z.string(),
    num_units: z.number(),
    style: z.number(),
    tier_current: z.number(),
    tier_total: z.number()
});

const UnitSchema = z.object({
    character_id: z.string(),
    itemNames: z.array(z.string()),
    name: z.string(),
    rarity: z.number(),
    tier: z.number()
});

const ParticipantSchema = z.object({
    companion: CompanionSchema,
    gold_left: z.number(),
    last_round: z.number(),
    level: z.number(),
    placement: z.number(),
    players_eliminated: z.number(),
    puuid: z.string(),
    time_eliminated: z.number(),
    total_damage_to_players: z.number(),
    riotIdGameName: z.string().optional(),
    riotIdTagline: z.string().optional(),
    missions: z.record(z.string(), z.unknown()).optional(),
    traits: z.array(TraitSchema),
    units: z.array(UnitSchema),
    win: z.boolean().optional()
});

export type Participant = z.infer<typeof ParticipantSchema>;

const MetadataSchema = z.object({
    data_version: z.string(),
    match_id: z.string(),
    participants: z.array(z.string())
});

const InfoSchema = z.object({
    endOfGameResult: z.string(),
    gameCreation: z.number(),
    gameId: z.number(),
    game_datetime: z.number(),
    game_length: z.number(),
    game_version: z.string(),
    mapId: z.number(),
    queueId: z.number(),
    queue_id: z.number(),
    tft_game_type: z.string(),
    tft_set_core_name: z.string(),
    tft_set_number: z.number(),
    participants: z.array(ParticipantSchema)
});

export const RiotMatchSchema = z.object({
    metadata: MetadataSchema,
    info: InfoSchema
});

export type RiotMatch = z.infer<typeof RiotMatchSchema>;

export const MatchSummarySchema = z.object({
    match_id: z.string(),
    game_datetime: z.number(),
    game_length: z.number(),
    queue_id: z.number(),
    tft_set_number: z.number(),
    tft_game_type: z.string(),
    participants_count: z.number()
});

export type MatchSummary = z.infer<typeof MatchSummarySchema>;
