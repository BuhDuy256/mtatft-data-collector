import { PlayerAccountUpdateSchema, type PlayerAccountUpdate } from '../models/database/PlayerDBModel';
import { type RiotAccount } from '../models/riot/RiotAccountModels';

export function mapRiotAccountToPlayerUpdate(riot_account: RiotAccount): PlayerAccountUpdate {
    const update: PlayerAccountUpdate = {
        puuid: riot_account.puuid,
        game_name: riot_account.gameName,
        tag_line: riot_account.tagLine
    };
    
    return PlayerAccountUpdateSchema.parse(update);
}

export function mapRiotAccountsToPlayerUpdates(riot_accounts: RiotAccount[]): PlayerAccountUpdate[] {
    return riot_accounts.map(account => mapRiotAccountToPlayerUpdate(account));
}
