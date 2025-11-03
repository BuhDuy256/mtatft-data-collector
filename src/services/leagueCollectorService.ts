import { platformApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { RiotLeagueEntriesSchema, type RiotLeagueEntry } from '../models/riot/RiotLeagueModels';

/**
 * Fetch league entries cho một player và lọc lấy RANKED_TFT
 * @param puuid - Player PUUID
 * @returns RiotLeagueEntry cho RANKED_TFT hoặc null nếu không tìm thấy
 */
export async function fetchPlayerLeague(puuid: string): Promise<RiotLeagueEntry | null> {
    try {
        const response = await retryOnRateLimit(() => 
            platformApi.get(`/tft/league/v1/by-puuid/${puuid}`));
        await sleep(RATE_LIMIT_DELAY);
        
        // Validate response - API trả về array of league entries
        const leagueEntries = RiotLeagueEntriesSchema.parse(response.data);
        
        // Lọc lấy RANKED_TFT entry
        const rankedTftEntry = leagueEntries.find(entry => entry.queueType === 'RANKED_TFT');
        
        if (!rankedTftEntry) {
            console.warn(`(WARNING) No RANKED_TFT data found for PUUID: ${puuid.substring(0, 10)}...`);
            return null;
        }
        
        return rankedTftEntry;
    } catch (error) {
        if (isAxiosError(error)) {
            if (error.response?.status === 404) {
                console.warn(`(WARNING) League entry not found for PUUID: ${puuid.substring(0, 10)}...`);
                return null;
            }
            console.error(`(ERROR) API Error for ${puuid.substring(0, 10)}: ${error.response?.status}`);
        } else {
            console.error(`(ERROR) Error fetching league for ${puuid}:`, error instanceof Error ? error.message : String(error));
        }
        return null;
    }
}

/**
 * Fetch league entries cho nhiều players (chỉ RANKED_TFT)
 * @param puuids - Array of PUUIDs
 * @returns Array of RiotLeagueEntry objects (chỉ players có RANKED_TFT data)
 */
export async function fetchPlayerLeagues(puuids: string[]): Promise<RiotLeagueEntry[]> {
    const leagueEntries: RiotLeagueEntry[] = [];
    let i = 0;
    
    console.log(`(INFO) Fetching league info for ${puuids.length} players...`);
    
    for (const puuid of puuids) {
        i++;
        console.log(`[League ${i}/${puuids.length}] Fetching ${puuid.substring(0, 10)}...`);
        
        const league = await fetchPlayerLeague(puuid);
        if (league) {
            leagueEntries.push(league);
            console.log(`... Found: ${league.tier} ${league.rank} (${league.leaguePoints} LP)`);
        }
    }
    
    console.log(`(INFO) Successfully fetched ${leagueEntries.length}/${puuids.length} league entries.`);
    return leagueEntries;
}

/**
 * STREAM VERSION: Fetch và save league ngay vào DB
 * @param puuids - Array of PUUIDs
 * @param onLeagueFetched - Callback để save vào DB
 * @returns Số lượng leagues đã fetch thành công
 */
export async function fetchAndSavePlayerLeagues(
    puuids: string[],
    onLeagueFetched: (league: RiotLeagueEntry) => Promise<void>
): Promise<number> {
    let successCount = 0;
    let i = 0;
    
    console.log(`(INFO) Fetching and saving league info for ${puuids.length} players...`);
    
    for (const puuid of puuids) {
        i++;
        console.log(`[League ${i}/${puuids.length}] Fetching ${puuid.substring(0, 10)}...`);
        
        const league = await fetchPlayerLeague(puuid);
        if (league) {
            console.log(`... Found: ${league.tier} ${league.rank} (${league.leaguePoints} LP)`);
            try {
                await onLeagueFetched(league);
                successCount++;
                console.log(`... Saved to DB ✓`);
            } catch (error) {
                console.error(`... Failed to save: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    
    console.log(`(INFO) Successfully fetched and saved ${successCount}/${puuids.length} league entries.`);
    return successCount;
}
