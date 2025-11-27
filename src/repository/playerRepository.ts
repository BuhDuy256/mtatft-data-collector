import { supabase } from '../database/supabaseClient';
import type { PlayerDB } from '../models/database/PlayerDBModel';

async function fetchAllRecords<T>(
    tableName: string,
    selectFields: string,
    filterFn?: (query: any) => any
): Promise<T[]> {
    const PAGE_SIZE = 1000;
    let allRecords: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        let query = supabase
            .from(tableName)
            .select(selectFields, { count: 'exact' })
            .range(start, end);

        if (filterFn) {
            query = filterFn(query);
        }

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            allRecords = allRecords.concat(data as T[]);
        }

        hasMore = data && data.length === PAGE_SIZE;
        page++;

        if (count !== null && allRecords.length >= count) {
            hasMore = false;
        }
    }

    return allRecords;
}

export async function upsertPlayers(players: PlayerDB[]): Promise<string[]> {
    console.log(`(INFO) Upserting ${players.length} players to database...`);

    const { data, error } = await supabase
        .from('players')
        .upsert(players, { onConflict: 'puuid' })
        .select('puuid');
    
    if (error) {
        console.error("(ERROR) Error upserting players:", error.message, error.details);
        throw error;
    }
    
    const upserted_puuids = data?.map(row => row.puuid) || [];
    
    console.log(`(OK) Successfully upserted ${upserted_puuids.length} players to database.`);
    console.log(`    - DB confirmed ${data?.length || 0} rows affected`);
    
    return upserted_puuids;
}

export async function getPlayersByPuuids(puuids: string[]): Promise<PlayerDB[]> {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .in('puuid', puuids);
    
    if (error) {
        console.error("(ERROR) Error fetching players:", error.message);
        throw error;
    }
    
    return data || [];
}

export async function deletePlayersByPuuids(puuids: string[]): Promise<number> {
    const { data, error } = await supabase
        .from('players')
        .delete()
        .in('puuid', puuids)
        .select('puuid');
    
    if (error) {
        console.error("(ERROR) Error deleting players:", error.message);
        throw error;
    }
    
    return data?.length || 0;
}

export async function updatePlayerAccount(
    puuid: string, 
    game_name: string, 
    tag_line: string
): Promise<void> {
    const { error } = await supabase
        .from('players')
        .update({ 
            game_name: game_name, 
            tag_line: tag_line,
            updated_at: new Date().toISOString()
        })
        .eq('puuid', puuid);
    
    if (error) {
        console.error(`(ERROR) Error updating account for ${puuid}:`, error.message);
        throw error;
    }
}

export async function batchUpdatePlayerAccounts(
    updates: Array<{ puuid: string; game_name: string; tag_line: string }>
): Promise<number> {
    console.log(`(INFO) Batch updating ${updates.length} player accounts...`);
    
    let success_count = 0;
    
    for (const { puuid, game_name, tag_line } of updates) {
        try {
            await updatePlayerAccount(puuid, game_name, tag_line);
            success_count++;
        } catch (error) {
            console.warn(`(WARN) Failed to update account for ${puuid}`);
        }
    }
    
    console.log(`(OK) Successfully updated ${success_count}/${updates.length} player accounts`);
    return success_count;
}

export async function getPlayersMissingAccountInfo(): Promise<string[]> {
    try {
        const records = await fetchAllRecords<{ puuid: string }>(
            'players',
            'puuid',
            (query) => query.or('game_name.is.null,tag_line.is.null')
        );
        
        return records.map(row => row.puuid);
    } catch (error) {
        console.error("(ERROR) Error fetching players missing account info:", error);
        throw error;
    }
}

export async function getPlayersMissingLeagueInfo(): Promise<string[]> {
    try {
        const records = await fetchAllRecords<{ puuid: string }>(
            'players',
            'puuid',
            (query) => query.is('updated_at', null)
        );
        
        return records.map(row => row.puuid);
    } catch (error) {
        console.error("(ERROR) Error fetching players missing league info:", error);
        throw error;
    }
}

export async function getAllPlayerPuuids(): Promise<string[]> {
    try {
        const records = await fetchAllRecords<{ puuid: string }>(
            'players',
            'puuid'
        );
        
        return records.map(row => row.puuid);
    } catch (error) {
        console.error("(ERROR) Error fetching all player PUUIDs:", error);
        throw error;
    }
}

export async function updatePlayerLeague(
    puuid: string,
    league_data: {
        tier: string;
        rank: string;
        leaguePoints: number;
        wins: number;
        losses: number;
        veteran: boolean;
        inactive: boolean;
        freshBlood: boolean;
        hotStreak: boolean;
    }
): Promise<void> {
    const { error } = await supabase
        .from('players')
        .update({
            tier: league_data.tier,
            rank: league_data.rank,
            league_points: league_data.leaguePoints,
            wins: league_data.wins,
            losses: league_data.losses,
            veteran: league_data.veteran,
            inactive: league_data.inactive,
            fresh_blood: league_data.freshBlood,
            hot_streak: league_data.hotStreak,
            updated_at: new Date().toISOString()
        })
        .eq('puuid', puuid);
    
    if (error) {
        console.error(`(ERROR) Error updating league for ${puuid}:`, error.message);
        throw error;
    }
}

export async function batchUpdatePlayerLeagues(
    updates: Array<{
        puuid: string;
        tier: string;
        rank: string;
        leaguePoints: number;
        wins: number;
        losses: number;
        veteran: boolean;
        inactive: boolean;
        freshBlood: boolean;
        hotStreak: boolean;
    }>
): Promise<number> {
    console.log(`(INFO) Batch updating ${updates.length} player leagues...`);
    
    let success_count = 0;
    
    for (const update of updates) {
        try {
            await updatePlayerLeague(update.puuid, update);
            success_count++;
        } catch (error) {
            console.warn(`(WARN) Failed to update league for ${update.puuid}`);
        }
    }
    
    console.log(`(OK) Successfully updated ${success_count}/${updates.length} player leagues`);
    return success_count;
}
