import { platformApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { RiotLeagueEntriesSchema, type RiotLeagueEntry } from '../models/riot/RiotLeagueModels';

/**
 * Fetch league entry for a single player (RANKED_TFT only)
 * Filters out other queue types (RANKED_TFT_TURBO, etc.).
 * 
 * @param puuid - Player PUUID
 * @returns RiotLeagueEntry for RANKED_TFT or null if not found
 */
export async function fetchPlayerLeague(puuid: string): Promise<RiotLeagueEntry | null> {
    try {
        const response = await retryOnRateLimit(() => 
            platformApi.get(`/tft/league/v1/by-puuid/${puuid}`));
        await sleep(RATE_LIMIT_DELAY);
        
        // Validate response - API returns array of league entries
        const league_entries = RiotLeagueEntriesSchema.parse(response.data);
        
        // Filter for RANKED_TFT entry only
        const ranked_tft_entry = league_entries.find(entry => entry.queueType === 'RANKED_TFT');
        
        if (!ranked_tft_entry) {
            console.warn(`(WARNING) No RANKED_TFT data found for PUUID: ${puuid.substring(0, 10)}...`);
            return null;
        }
        
        return ranked_tft_entry;
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
 * Fetch league entries for multiple players in batch (RANKED_TFT only)
 * DEPRECATED: Prefer using fetchAndSavePlayerLeagues() for stream processing.
 * 
 * @param puuids - Array of player PUUIDs
 * @returns Array of RiotLeagueEntry objects (only players with RANKED_TFT data)
 */
export async function fetchPlayerLeagues(puuids: string[]): Promise<RiotLeagueEntry[]> {
    const league_entries: RiotLeagueEntry[] = [];
    let i = 0;
    
    console.log(`(INFO) Fetching league info for ${puuids.length} players...`);
    
    for (const puuid of puuids) {
        i++;
        console.log(`[League ${i}/${puuids.length}] Fetching ${puuid.substring(0, 10)}...`);
        
        const league = await fetchPlayerLeague(puuid);
        if (league) {
            league_entries.push(league);
            console.log(`... Found: ${league.tier} ${league.rank} (${league.leaguePoints} LP)`);
        }
    }
    
    console.log(`(INFO) Successfully fetched ${league_entries.length}/${puuids.length} league entries.`);
    return league_entries;
}

/**
 * Fetch league info with streaming database saves
 * RECOMMENDED: Use this to avoid memory issues with large player sets.
 * Fetches one league entry at a time and immediately saves to database via callback.
 * 
 * @param puuids - Array of player PUUIDs
 * @param on_league_fetched - Callback to save league data to database
 * @returns Number of league entries successfully fetched and saved
 */
export async function fetchAndSavePlayerLeagues(
    puuids: string[],
    on_league_fetched: (league: RiotLeagueEntry) => Promise<void>
): Promise<number> {
    let success_count = 0;
    let i = 0;
    
    console.log(`(INFO) Fetching and saving league info for ${puuids.length} players...`);
    
    for (const puuid of puuids) {
        i++;
        console.log(`[League ${i}/${puuids.length}] Fetching ${puuid.substring(0, 10)}...`);
        
        const league = await fetchPlayerLeague(puuid);
        if (league) {
            console.log(`... Found: ${league.tier} ${league.rank} (${league.leaguePoints} LP)`);
            try {
                await on_league_fetched(league);
                success_count++;
                console.log(`... Saved to DB ✓`);
            } catch (error) {
                console.error(`... Failed to save: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    
    console.log(`(INFO) Successfully fetched and saved ${success_count}/${puuids.length} league entries.`);
    return success_count;
}
