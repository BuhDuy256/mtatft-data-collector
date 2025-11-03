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
import { fecthPlayersBasedTier } from './services/playerCollectorService';
import { randomPlayersBasedOnMatchGoal } from './services/playerSelectionService';
import { collectMatchIDBaseOnPlayerPUUIDs, collectMatchDetail } from './services/matchCollectorService';
import { fetchPlayerAccounts } from './services/accountCollectorService';
import { fetchPlayerLeagues } from './services/leagueCollectorService';

// Mappers
import { mapRiotPlayersToDB } from './mappers/PlayerMapper';
import { mapRiotAccountsToPlayerUpdates } from './mappers/AccountMapper';
import { mapRiotLeaguesToPlayerUpdates } from './mappers/LeagueMapper';

// Repository
import { upsertPlayers, batchUpdatePlayerAccounts, batchUpdatePlayerLeagues, getAllPlayerPuuids } from './repository/playerRepository';
import { upsertMatches, upsertPlayerStubs, upsertPlayerMatchLinks } from './repository/matchRepository';

// Models
import type { MatchDB, PlayerMatchLinkDB } from './models/database/MatchDBMode';

// Utils
import { RIOT_MATCH_REGION } from './utils/api';

// --- LOG ---
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logFile = path.join(logDir, 'index.log');

const logStream = fs.createWriteStream(logFile, { flags: 'a' });

['log', 'error', 'warn', 'info', 'debug'].forEach((method) => {
    const original = (console as any)[method];
    (console as any)[method] = (...args: any[]) => {
        const message = args.map(String).join(' ');
        const timestamp = new Date().toISOString();
        logStream.write(`[${timestamp}] [${method.toUpperCase()}] ${message}\n`);
        original.apply(console, args);
    };
});

// --- CLI ARGUMENTS --- 
const args = process.argv.slice(2);
const tierArg = args[0];
const matchGoalArg = args[1];

const parsedTier = TierSchema.safeParse(tierArg);

if (!parsedTier.success) {
    const allTiers = [...HIGH_TIERS, ...LOW_TIERS].join(', ');
    throw new Error(
        `(ERROR) Invalid tier: "${tierArg}". Must be one of: ${allTiers}`
    );
}

const tier: Tier = parsedTier.data;
const match_goal = parseInt(matchGoalArg || '');

if (isNaN(match_goal)) {
    throw new Error(
        `(ERROR) Match goal argument is required and must be a number. Usage: npm start <TIER> <MATCH_GOAL>`
    );
}

/**
 * STAGE 1: Collect tier-based players and insert into database
 * @returns Set of PUUIDs that were successfully inserted into DB
 */
async function collectPlayersBaseOnTier(
    tier: Tier, 
    matchGoal: number,
    divisions: Division[] = [1, 2, 3, 4],
    pages: number[] = [1]
): Promise<Set<string>> {
    console.log(`(INFO) Stage 1: Collecting players...`);
    
    // Step 1: Fetch and select players
    const raw_players = await fecthPlayersBasedTier(tier, divisions, pages);
    const players = randomPlayersBasedOnMatchGoal(raw_players, matchGoal);
    const players_to_upsert = mapRiotPlayersToDB(players);

    // Step 2: Upsert to database via repository
    const upsertedPuuids = await upsertPlayers(players_to_upsert);
    
    // Step 3: Build Set from successfully upserted PUUIDs
    const puuidSeedList = new Set<string>(upsertedPuuids);
    
    console.log(`    - Seed list contains ${puuidSeedList.size} unique PUUIDs`);
    
    return puuidSeedList;
}

/**
 * STAGE 2: Collect matches từ seed players
 * 1. Lấy match IDs từ players
 * 2. Fetch full match details từ API
 * 3. Lưu full JSON vào DB (JSONB)
 * 4. Extract players từ match và upsert vào DB (chỉ puuid, các field khác NULL)
 * 5. Tạo links giữa players và matches
 */
async function collectMatchBaseOnPlayerPUUIDs(
    puuid_seed_list: Set<string>,
    region: string
): Promise<void> {
    console.log(`(INFO) Stage 2: Collecting matches from ${puuid_seed_list.size} seed players...`);
    
    // Step 1: Lấy match IDs từ seed players
    const matchIdSet = await collectMatchIDBaseOnPlayerPUUIDs(puuid_seed_list);
    
    if (matchIdSet.size === 0) {
        console.log("(WARNING) No match IDs found.");
        return;
    }
    
    // Step 2: Fetch match details và lưu vào DB
    const matchResults = await collectMatchDetail(matchIdSet, region);
    
    // Step 3: Prepare data để insert vào DB
    const matchesToInsert: MatchDB[] = matchResults.map(result => ({
        match_id: result.matchId,
        data: result.fullMatchData, // Full JSON vào JSONB column
        is_processed: false,
        region: region
    }));
    
    // Step 4: Upsert matches vào DB
    console.log(`(INFO) Upserting ${matchesToInsert.length} matches to database...`);
    await upsertMatches(matchesToInsert);
    
    // Step 5: Extract tất cả player PUUIDs từ matches và upsert vào DB
    const allPlayerPuuids = new Set<string>();
    matchResults.forEach(result => {
        result.playerPuuids.forEach(puuid => allPlayerPuuids.add(puuid));
    });
    
    console.log(`(INFO) Found ${allPlayerPuuids.size} unique players across all matches.`);
    console.log(`(INFO) Upserting player stubs (puuid only, other fields NULL)...`);
    await upsertPlayerStubs(Array.from(allPlayerPuuids));
    
    // Step 6: Tạo links giữa players và matches
    const links: PlayerMatchLinkDB[] = [];
    matchResults.forEach(result => {
        result.playerPuuids.forEach(puuid => {
            links.push({
                puuid,
                match_id: result.matchId
            });
        });
    });
    
    console.log(`(INFO) Creating ${links.length} player-match links...`);
    await upsertPlayerMatchLinks(links);
    
    console.log(`(OK) Stage 2 Complete!`);
    console.log(`    - Matches collected: ${matchesToInsert.length}`);
    console.log(`    - Unique players found: ${allPlayerPuuids.size}`);
    console.log(`    - Links created: ${links.length}`);
}

