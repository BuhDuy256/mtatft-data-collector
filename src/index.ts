import fs from 'fs';
import path from 'path';
import { supabase } from './database/supabaseClient';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as dotenv from 'dotenv'; // For loading environment variables. Docs: https://www.npmjs.com/package/dotenv
import { z } from 'zod'; // For runtime validation. Docs: https://zod.dev/api
import { RiotHighTierEntry, RiotLowTierEntry } from './features/player_collector/tier_based_players_collector';
import { randomPlayersBasedOnMatchGoal } from './features/player_collector/match_goal_based_players_collector';

import { 
    TierSchema, 
    HIGH_TIERS, 
    LOW_TIERS,
    type Tier,
    type Division,
    fecthPlayersBasedTier
} from './features/player_collector/tier_based_players_collector';
import { mapPlayersForDB } from './features/player_collector/transfer_players_for_db';

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
async function collectTierBasedPlayers(
    tier: Tier, 
    matchGoal: number,
    divisions: Division[] = [1, 2, 3, 4],
    pages: number[] = [1]
): Promise<Set<string>> {
    console.log(`(INFO) Stage 1: Collecting players...`);
    
    // Step 1: Fetch and select players
    const raw_players = await fecthPlayersBasedTier(tier, divisions, pages);
    const players = randomPlayersBasedOnMatchGoal(raw_players, matchGoal);
    const players_to_upsert = mapPlayersForDB(players);

    console.log(`(INFO) Upserting ${players_to_upsert.length} players to database...`);

    // Step 2: Upsert to database
    // Note: .upsert() with .select() returns ALL affected rows (both new inserts + updates)
    // We use this to confirm all players were successfully processed
    const { data, error: upsertError } = await supabase
        .from('players')
        .upsert(players_to_upsert, { onConflict: 'puuid' })
        .select('puuid');
    
    if (upsertError) {
        console.error("(ERROR) Error upserting seed players:", upsertError.message, upsertError.details);
        throw upsertError;
    }
    
    // Step 3: Build Set from successfully upserted players
    // This includes both newly inserted AND updated existing players
    const puuidSeedList = new Set<string>(
        players_to_upsert.map(p => p.puuid)
    );
    
    console.log(`(OK) Successfully upserted ${puuidSeedList.size} players to database.`);
    console.log(`    - DB confirmed ${data?.length || 0} rows affected`);
    console.log(`    - Seed list contains ${puuidSeedList.size} unique PUUIDs`);
    
    return puuidSeedList;
}

// --- MAIN FUNCTION ---
async function main() {
    try {
        console.log(`(INFO) Starting data collection for tier: ${tier}, match goal: ${match_goal}`);
        
        // --- STAGE 1: COLLECT TIER-BASED PLAYERS ---
        const puuidSeedList = await collectTierBasedPlayers(tier, match_goal, [2, 3], [1, 2]);
        
        // --- STAGE 2: COLLECT MATCHES ---
        
        // --- STAGE 3: DELETE ALL PLAYERS DON'T HAVE MATCH IN DATABASE ---
        
        // --- STAGE 4: COLLECT PLAYER ACCOUNT DATA ---
        
        // --- STAGE 5: COLLECT PLAYER LEAGUE DATA ---
        
        console.log(`(OK) Data collection complete!`);
    } catch (error) {
        console.error(`(ERROR) Fatal error in main:`, error);
        process.exit(1);
    }
}

// Run main function
main(); 





