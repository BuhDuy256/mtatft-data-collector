import { supabase } from '../database/supabaseClient';
import { MatchDBSchema, type MatchDB, PlayerMatchLinkDBSchema, type PlayerMatchLinkDB } from '../models/database/MatchDBMode';

/**
 * Upsert single match into database
 * Stores full match JSON in JSONB 'data' column.
 * Uses ON CONFLICT to update if match_id already exists.
 * 
 * @param match_data - Match data including JSONB payload
 */
export async function upsertMatch(match_data: MatchDB): Promise<void> {
    const validated_match = MatchDBSchema.parse(match_data);
    
    const { error } = await supabase
        .from('matches')
        .upsert(validated_match, { onConflict: 'match_id' });
    
    if (error) {
        throw new Error(`Error upserting match: ${error.message} - ${error.details}`);
    }
}

/**
 * Batch upsert multiple matches into database
 * DEPRECATED: Prefer stream processing with individual upserts.
 * 
 * @param matches - Array of match data
 */
export async function upsertMatches(matches: MatchDB[]): Promise<void> {
    if (matches.length === 0) return;
    
    const validated_matches = matches.map(m => MatchDBSchema.parse(m));
    
    const { error } = await supabase
        .from('matches')
        .upsert(validated_matches, { onConflict: 'match_id' });
    
    if (error) {
        throw new Error(`Error upserting matches: ${error.message} - ${error.details}`);
    }
}

/**
 * Upsert player stubs (minimal player records with default values)
 * Creates placeholder records for players discovered in matches.
 * Uses ignoreDuplicates to avoid overwriting existing players.
 * Player stubs will be enriched later with account and league data.
 * 
 * @param puuids - Array of player PUUIDs to create stubs for
 */
export async function upsertPlayerStubs(puuids: string[]): Promise<void> {
    if (puuids.length === 0) return;
    
    // Create player stubs with default values for required fields
    const player_stubs = puuids.map(puuid => ({
        puuid,
        tier: 'UNKNOWN',           // Placeholder - will update in Stage 5
        league_points: 0,           // Default 0
        rank: 'IV',                 // Default lowest rank
        wins: 0,                    // Default 0
        losses: 0,                  // Default 0
        veteran: false,
        inactive: false,
        fresh_blood: false,
        hot_streak: false
    }));
    
    const { error } = await supabase
        .from('players')
        .upsert(player_stubs, { 
            onConflict: 'puuid',
            ignoreDuplicates: true // Don't overwrite if player already exists
        });
    
    if (error) {
        throw new Error(`Error upserting player stubs: ${error.message} - ${error.details}`);
    }
}

/**
 * Create links between players and matches in junction table
 * Uses ignoreDuplicates to handle existing relationships gracefully.
 * 
 * @param links - Array of player-match link records
 */
export async function upsertPlayerMatchLinks(links: PlayerMatchLinkDB[]): Promise<void> {
    if (links.length === 0) return;
    
    const validated_links = links.map(link => PlayerMatchLinkDBSchema.parse(link));
    
    const { error } = await supabase
        .from('players_matches_link')
        .upsert(validated_links, {
            onConflict: 'puuid,match_id',
            ignoreDuplicates: true
        });
    
    if (error) {
        throw new Error(`Error upserting player-match links: ${error.message} - ${error.details}`);
    }
}

/**
 * Get total count of matches currently in database
 * Used for progress tracking and statistics.
 * 
 * @returns Number of matches in matches table
 */
export async function getMatchCount(): Promise<number> {
    const { count, error } = await supabase
        .from('matches')
        .select('match_id', { count: 'exact', head: true });
    
    if (error) {
        throw new Error(`Error getting match count: ${error.message}`);
    }
    
    return count ?? 0;
}
