import { PlayerAccountUpdateSchema, type PlayerAccountUpdate } from '../models/database/PlayerDBModel';
import { type RiotAccount } from '../models/riot/RiotAccountModels';

/**
 * Map RiotAccount từ API sang PlayerAccountUpdate format cho DB
 * @param riotAccount - Account data từ Riot API
 * @returns PlayerAccountUpdate object để update vào DB
 */
export function mapRiotAccountToPlayerUpdate(riotAccount: RiotAccount): PlayerAccountUpdate {
    const update: PlayerAccountUpdate = {
        puuid: riotAccount.puuid,
        game_name: riotAccount.gameName,
        tag_line: riotAccount.tagLine
    };
    
    return PlayerAccountUpdateSchema.parse(update);
}

/**
 * Map multiple RiotAccounts sang PlayerAccountUpdate format
 * @param riotAccounts - Array of account data từ Riot API
 * @returns Array of PlayerAccountUpdate objects
 */
export function mapRiotAccountsToPlayerUpdates(riotAccounts: RiotAccount[]): PlayerAccountUpdate[] {
    return riotAccounts.map(account => mapRiotAccountToPlayerUpdate(account));
}
