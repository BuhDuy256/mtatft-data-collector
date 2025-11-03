import { matchApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { MatchIdListSchema, RiotMatchSchema, MatchSummarySchema, type RiotMatch, type MatchSummary } from '../models/riot/RiotMatchModels';

export async function collectMatchIDBaseOnPlayerPUUIDs(puuid_seed_list: Set<string>): Promise<Set<string>> {
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
 * Collect match details and return:
 * 1. Full match JSON (to store in DB as JSONB)
 * 2. Match summary (parsed)
 * 3. List of player PUUIDs from participants
 */
export interface MatchDetailResult {
    matchId: string;
    fullMatchData: Record<string, any>; // Full JSON để lưu vào DB
    matchSummary: MatchSummary;
    playerPuuids: string[]; // Danh sách PUUID của players trong match
}

export async function collectMatchDetail(match_id_list: Set<string>, region: string): Promise<MatchDetailResult[]> {
    const results: MatchDetailResult[] = [];
    let i = 0;
    
    console.log(`(INFO) Collecting details for ${match_id_list.size} matches...`);
    
    for (const matchId of match_id_list) {
        i++;
        console.log(`[Match ${i}/${match_id_list.size}] Fetching details for ${matchId}...`);
        
        try {
            // Gọi API để lấy full match data
            const response = await retryOnRateLimit(() => 
                matchApi.get(`/tft/match/v1/matches/${matchId}`));
            await sleep(RATE_LIMIT_DELAY);
            
            const fullMatchData = response.data; // Full JSON
            
            // Validate với RiotMatchSchema để đảm bảo cấu trúc đúng
            const validatedMatch = RiotMatchSchema.parse(fullMatchData);
            
            // Parse match summary
            const matchSummary: MatchSummary = {
                match_id: validatedMatch.metadata.match_id,
                game_datetime: validatedMatch.info.game_datetime,
                game_length: validatedMatch.info.game_length,
                queue_id: validatedMatch.info.queue_id,
                tft_set_number: validatedMatch.info.tft_set_number,
                tft_game_type: validatedMatch.info.tft_game_type,
                participants_count: validatedMatch.info.participants.length
            };
            
            // Extract player PUUIDs từ participants
            const playerPuuids = validatedMatch.info.participants.map(p => p.puuid);
            
            results.push({
                matchId,
                fullMatchData,
                matchSummary: MatchSummarySchema.parse(matchSummary),
                playerPuuids
            });
            
            console.log(`... Success! Found ${playerPuuids.length} players in match.`);
            
        } catch (error) {
            if (isAxiosError(error)) {
                console.error(`(ERROR) API Error for ${matchId}: ${error.response?.status}`, error.response?.data);
            } else {
                console.error(`(ERROR) Error fetching details for ${matchId}:`, error instanceof Error ? error.message : String(error));
            }
            // Skip match nếu có lỗi, tiếp tục với match tiếp theo
        }
    }
    
    console.log(`(INFO) Successfully collected ${results.length}/${match_id_list.size} matches.`);
    return results;
}

