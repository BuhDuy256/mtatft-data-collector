import fs from 'fs';
import path from 'path';
import { supabase } from './database/supabaseClient';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as dotenv from 'dotenv'; // For loading environment variables. Docs: https://www.npmjs.com/package/dotenv
import { z } from 'zod'; // For runtime validation. Docs: https://zod.dev/api

import type { RiotLeagueRegion, RiotMatchRegion, RiotAccountRegion } from './utils/constant';
import { leagueApi, matchApi, accountApi } from './service/api';
import { 
    TierSchema, 
    HIGH_TIERS, 
    LOW_TIERS,
    isHighTier,
    isLowTier,
    type Tier,
    type HighTier, 
    type LowTier, 
    type Division 
} from './features/player_collector/seedPlayerCollector';

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

const TIER: Tier = parsedTier.data;
const MATCH_GOAL = parseInt(matchGoalArg || '');

if (isNaN(MATCH_GOAL)) {
  throw new Error(
    `(ERROR) Match goal argument is required and must be a number. Usage: npm start <TIER> <MATCH_GOAL>`
  );
}

console.log(`(INFO) Starting data collection for tier: ${TIER}, match goal: ${MATCH_GOAL}`);

// --- STAGE 1: COLLECT TIER-BASED PLAYERS ---
// --- STAGE 2: COLLECT MATCHES ---
// --- STAGE 3: DELETE ALL PLAYERS DON'T HAVE MATCH IN DATABASE ---
// --- STAGE 3: COLLECT PLAYER ACCOUNT DATA ---
// --- STAGE 4: COLLECT PLAYER LEAGUE DATA --- 





