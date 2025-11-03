import { supabase } from '../database/supabaseClient';
import type { PlayerDB } from '../models/database/PlayerDBModel';

/**
 * Repository for player-related database operations
 * Handles all Supabase interactions for the 'players' table
 */

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
 * Delete players that don't have any matches
 * Uses SQL stored procedure (delete_orphaned_players) for optimal performance.
 * Stored procedure deletes players whose PUUID is not in players_matches_link table.
 * 
 * @returns Number of deleted players
 */
export async function deletePlayersWithoutMatches(): Promise<number> {
    console.log("(INFO) Deleting players without matches...");
    
    const { data, error } = await supabase.rpc('delete_orphaned_players');
    
    if (error) {
        console.error("(ERROR) Error deleting orphaned players:", error.message, error.details);
        throw error;
    }
    
    const deleted_count = typeof data === 'number' ? data : 0;
    console.log(`(OK) Deleted ${deleted_count} orphaned players.`);
    
    return deleted_count;
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
            tag_line: tag_line 
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
 * 
 * @returns Array of PUUIDs for players without complete account data
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
 * Fetches complete list of players for batch operations.
 * 
 * @returns Array of all PUUIDs in players table
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
            hot_streak: league_data.hotStreak
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
