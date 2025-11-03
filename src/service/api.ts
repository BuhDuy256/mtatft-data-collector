import axios, { AxiosInstance } from 'axios';
import { RiotLeagueRegion, RiotMatchRegion, RiotAccountRegion } from '../utils/constant';
import * as dotenv from 'dotenv';

dotenv.config();

const RIOT_LEAGUE_REGION: RiotLeagueRegion = 'vn2';
const RIOT_MATCH_REGION: RiotMatchRegion = 'sea';
const RIOT_ACCOUNT_REGION: RiotAccountRegion = 'asia';

const RIOT_API_KEY = process.env.RIOT_API_KEY;
if (!RIOT_API_KEY) {
    throw new Error('RIOT_API_KEY is not defined in environment variables');
}

const HighTierLeagueApi: AxiosInstance = axios.create({
    baseURL: `https://${RIOT_LEAGUE_REGION}.api.riotgames.com`,
    headers: { "X-Riot-Token": RIOT_API_KEY }
});

const LowTierLeagueApi: AxiosInstance = axios.create({
    baseURL: `https://${RIOT_LEAGUE_REGION}.api.riotgames.com`,
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

export { HighTierLeagueApi, LowTierLeagueApi, matchApi, accountApi };