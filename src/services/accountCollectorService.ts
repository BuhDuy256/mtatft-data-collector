import { accountApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { isAxiosError } from 'axios';
import { RiotAccountSchema, type RiotAccount } from '../models/riot/RiotAccountModels';

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
