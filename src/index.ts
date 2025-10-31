// src/index.ts

import axios from 'axios';
import * as dotenv from 'dotenv';

// 1. Tải các biến môi trường từ file .env
// Phải chạy hàm này đầu tiên
dotenv.config();

// 2. Lấy API key từ process.env
// Dấu "!" ở cuối để báo cho TypeScript rằng chúng ta chắc chắn key này tồn tại
const RIOT_API_KEY = process.env.RIOT_API_KEY!;

if (!RIOT_API_KEY) {
  throw new Error("Không tìm thấy RIOT_API_KEY trong file .env");
}

// 3. (QUAN TRỌNG) Chọn máy chủ (platform) bạn muốn lấy data
// Vd: "vn2", "na1", "kr", "euw1",...
const PLATFORM_ID = 'vn2';

// 4. Định nghĩa kiểu dữ liệu (Interfaces) cho kết quả trả về
// Điều này giúp code của bạn an toàn và tự động gợi ý
interface LeagueItemDTO {
  summonerName: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
}

interface LeagueListDTO {
  tier: string;
  leagueId: string;
  queue: string;
  name: string;
  entries: LeagueItemDTO[];
}

// 5. Tạo một "instance" của axios
// Instance này sẽ tự động gắn API key vào MỌI yêu cầu
const riotApi = axios.create({
  baseURL: `https://${PLATFORM_ID}.api.riotgames.com`, // Base URL cho mọi request
  headers: {
    "X-Riot-Token": RIOT_API_KEY // Gắn API key vào header
  }
});


// 6. Viết hàm main bất đồng bộ (async) để gọi API
async function getChallengerLeague() {
  console.log(`🚀 Đang lấy danh sách Thách Đấu từ máy chủ ${PLATFORM_ID}...`);

  try {
    // Gọi API. Bạn chỉ cần đường dẫn, không cần URL đầy đủ
    // vì chúng ta đã set 'baseURL' ở trên
    const response = await riotApi.get<LeagueListDTO>(
      '/tft/league/v1/challenger'
    );

    // 7. Xử lý dữ liệu
    const data = response.data;
    const players = data.entries;

    // Sắp xếp người chơi từ cao xuống thấp
    players.sort((a, b) => b.leaguePoints - a.leaguePoints);

    console.log(`✅ Lấy dữ liệu thành công!`);
    console.log(`========================================`);
    console.log(`Bậc: ${data.name} (${data.tier})`);
    console.log(`Tổng số người chơi: ${players.length}`);
    console.log(`========================================`);

    // In ra Top 3
    players.slice(0, 3).forEach((player, index) => {
      console.log(
        `#${index + 1}: ${player.summonerName} - ${player.leaguePoints} LP (${player.wins} Thắng)`
      );
    });

  } catch (error) {
    // 8. Xử lý lỗi RẤT QUAN TRỌNG
    console.error("❌ Đã xảy ra lỗi khi gọi API:", error instanceof Error ? error.message : String(error));

    // Lỗi từ axios thường có 'response' chứa thông tin từ server Riot
    if (axios.isAxiosError(error) && error.response) {
      console.error("Chi tiết lỗi từ Riot:", error.response.data);
      console.error("Status code:", error.response.status);
    }
  }
}

// 9. Chạy hàm main
getChallengerLeague();