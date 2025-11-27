import { matchApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { MatchIdListSchema, RiotMatchSchema, MatchSummarySchema, type RiotMatch, type MatchSummary } from '../models/riot/RiotMatchModels';

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

export interface MatchDetailResult {
    matchId: string;
    fullMatchData: Record<string, any>;
    matchSummary: MatchSummary;
    playerPuuids: string[];
}

export async function collectMatchDetail(match_id_list: Set<string>, region: string): Promise<MatchDetailResult[]> {
    const results: MatchDetailResult[] = [];
    let i = 0;
    
    console.log(`(INFO) Collecting details for ${match_id_list.size} matches...`);
    
    for (const match_id of match_id_list) {
        i++;
        console.log(`[Match ${i}/${match_id_list.size}] Fetching details for ${match_id}...`);
        
        try {
            const response = await retryOnRateLimit(() => 
                matchApi.get(`/tft/match/v1/matches/${match_id}`));
            await sleep(RATE_LIMIT_DELAY);
            
            const full_match_data = response.data;
            const validated_match = RiotMatchSchema.parse(full_match_data);
            const match_summary: MatchSummary = {
                match_id: validated_match.metadata.match_id,
                game_datetime: validated_match.info.game_datetime,
                game_length: validated_match.info.game_length,
                queue_id: validated_match.info.queue_id,
                tft_set_number: validated_match.info.tft_set_number,
                tft_game_type: validated_match.info.tft_game_type,
                participants_count: validated_match.info.participants.length
            };
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
        }
    }
    
    console.log(`(INFO) Successfully collected ${results.length}/${match_id_list.size} matches.`);
    return results;
}

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
            const response = await retryOnRateLimit(() => 
                matchApi.get(`/tft/match/v1/matches/${match_id}`));
            await sleep(RATE_LIMIT_DELAY);
            
            const full_match_data = response.data;
            const validated_match = RiotMatchSchema.parse(full_match_data);
            const match_summary: MatchSummary = {
                match_id: validated_match.metadata.match_id,
                game_datetime: validated_match.info.game_datetime,
                game_length: validated_match.info.game_length,
                queue_id: validated_match.info.queue_id,
                tft_set_number: validated_match.info.tft_set_number,
                tft_game_type: validated_match.info.tft_game_type,
                participants_count: validated_match.info.participants.length
            };
            const player_puuids = validated_match.info.participants.map(p => p.puuid);
            const match_result: MatchDetailResult = {
                matchId: match_id,
                fullMatchData: full_match_data,
                matchSummary: MatchSummarySchema.parse(match_summary),
                playerPuuids: player_puuids
            };
            console.log(`... Success! Found ${player_puuids.length} players.`);
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

export async function fetchAndSaveMatchesDirectly(
    match_id_list: Set<string>,
    region: string,
    on_match_fetched: (match_data: { match_id: string; data: any; region: string }) => Promise<void>
): Promise<number> {
    let success_count = 0;
    let i = 0;
    
    console.log(`(INFO) Fetching and saving ${match_id_list.size} matches (direct mode - no snowball)...`);
    
    for (const match_id of match_id_list) {
        i++;
        console.log(`[Match ${i}/${match_id_list.size}] Fetching ${match_id}...`);
        
        try {
            // Fetch match data
            const response = await retryOnRateLimit(() => 
                matchApi.get(`/tft/match/v1/matches/${match_id}`));
            await sleep(RATE_LIMIT_DELAY);
            
            const full_match_data = response.data;
            
            // Validate data structure
            RiotMatchSchema.parse(full_match_data);
            
            console.log(`... Success! Match fetched.`);
            
            // Save to DB immediately
            try {
                await on_match_fetched({
                    match_id: match_id,
                    data: full_match_data,
                    region: region
                });
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
    
    console.log(`(INFO) Successfully fetched and saved ${success_count}/${match_id_list.size} matches (direct mode).`);
    return success_count;
}
