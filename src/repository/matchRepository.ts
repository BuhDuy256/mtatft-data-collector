import { supabase } from '../database/supabaseClient';
import { MatchDBSchema, type MatchDB, PlayerMatchLinkDBSchema, type PlayerMatchLinkDB } from '../models/database/MatchDBMode';

/**
 * Insert hoặc update match vào database
 * Lưu full JSON vào cột data (JSONB)
 */
export async function upsertMatch(matchData: MatchDB): Promise<void> {
    const validatedMatch = MatchDBSchema.parse(matchData);
    
    const { error } = await supabase
        .from('matches')
        .upsert(validatedMatch, { onConflict: 'match_id' });
    
    if (error) {
        throw new Error(`Error upserting match: ${error.message} - ${error.details}`);
    }
}

/**
 * Batch insert/update nhiều matches
 */
export async function upsertMatches(matches: MatchDB[]): Promise<void> {
    if (matches.length === 0) return;
    
    const validatedMatches = matches.map(m => MatchDBSchema.parse(m));
    
    const { error } = await supabase
        .from('matches')
        .upsert(validatedMatches, { onConflict: 'match_id' });
    
    if (error) {
        throw new Error(`Error upserting matches: ${error.message} - ${error.details}`);
    }
}

/**
 * Insert player stub (chỉ có puuid, các field khác dùng giá trị mặc định)
 * Sử dụng ignoreDuplicates để không overwrite players đã tồn tại
 */
export async function upsertPlayerStubs(puuids: string[]): Promise<void> {
    if (puuids.length === 0) return;
    
    // Tạo player stubs với giá trị mặc định cho các field bắt buộc
    const playerStubs = puuids.map(puuid => ({
        puuid,
        tier: 'UNKNOWN',           // Placeholder - sẽ update ở Stage 5
        league_points: 0,           // Default 0
        rank: 'IV',                 // Default rank thấp nhất
        wins: 0,                    // Default 0
        losses: 0,                  // Default 0
        veteran: false,
        inactive: false,
        fresh_blood: false,
        hot_streak: false
    }));
    
    const { error } = await supabase
        .from('players')
        .upsert(playerStubs, { 
            onConflict: 'puuid',
            ignoreDuplicates: true // Không overwrite nếu player đã tồn tại
        });
    
    if (error) {
        throw new Error(`Error upserting player stubs: ${error.message} - ${error.details}`);
    }
}

/**
 * Tạo links giữa players và matches
 */
export async function upsertPlayerMatchLinks(links: PlayerMatchLinkDB[]): Promise<void> {
    if (links.length === 0) return;
    
    const validatedLinks = links.map(link => PlayerMatchLinkDBSchema.parse(link));
    
    const { error } = await supabase
        .from('players_matches_link')
        .upsert(validatedLinks, {
            onConflict: 'puuid,match_id',
            ignoreDuplicates: true
        });
    
    if (error) {
        throw new Error(`Error upserting player-match links: ${error.message} - ${error.details}`);
    }
}

/**
 * Lấy số lượng matches hiện tại trong DB
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
