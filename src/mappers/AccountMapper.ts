import { PlayerAccountUpdateSchema, type PlayerAccountUpdate } from '../models/database/PlayerDBModel';
import { type RiotAccount } from '../models/riot/RiotAccountModels';

/**
 * Map Riot account data to player update format for database
 * Transforms gameName/tagLine from API to game_name/tag_line for DB.
 * 
 * @param riot_account - Account data from Riot API
 * @returns PlayerAccountUpdate object for database update
 */
export function mapRiotAccountToPlayerUpdate(riot_account: RiotAccount): PlayerAccountUpdate {
    const update: PlayerAccountUpdate = {
        puuid: riot_account.puuid,
        game_name: riot_account.gameName,
        tag_line: riot_account.tagLine
    };
    
    return PlayerAccountUpdateSchema.parse(update);
}

/**
 * Map multiple Riot accounts to player update format
 * Batch version of mapRiotAccountToPlayerUpdate().
 * 
 * @param riot_accounts - Array of account data from Riot API
 * @returns Array of PlayerAccountUpdate objects
 */
export function mapRiotAccountsToPlayerUpdates(riot_accounts: RiotAccount[]): PlayerAccountUpdate[] {
    return riot_accounts.map(account => mapRiotAccountToPlayerUpdate(account));
}
