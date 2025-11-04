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
/**
 * CLI Usage: npm start <TIERS...> <MATCH_GOAL> <ENRICH_ACCOUNT> <ENRICH_LEAGUE>
 * 
 * Examples:
 *   npm start challenger 1000 on on
 *   npm start challenger master diamond 500 on off
 *   npm start all 100 on off
 * 
 * Arguments:
 *   TIERS: One or more tier names (challenger, master, diamond...) or "all" for all tiers
 *   MATCH_GOAL: Number of matches to collect per tier
 *   ENRICH_ACCOUNT: "on" or "off" - Stage 4 (fetch gameName, tagLine)
 *   ENRICH_LEAGUE: "on" or "off" - Stage 5 (fetch tier, rank, LP, W/L)
 */
const args = process.argv.slice(2);

if (args.length < 4) {
    console.error('(ERROR) Invalid arguments.');
    console.error('Usage: npm start <TIERS...> <MATCH_GOAL> <ENRICH_ACCOUNT> <ENRICH_LEAGUE>');
    console.error('');
    console.error('Examples:');
    console.error('  npm start challenger 1000 on on');
    console.error('  npm start challenger master 500 on off');
    console.error('  npm start all 100 on off');
    console.error('');
    console.error('Arguments:');
    console.error('  TIERS: One or more tier names or "all"');
    console.error('  MATCH_GOAL: Number of matches per tier');
    console.error('  ENRICH_ACCOUNT: "on" or "off" (Stage 4)');
    console.error('  ENRICH_LEAGUE: "on" or "off" (Stage 5)');
    process.exit(1);
}

// Parse tiers (all args except last 3 are tiers)
const tier_args = args.slice(0, -3);
const match_goal_arg = args[args.length - 3];
const enrich_account_arg = args[args.length - 2].toLowerCase();
const enrich_league_arg = args[args.length - 1].toLowerCase();

// Parse match goal
const match_goal = parseInt(match_goal_arg || '');
if (isNaN(match_goal) || match_goal <= 0) {
    throw new Error(`(ERROR) Match goal must be a positive number. Got: "${match_goal_arg}"`);
}

// Parse enrich flags
const enrich_account = enrich_account_arg === 'on';
const enrich_league = enrich_league_arg === 'on';

if (!['on', 'off'].includes(enrich_account_arg)) {
    throw new Error(`(ERROR) ENRICH_ACCOUNT must be "on" or "off". Got: "${enrich_account_arg}"`);
}
if (!['on', 'off'].includes(enrich_league_arg)) {
    throw new Error(`(ERROR) ENRICH_LEAGUE must be "on" or "off". Got: "${enrich_league_arg}"`);
}

// Parse tiers
let tiers: Tier[] = [];

if (tier_args.length === 1 && tier_args[0].toLowerCase() === 'all') {
    // Use all tiers
    tiers = [...HIGH_TIERS, ...LOW_TIERS] as Tier[];
    console.log(`(INFO) Using ALL tiers: ${tiers.join(', ')}`);
} else {
    // Parse individual tiers
    for (const tier_arg of tier_args) {
        const parsed_tier = TierSchema.safeParse(tier_arg);
        if (!parsed_tier.success) {
            const all_tiers = [...HIGH_TIERS, ...LOW_TIERS].join(', ');
            throw new Error(
                `(ERROR) Invalid tier: "${tier_arg}". Must be one of: ${all_tiers}, or "all"`
            );
        }
        tiers.push(parsed_tier.data);
    }
}

console.log(`(INFO) Configuration:`);
console.log(`  - Tiers: ${tiers.join(', ')}`);
console.log(`  - Matches per tier: ${match_goal}`);
console.log(`  - Total matches goal: ${match_goal * tiers.length}`);
console.log(`  - Enrich account (Stage 4): ${enrich_account ? 'ON' : 'OFF'}`);
console.log(`  - Enrich league (Stage 5): ${enrich_league ? 'ON' : 'OFF'}`);

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
 * Executes data collection pipeline for multiple tiers:
 * 1. Collect seed players from each specified tier
 * 2. Collect matches from those players (with streaming saves)
 * 3. Clean up orphaned players (no matches)
 * 4. [Optional] Enrich player account data (gameName, tagLine)
 * 5. [Optional] Enrich player league data (tier, rank, LP, W/L)
 */
