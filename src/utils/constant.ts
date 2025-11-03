export type RiotLeagueRegion = 'na1' | 'br1' | 'eun1' | 'euw1' | 'jp1' | 'kr' | 'la1' | 'la2' | 'oc1' | 'tr1' | 'ru' | 'vn2';
export type RiotMatchRegion = 'americas' | 'asia' | 'europe' | 'sea';
export type RiotAccountRegion = 'americas' | 'europe' | 'asia';
export const RATE_LIMIT_DELAY = 1300; // in milliseconds
export const MATCHES_PER_PLAYER = 20; // Riot API returns max 20 match IDs per player