/**
 * STAGE 4: Enrich player account data (game_name, tag_line)
 * Update account info cho TẤT CẢ players trong database
 * 1. Lấy tất cả player PUUIDs
 * 2. Fetch account data từ Riot API
 * 3. Update vào DB
 */
async function enrichPlayerAccounts(): Promise<void> {
    console.log(`(INFO) Stage 4: Enriching player account data...`);
    
    // Step 1: Lấy TẤT CẢ player PUUIDs từ database
    const allPuuids = await getAllPlayerPuuids();
    
    if (allPuuids.length === 0) {
        console.log("(WARNING) No players found in database. Skipping Stage 4.");
        return;
    }
    
    console.log(`(INFO) Updating account info for ${allPuuids.length} players...`);
    
    // Step 2: Fetch account data từ Riot API
    const accounts = await fetchPlayerAccounts(allPuuids);
    
    if (accounts.length === 0) {
        console.log("(WARNING) No accounts fetched. Skipping update.");
        return;
    }
    
    // Step 3: Map sang DB format
    const updates = accounts.map(account => ({
        puuid: account.puuid,
        gameName: account.gameName,
        tagLine: account.tagLine
    }));
    
    // Step 4: Batch update vào DB
    const updatedCount = await batchUpdatePlayerAccounts(updates);
    
    console.log(`(OK) Stage 4 Complete!`);
    console.log(`    - Total players: ${allPuuids.length}`);
    console.log(`    - Accounts fetched: ${accounts.length}`);
    console.log(`    - Successfully updated: ${updatedCount}`);
}

/**
 * STAGE 5: Enrich player league data (tier, rank, LP, wins, losses, etc.)
 * Update league info cho TẤT CẢ players, chỉ lấy RANKED_TFT queue
 * 1. Lấy tất cả player PUUIDs
 * 2. Fetch league data từ Riot API (filter RANKED_TFT)
 * 3. Update vào DB
 */
async function enrichPlayerLeagues(): Promise<void> {
    console.log(`(INFO) Stage 5: Enriching player league data (RANKED_TFT only)...`);
    
    // Step 1: Lấy TẤT CẢ player PUUIDs từ database
    const allPuuids = await getAllPlayerPuuids();
    
    if (allPuuids.length === 0) {
        console.log("(WARNING) No players found in database. Skipping Stage 5.");
        return;
    }
    
    console.log(`(INFO) Updating league info for ${allPuuids.length} players...`);
    
    // Step 2: Fetch league data từ Riot API (chỉ RANKED_TFT)
    const leagues = await fetchPlayerLeagues(allPuuids);
    
    if (leagues.length === 0) {
        console.log("(WARNING) No RANKED_TFT league entries fetched. Skipping update.");
        return;
    }
    
    // Step 3: Map sang DB format
    const updates = mapRiotLeaguesToPlayerUpdates(leagues);
    
    // Step 4: Batch update vào DB
    const updatedCount = await batchUpdatePlayerLeagues(updates);
    
    console.log(`(OK) Stage 5 Complete!`);
    console.log(`    - Total players: ${allPuuids.length}`);
    console.log(`    - RANKED_TFT entries fetched: ${leagues.length}`);
    console.log(`    - Successfully updated: ${updatedCount}`);
}

// --- MAIN FUNCTION ---
async function main() {
    try {
        // console.log(`(INFO) Starting data collection for tier: ${tier}, match goal: ${match_goal}`);
        
        // // --- STAGE 1: COLLECT TIER-BASED PLAYERS ---
        // const puuidSeedList = await collectPlayersBaseOnTier(tier, match_goal, [2, 3], [1, 2]);
        
        // if (puuidSeedList.size === 0) {
        //     console.log("(WARNING) No seed players found. Stopping.");
        //     return;
        // }
        
        // // --- STAGE 2: COLLECT MATCHES ---
        // await collectMatchBaseOnPlayerPUUIDs(puuidSeedList, RIOT_MATCH_REGION);
        
        // // --- STAGE 3: DELETE ALL PLAYERS DON'T HAVE MATCH IN DATABASE ---
        // // TODO: Implement later
        
        // // --- STAGE 4: COLLECT PLAYER ACCOUNT DATA ---
        // await enrichPlayerAccounts();
        
        // --- STAGE 5: COLLECT PLAYER LEAGUE DATA ---
        await enrichPlayerLeagues();
        
        console.log(`(OK) Data collection complete!`);
    } catch (error) {
        console.error(`(ERROR) Fatal error in main:`, error);
        process.exit(1);
    }
}

// Run main function
main(); 





