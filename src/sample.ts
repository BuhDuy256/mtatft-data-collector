// src/crawler.ts
import { supabase } from './database/supabaseClient';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// --- 1. CONFIGURATION ---
const RIOT_API_KEY = process.env.RIOT_API_KEY!;
if (!RIOT_API_KEY) throw new Error("RIOT_API_KEY not found in .env");

const RIOT_PLATFORM_ID = 'vn2'; // vn2, na1, kr...
const RIOT_MATCH_REGION = 'sea'; // sea, americas, asia...
const RIOT_ACCOUNT_REGION = process.env.RIOT_ACCOUNT_REGION!; // asia, americas...
if (!RIOT_ACCOUNT_REGION) throw new Error("RIOT_ACCOUNT_REGION not found in .env");

const MATCH_GOAL = 2000;
const RATE_LIMIT_DELAY = 1200; // 1.2 seconds

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPER: API Call with Retry Logic ---
async function apiCallWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '10');
        console.warn(`(WARNING) Rate limited! Waiting ${retryAfter}s... (Attempt ${attempt}/${maxRetries})`);
        await sleep(retryAfter * 1000);
        if (attempt === maxRetries) throw error;
      } else {
        throw error;
      }
    }
  }
  throw new Error("API call failed after retries");
}
// --- 3 AXIOS INSTANCES ---
const platformApi: AxiosInstance = axios.create({
  baseURL: `https://${RIOT_PLATFORM_ID}.api.riotgames.com`,
  headers: { "X-Riot-Token": RIOT_API_KEY }
});

const matchApi: AxiosInstance = axios.create({
  baseURL: `https://${RIOT_MATCH_REGION}.api.riotgames.com`,
  headers: { "X-Riot-Token": RIOT_API_KEY }
});

const accountApi: AxiosInstance = axios.create({
  baseURL: `https://${RIOT_ACCOUNT_REGION}.api.riotgames.com`,
  headers: { "X-Riot-Token": RIOT_API_KEY }
});

// --- TYPE DEFINITIONS ---
interface RiotLeaguePlayer { puuid: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number; }
interface RiotAccount { puuid: string; gameName: string; tagLine: string; }
interface RiotLeagueEntry { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number; }
interface RiotMatchParticipant { puuid: string; }
interface RiotMatchInfo { participants: RiotMatchParticipant[]; game_version: string; }
interface RiotMatchDetail { metadata: { match_id: string; }; info: RiotMatchInfo; }


// --- STAGE 1: COLLECT SEED PLAYERS ---
async function runStage1_SeedPlayers(): Promise<Set<string>> {
  console.log("--- STAGE 1: Starting to collect Seed Players ---");
  const puuidSeedList = new Set<string>();
  try {
    const response = await apiCallWithRetry(() => platformApi.get(`/tft/league/v1/challenger`));
    await sleep(RATE_LIMIT_DELAY);
    const players = response.data.entries as RiotLeaguePlayer[];
    
    // Update rank for seed players
    const playersToUpsert = players.map(p => ({
      puuid: p.puuid, tier: p.tier, rank: p.rank,
      league_points: p.leaguePoints, wins: p.wins, losses: p.losses,
      last_updated: new Date()
    }));
    
    const { error: upsertError } = await supabase.from('players').upsert(playersToUpsert, { onConflict: 'puuid' });
    if (upsertError) {
      console.error("(ERROR) Error upserting seed players:", upsertError.message, upsertError.details);
    }

    players.forEach(p => puuidSeedList.add(p.puuid));
    console.log(`(OK) Successfully collected ${puuidSeedList.size} seed PUUIDs.`);
    return puuidSeedList;
  } catch (error) {
    if (isAxiosError(error)) {
      console.error("(ERROR) API Error:", error.response?.status, error.response?.data);
    } else {
      console.error("(ERROR) Stage 1 Error:", error instanceof Error ? error.message : String(error));
    }
    return puuidSeedList;
  }
}

