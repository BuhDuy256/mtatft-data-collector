import { supabase } from '../database/supabaseClient';
import type { PlayerDB } from '../models/database/PlayerDBModel';

/**
 * Repository for player-related database operations
 * Handles all Supabase interactions for the 'players' table
 */

/**
 * Upsert players into database
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
    const upsertedPuuids = data?.map(row => row.puuid) || [];
    
    console.log(`(OK) Successfully upserted ${upsertedPuuids.length} players to database.`);
    console.log(`    - DB confirmed ${data?.length || 0} rows affected`);
    
    return upsertedPuuids;
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
 * Delete players that don't have any matches
 * Uses RPC function or direct query
 * @returns Number of deleted players
 */
export async function deletePlayersWithoutMatches(): Promise<number> {
    // Option 1: Using RPC if you have a stored procedure
    // const { data, error } = await supabase.rpc('delete_players_without_matches');
    
    // Option 2: Direct query (if matches table exists)
    const { data, error } = await supabase
        .from('players')
        .delete()
        .not('puuid', 'in', 
            supabase.from('matches').select('puuid')
        )
        .select('puuid');
    
    if (error) {
        console.error("(ERROR) Error deleting players without matches:", error.message);
        throw error;
    }
    
    return data?.length || 0;
}

/**
 * Update player account information (game_name, tag_line)
 * @param puuid - Player PUUID
 * @param gameName - Riot ID game name
 * @param tagLine - Riot ID tag line
 */
export async function updatePlayerAccount(
    puuid: string, 
    gameName: string, 
    tagLine: string
): Promise<void> {
    const { error } = await supabase
        .from('players')
        .update({ 
            game_name: gameName, 
            tag_line: tagLine 
        })
        .eq('puuid', puuid);
    
    if (error) {
        console.error(`(ERROR) Error updating account for ${puuid}:`, error.message);
        throw error;
    }
}

/**
 * Batch update player accounts
 * @param updates - Array of { puuid, gameName, tagLine }
 * @returns Number of updated players
 */
export async function batchUpdatePlayerAccounts(
    updates: Array<{ puuid: string; gameName: string; tagLine: string }>
): Promise<number> {
    console.log(`(INFO) Batch updating ${updates.length} player accounts...`);
    
    let successCount = 0;
    
    for (const { puuid, gameName, tagLine } of updates) {
        try {
            await updatePlayerAccount(puuid, gameName, tagLine);
            successCount++;
        } catch (error) {
            console.warn(`(WARN) Failed to update account for ${puuid}`);
        }
    }
    
    console.log(`(OK) Successfully updated ${successCount}/${updates.length} player accounts`);
    return successCount;
}
