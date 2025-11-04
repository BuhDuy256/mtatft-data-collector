# 🎮 TFT Data Collector

A comprehensive data collection pipeline for Teamfight Tactics (TFT) that fetches player data, match history, and league information from Riot Games API and stores it in Supabase PostgreSQL database.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Usage](#-usage)
  - **[📚 See EXAMPLES.md for detailed use cases](EXAMPLES.md)**
- [Data Pipeline Stages](#-data-pipeline-stages)
- [Database Schema](#-database-schema)
- [Code Conventions](#-code-conventions)
- [API Rate Limiting & Performance](#-api-rate-limiting--performance)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## ✨ Features

- **Multi-Tier Data Collection**
  - Collect from **one or multiple tiers** in a single run
  - Use `all` keyword to collect from all 10 TFT tiers
  - Matches collected **per tier** (configurable goal)
  - Example: `npm start challenger master diamond 500 on on` = 1500 matches

- **5-Stage Configurable Pipeline**
  - Stage 1-2: Collect seed players and matches (always runs)
  - Stage 3: Clean up orphaned players (always runs)
  - Stage 4: Enrich account info - **Optional** (`on`/`off` via CLI)
  - Stage 5: Enrich league stats - **Optional** (`on`/`off` via CLI)

- **Stream Processing Architecture**
  - Fetch one, save immediately pattern
  - Memory-efficient for large datasets
  - Fault-tolerant with individual error handling
  - No memory overflow even with thousands of matches

- **Robust API Integration**
  - Automatic retry logic with exponential backoff
  - 429 (rate limit) handling
  - Configurable delays between requests
  - Handles API errors gracefully (404, 500, etc.)

- **JSONB Storage for Matches**
  - Full match JSON stored in database
  - No data loss from normalization
  - Flexible for future analysis needs
  - Efficient querying with PostgreSQL JSONB indexes

- **Player Stub System**
  - Automatic player discovery from matches
  - Default values for unknown players
  - Progressive enrichment with API data
  - No duplicate players across tiers

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

## ⚡ Quick Start

```bash
# 1. Clone and install
git clone https://github.com/BuhDuy256/mtatft-data-collector.git
cd mtatft-data-collector
npm install

# 2. Create .env file with your credentials
# SUPABASE_URL=your_url
# SUPABASE_ANON_KEY=your_key
# RIOT_API_KEY=your_key

# 3. Set up database (run SQL in Supabase SQL Editor - see below)

# 4. Run your first collection!
npm start diamond 100 off off
```

**First-time users**: Start with `npm start diamond 100 off off` to:
- ✅ Collect 100 matches from Diamond tier
- ✅ Skip enrichments (faster, fewer API calls)
- ✅ Verify setup works correctly
- ✅ Complete in ~15-20 minutes

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- npm or yarn
- Supabase account and project
- Riot Games API key ([Get one here](https://developer.riotgames.com/))

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

### Command Line Interface

Run the data collection pipeline with the following syntax:

```bash
npm start <TIERS...> <MATCH_GOAL> <ENRICH_ACCOUNT> <ENRICH_LEAGUE>
```

**Parameters:**

| Parameter | Description | Values |
|-----------|-------------|--------|
| `TIERS...` | One or more tier names, or "all" | `challenger`, `master`, `diamond`, etc. or `all` |
| `MATCH_GOAL` | Number of matches to collect **per tier** | Any positive integer |
| `ENRICH_ACCOUNT` | Enable/disable Stage 4 (fetch gameName, tagLine) | `on` or `off` |
| `ENRICH_LEAGUE` | Enable/disable Stage 5 (fetch tier, rank, LP, W/L) | `on` or `off` |

### Examples

#### Single Tier Collection
```bash
# Collect 1000 matches from Diamond tier, with both enrichments
npm start diamond 1000 on on

# Collect 500 matches from Master tier, skip league enrichment
npm start master 500 on off
```

#### Multiple Tiers Collection
```bash
# Collect 1000 matches from Challenger AND 1000 from Master (2000 total)
npm start challenger master 1000 on on

# Collect 500 matches each from Diamond, Emerald, Platinum (1500 total)
npm start diamond emerald platinum 500 on off

# Collect 200 matches each from top 3 tiers (600 total), no enrichments
npm start challenger grandmaster master 200 off off
```

#### All Tiers Collection
```bash
# Collect 100 matches from ALL tiers (challenger, grandmaster, master, diamond, emerald, platinum, gold, silver, bronze, iron)
# Total: 100 × 10 tiers = 1000 matches
npm start all 100 on off

# Collect 50 matches from ALL tiers with full enrichment
npm start all 50 on on
```

### Available Tiers

**High Tiers** (no pagination):
- `challenger` - Top 300 players
- `grandmaster` - Next tier after Challenger
- `master` - Master tier players

**Low Tiers** (with pagination):
- `diamond` - Diamond tier
- `emerald` - Emerald tier
- `platinum` - Platinum tier
- `gold` - Gold tier
- `silver` - Silver tier
- `bronze` - Bronze tier
- `iron` - Iron tier

**Special Keyword:**
- `all` - Collects from all 10 tiers (challenger through iron)

### Pipeline Stages Explained

The pipeline executes in the following order:

1. **Stage 1 & 2** (Always runs): 
   - Fetches seed players from each specified tier
   - Collects matches from those players (up to 20 matches per player)
   - Stores full match JSON in database
   - Creates player stubs for all participants

2. **Stage 3** (Always runs):
   - Removes players who have no associated matches
   - Uses SQL stored procedure for performance

3. **Stage 4** (Optional - controlled by `ENRICH_ACCOUNT`):
   - Fetches Riot ID (gameName#tagLine) for all players
   - Updates player records with account information
   - Handles 404 errors gracefully (account not found)

4. **Stage 5** (Optional - controlled by `ENRICH_LEAGUE`):
   - Fetches current ranked statistics for all players
   - Updates: tier, rank, league points, wins, losses, status flags
   - Filters for RANKED_TFT queue only

### Understanding Match Goals

- **Per Tier**: The `MATCH_GOAL` applies to **each tier** individually
- **Total Matches**: `Total = MATCH_GOAL × Number of Tiers`

**Examples:**
```bash
# Example 1: Single tier
npm start diamond 1000 on on
# Expected: ~1000 matches from Diamond

# Example 2: Three tiers
npm start challenger master diamond 500 on on
# Expected: ~1500 matches total (500 from each tier)

# Example 3: All tiers
npm start all 100 on on
# Expected: ~1000 matches total (100 from each of 10 tiers)
```

### When to Disable Enrichments

**Disable Account Enrichment (`off`)** when:
- You only need match data, not player identities
- Reducing API calls to stay under rate limits
- Faster data collection is priority

**Disable League Enrichment (`off`)** when:
- You don't need current rank information
- Processing historical match data (ranks change over time)
- Reducing API calls significantly (most expensive stage)

**Typical Use Cases:**
```bash
# Fast match collection only
npm start diamond 2000 off off

# Get player names but skip rank info
npm start all 100 on off

# Full data collection with everything
npm start challenger master 1000 on on
```

### Logs

All logs are written to `logs/index.log` with timestamps:

```
[2025-11-04T10:30:45.123Z] [INFO] ========================================
[2025-11-04T10:30:45.124Z] [INFO] Starting Multi-Tier Data Collection
[2025-11-04T10:30:45.125Z] [INFO] ========================================
[2025-11-04T10:30:45.126Z] [INFO] Total tiers: 2
[2025-11-04T10:30:45.127Z] [INFO] Matches per tier: 1000
[2025-11-04T10:30:45.128Z] [INFO] Total matches goal: 2000
[2025-11-04T10:30:45.129Z] [INFO] ========================================
[2025-11-04T10:30:46.456Z] [INFO] Processing Tier 1/2: CHALLENGER
[2025-11-04T10:30:50.789Z] [INFO] Processing Tier 2/2: MASTER
...
[2025-11-04T10:45:30.123Z] [INFO] Stage 4: Account Enrichment (ENABLED)
[2025-11-04T10:50:15.456Z] [INFO] Stage 5: League Enrichment (SKIPPED - disabled via CLI)
[2025-11-04T10:50:15.789Z] [OK] ✅ Data Collection Pipeline Complete!
```

## 🔄 Data Pipeline Stages

### Stage 1 & 2: Multi-Tier Player and Match Collection

**Purpose**: Collect seed players and their matches from one or more tiers

**Process** (repeated for each tier):
1. **Tier-Based Player Collection**:
   - Fetch players from Riot League API for current tier
   - Calculate required player count based on match goal
   - Randomly select subset of players
   - Map to database format and upsert

2. **Match Collection (Stream Processing)**:
   - Fetch match IDs from each seed player (up to 20 matches)
   - Stream fetch match details one-by-one:
     - Save full match JSON to `matches.data` (JSONB)
     - Extract participant PUUIDs
     - Create player stubs with default values
     - Create player-match links
   - Immediate database saves after each fetch

**Key Features**:
- Processes tiers sequentially (one after another)
- Accumulates unique players across all tiers
- No duplicate matches (match_id is primary key)

**Output**: 
- Matches stored from all specified tiers
- Player stubs created for all discovered players
- Player-match links established

### Stage 3: Orphan Cleanup (Always Runs)

**Purpose**: Remove players without any associated matches

**Process**:
1. Call SQL stored procedure `delete_orphaned_players()`
2. Deletes players not in `players_matches_link` table
3. Returns count of deleted players

**Why It's Needed**:
- Players from Stage 1 might not have any valid matches
- API errors during Stage 2 can leave orphaned records
- Keeps database clean and efficient

**Output**: Clean database with only relevant players

### Stage 4: Account Enrichment (Optional)

**Controlled By**: `ENRICH_ACCOUNT` parameter (`on`/`off`)

**Purpose**: Fetch and update player account information

**Process** (when enabled):
1. Get all player PUUIDs from database
2. Stream fetch account data from Riot Account API:
   - Fetch `gameName` and `tagLine`
   - Update player record immediately
3. Handle 404 errors gracefully (account not found)

**When to Enable**:
- ✅ Need player display names for analysis
- ✅ Want to track specific players by name
- ✅ Building leaderboards or player profiles

**When to Disable**:
- ❌ Only need match data, not player identities
- ❌ Want faster collection (saves ~1.3s per player)
- ❌ Reducing API call volume

**Output**: Players updated with Riot ID (gameName#tagLine)

### Stage 5: League Enrichment (Optional)

**Controlled By**: `ENRICH_LEAGUE` parameter (`on`/`off`)

**Purpose**: Fetch and update current league statistics

**Process** (when enabled):
1. Get all player PUUIDs from database
2. Stream fetch league data from Riot League API:
   - Filter for `RANKED_TFT` queue only
   - Extract: tier, rank, LP, wins, losses, flags
   - Update player record immediately
3. Skip players without ranked data

**When to Enable**:
- ✅ Need current rank information for analysis
- ✅ Building rank distribution statistics
- ✅ Filtering players by skill level

**When to Disable**:
- ❌ Only analyzing historical match data
- ❌ Player ranks from Stage 1 are sufficient
- ❌ Want much faster collection (most expensive stage)
- ❌ Processing old matches (ranks change over time)

**Important Note**: 
- League data is **current at time of fetch**, not historical
- For historical analysis, use tier info from match JSON instead
- This stage significantly increases runtime and API usage

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

## ⏱ API Rate Limiting & Performance

### Current Settings

- **Delay between requests**: 1300ms (configurable in `constant.ts`)
- **Retry on 429**: Automatic retry with exponential backoff
- **Max retries**: 3 attempts per request

### Riot API Limits (Production Key)

- **20 requests per second**
- **100 requests per 2 minutes**

### Performance Expectations

**Time estimates for common scenarios:**

| Command | Tiers | Matches | Enrichment | Estimated Time |
|---------|-------|---------|------------|----------------|
| `npm start diamond 1000 off off` | 1 | ~1000 | None | 30-45 min |
| `npm start diamond 1000 on off` | 1 | ~1000 | Account | 1-2 hours |
| `npm start diamond 1000 on on` | 1 | ~1000 | Both | 2-3 hours |
| `npm start challenger master 500 on on` | 2 | ~1000 | Both | 3-4 hours |
| `npm start all 100 off off` | 10 | ~1000 | None | 1-2 hours |
| `npm start all 100 on on` | 10 | ~1000 | Both | 4-6 hours |
| `npm start all 500 on on` | 10 | ~5000 | Both | 12-24 hours |

**Factors affecting runtime:**
- **Number of tiers**: More tiers = proportionally more time
- **Matches per tier**: More matches = more API calls
- **Enrichment stages**: 
  - Stage 4 (Account): Adds ~1.3s per unique player
  - Stage 5 (League): Adds ~1.3s per unique player
- **Player discovery**: Matches contain 8 players, creates many unique players
- **API rate limits**: 1300ms delay between requests

**Optimization tips:**
```bash
# Fastest: Skip all enrichments
npm start diamond 500 off off

# Balanced: Get player names, skip ranks
npm start challenger master 300 on off

# Complete data: Enable both (takes longest)
npm start diamond 200 on on
```

### Recommendations

For large data collection:
- Use production API key (not development key)
- Monitor rate limit headers in logs
- Adjust `RATE_LIMIT_DELAY` if getting 429 errors
- Consider running during off-peak hours
- **Start small**: Test with 100 matches first
- **Scale up gradually**: Increase to 500, then 1000+
- **Use `off off`** for initial testing to verify pipeline works

## 🐛 Troubleshooting

### Common Issues

**1. Invalid CLI Arguments**
```
Error: Invalid arguments
Solution: Check command format
  npm start <TIERS...> <MATCH_GOAL> <ENRICH_ACCOUNT> <ENRICH_LEAGUE>
Example: npm start challenger master 500 on off
```

**2. API 429 Errors (Rate Limit)**
```
Error: Too many requests
Solution: Increase RATE_LIMIT_DELAY in src/utils/constant.ts
Current: 1300ms → Try: 1500ms or 2000ms
Note: More tiers = more API calls = higher rate limit risk
```

**3. Supabase Connection Error**
```
Error: Failed to connect to Supabase
Solution: Verify .env variables are correct
Check: SUPABASE_URL and SUPABASE_ANON_KEY
```

**4. No Players Found for Tier**
```
Warning: No seed players found for <tier>
Solution: 
  - Check tier spelling (use lowercase: diamond, not DIAMOND)
  - Verify API key is valid for the region
  - Some low tiers may have no active players
  - Pipeline will skip to next tier automatically
```

**5. Player Stub Constraint Errors**
```
Error: NOT NULL constraint failed
Solution: Ensure default values are provided for all required fields
Check: upsertPlayerStubs() in matchRepository.ts
All required fields should have defaults (tier='UNKNOWN', rank='IV', etc.)
```

**6. Memory Issues (Large Datasets)**
```
Error: JavaScript heap out of memory
Solution: 
  - Stream processing is already implemented
  - Reduce MATCH_GOAL (e.g., 500 instead of 2000)
  - Process fewer tiers at once
  - Disable enrichment stages (off off)
Example: npm start diamond 500 off off
```

**7. "all" Keyword Takes Too Long**
```
Issue: npm start all 100 on on takes hours
Explanation: 
  - 10 tiers × 100 matches = 1000 matches
  - Each player fetch: ~1.3s delay
  - Account + League enrichment adds significant time
Solution:
  - Disable enrichments: npm start all 100 off off
  - Or process fewer tiers: npm start challenger master diamond 100 on off
  - Or reduce matches: npm start all 50 on on
```

**8. Stage 4/5 Not Running**
```
Issue: Account/League enrichment skipped
Solution: Check CLI arguments
  - Must be "on" (lowercase) to enable
  - "OFF", "On", "ON" will not work
Correct: npm start diamond 1000 on on
Wrong: npm start diamond 1000 ON on
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

**Latest Updates** (November 4, 2025):
- ✨ Multi-tier collection support
- ✨ `all` keyword for collecting from all tiers
- ✨ Configurable enrichment stages (on/off)
- ✨ Enhanced CLI with flexible arguments
- 📝 Comprehensive README with performance metrics

---

## 🎯 Quick Reference Card

```bash
# Syntax
npm start <TIERS...> <MATCHES_PER_TIER> <ACCOUNT:on/off> <LEAGUE:on/off>

# Common Commands
npm start diamond 1000 on on           # Single tier, full enrichment
npm start challenger master 500 on off # Two tiers, skip league
npm start all 100 off off              # All tiers, no enrichment (fastest)

# Available Tiers
challenger, grandmaster, master, diamond, emerald, 
platinum, gold, silver, bronze, iron, or "all"

# Enrichment Stages
on  = Enable  (fetch data from API)
off = Disable (skip stage, faster collection)
```

**Need help?** Check [Usage Examples](#-usage) or [Troubleshooting](#-troubleshooting)

---

**Built with ❤️ for TFT data analysis**
