import { supabase } from '../database/supabaseClient';
import { MatchDBSchema, type MatchDB } from '../models/database/MatchDBMode';

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
