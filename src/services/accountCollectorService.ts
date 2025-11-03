import { accountApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { RiotAccountSchema, type RiotAccount } from '../models/riot/RiotAccountModels';

/**
 * Fetch account information (gameName, tagLine) for a single player
 * Handles 404 errors gracefully (account not found).
 * 
 * @param puuid - Player PUUID
 * @returns RiotAccount object or null if not found
 */
export async function fetchPlayerAccount(puuid: string): Promise<RiotAccount | null> {
    try {
        const response = await retryOnRateLimit(() => 
            accountApi.get(`/riot/account/v1/accounts/by-puuid/${puuid}`));
        await sleep(RATE_LIMIT_DELAY);
        
        const account = RiotAccountSchema.parse(response.data);
        return account;
    } catch (error) {
        if (isAxiosError(error)) {
            if (error.response?.status === 404) {
                console.warn(`(WARNING) Account not found for PUUID: ${puuid.substring(0, 10)}...`);
                return null;
            }
            console.error(`(ERROR) API Error for ${puuid.substring(0, 10)}: ${error.response?.status}`);
        } else {
            console.error(`(ERROR) Error fetching account for ${puuid}:`, error instanceof Error ? error.message : String(error));
        }
        return null;
    }
}

/**
 * Fetch account information for multiple players in batch
 * DEPRECATED: Prefer using fetchAndSavePlayerAccounts() for stream processing.
 * 
 * @param puuids - Array of player PUUIDs
 * @returns Array of RiotAccount objects (only found players)
 */
export async function fetchPlayerAccounts(puuids: string[]): Promise<RiotAccount[]> {
    const accounts: RiotAccount[] = [];
    let i = 0;
    
    console.log(`(INFO) Fetching account info for ${puuids.length} players...`);
    
    for (const puuid of puuids) {
        i++;
        console.log(`[Account ${i}/${puuids.length}] Fetching ${puuid.substring(0, 10)}...`);
        
        const account = await fetchPlayerAccount(puuid);
        if (account) {
            accounts.push(account);
            console.log(`... Found: ${account.gameName}#${account.tagLine}`);
        }
    }
    
    console.log(`(INFO) Successfully fetched ${accounts.length}/${puuids.length} accounts.`);
    return accounts;
}

/**
 * Fetch account info with streaming database saves
 * RECOMMENDED: Use this to avoid memory issues with large player sets.
 * Fetches one account at a time and immediately saves to database via callback.
 * 
 * @param puuids - Array of player PUUIDs
 * @param on_account_fetched - Callback to save account to database
 * @returns Number of accounts successfully fetched and saved
 */
export async function fetchAndSavePlayerAccounts(
    puuids: string[],
    on_account_fetched: (account: RiotAccount) => Promise<void>
): Promise<number> {
    let success_count = 0;
    let i = 0;
    
    console.log(`(INFO) Fetching and saving account info for ${puuids.length} players...`);
    
    for (const puuid of puuids) {
        i++;
        console.log(`[Account ${i}/${puuids.length}] Fetching ${puuid.substring(0, 10)}...`);
        
        const account = await fetchPlayerAccount(puuid);
        if (account) {
            console.log(`... Found: ${account.gameName}#${account.tagLine}`);
            try {
                await on_account_fetched(account);
                success_count++;
                console.log(`... Saved to DB ✓`);
            } catch (error) {
                console.error(`... Failed to save: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    
    console.log(`(INFO) Successfully fetched and saved ${success_count}/${puuids.length} accounts.`);
    return success_count;
}
