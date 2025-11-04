# 📚 Usage Examples

Comprehensive examples for different use cases of the TFT Data Collector.

## Table of Contents
- [Basic Examples](#basic-examples)
- [Multi-Tier Collection](#multi-tier-collection)
- [Use Case Scenarios](#use-case-scenarios)
- [Performance Optimization](#performance-optimization)
- [Advanced Usage](#advanced-usage)

---

## Basic Examples

### Example 1: Your First Collection (Recommended Start)
```bash
npm start diamond 100 off off
```
**What it does:**
- Collects 100 matches from Diamond tier
- Skips both enrichment stages (faster)
- Takes approximately 15-20 minutes
- Good for testing setup

**Expected Output:**
```
(INFO) Configuration:
  - Tiers: diamond
  - Matches per tier: 100
  - Total matches goal: 100
  - Enrich account (Stage 4): OFF
  - Enrich league (Stage 5): OFF
...
(OK) ✅ Data Collection Pipeline Complete!
```

---

### Example 2: Single Tier with Full Enrichment
```bash
npm start master 500 on on
```
**What it does:**
- Collects 500 matches from Master tier
- Enriches player accounts (gameName, tagLine)
- Enriches league data (tier, rank, LP, W/L)
- Takes approximately 2-3 hours

**Use when:**
- You need complete player information
- Building player profiles or leaderboards
- Analyzing current meta at specific rank

---

### Example 3: Fast Match Collection Only
```bash
npm start challenger 1000 off off
```
**What it does:**
- Collects 1000 matches from Challenger
- Skips all enrichments
- Focuses on speed and match data only
- Takes approximately 30-45 minutes

**Use when:**
- Only analyzing match patterns/compositions
- Don't need player identity information
- Want to minimize API calls

---

## Multi-Tier Collection

### Example 4: Top Tiers Analysis
```bash
npm start challenger grandmaster master 300 on off
```
**What it does:**
- Collects 300 matches from each of the top 3 tiers
- Total: 900 matches
- Gets player names but skips league data
- Takes approximately 2-3 hours

**Use when:**
- Comparing high-level gameplay across apex tiers
- Need player names for tracking
- Current ranks not important (historical data)

---

### Example 5: Specific Tier Range
```bash
npm start diamond emerald platinum 500 on on
```
**What it does:**
- Collects 500 matches from Diamond, Emerald, Platinum
- Total: 1500 matches
- Full enrichment for all players
- Takes approximately 4-6 hours

**Use when:**
- Analyzing mid-tier meta differences
- Building rank-specific datasets
- Need complete player profiles

---

### Example 6: All Tiers Survey
```bash
npm start all 100 on off
```
**What it does:**
- Collects 100 matches from ALL 10 tiers
- Total: 1000 matches (100 × 10 tiers)
- Gets player accounts but skips league
- Takes approximately 2-3 hours

**Use when:**
- Surveying entire player base
- Analyzing meta differences across all ranks
- Building comprehensive tier comparison

**Tiers included:**
- Challenger, Grandmaster, Master
- Diamond, Emerald, Platinum
- Gold, Silver, Bronze, Iron

---

### Example 7: Complete Database Build
```bash
npm start all 500 on on
```
**What it does:**
- Collects 500 matches from EVERY tier
- Total: 5000 matches
- Full enrichment (accounts + leagues)
- Takes approximately 12-24 hours ⚠️

**Use when:**
- Building a comprehensive TFT database
- Long-term research project
- Running overnight/background collection

**Warning:** This is a very long-running job. Consider:
- Running in a screen/tmux session
- Monitoring logs periodically
- Having stable internet connection

---

## Use Case Scenarios

### Scenario 1: Meta Analysis (No Player Info Needed)
```bash
# Fast collection for composition/trait analysis
npm start diamond emerald 800 off off

# Why:
# - Large sample size (1600 matches)
# - Covers common ranks (Diamond + Emerald)
# - No enrichment = faster + fewer API calls
# - Match JSON has all game data needed
```

---

### Scenario 2: Player Tracking & Leaderboards
```bash
# Get complete player information
npm start challenger 200 on on

# Why:
# - Full player profiles (name + current rank)
# - Top tier players for leaderboard
# - Real-time rank data for accuracy
# - Reasonable match count for initial dataset
```

---

### Scenario 3: Historical Match Research
```bash
# Matches only, skip current rank data
npm start all 300 on off

# Why:
# - 3000 matches across all skill levels
# - Player names for identification
# - Skip league (ranks change over time)
# - Match JSON has historical rank at play time
```

---

### Scenario 4: Rank Distribution Study
```bash
# Wide tier coverage with ranks
npm start diamond emerald platinum gold silver 200 on on

# Why:
# - 1000 matches from mid-tiers
# - Current rank data for distribution analysis
# - Player accounts for validation
# - Balanced sample across ranks
```

---

### Scenario 5: Quick Testing / Development
```bash
# Minimal collection for testing
npm start diamond 50 off off

# Why:
# - Completes in ~8-10 minutes
# - Tests full pipeline
# - Minimal API usage
# - Good for debugging/development
```

---

### Scenario 6: Continuous Daily Collection
```bash
# Run daily via cron job
npm start challenger master 100 on off

# Why:
# - Manageable daily run (~1 hour)
# - Top tiers for current meta
# - Player names for tracking
# - Skip league (Stage 1 already has tier)
```

**Cron Example (Linux/Mac):**
```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/mtatft-data-collector && npm start challenger master 100 on off >> logs/cron.log 2>&1
```

---

## Performance Optimization

### Fastest Possible Collection
```bash
# Absolute minimum API calls
npm start diamond 1000 off off

# Speed optimizations:
# ✓ Single tier (no tier-switching)
# ✓ No account enrichment
# ✓ No league enrichment
# ✓ Only match data collection
# ⏱ ~30-45 minutes for 1000 matches
```

---

### Balanced Speed vs. Completeness
```bash
# Get player names, skip ranks
npm start challenger master diamond 300 on off

# Balance:
# ✓ Multiple tiers (900 matches)
# ✓ Player identification
# ✗ Skip expensive league calls
# ⏱ ~2-3 hours
```

---

### Maximum Data Collection
```bash
# Everything enabled
npm start all 500 on on

# Completeness:
# ✓ All 10 tiers
# ✓ Full player accounts
# ✓ Current league stats
# ✓ 5000 total matches
# ⏱ ~12-24 hours (overnight recommended)
```

---

## Advanced Usage

### Example: Specific Divisions for Low Tiers
The code automatically fetches divisions 2-3 for low tiers. To customize, modify `index.ts`:

```typescript
// Default (in code)
await collectTierBasedPlayers(tier, match_goal, [2, 3], [1, 2]);

// Custom: Only Diamond I and II, pages 1-3
await collectTierBasedPlayers('diamond', 500, [1, 2], [1, 2, 3]);
```

---

### Example: Rate Limit Adjustment
If getting 429 errors, adjust the delay in `src/utils/constant.ts`:

```typescript
// Default
export const RATE_LIMIT_DELAY = 1300; // ms

// For slower collection (more reliable)
export const RATE_LIMIT_DELAY = 1500; // ms

// For faster collection (risky with rate limits)
export const RATE_LIMIT_DELAY = 1000; // ms
```

---

### Example: Batch Processing Script
Create a bash script for multiple runs:

```bash
#!/bin/bash
# collect_all.sh - Collect from all tiers in separate runs

echo "Starting batch collection..."

npm start challenger 500 on on
npm start grandmaster 500 on on
npm start master 500 on on
npm start diamond 500 on on
npm start emerald 500 on on
npm start platinum 500 on on

echo "Batch collection complete!"
```

**Why separate runs?**
- Checkpoint progress after each tier
- Resume from failure point
- Monitor tier-by-tier results

---

### Example: Docker Deployment
Run in Docker for long-running collections:

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start", "all", "500", "on", "on"]
```

```bash
# Build and run
docker build -t tft-collector .
docker run -d --name tft-collector \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
  -e RIOT_API_KEY=$RIOT_API_KEY \
  -v $(pwd)/logs:/app/logs \
  tft-collector

# Check logs
docker logs -f tft-collector
```

---

## Common Patterns

### Pattern 1: Tier Comparison Study
```bash
# Low tier
npm start iron bronze silver 300 on off

# Mid tier  
npm start gold platinum emerald 300 on off

# High tier
npm start diamond master challenger 300 on off

# Compare results across skill levels
```

---

### Pattern 2: Weekly Meta Snapshot
```bash
# Monday
npm start all 200 on on

# Captures current meta across all ranks
# 2000 matches with full player data
# Repeat weekly for trend analysis
```

---

### Pattern 3: Focused Rank Research
```bash
# Deep dive into Diamond
npm start diamond 2000 on on

# Large sample size for statistical significance
# Full player profiles
# Sufficient data for detailed analysis
```

---

## Tips & Tricks

### 💡 Tip 1: Start Small, Scale Up
```bash
# First run
npm start diamond 50 off off

# If successful, increase
npm start diamond 200 off off

# Then add enrichment
npm start diamond 200 on off

# Finally full
npm start diamond 500 on on
```

---

### 💡 Tip 2: Monitor Logs in Real-Time
```bash
# In one terminal: run collection
npm start diamond 1000 on on

# In another terminal: watch logs
tail -f logs/index.log
```

---

### 💡 Tip 3: Database Size Estimation
```
Match JSON: ~50-100 KB per match
1000 matches: ~50-100 MB
10000 matches: ~500 MB - 1 GB

Plan Supabase storage accordingly!
```

---

### 💡 Tip 4: Resume After Failure
The pipeline is idempotent:
- Duplicate matches are skipped (primary key)
- Duplicate players are merged (upsert)
- Just re-run the same command to continue

---

### 💡 Tip 5: Query Collected Data
```sql
-- Check match count per tier
SELECT 
  data->'info'->'participants'->0->>'ratedTier' as tier,
  COUNT(*) as match_count
FROM matches
GROUP BY tier
ORDER BY match_count DESC;

-- Find players with most matches
SELECT 
  p.game_name,
  p.tier,
  COUNT(pml.match_id) as matches_played
FROM players p
JOIN players_matches_link pml ON p.puuid = pml.puuid
WHERE p.game_name IS NOT NULL
GROUP BY p.puuid, p.game_name, p.tier
ORDER BY matches_played DESC
LIMIT 20;
```

---

## Need Help?

- 📖 See [README.md](README.md) for detailed documentation
- 🐛 Check [Troubleshooting section](README.md#-troubleshooting)
- 💬 Open an issue on GitHub

**Happy collecting! 🎮**
