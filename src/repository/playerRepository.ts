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
 * Uses SQL stored procedure for better performance
 * @returns Number of deleted players
 */
export async function deletePlayersWithoutMatches(): Promise<number> {
    console.log("(INFO) Deleting players without matches...");
    
    const { data, error } = await supabase.rpc('delete_orphaned_players');
    
    if (error) {
        console.error("(ERROR) Error deleting orphaned players:", error.message, error.details);
        throw error;
    }
    
    const deletedCount = typeof data === 'number' ? data : 0;
    console.log(`(OK) Deleted ${deletedCount} orphaned players.`);
    
    return deletedCount;
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

/**
 * Get players missing account info (game_name hoặc tag_line là NULL)
 * @returns Array of PUUIDs
 */
export async function getPlayersMissingAccountInfo(): Promise<string[]> {
    const { data, error } = await supabase
        .from('players')
        .select('puuid')
        .or('game_name.is.null,tag_line.is.null');
    
    if (error) {
        console.error("(ERROR) Error fetching players missing account info:", error.message);
        throw error;
    }
    
    return data?.map(row => row.puuid) || [];
}

/**
 * Get all player PUUIDs from database
 * @returns Array of all PUUIDs
 */
export async function getAllPlayerPuuids(): Promise<string[]> {
    const { data, error } = await supabase
        .from('players')
        .select('puuid');
    
    if (error) {
        console.error("(ERROR) Error fetching all player PUUIDs:", error.message);
        throw error;
    }
    
    return data?.map(row => row.puuid) || [];
}

/**
 * Update player league information (tier, rank, LP, wins, losses, etc.)
 * @param puuid - Player PUUID
 * @param leagueData - League data to update
 */
export async function updatePlayerLeague(
    puuid: string,
    leagueData: {
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
            tier: leagueData.tier,
            rank: leagueData.rank,
            league_points: leagueData.leaguePoints,
            wins: leagueData.wins,
            losses: leagueData.losses,
            veteran: leagueData.veteran,
            inactive: leagueData.inactive,
            fresh_blood: leagueData.freshBlood,
            hot_streak: leagueData.hotStreak
        })
        .eq('puuid', puuid);
    
    if (error) {
        console.error(`(ERROR) Error updating league for ${puuid}:`, error.message);
        throw error;
    }
}

/**
 * Batch update player league data
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
    
    let successCount = 0;
    
    for (const update of updates) {
        try {
            await updatePlayerLeague(update.puuid, update);
            successCount++;
        } catch (error) {
            console.warn(`(WARN) Failed to update league for ${update.puuid}`);
        }
    }
    
    console.log(`(OK) Successfully updated ${successCount}/${updates.length} player leagues`);
    return successCount;
}
