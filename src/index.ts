import fs from 'fs';
import path from 'path';
import { supabase } from './database/supabaseClient';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as dotenv from 'dotenv'; // For loading environment variables. Docs: https://www.npmjs.com/package/dotenv
import { z } from 'zod'; // For runtime validation. Docs: https://zod.dev/api
// Models
import { 
    TierSchema, 
    HIGH_TIERS, 
    LOW_TIERS,
    type Tier,
    type Division
} from './models/riot/RiotTierModels';

// Services
import { fetchPlayersFromTier } from './services/playerCollectorService';
import { selectRandomPlayers } from './services/playerSelectionService';
import { collectMatchIdsFromPlayers, fetchAndSaveMatchDetails, type MatchDetailResult } from './services/matchCollectorService';
import { fetchAndSavePlayerAccounts } from './services/accountCollectorService';
import { fetchAndSavePlayerLeagues } from './services/leagueCollectorService';

// Mappers
import { mapRiotPlayersToDatabase } from './mappers/PlayerMapper';

// Repository
import { upsertPlayers, updatePlayerAccount, updatePlayerLeague, getAllPlayerPuuids, deletePlayersWithoutMatches } from './repository/playerRepository';
import { upsertPlayerStubs, upsertPlayerMatchLinks } from './repository/matchRepository';

// Models
import type { MatchDB, PlayerMatchLinkDB } from './models/database/MatchDBMode';

// Utils
import { RIOT_MATCH_REGION } from './utils/api';

// --- LOGGING SETUP ---
const log_dir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(log_dir)) fs.mkdirSync(log_dir);

const log_file = path.join(log_dir, 'index.log');
const log_stream = fs.createWriteStream(log_file, { flags: 'a' });

// Override console methods to write to log file
['log', 'error', 'warn', 'info', 'debug'].forEach((method) => {
    const original = (console as any)[method];
    (console as any)[method] = (...args: any[]) => {
        const message = args.map(String).join(' ');
        const timestamp = new Date().toISOString();
        log_stream.write(`[${timestamp}] [${method.toUpperCase()}] ${message}\n`);
        original.apply(console, args);
    };
});

// --- CLI ARGUMENTS PARSING --- 
const args = process.argv.slice(2);
const tier_arg = args[0];
const match_goal_arg = args[1];

const parsed_tier = TierSchema.safeParse(tier_arg);

if (!parsed_tier.success) {
    const all_tiers = [...HIGH_TIERS, ...LOW_TIERS].join(', ');
    throw new Error(
        `(ERROR) Invalid tier: "${tier_arg}". Must be one of: ${all_tiers}`
    );
}

const tier: Tier = parsed_tier.data;
const match_goal = parseInt(match_goal_arg || '');

if (isNaN(match_goal)) {
    throw new Error(
        `(ERROR) Match goal argument is required and must be a number. Usage: npm start <TIER> <MATCH_GOAL>`
    );
}

/**
 * Collect tier-based seed players and insert into database
 * Fetches players from specified tier/divisions, selects random subset based on match goal,
 * and upserts to database
 * 
 * @param tier - Tier to fetch players from (CHALLENGER, GRANDMASTER, etc.)
 * @param match_goal - Target number of matches to collect (used for player selection)
 * @param divisions - Array of divisions to fetch (1-4 for non-Apex tiers)
 * @param pages - Array of page numbers to fetch
 * @returns Set of PUUIDs that were successfully inserted into database
 */
async function collectTierBasedPlayers(
    tier: Tier, 
    match_goal: number,
    divisions: Division[] = [1, 2, 3, 4],
    pages: number[] = [1]
): Promise<Set<string>> {
    console.log(`(INFO) Stage 1: Collecting players...`);
    
    // Step 1: Fetch and select players
    const raw_players = await fetchPlayersFromTier(tier, divisions, pages);
    const players = selectRandomPlayers(raw_players, match_goal);
    const players_to_upsert = mapRiotPlayersToDatabase(players);

    // Step 2: Upsert to database via repository
    const upserted_puuids = await upsertPlayers(players_to_upsert);
    
    // Step 3: Build set from successfully upserted PUUIDs
    const puuid_seed_list = new Set<string>(upserted_puuids);
    
    console.log(`    - Seed list contains ${puuid_seed_list.size} unique PUUIDs`);
    
    return puuid_seed_list;
}

/**
 * Collect matches from seed players using stream processing
 * Fetches match IDs from players, then streams match details with immediate database saves.
 * For each match: saves full JSONB data, extracts participants as player stubs, creates links.
 * 
 * @param puuid_seed_list - Set of player PUUIDs to fetch matches from
 * @param region - Region identifier for match data (e.g., 'sea', 'na1')
 */
async function collectMatchesFromPlayers(
    puuid_seed_list: Set<string>,
    region: string
): Promise<void> {
    console.log(`(INFO) Stage 2: Collecting matches from ${puuid_seed_list.size} seed players...`);
    
    // Step 1: Fetch match IDs from seed players
    const match_id_set = await collectMatchIdsFromPlayers(puuid_seed_list);
    
    if (match_id_set.size === 0) {
        console.log("(WARNING) No match IDs found.");
        return;
    }
    
    let match_count = 0;
    let total_players = new Set<string>();
    let total_links = 0;
    
    // Step 2: Stream fetch and immediately save each match
    await fetchAndSaveMatchDetails(match_id_set, region, async (match_result: MatchDetailResult) => {
        match_count++;
        
        // Save match to database
        const match_db: MatchDB = {
            match_id: match_result.matchId,
            data: match_result.fullMatchData,
            is_processed: false,
            region: region
        };
        
        const { upsertMatch } = await import('./repository/matchRepository');
        await upsertMatch(match_db);
        
        // Upsert player stubs (puuid only, other fields default)
        await upsertPlayerStubs(match_result.playerPuuids);
        match_result.playerPuuids.forEach(puuid => total_players.add(puuid));
        
        // Create player-match links
        const links: PlayerMatchLinkDB[] = match_result.playerPuuids.map(puuid => ({
            puuid,
            match_id: match_result.matchId
        }));
        await upsertPlayerMatchLinks(links);
        total_links += links.length;
    });
    
    console.log(`(OK) Stage 2 Complete!`);
    console.log(`    - Matches saved: ${match_count}`);
    console.log(`    - Unique players found: ${total_players.size}`);
    console.log(`    - Links created: ${total_links}`);
}

