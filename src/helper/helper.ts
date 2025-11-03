import { isAxiosError } from 'axios';

// --- HELPER: Utilities ---
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- HELPER: API Call with Retry Logic ---
export async function retryOnRateLimit<T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 429) {
                const retryAfter = parseInt(error.response.headers['retry-after'] || '10');
                console.warn(`(WARNING) Rate limited! Waiting ${retryAfter}s... (Attempt ${attempt}/${maxRetries})`);
                await sleep(retryAfter * 1000);
                if (attempt === maxRetries) throw error;
            } else {
                throw error;
            }
        }
    }
    throw new Error("API call failed after retries");
}