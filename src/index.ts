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
import { collectMatchIDBaseOnPlayerPUUIDs, fetchAndSaveMatchDetails, type MatchDetailResult } from './services/matchCollectorService';
import { fetchAndSavePlayerAccounts } from './services/accountCollectorService';
import { fetchAndSavePlayerLeagues } from './services/leagueCollectorService';

// Mappers
import { mapRiotPlayersToDB } from './mappers/PlayerMapper';

// Repository
import { upsertPlayers, updatePlayerAccount, updatePlayerLeague, getAllPlayerPuuids, deletePlayersWithoutMatches } from './repository/playerRepository';
import { upsertPlayerStubs, upsertPlayerMatchLinks } from './repository/matchRepository';

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
 * STAGE 2: Collect matches từ seed players (STREAM VERSION)
 * Fetch match và SAVE NGAY vào DB, không đợi fetch hết
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
    
    let matchCount = 0;
    let totalPlayers = new Set<string>();
    let totalLinks = 0;
    
    // Step 2: Fetch và save ngay từng match
    await fetchAndSaveMatchDetails(matchIdSet, region, async (matchResult: MatchDetailResult) => {
        matchCount++;
        
        // Save match vào DB
        const matchDB: MatchDB = {
            match_id: matchResult.matchId,
            data: matchResult.fullMatchData,
            is_processed: false,
            region: region
        };
        
        const { upsertMatch } = await import('./repository/matchRepository');
        await upsertMatch(matchDB);
        
        // Upsert player stubs
        await upsertPlayerStubs(matchResult.playerPuuids);
        matchResult.playerPuuids.forEach(puuid => totalPlayers.add(puuid));
        
        // Tạo links
        const links: PlayerMatchLinkDB[] = matchResult.playerPuuids.map(puuid => ({
            puuid,
            match_id: matchResult.matchId
        }));
        await upsertPlayerMatchLinks(links);
        totalLinks += links.length;
    });
    
    console.log(`(OK) Stage 2 Complete!`);
    console.log(`    - Matches saved: ${matchCount}`);
    console.log(`    - Unique players found: ${totalPlayers.size}`);
    console.log(`    - Links created: ${totalLinks}`);
}

/**
 * STAGE 4: Enrich player account data (STREAM VERSION)
 * Fetch account và SAVE NGAY vào DB
 */
async function enrichPlayerAccounts(): Promise<void> {
    console.log(`(INFO) Stage 4: Enriching player account data...`);
    
    // Lấy tất cả player PUUIDs
    const allPuuids = await getAllPlayerPuuids();
    
    if (allPuuids.length === 0) {
        console.log("(WARNING) No players found in database. Skipping Stage 4.");
        return;
    }
    
    console.log(`(INFO) Updating account info for ${allPuuids.length} players...`);
    
    // Fetch và save ngay từng account
    const updatedCount = await fetchAndSavePlayerAccounts(allPuuids, async (account) => {
        await updatePlayerAccount(account.puuid, account.gameName, account.tagLine);
    });
    
    console.log(`(OK) Stage 4 Complete!`);
    console.log(`    - Total players: ${allPuuids.length}`);
    console.log(`    - Successfully updated: ${updatedCount}`);
}

/**
 * STAGE 5: Enrich player league data (STREAM VERSION)
 * Fetch league và SAVE NGAY vào DB, chỉ lấy RANKED_TFT
 */
async function enrichPlayerLeagues(): Promise<void> {
    console.log(`(INFO) Stage 5: Enriching player league data (RANKED_TFT only)...`);
    
    // Lấy tất cả player PUUIDs
    const allPuuids = await getAllPlayerPuuids();
    
    if (allPuuids.length === 0) {
        console.log("(WARNING) No players found in database. Skipping Stage 5.");
        return;
    }
    
    console.log(`(INFO) Updating league info for ${allPuuids.length} players...`);
    
    // Fetch và save ngay từng league entry
    const updatedCount = await fetchAndSavePlayerLeagues(allPuuids, async (league) => {
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
    console.log(`    - Total players: ${allPuuids.length}`);
    console.log(`    - Successfully updated: ${updatedCount}`);
}

/**
 * STAGE 3: Clean up orphaned players
 * Xóa players không có match nào trong database
 * Sử dụng SQL stored procedure để performance tốt hơn
 */
async function cleanUpOrphanedPlayers(): Promise<void> {
    console.log(`(INFO) Stage 3: Cleaning up orphaned players...`);
    
    const deletedCount = await deletePlayersWithoutMatches();
    
    console.log(`(OK) Stage 3 Complete!`);
    console.log(`    - Orphaned players deleted: ${deletedCount}`);
}

// --- MAIN FUNCTION ---
async function main() {
    try {
        console.log(`(INFO) Starting data collection for tier: ${tier}, match goal: ${match_goal}`);
        
        // --- STAGE 1: COLLECT TIER-BASED PLAYERS ---
        const puuidSeedList = await collectPlayersBaseOnTier(tier, match_goal, [2, 3], [1, 2]);
        
        if (puuidSeedList.size === 0) {
            console.log("(WARNING) No seed players found. Stopping.");
            return;
        }
        
        // --- STAGE 2: COLLECT MATCHES ---
        await collectMatchBaseOnPlayerPUUIDs(puuidSeedList, RIOT_MATCH_REGION);
        
        // --- STAGE 3: DELETE ALL PLAYERS DON'T HAVE MATCH IN DATABASE ---
        await cleanUpOrphanedPlayers();
        
        // --- STAGE 4: COLLECT PLAYER ACCOUNT DATA ---
        await enrichPlayerAccounts();
        
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





