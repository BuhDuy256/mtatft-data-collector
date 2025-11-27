1. Logging setup: write logs into file /logs/index.log.
2. Override console method (log, error, warn, info, debug) to write to log file.
3. Check validity of CLI arguments of user commands in the format: npm start <TIERS...> <MATCH_GOAL> <ENRICH_ACCOUNT> <ENRICH_LEAGUE>
=> Code: const args = process.argv.slice(2)
4. Parse and check valid for all CLI arguments:
    - tier_args 
        => Code: const tier_args = args.slice(0, -3) 
        => Valid:
            HIGH_TIERS: challenger, grandmaster, master
            LOW_TIERS: diamond, emerald, platium, gold, silver, bronze, iron
            => Notes:
                HIGH_TIERS & LOW_TIERS are enum type inferred from zod enum schema
    - match_goal_arg
    - enrich_account_arg => Valid: on/off 
    - enrigh_league_arg => Valid: on/off
5. Stage 1: Collect players by tiers (collectTierBasedPlayers):
    Input: tier, match_goal, divisions, pages
    Output: puuid_seed_list (Set<string>)
    Process:
        - Fetch players từ Riot API theo tier
            - Nếu là HIGH_TIER (challenger/grandmaster/master): gọi API endpoint đơn, không có phân trang
            - Nếu là LOW_TIER (diamond/emerald/platinum...): gọi API có phân trang theo division (I, II, III, IV) và page number
        - Random chọn players:
            - Tính số players cần = match_goal / MATCHES_PER_PLAYER (mỗi player có ~20 matches)
            - Dùng Fisher-Yates shuffle để random chọn players
            - Nếu cần nhiều hơn số players có sẵn thì lấy tất cả
        - Map players sang database model (PlayerDB)
        - Upsert players vào database (bảng players)
        - Trả về Set các PUUIDs đã lưu thành công

6. Stage 2: Collect matches from players (collectMatchesFromPlayers):
    Input: puuid_seed_list (Set<string>), region
    Output: void (lưu trực tiếp vào DB)
    Process:
        - Step 1: Thu thập match IDs từ tất cả seed players
            - Với mỗi PUUID: gọi API lấy 20 match IDs gần nhất
            - Dùng Set để tự động loại bỏ trùng lặp match IDs
        - Step 2: Stream processing - fetch và save từng match một
            - Với mỗi match_id:
                - Fetch full match data từ Riot API (JSON đầy đủ)
                - Parse và validate dữ liệu match
                - Tạo MatchDB object chứa: match_id, full JSON data, region, is_processed=false
                - Lưu ngay vào database (bảng matches)
            - Không giữ matches trong memory, save ngay sau khi fetch
        - Log progress và số matches đã save thành công

7. Stage 3: Enrich player account data (enrichPlayerAccounts) - TÙY CHỌN:
    Input: không (query từ DB)
    Output: void (update trực tiếp vào DB)
    Kích hoạt: khi CLI argument enrich_account = "on"
    Process:
        - Query database tìm tất cả players thiếu account info (game_name hoặc tag_line là NULL)
        - Nếu không có players thiếu info: skip stage này
        - Stream processing - fetch và update từng player một:
            - Với mỗi PUUID:
                - Gọi Riot Account API: /riot/account/v1/accounts/by-puuid/{puuid}
                - Lấy gameName và tagLine
                - Update ngay vào database (bảng players)
                - Nếu API trả 404: log warning và skip
        - Log số players cần update và số players update thành công

8. Stage 4: Enrich player league data (enrichPlayerLeagues) - TÙY CHỌN:
    Input: không (query từ DB)
    Output: void (update trực tiếp vào DB)
    Kích hoạt: khi CLI argument enrich_league = "on"
    Process:
        - Query database tìm tất cả players thiếu league info (updated_at là NULL)
        - Nếu không có players thiếu info: skip stage này
        - Stream processing - fetch và update từng player một:
            - Với mỗi PUUID:
                - Gọi Riot League API: /tft/league/v1/by-puuid/{puuid}
                - API trả về array các queue types (RANKED_TFT, RANKED_TFT_TURBO, etc.)
                - Lọc chỉ lấy entry có queueType = "RANKED_TFT"
                - Lấy thông tin: tier, rank, leaguePoints, wins, losses, veteran, inactive, freshBlood, hotStreak
                - Update ngay vào database (bảng players)
                - Nếu không tìm thấy RANKED_TFT entry: log warning và skip
        - Log số players cần update và số players update thành công

9. Main Pipeline Orchestrator (runPipeline):
    Flow tổng thể:
        - Log configuration: tiers, match_goal, enrich flags
        - Tạo Set để lưu tất cả seed PUUIDs từ mọi tiers
        - Loop qua từng tier:
            - Chạy Stage 1: collect players cho tier đó
            - Chạy Stage 2: collect matches từ players của tier đó
            - Thêm seed PUUIDs vào tổng Set
        - Nếu enrich_account = ON: chạy Stage 3 cho TẤT CẢ players trong DB thiếu account info
        - Nếu enrich_league = ON: chạy Stage 4 cho TẤT CẢ players trong DB thiếu league info
        - Log summary: số tiers xử lý, số players, match count, enrich status
        - Nếu có lỗi: log error và exit với code 1

10. Key Design Patterns:
    - Stream Processing: Fetch-Save-Forget pattern để tránh tràn memory với dataset lớn
    - Rate Limiting: Mỗi API call có delay và retry logic khi hit rate limit
    - Data Validation: Dùng Zod schema để validate mọi API response
    - Error Handling: Graceful handling với 404 (not found) và các API errors
    - Incremental Updates: Stage 3 & 4 chỉ update players thiếu data, không re-fetch toàn bộ
    - Transaction Safety: Upsert operations để tránh duplicate và conflict

11. Database Schema (inferred):
    - Bảng players: 
        - puuid (PK), tier, rank, league_points, wins, losses
        - game_name, tag_line (từ Stage 3)
        - veteran, inactive, fresh_blood, hot_streak (từ Stage 4)
        - updated_at (timestamp để track enrich status)
    - Bảng matches:
        - match_id (PK), data (JSONB - full match JSON), region
        - is_processed (boolean flag), created_at

12. API Endpoints được sử dụng:
    - League API (platformApi): /tft/league/v1/{tier} hoặc /tft/league/v1/entries/{tier}/{division}
    - Match API (matchApi): /tft/match/v1/matches/by-puuid/{puuid}/ids và /tft/match/v1/matches/{matchId}
    - Account API (accountApi): /riot/account/v1/accounts/by-puuid/{puuid}
    - League Entry API (platformApi): /tft/league/v1/by-puuid/{puuid} 