import { accountApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { RiotAccountSchema, type RiotAccount } from '../models/riot/RiotAccountModels';

/**
 * Fetch account information (gameName, tagLine) cho một player
 * @param puuid - Player PUUID
 * @returns RiotAccount object hoặc null nếu không tìm thấy
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
 * Fetch account information cho nhiều players
 * @param puuids - Array of PUUIDs
 * @returns Array of RiotAccount objects (chỉ players tìm thấy)
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