async function runPipeline() {
    try {
        console.log(`(INFO) ========================================`);
        console.log(`(INFO) Starting Multi-Tier Data Collection`);
        console.log(`(INFO) ========================================`);
        console.log(`(INFO) Total tiers: ${tiers.length}`);
        console.log(`(INFO) Matches per tier: ${match_goal}`);
        console.log(`(INFO) Total matches goal: ${match_goal * tiers.length}`);
        console.log(`(INFO) ========================================`);
        
        const all_puuid_seeds = new Set<string>();
        
        // --- STAGE 1 & 2: COLLECT PLAYERS AND MATCHES FOR EACH TIER ---
        for (let i = 0; i < tiers.length; i++) {
            const tier = tiers[i];
            console.log(`\n(INFO) ========================================`);
            console.log(`(INFO) Processing Tier ${i + 1}/${tiers.length}: ${tier.toUpperCase()}`);
            console.log(`(INFO) ========================================`);
            
            // Stage 1: Collect seed players for this tier
            const puuid_seed_list = await collectTierBasedPlayers(tier, match_goal, [2, 3], [1, 2]);
            
            if (puuid_seed_list.size === 0) {
                console.log(`(WARNING) No seed players found for ${tier}. Skipping to next tier.`);
                continue;
            }
            
            // Accumulate all seed PUUIDs
            puuid_seed_list.forEach(puuid => all_puuid_seeds.add(puuid));
            
            // Stage 2: Collect matches from players
            await collectMatchesFromPlayers(puuid_seed_list, RIOT_MATCH_REGION);
        }
        
        console.log(`\n(INFO) ========================================`);
        console.log(`(INFO) All Tiers Processed`);
        console.log(`(INFO) Total unique seed players: ${all_puuid_seeds.size}`);
        console.log(`(INFO) ========================================`);
        
        // --- STAGE 3: DELETE ORPHANED PLAYERS ---
        console.log(`\n(INFO) ========================================`);
        console.log(`(INFO) Stage 3: Cleanup`);
        console.log(`(INFO) ========================================`);
        await cleanUpOrphanedPlayers();
        
        // --- STAGE 4: ENRICH PLAYER ACCOUNT DATA (OPTIONAL) ---
        if (enrich_account) {
            console.log(`\n(INFO) ========================================`);
            console.log(`(INFO) Stage 4: Account Enrichment (ENABLED)`);
            console.log(`(INFO) ========================================`);
            await enrichPlayerAccounts();
        } else {
            console.log(`\n(INFO) Stage 4: Account Enrichment (SKIPPED - disabled via CLI)`);
        }
        
        // --- STAGE 5: ENRICH PLAYER LEAGUE DATA (OPTIONAL) ---
        if (enrich_league) {
            console.log(`\n(INFO) ========================================`);
            console.log(`(INFO) Stage 5: League Enrichment (ENABLED)`);
            console.log(`(INFO) ========================================`);
            await enrichPlayerLeagues();
        } else {
            console.log(`\n(INFO) Stage 5: League Enrichment (SKIPPED - disabled via CLI)`);
        }
        
        console.log(`\n(INFO) ========================================`);
        console.log(`(OK) ✅ Data Collection Pipeline Complete!`);
        console.log(`(INFO) ========================================`);
        console.log(`(INFO) Summary:`);
        console.log(`  - Tiers processed: ${tiers.join(', ')}`);
        console.log(`  - Matches per tier: ${match_goal}`);
        console.log(`  - Total unique players: ${all_puuid_seeds.size}`);
        console.log(`  - Account enrichment: ${enrich_account ? 'YES' : 'NO'}`);
        console.log(`  - League enrichment: ${enrich_league ? 'YES' : 'NO'}`);
        console.log(`(INFO) ========================================`);
        
    } catch (error) {
        console.error(`\n(ERROR) ========================================`);
        console.error(`(ERROR) Fatal error in pipeline:`);
        console.error(`(ERROR) ========================================`);
        console.error(error);
        console.error(`(ERROR) ========================================`);
        process.exit(1);
    }
}

// Execute main pipeline
runPipeline();