/**
 * Enrich player account data using stream processing
 * Fetches Riot account info (gameName, tagLine) for all players and immediately updates database.
 * Uses streaming approach - fetch one, save one.
 */
async function enrichPlayerAccounts(): Promise<void> {
    console.log(`(INFO) Stage 4: Enriching player account data...`);
    
    // Fetch all player PUUIDs from database
    const all_puuids = await getAllPlayerPuuids();
    
    if (all_puuids.length === 0) {
        console.log("(WARNING) No players found in database. Skipping Stage 4.");
        return;
    }
    
    console.log(`(INFO) Updating account info for ${all_puuids.length} players...`);
    
    // Stream fetch and immediately save each account
    const updated_count = await fetchAndSavePlayerAccounts(all_puuids, async (account) => {
        await updatePlayerAccount(account.puuid, account.gameName, account.tagLine);
    });
    
    console.log(`(OK) Stage 4 Complete!`);
    console.log(`    - Total players: ${all_puuids.length}`);
    console.log(`    - Successfully updated: ${updated_count}`);
}

/**
 * Enrich player league data using stream processing
 * Fetches RANKED_TFT league entries (tier, rank, LP, W/L) for all players and immediately updates database.
 * Filters to only RANKED_TFT queue type, ignoring other modes like RANKED_TFT_TURBO.
 */
async function enrichPlayerLeagues(): Promise<void> {
    console.log(`(INFO) Stage 5: Enriching player league data (RANKED_TFT only)...`);
    
    // Fetch all player PUUIDs from database
    const all_puuids = await getAllPlayerPuuids();
    
    if (all_puuids.length === 0) {
        console.log("(WARNING) No players found in database. Skipping Stage 5.");
        return;
    }
    
    console.log(`(INFO) Updating league info for ${all_puuids.length} players...`);
    
    // Stream fetch and immediately save each league entry
    const updated_count = await fetchAndSavePlayerLeagues(all_puuids, async (league) => {
        await updatePlayerLeague(league.puuid, {
            tier: league.tier,
            rank: league.rank,
            leaguePoints: league.leaguePoints,
            wins: league.wins,
            losses: league.losses,
            veteran: league.veteran,
            inactive: league.inactive,
            freshBlood: league.freshBlood,
            hotStreak: league.hotStreak
        });
    });
    
    console.log(`(OK) Stage 5 Complete!`);
    console.log(`    - Total players: ${all_puuids.length}`);
    console.log(`    - Successfully updated: ${updated_count}`);
}

/**
 * Clean up orphaned players from database
 * Deletes players who don't have any associated matches in players_matches_link table.
 * Uses SQL stored procedure (delete_orphaned_players) for optimal performance.
 * 
 * @returns Number of players deleted
 */
async function cleanUpOrphanedPlayers(): Promise<void> {
    console.log(`(INFO) Stage 3: Cleaning up orphaned players...`);
    
    const deleted_count = await deletePlayersWithoutMatches();
    
    console.log(`(OK) Stage 3 Complete!`);
    console.log(`    - Orphaned players deleted: ${deleted_count}`);
}

/**
 * Main pipeline orchestrator
 * Executes 5-stage data collection pipeline:
 * 1. Collect seed players from specified tier
 * 2. Collect matches from those players (with streaming saves)
 * 3. Clean up orphaned players (no matches)
 * 4. Enrich player account data (gameName, tagLine)
 * 5. Enrich player league data (tier, rank, LP, W/L)
 */
async function runPipeline() {
    try {
        console.log(`(INFO) Starting data collection for tier: ${tier}, match goal: ${match_goal}`);
        
        // --- STAGE 1: COLLECT TIER-BASED SEED PLAYERS ---
        const puuid_seed_list = await collectTierBasedPlayers(tier, match_goal, [2, 3], [1, 2]);
        
        if (puuid_seed_list.size === 0) {
            console.log("(WARNING) No seed players found. Stopping.");
            return;
        }
        
        // --- STAGE 2: COLLECT MATCHES FROM PLAYERS ---
        await collectMatchesFromPlayers(puuid_seed_list, RIOT_MATCH_REGION);
        
        // --- STAGE 3: DELETE ORPHANED PLAYERS ---
        await cleanUpOrphanedPlayers();
        
        // --- STAGE 4: ENRICH PLAYER ACCOUNT DATA ---
        await enrichPlayerAccounts();
        
        // --- STAGE 5: ENRICH PLAYER LEAGUE DATA ---
        await enrichPlayerLeagues();
        
        console.log(`(OK) Data collection complete!`);
    } catch (error) {
        console.error(`(ERROR) Fatal error in pipeline:`, error);
        process.exit(1);
    }
}

// Execute main pipeline
runPipeline(); 





