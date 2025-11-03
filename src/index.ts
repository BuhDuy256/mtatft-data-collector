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

// Mappers
import { mapRiotPlayersToDB } from './mappers/PlayerMapper';

// Repository
import { upsertPlayers } from './repository/playerRepository';

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

async function collectMatchBaseOnPlayerPUUIDs(puuid_seed_list: Set<string>) {
    
}

// --- MAIN FUNCTION ---
async function main() {
    try {
        console.log(`(INFO) Starting data collection for tier: ${tier}, match goal: ${match_goal}`);
        
        // --- STAGE 1: COLLECT TIER-BASED PLAYERS ---
        const puuidSeedList = await collectPlayersBaseOnTier(tier, match_goal, [2, 3], [1, 2]);
        
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





