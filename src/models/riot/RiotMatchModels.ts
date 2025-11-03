import { z } from 'zod';

/**
 * Riot TFT Match API models
 * Based on Match V1 API response structure
 */

// --- MATCH ID LIST ---
export const MatchIdListSchema = z.array(z.string());
export type MatchIdList = z.infer<typeof MatchIdListSchema>;

// --- COMPANION SCHEMA ---
const CompanionSchema = z.object({
    content_ID: z.string(),
    item_ID: z.number(),
    skin_ID: z.number(),
    species: z.string()
});

// --- TRAIT SCHEMA ---
const TraitSchema = z.object({
    name: z.string(),
    num_units: z.number(),
    style: z.number(),
    tier_current: z.number(),
    tier_total: z.number()
});

// --- UNIT SCHEMA ---
const UnitSchema = z.object({
    character_id: z.string(),
    itemNames: z.array(z.string()),
    name: z.string(),
    rarity: z.number(),
    tier: z.number()
});

// --- PARTICIPANT SCHEMA ---
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
    
    // Optional fields (may not exist for all participants)
    riotIdGameName: z.string().optional(),
    riotIdTagline: z.string().optional(),
    
    // Missions (dynamic object with unknown values)
    missions: z.record(z.string(), z.unknown()).optional(),
    
    // Collections
    traits: z.array(TraitSchema),
    units: z.array(UnitSchema),
    
    // Win status
    win: z.boolean().optional()
});

export type Participant = z.infer<typeof ParticipantSchema>;

// --- METADATA SCHEMA ---
const MetadataSchema = z.object({
    data_version: z.string(),
    match_id: z.string(),
    participants: z.array(z.string()) // Array of PUUIDs
});

// --- INFO SCHEMA ---
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

// --- FULL MATCH SCHEMA ---
export const RiotMatchSchema = z.object({
    metadata: MetadataSchema,
    info: InfoSchema
});

export type RiotMatch = z.infer<typeof RiotMatchSchema>;

// --- SIMPLIFIED MATCH INFO (for common queries) ---
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