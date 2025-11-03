import fs from 'fs';
import path from 'path';
import { supabase } from './database/supabaseClient';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as dotenv from 'dotenv'; // For loading environment variables. Docs: https://www.npmjs.com/package/dotenv
import { z } from 'zod'; // For runtime validation. Docs: https://zod.dev/api

import type { RiotLeagueRegion, RiotMatchRegion, RiotAccountRegion } from './utils/constant';
import { 
    TierSchema, 
    HIGH_TIERS, 
    LOW_TIERS,
    isHighTier,
    isLowTier,
    type Tier,
    type HighTier, 
    type LowTier, 
    type Division, 
    fetchHighTierPlayers,
    fetchTierBasedPlayers
} from './features/player_collector/seedPlayerCollector';
import { pagesToFetch } from './utils/constant';

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

// --- MAIN FUNCTION ---
async function main() {
  try {
    console.log(`(INFO) Starting data collection for tier: ${tier}, match goal: ${match_goal}`);
    
    // --- STAGE 1: COLLECT TIER-BASED PLAYERS ---
    console.log(`(INFO) Stage 1: Collecting players...`);
    const players = await fetchTierBasedPlayers(tier, pagesToFetch);
    console.log(players.length);
    
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





