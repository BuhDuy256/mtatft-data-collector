import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseClient';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as dotenv from 'dotenv'; // For loading environment variables. Docs: https://www.npmjs.com/package/dotenv
import { z } from 'zod'; // For runtime validation. Docs: https://zod.dev/api

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

// --- ENV VARIABLES ---
dotenv.config();

const RIOT_API_KEY = process.env.RIOT_API_KEY;
if (!RIOT_API_KEY) {
    throw new Error('RIOT_API_KEY is not defined in environment variables');
}

type RiotLeagueRegion = 'na1' | 'br1' | 'eun1' | 'euw1' | 'jp1' | 'kr' | 'la1' | 'la2' | 'oc1' | 'tr1' | 'ru' | 'vn2';
type RiotMatchRegion = 'americas' | 'asia' | 'europe' | 'sea';
type RiotAccountRegion = 'americas' | 'europe' | 'asia';
const RIOT_LEAGUE_REGION: RiotLeagueRegion = 'vn2';
const RIOT_MATCH_REGION: RiotMatchRegion = 'sea';
const RIOT_ACCOUNT_REGION: RiotAccountRegion = 'asia';

// --- CLI ARGUMENTS --- 
const TierSchema = z.enum([
    'iron',
    'bronze',
    'silver',
    'gold',
    'platinum',
    'diamond',
    'master',
    'grandmaster',
    'challenger',
]);

type Tier = z.infer<typeof TierSchema>;

const args = process.argv.slice(2);
const tierArg = args[0];
const matchGoalArg = args[1];

const parsedTier = TierSchema.safeParse(tierArg);

if (!parsedTier.success) {
  throw new Error(
    `(ERROR) Invalid tier: "${tierArg}". Must be one of: ${TierSchema.options.join(', ')}`
  );
}

const TIER: Tier = parsedTier.data;
const MATCH_GOAL = parseInt(matchGoalArg || '');

if (isNaN(MATCH_GOAL)) {
  throw new Error(
    `(ERROR) Match goal argument is required and must be a number. Usage: npm start <TIER> <MATCH_GOAL>`
  );
}