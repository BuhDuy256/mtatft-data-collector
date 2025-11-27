import { supabase } from '../database/supabaseClient';
import { MatchDBSchema, type MatchDB } from '../models/database/MatchDBMode';

export async function upsertMatch(match_data: MatchDB): Promise<void> {
    const validated_match = MatchDBSchema.parse(match_data);
    
    const { error } = await supabase
        .from('raw_matches')
        .upsert(validated_match, { onConflict: 'match_id' });
    
    if (error) {
        throw new Error(`Error upserting match: ${error.message} - ${error.details}`);
    }
}

export async function upsertMatches(matches: MatchDB[]): Promise<void> {
    if (matches.length === 0) return;
    
    const validated_matches = matches.map(m => MatchDBSchema.parse(m));
    
    const { error } = await supabase
        .from('raw_matches')
        .upsert(validated_matches, { onConflict: 'match_id' });
    
    if (error) {
        throw new Error(`Error upserting matches: ${error.message} - ${error.details}`);
    }
}

export async function getMatchCount(): Promise<number> {
    const { count, error } = await supabase
        .from('raw_matches')
        .select('match_id', { count: 'exact', head: true });
    
    if (error) {
        throw new Error(`Error getting match count: ${error.message}`);
    }
    
    return count ?? 0;
}