// --- STAGE 2: CRAWL MATCHES (Create Stubs) ---
async function runStage2_CrawlMatches(puuidSeedList: Set<string>) {
  console.log("--- STAGE 2: Starting to crawl 1000 matches ---");
  const matchIdToCrawl = new Set<string>();
  let i = 0;

  console.log("Fetching Match IDs from seed players...");
  for (const puuid of puuidSeedList) {
    i++;
    console.log(`[Seed ${i}/${puuidSeedList.size}] Fetching ${puuid.substring(0, 10)}...`);
    try {
      const response = await apiCallWithRetry(() => 
        matchApi.get(`/tft/match/v1/matches/by-puuid/${puuid}/ids`, { params: { count: 20 } })
      );
      await sleep(RATE_LIMIT_DELAY);
      (response.data as string[]).forEach(id => matchIdToCrawl.add(id));
      console.log(`... Found ${response.data.length} match IDs.`);
    } catch (error) {
      if (isAxiosError(error)) {
        console.warn(`(WARNING) API Error for ${puuid.substring(0, 10)}: ${error.response?.status}`);
      } else {
        console.warn(`(WARNING) Error fetching match IDs for ${puuid}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  console.log(`Found ${matchIdToCrawl.size} unique Match IDs to crawl.`);

  let crawlCount = 0;
  for (const matchId of matchIdToCrawl) {
    const { count: currentMatchCount } = await supabase
      .from('matches').select('match_id', { count: 'exact', head: true });
      
    if (currentMatchCount !== null && currentMatchCount >= MATCH_GOAL) {
      console.log(`(OK) Reached goal of ${MATCH_GOAL} matches. Stopping crawl.`);
      break;
    }
    console.log(`[Match ${currentMatchCount || 0}/${MATCH_GOAL}] Processing ${matchId}`);

    const { error: insertError } = await supabase.from('matches').insert({
      match_id: matchId, data: {}, region: RIOT_PLATFORM_ID, is_processed: false
    });

    if (insertError) {
      if (insertError.code === '23505') {
        console.log("... Match already exists. Skipping.");
      } else {
        console.error("(ERROR) Error inserting match_id:", insertError.message, insertError.details);
      }
      continue;
    }

    crawlCount++;
    let matchDetails: RiotMatchDetail;
    try {
      const response = await apiCallWithRetry(() => matchApi.get(`/tft/match/v1/matches/${matchId}`));
      await sleep(RATE_LIMIT_DELAY);
      matchDetails = response.data as RiotMatchDetail;
    } catch (error) {
      if (isAxiosError(error)) {
        console.error(`(ERROR) API Error for ${matchId}: ${error.response?.status}`, error.response?.data);
      } else {
        console.error(`(ERROR) Error fetching details for ${matchId}:`, error instanceof Error ? error.message : String(error));
      }
      await supabase.from('matches').delete().eq('match_id', matchId);
      crawlCount--;
      continue;
    }

    // 1. Update NoSQL (jsonb)
    const { error: updateError } = await supabase.from('matches').update({ data: matchDetails.info }).eq('match_id', matchId);
    if (updateError) {
      console.error("(ERROR) Error updating match data:", updateError.message, updateError.details);
    }

    // 2. Prepare 8 player "stubs" and 8 "links"
    const participants = matchDetails.info.participants;
    
    // 2a. Create player stubs (only puuid)
    //     Use 'ignoreDuplicates: true' to avoid errors if player already exists
    const playersToUpsert = participants.map(p => ({ puuid: p.puuid }));
    const { error: playerError } = await supabase.from('players').upsert(playersToUpsert, { 
      onConflict: 'puuid', 
      ignoreDuplicates: true 
    });
    if (playerError) {
      console.error("(ERROR) Error upserting players:", playerError.message, playerError.details);
    }
    
    // 2b. Create links
    const linksToInsert = participants.map(p => ({
      puuid: p.puuid,
      match_id: matchId
    }));
    const { error: linkError } = await supabase.from('players_matches_link').upsert(linksToInsert, { 
      onConflict: 'puuid,match_id', 
      ignoreDuplicates: true 
    });
    if (linkError) {
      console.error("(ERROR) Error inserting links:", linkError.message, linkError.details);
    }
  }
  console.log(`(OK) Stage 2 Complete. Crawled ${crawlCount} new matches.`);
}

// --- STAGE 3: CLEAN UP ---
async function runStage3_CleanUp() {
  console.log("--- STAGE 3: Cleaning up orphaned players ---");
  // Call SQL function 'delete_orphaned_players'
  const { error } = await supabase.rpc('delete_orphaned_players');
  if (error) {
    console.error("(ERROR) Error cleaning up:", error.message, error.details);
  } else {
    console.log("(OK) Cleanup successful.");
  }
}

// --- STAGE 4: ENRICH NAMES ---
async function runStage4_EnrichNames() {
  console.log("--- STAGE 4: Starting to enrich player names (gameName/tagLine) ---");
  const { data: players, error } = await supabase
    .from('players').select('puuid').is('game_name', null);

  if (error || !players || players.length === 0) {
    console.log("(OK) No players missing names.");
    return;
  }

  console.log(`Found ${players.length} players needing name updates.`);
  let i = 0;
  for (const player of players) {
    i++;
    console.log(`[Name ${i}/${players.length}] Fetching name for ${player.puuid.substring(0, 10)}...`);
    try {
      const response = await apiCallWithRetry(() => 
        accountApi.get<RiotAccount>(`/riot/account/v1/accounts/by-puuid/${player.puuid}`)
      );
      await sleep(RATE_LIMIT_DELAY);
      const account = response.data;
      
      const { error: updateError } = await supabase.from('players').update({
        game_name: account.gameName,
        tag_line: account.tagLine,
        last_updated: new Date()
      }).eq('puuid', player.puuid);
      
      if (updateError) {
        console.error("(ERROR) Error updating player name:", updateError.message);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        console.warn(`(WARNING) API Error for ${player.puuid.substring(0, 10)}: ${error.response?.status}`);
        if (error.response?.status === 404) {
          await supabase.from('players').update({ game_name: 'NOT_FOUND' }).eq('puuid', player.puuid);
        }
      } else {
        console.warn(`(WARNING) Error fetching name for ${player.puuid}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  console.log("(OK) Name enrichment complete.");
}

// --- STAGE 5: ENRICH RANKS ---
async function runStage5_EnrichRanks() {
    console.log("--- STAGE 5: Starting to enrich player ranks ---");
    const { data: players, error } = await supabase
        .from('players').select('puuid').is('tier', null);

    if (error || !players || players.length === 0) {
        console.log("(OK) No players missing ranks.");
        return;
    }

    console.log(`Found ${players.length} players needing rank updates.`);
    let i = 0;
    for (const player of players) {
        i++;
        console.log(`[Rank ${i}/${players.length}] Fetching rank for ${player.puuid.substring(0, 10)}...`);
        try {
        const response = await apiCallWithRetry(() =>
            platformApi.get<RiotLeagueEntry[]>(`/tft/league/v1/entries/by-puuid/${player.puuid}`)
        );
        await sleep(RATE_LIMIT_DELAY);

        const leagueEntries = response.data;
        const rankedTftInfo = leagueEntries.find(e => e.queueType === 'RANKED_TFT');

        if (rankedTftInfo) {
            const { error: updateError } = await supabase.from('players').update({
            tier: rankedTftInfo.tier,
            rank: rankedTftInfo.rank,
            league_points: rankedTftInfo.leaguePoints,
            wins: rankedTftInfo.wins,
            losses: rankedTftInfo.losses,
            last_updated: new Date()
            }).eq('puuid', player.puuid);
            
            if (updateError) {
            console.error("(ERROR) Error updating player rank:", updateError.message);
            }
        } else {
            await supabase.from('players').update({ tier: 'UNRANKED' }).eq('puuid', player.puuid);
        }
        } catch (error) {
        if (isAxiosError(error)) {
            console.warn(`(WARNING) API Error for ${player.puuid.substring(0, 10)}: ${error.response?.status}`);
            if (error.response?.status === 404) {
            await supabase.from('players').update({ tier: 'UNRANKED' }).eq('puuid', player.puuid);
            }
        } else {
            console.warn(`(WARNING) Error fetching rank for ${player.puuid}:`, error instanceof Error ? error.message : String(error));
        }
        }
    }
    console.log("(OK) Rank enrichment complete.");
}


// --- MAIN FUNCTION (Pipeline) ---
async function main() {
  console.log("=== STARTING CRAWLER PIPELINE ===");
  try {
    const seedList = await runStage1_SeedPlayers();
    if (seedList.size > 0) {
      await runStage2_CrawlMatches(seedList);
      await runStage3_CleanUp();
      await runStage4_EnrichNames();
      await runStage5_EnrichRanks();
    } else {
      console.log("No seed list found. Stopping.");
    }
  } catch (error) {
    console.error("CRITICAL CRAWLER ERROR:", error);
  }
  console.log("=== CRAWLER PIPELINE COMPLETE ===");
}

main();