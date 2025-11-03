# 🎮 TFT Data Collector

A comprehensive data collection pipeline for Teamfight Tactics (TFT) that fetches player data, match history, and league information from Riot Games API and stores it in Supabase PostgreSQL database.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Data Pipeline Stages](#-data-pipeline-stages)
- [Database Schema](#-database-schema)
- [Code Conventions](#-code-conventions)
- [API Rate Limiting](#-api-rate-limiting)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## ✨ Features

- **5-Stage Data Collection Pipeline**
  - Stage 1: Collect seed players from specified tier
  - Stage 2: Fetch and store match data (full JSONB storage)
  - Stage 3: Clean up orphaned players
  - Stage 4: Enrich player account information (gameName, tagLine)
  - Stage 5: Enrich player league statistics (tier, rank, LP, W/L)

- **Stream Processing Architecture**
  - Fetch one, save immediately pattern
  - Memory-efficient for large datasets
  - Fault-tolerant with individual error handling

- **Robust API Integration**
  - Automatic retry logic with exponential backoff
  - 429 (rate limit) handling
  - Configurable delays between requests

- **JSONB Storage for Matches**
  - Full match JSON stored in database
  - No data loss from normalization
  - Flexible for future analysis needs

- **Player Stub System**
  - Automatic player discovery from matches
  - Default values for unknown players
  - Progressive enrichment with API data

## 🏗 Architecture

```
┌─────────────────┐
│  Riot Games API │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     Data Collection Pipeline         │
│  ┌──────────────────────────────┐   │
│  │ Stage 1: Tier-Based Players  │   │
│  └────────────┬─────────────────┘   │
│               ▼                      │
│  ┌──────────────────────────────┐   │
│  │ Stage 2: Match Collection    │   │
│  │  - Stream Processing         │   │
│  │  - JSONB Storage             │   │
│  │  - Player Stub Creation      │   │
│  └────────────┬─────────────────┘   │
│               ▼                      │
│  ┌──────────────────────────────┐   │
│  │ Stage 3: Orphan Cleanup      │   │
│  │  - SQL Stored Procedure      │   │
│  └────────────┬─────────────────┘   │
│               ▼                      │
│  ┌──────────────────────────────┐   │
│  │ Stage 4: Account Enrichment  │   │
│  │  - gameName, tagLine         │   │
│  └────────────┬─────────────────┘   │
│               ▼                      │
│  ┌──────────────────────────────┐   │
│  │ Stage 5: League Enrichment   │   │
│  │  - Tier, Rank, LP, W/L       │   │
│  └──────────────────────────────┘   │
└─────────────┬───────────────────────┘
              ▼
    ┌──────────────────┐
    │ Supabase (PostgreSQL) │
    │  - players       │
    │  - matches       │
    │  - players_matches_link │
    └──────────────────┘
```

## 🛠 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Language**: TypeScript 5.9.3 (CommonJS)
- **Database**: Supabase (PostgreSQL with JSONB)
- **Validation**: Zod for runtime type checking
- **HTTP Client**: Axios with custom retry logic
- **API**: Riot Games TFT API (League V1, Match V1, Account V1)

## 📁 Project Structure

```
mtatft-data-collector/
├── src/
│   ├── index.ts                    # Main orchestration pipeline
│   ├── database/
│   │   └── supabaseClient.ts       # Supabase connection
│   ├── services/
│   │   ├── playerCollectorService.ts
│   │   ├── playerSelectionService.ts
│   │   ├── matchCollectorService.ts
│   │   ├── accountCollectorService.ts
│   │   └── leagueCollectorService.ts
│   ├── mappers/
│   │   ├── PlayerMapper.ts
│   │   ├── AccountMapper.ts
│   │   └── LeagueMapper.ts
│   ├── repository/
│   │   ├── playerRepository.ts
│   │   └── matchRepository.ts
│   ├── models/
│   │   ├── riot/                   # API response models
│   │   │   ├── RiotTierModels.ts
│   │   │   ├── RiotPlayerModels.ts
│   │   │   ├── RiotMatchModels.ts
│   │   │   ├── RiotAccountModels.ts
│   │   │   └── RiotLeagueModels.ts
│   │   └── database/               # Database models
│   │       ├── PlayerDBModel.ts
│   │       └── MatchDBModel.ts
│   ├── utils/
│   │   ├── api.ts                  # API clients & regions
│   │   └── constant.ts             # Constants
│   └── helper/
│       └── helper.ts               # Utility functions
├── logs/                           # Log files (auto-created)
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- npm or yarn
- Supabase account and project
- Riot Games API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BuhDuy256/mtatft-data-collector.git
   cd mtatft-data-collector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key

   # Riot API Configuration
   RIOT_API_KEY=your_riot_api_key
   ```

4. **Set up database schema**
   
   Run the following SQL in your Supabase SQL Editor:

   ```sql
   -- Players table
   CREATE TABLE players (
       puuid TEXT PRIMARY KEY,
       game_name TEXT,
       tag_line TEXT,
       tier TEXT NOT NULL,
       rank TEXT NOT NULL,
       league_points INTEGER NOT NULL DEFAULT 0,
       wins INTEGER NOT NULL DEFAULT 0,
       losses INTEGER NOT NULL DEFAULT 0,
       veteran BOOLEAN NOT NULL DEFAULT FALSE,
       inactive BOOLEAN NOT NULL DEFAULT FALSE,
       fresh_blood BOOLEAN NOT NULL DEFAULT FALSE,
       hot_streak BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Matches table (JSONB storage)
   CREATE TABLE matches (
       match_id TEXT PRIMARY KEY,
       data JSONB NOT NULL,
       is_processed BOOLEAN NOT NULL DEFAULT FALSE,
       region TEXT NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Junction table for players-matches relationship
   CREATE TABLE players_matches_link (
       puuid TEXT NOT NULL REFERENCES players(puuid) ON DELETE CASCADE,
       match_id TEXT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       PRIMARY KEY (puuid, match_id)
   );

   -- Stored procedure for orphan cleanup
   CREATE OR REPLACE FUNCTION delete_orphaned_players()
   RETURNS INTEGER AS $$
   DECLARE deleted_count INTEGER;
   BEGIN
       DELETE FROM players WHERE puuid NOT IN (
           SELECT DISTINCT puuid FROM players_matches_link
       );
       GET DIAGNOSTICS deleted_count = ROW_COUNT;
       RETURN deleted_count;
   END;
   $$ LANGUAGE plpgsql;

   -- Indexes for performance
   CREATE INDEX idx_players_tier ON players(tier);
   CREATE INDEX idx_players_game_name ON players(game_name);
   CREATE INDEX idx_matches_region ON matches(region);
   CREATE INDEX idx_players_matches_link_puuid ON players_matches_link(puuid);
   CREATE INDEX idx_players_matches_link_match_id ON players_matches_link(match_id);
   ```

## ⚙ Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `RIOT_API_KEY` | Riot Games API key | `RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

### Constants (src/utils/constant.ts)

- `RATE_LIMIT_DELAY`: Delay between API calls (default: 1300ms)
- `MATCHES_PER_PLAYER`: Expected matches per player (default: 20)

## 🎯 Usage

### Basic Usage

Run the data collection pipeline with command-line arguments:

```bash
npm start <TIER> <MATCH_GOAL>
```

**Examples:**

```bash
# Collect 1000 matches from Diamond tier
npm start diamond 1000

# Collect 500 matches from Master tier
npm start master 500

# Collect 2000 matches from Challenger tier
npm start challenger 2000
```

### Available Tiers

**High Tiers** (no pagination):
- `CHALLENGER`
- `GRANDMASTER`
- `MASTER`

**Low Tiers** (with pagination):
- `DIAMOND`
- `EMERALD`
- `PLATINUM`
- `GOLD`
- `SILVER`
- `BRONZE`
- `IRON`

### What Happens During Execution

1. **Stage 1**: Fetches players from specified tier
2. **Stage 2**: Collects matches from those players (up to 20 per player)
3. **Stage 3**: Removes players who have no matches
4. **Stage 4**: Updates player account info (gameName#tagLine)
5. **Stage 5**: Updates player league stats (current rank, LP, W/L)

### Logs

All logs are written to `logs/index.log` with timestamps:

```
[2025-11-03T10:30:45.123Z] [INFO] Starting data collection for tier: diamond, match goal: 1000
[2025-11-03T10:30:46.456Z] [INFO] Stage 1: Collecting tier-based players...
[2025-11-03T10:30:50.789Z] [OK] Stage 1 Complete!
...
```

## 🔄 Data Pipeline Stages

### Stage 1: Tier-Based Player Collection

**Purpose**: Collect seed players from specified rank tier

**Process**:
1. Fetch players from Riot League API
2. Calculate required player count based on match goal
3. Randomly select subset of players
4. Map to database format and upsert

**Output**: Set of player PUUIDs for next stage

### Stage 2: Match Collection (Stream Processing)

**Purpose**: Collect match data and discover new players

**Process**:
1. Fetch match IDs from each seed player (up to 20 matches)
2. Stream fetch match details one-by-one:
   - Save full match JSON to `matches.data` (JSONB)
   - Extract participant PUUIDs
   - Create player stubs with default values
   - Create player-match links
3. Immediate database saves after each fetch

**Output**: Matches stored, player stubs created, links established

### Stage 3: Orphan Cleanup

**Purpose**: Remove players without any associated matches

**Process**:
1. Call SQL stored procedure `delete_orphaned_players()`
2. Deletes players not in `players_matches_link` table
3. Returns count of deleted players

**Output**: Clean database with only relevant players

### Stage 4: Account Enrichment

**Purpose**: Fetch and update player account information

**Process**:
1. Get all player PUUIDs from database
2. Stream fetch account data from Riot Account API:
   - Fetch `gameName` and `tagLine`
   - Update player record immediately
3. Handle 404 errors gracefully (account not found)

**Output**: Players updated with Riot ID (gameName#tagLine)

### Stage 5: League Enrichment

**Purpose**: Fetch and update current league statistics

**Process**:
1. Get all player PUUIDs from database
2. Stream fetch league data from Riot League API:
   - Filter for `RANKED_TFT` queue only
   - Extract: tier, rank, LP, wins, losses, flags
   - Update player record immediately
3. Skip players without ranked data

**Output**: Players updated with current ranked stats

## 🗄 Database Schema

### `players` Table

| Column | Type | Description |
|--------|------|-------------|
| `puuid` | TEXT (PK) | Player unique identifier |
| `game_name` | TEXT | Riot ID game name |
| `tag_line` | TEXT | Riot ID tag line |
| `tier` | TEXT | Current tier (CHALLENGER, DIAMOND, etc.) |
| `rank` | TEXT | Current division (I, II, III, IV) |
| `league_points` | INTEGER | League points (LP) |
| `wins` | INTEGER | Ranked wins |
| `losses` | INTEGER | Ranked losses |
| `veteran` | BOOLEAN | Veteran status flag |
| `inactive` | BOOLEAN | Inactive status flag |
| `fresh_blood` | BOOLEAN | Fresh blood status flag |
| `hot_streak` | BOOLEAN | Hot streak status flag |

### `matches` Table

| Column | Type | Description |
|--------|------|-------------|
| `match_id` | TEXT (PK) | Match unique identifier |
| `data` | JSONB | Full match JSON from API |
| `is_processed` | BOOLEAN | Processing status flag |
| `region` | TEXT | Server region (e.g., 'sea') |

### `players_matches_link` Table

| Column | Type | Description |
|--------|------|-------------|
| `puuid` | TEXT (FK) | Player identifier |
| `match_id` | TEXT (FK) | Match identifier |

## 📝 Code Conventions

This project follows **C++ style conventions** for consistency:

### Naming Rules

- **Variables**: `snake_case`
  ```typescript
  const match_id_set = new Set<string>();
  const player_puuids = validated_match.info.participants.map(p => p.puuid);
  ```

- **Functions**: `verbNoun` camelCase format
  ```typescript
  async function fetchPlayersFromTier(tier: Tier): Promise<RiotPlayer[]>
  async function collectMatchIdsFromPlayers(puuids: Set<string>): Promise<Set<string>>
  ```

- **Types/Interfaces**: `PascalCase`
  ```typescript
  interface MatchDetailResult { ... }
  type PlayerDB = { ... }
  ```

### Comments

- All comments in **English**
- JSDoc for all public functions
- Include parameter descriptions and return types

### File Organization

- **Models**: Data structures and validation schemas (Zod)
- **Mappers**: Transform API data → Database format
- **Services**: Business logic and API interactions
- **Repository**: Database operations (CRUD)

## ⏱ API Rate Limiting

### Current Settings

- **Delay between requests**: 1300ms (configurable in `constant.ts`)
- **Retry on 429**: Automatic retry with exponential backoff
- **Max retries**: 3 attempts per request

### Riot API Limits (Production Key)

- **20 requests per second**
- **100 requests per 2 minutes**

### Recommendations

For large data collection:
- Use production API key (not development key)
- Monitor rate limit headers
- Adjust `RATE_LIMIT_DELAY` if needed
- Consider running during off-peak hours

## 🐛 Troubleshooting

### Common Issues

**1. API 429 Errors (Rate Limit)**
```
Solution: Increase RATE_LIMIT_DELAY in src/utils/constant.ts
Current: 1300ms → Try: 1500ms or 2000ms
```

**2. Supabase Connection Error**
```
Solution: Verify .env variables are correct
Check: SUPABASE_URL and SUPABASE_ANON_KEY
```

**3. No Players Found**
```
Solution: Check tier spelling and API key validity
Valid tiers: challenger, grandmaster, master, diamond, etc.
```

**4. Player Stub Constraint Errors**
```
Solution: Ensure default values are provided for all required fields
Check: upsertPlayerStubs() in matchRepository.ts
```

**5. Memory Issues (Large Datasets)**
```
Solution: Stream processing is already implemented
If still occurs: Process in smaller batches (reduce MATCH_GOAL)
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow code conventions (C++ style)
4. Add JSDoc comments for new functions
5. Test thoroughly before committing
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style Checklist

- [ ] Variables use `snake_case`
- [ ] Functions use `verbNoun` format
- [ ] All comments in English
- [ ] JSDoc added for public functions
- [ ] Zod schemas for validation
- [ ] Error handling implemented
- [ ] Logging added for important steps

## 📄 License

ISC License

## 👤 Author

**BuhDuy256**
- GitHub: [@BuhDuy256](https://github.com/BuhDuy256)
- Repository: [mtatft-data-collector](https://github.com/BuhDuy256/mtatft-data-collector)

## 🙏 Acknowledgments

- Riot Games for providing the TFT API
- Supabase for the excellent PostgreSQL platform
- TypeScript and Zod for type safety

## 📊 Project Status

✅ **Active Development**

Current Version: 1.0.0

Last Updated: November 3, 2025

---

**Built with ❤️ for TFT data analysis**
