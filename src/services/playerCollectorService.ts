import { LeagueApi } from '../utils/api';
import { sleep, retryOnRateLimit } from '../helper/helper';
import { RATE_LIMIT_DELAY } from '../utils/constant';
import { type HighTier, type LowTier, type Tier, type Division, isHighTier, isLowTier } from '../models/riot/RiotTierModels';
import { type RiotHighTierPlayer, type RiotLowTierPlayer, RiotHighTierResponseSchema, RiotLowTierResponseSchema } from '../models/riot/RiotPlayerModels';

export async function fetchHighTierPlayers(
    tier: HighTier
): Promise<RiotHighTierPlayer[]> {
    const response = await retryOnRateLimit(() => LeagueApi.get(`/tft/league/v1/${tier}`));
    await sleep(RATE_LIMIT_DELAY);

    const validated_data = RiotHighTierResponseSchema.parse(response.data);

    return validated_data.entries.map((player) => ({ // just get the player object data
        ...player,
        tier: tier.toUpperCase()
    }));
}

export async function fetchLowTierPlayers(
    tier: LowTier,
    division: Division,
    page: number = 1
): Promise<RiotLowTierPlayer[]> {
    const tier_upper = tier.toUpperCase();
    const response = await retryOnRateLimit(() =>
        LeagueApi.get(`/tft/league/v1/entries/${tier_upper}/${division}`, {
            params: { page }
        })
    );
    await sleep(RATE_LIMIT_DELAY);

    const validated_data = RiotLowTierResponseSchema.parse(response.data);

    return validated_data.map((player) => ({ // just get the player object data
        ...player,
        tier: player.tier.toUpperCase()
    }));
}

export async function fetchPlayersFromTier(
    tier: Tier,
    divisions: Division[] = ['I', 'II', 'III', 'IV'],
    pages: number[] = [1]
): Promise<RiotLowTierPlayer[] | RiotHighTierPlayer[]> {

    if (isHighTier(tier)) {
        console.log(`(INFO) Fetching high tier players: ${tier}`);
        return await fetchHighTierPlayers(tier);
    }

    if (isLowTier(tier)) {
        console.log(`(INFO) Fetching low tier players: ${tier} (all divisions, pages: [${pages.join(', ')}])`);
        const all_players: RiotLowTierPlayer[] = [];

        for (const division of divisions) {
            console.log(`(INFO) Fetching ${tier} division ${division}`);
            for (const page of pages) {
                try {
                    const players = await fetchLowTierPlayers(tier, division, page);
                    if (players.length === 0) {
                        console.log(`    ... Page ${page}: No players found`);
                        continue;
                    }
                    console.log(`    ... Page ${page}: ${players.length} players`);
                    all_players.push(...players);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Unknown error';
                    console.warn(`    ... Page ${page}: SKIPPED due to error - ${msg}`);
                }
            }
        }
        console.log(`(OK) Total ${tier} players: ${all_players.length}`);
        return all_players;
    }

    throw new Error(`(ERROR) Invalid tier: ${tier}`);
}
