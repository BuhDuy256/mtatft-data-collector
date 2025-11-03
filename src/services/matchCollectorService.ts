import { matchApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { MatchIdListSchema, RiotMatchSchema, type RiotMatch } from '../models/riot/RiotMatchModels';

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

