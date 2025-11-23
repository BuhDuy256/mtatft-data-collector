import { supabase } from '../database/supabaseClient';
import type { PlayerDB } from '../models/database/PlayerDBModel';

/**
 * Repository for player-related database operations
 * Handles all Supabase interactions for the 'players' table
 */

/**
 * Helper function to fetch all records with pagination to bypass 1000 row limit
 * @param query - Supabase query builder
 * @returns All records from the query
 */
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

        // Apply filters if provided
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

        // Check if there are more records
        hasMore = data && data.length === PAGE_SIZE;
        page++;

        // Safety check to prevent infinite loops
        if (count !== null && allRecords.length >= count) {
            hasMore = false;
        }
    }

    return allRecords;
}

/**
 * Upsert players into database
 * Uses ON CONFLICT to update existing players or insert new ones.
 * 
 * @param players - Array of players to insert/update
 * @returns Array of PUUIDs that were successfully upserted
 * @throws Error if upsert fails
 */
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
    
    // Extract PUUIDs from DB response
    const upserted_puuids = data?.map(row => row.puuid) || [];
    
    console.log(`(OK) Successfully upserted ${upserted_puuids.length} players to database.`);
    console.log(`    - DB confirmed ${data?.length || 0} rows affected`);
    
    return upserted_puuids;
}

/**
 * Get players by PUUIDs
 * @param puuids - Array of PUUIDs to fetch
 * @returns Array of player records
 */
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

/**
 * Delete players by PUUIDs
 * @param puuids - Array of PUUIDs to delete
 * @returns Number of deleted rows
 */
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

/**
 * Update player account information (game_name, tag_line)
 * Updates only the account fields, leaving league stats unchanged.
 * 
 * @param puuid - Player PUUID
 * @param game_name - Riot ID game name
 * @param tag_line - Riot ID tag line
 */
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

/**
 * Batch update player accounts
 * DEPRECATED: Prefer stream processing with individual updates.
 * 
 * @param updates - Array of { puuid, game_name, tag_line }
 * @returns Number of updated players
 */
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

/**
 * Get players missing account information
 * Returns players where game_name or tag_line is NULL.
 * Uses pagination to fetch ALL records (no 1000 limit).
 * 
 * @returns Array of PUUIDs for players without complete account data
 */
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

/**
 * Get players missing league information
 * Returns players where updated_at is NULL (never updated after initial insert).
 * These are players that were inserted with default tier from League API but never enriched.
 * Uses pagination to fetch ALL records (no 1000 limit).
 * 
 * @returns Array of PUUIDs for players without enriched league data
 */
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

/**
 * Get all player PUUIDs from database
 * Fetches complete list of players for batch operations.
 * Uses pagination to fetch ALL records (no 1000 limit).
 * 
 * @returns Array of all PUUIDs in players table
 */
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

/**
 * Update player league information (tier, rank, LP, wins, losses, etc.)
 * Updates all ranked stats while leaving account info (game_name, tag_line) unchanged.
 * 
 * @param puuid - Player PUUID
 * @param league_data - League data to update
 */
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

/**
 * Batch update player league data
 * DEPRECATED: Prefer stream processing with individual updates.
 * 
 * @param updates - Array of league update objects
 * @returns Number of updated players
 */
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
