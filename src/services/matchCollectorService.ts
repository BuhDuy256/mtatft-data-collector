import { matchApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { MatchIdListSchema, RiotMatchSchema, MatchSummarySchema, type RiotMatch, type MatchSummary } from '../models/riot/RiotMatchModels';

/**
 * Collect match IDs from player PUUIDs
 * Fetches up to 20 most recent match IDs for each player (Riot API limit).
 * Uses Set to automatically deduplicate match IDs across players.
 * 
 * @param puuid_seed_list - Set of player PUUIDs to fetch match history from
 * @returns Set of unique match IDs
 */
export async function collectMatchIdsFromPlayers(puuid_seed_list: Set<string>): Promise<Set<string>> {
    if (puuid_seed_list.size <= 0) {
        throw new Error("The size of puuid seed list is invalid to find match");
    }

    const match_id_list = new Set<string>();
    let i = 0;
    
    for (const puuid of puuid_seed_list) {
        try {
            const response = await retryOnRateLimit(() => 
                matchApi.get(`/tft/match/v1/matches/by-puuid/${puuid}/ids`, { params: { count: 20 } }));
            await sleep(RATE_LIMIT_DELAY);
            const match_id_list_by_puuid = MatchIdListSchema.parse(response.data);
            match_id_list_by_puuid.forEach((id: string) => match_id_list.add(id));
        } catch (error) {
            if (isAxiosError(error)) {
            console.warn(`(WARNING) API Error for ${puuid.substring(0, 10)}: ${error.response?.status}`);
            } else {
            console.warn(`(WARNING) Error fetching match IDs for ${puuid}:`, error instanceof Error ? error.message : String(error));
            }
        }
    }

    return match_id_list;
}

/**
 * Result structure for match detail fetch operations
 * Contains full JSON data for JSONB storage plus parsed summaries for reference.
 */
export interface MatchDetailResult {
    matchId: string;
    fullMatchData: Record<string, any>; // Full JSON to store in database JSONB column
    matchSummary: MatchSummary;
    playerPuuids: string[]; // List of player PUUIDs participating in match
}

/**
 * Collect full match details for batch of match IDs
 * DEPRECATED: Prefer using fetchAndSaveMatchDetails() for stream processing.
 * 
 * @param match_id_list - Set of match IDs to fetch
 * @param region - Region identifier (not currently used by API)
 * @returns Array of match detail results
 */
export async function collectMatchDetail(match_id_list: Set<string>, region: string): Promise<MatchDetailResult[]> {
    const results: MatchDetailResult[] = [];
    let i = 0;
    
    console.log(`(INFO) Collecting details for ${match_id_list.size} matches...`);
    
    for (const match_id of match_id_list) {
        i++;
        console.log(`[Match ${i}/${match_id_list.size}] Fetching details for ${match_id}...`);
        
        try {
            // Call API to get full match data
            const response = await retryOnRateLimit(() => 
                matchApi.get(`/tft/match/v1/matches/${match_id}`));
            await sleep(RATE_LIMIT_DELAY);
            
            const full_match_data = response.data; // Full JSON
            
            // Validate with RiotMatchSchema to ensure correct structure
            const validated_match = RiotMatchSchema.parse(full_match_data);
            
            // Parse match summary
            const match_summary: MatchSummary = {
                match_id: validated_match.metadata.match_id,
                game_datetime: validated_match.info.game_datetime,
                game_length: validated_match.info.game_length,
                queue_id: validated_match.info.queue_id,
                tft_set_number: validated_match.info.tft_set_number,
                tft_game_type: validated_match.info.tft_game_type,
                participants_count: validated_match.info.participants.length
            };
            
            // Extract player PUUIDs from participants
            const player_puuids = validated_match.info.participants.map(p => p.puuid);
            
            results.push({
                matchId: match_id,
                fullMatchData: full_match_data,
                matchSummary: MatchSummarySchema.parse(match_summary),
                playerPuuids: player_puuids
            });
            
            console.log(`... Success! Found ${player_puuids.length} players in match.`);
            
        } catch (error) {
            if (isAxiosError(error)) {
                console.error(`(ERROR) API Error for ${match_id}: ${error.response?.status}`, error.response?.data);
            } else {
                console.error(`(ERROR) Error fetching details for ${match_id}:`, error instanceof Error ? error.message : String(error));
            }
            // Skip match if error occurs, continue with next match
        }
    }
    
    console.log(`(INFO) Successfully collected ${results.length}/${match_id_list.size} matches.`);
    return results;
}

/**
 * Fetch match details with streaming database saves
 * RECOMMENDED: Use this instead of collectMatchDetail() to avoid memory issues.
 * Fetches one match at a time and immediately saves to database via callback.
 * 
 * @param match_id_list - Set of match IDs to fetch
 * @param region - Region identifier (not currently used by API)
 * @param on_match_fetched - Callback to save match to database (receives MatchDetailResult)
 * @returns Number of matches successfully fetched and saved
 */
export async function fetchAndSaveMatchDetails(
    match_id_list: Set<string>,
    region: string,
    on_match_fetched: (match_result: MatchDetailResult) => Promise<void>
): Promise<number> {
    let success_count = 0;
    let i = 0;
    
    console.log(`(INFO) Fetching and saving ${match_id_list.size} matches...`);
    
    for (const match_id of match_id_list) {
        i++;
        console.log(`[Match ${i}/${match_id_list.size}] Fetching ${match_id}...`);
        
        try {
            // Fetch match data
            const response = await retryOnRateLimit(() => 
                matchApi.get(`/tft/match/v1/matches/${match_id}`));
            await sleep(RATE_LIMIT_DELAY);
            
            const full_match_data = response.data;
            const validated_match = RiotMatchSchema.parse(full_match_data);
            
            // Parse match summary
            const match_summary: MatchSummary = {
                match_id: validated_match.metadata.match_id,
                game_datetime: validated_match.info.game_datetime,
                game_length: validated_match.info.game_length,
                queue_id: validated_match.info.queue_id,
                tft_set_number: validated_match.info.tft_set_number,
                tft_game_type: validated_match.info.tft_game_type,
                participants_count: validated_match.info.participants.length
            };
            
            // Extract player PUUIDs
            const player_puuids = validated_match.info.participants.map(p => p.puuid);
            
            const match_result: MatchDetailResult = {
                matchId: match_id,
                fullMatchData: full_match_data,
                matchSummary: MatchSummarySchema.parse(match_summary),
                playerPuuids: player_puuids
            };
            
            console.log(`... Success! Found ${player_puuids.length} players.`);
            
            // Save to DB immediately
            try {
                await on_match_fetched(match_result);
                success_count++;
                console.log(`... Saved to DB ✓`);
            } catch (error) {
                console.error(`... Failed to save: ${error instanceof Error ? error.message : String(error)}`);
            }
            
        } catch (error) {
            if (isAxiosError(error)) {
                console.error(`(ERROR) API Error for ${match_id}: ${error.response?.status}`);
            } else {
                console.error(`(ERROR) Error fetching ${match_id}:`, error instanceof Error ? error.message : String(error));
            }
        }
    }
    
    console.log(`(INFO) Successfully fetched and saved ${success_count}/${match_id_list.size} matches.`);
    return success_count;
}

