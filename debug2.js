require('dotenv').config();

const TARGET_SET_ID = "15";
const CDRAGON_URL = "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";

// Hàm lọc MỚI
const isValidUnit = (unit) => {
  // Loại bỏ units không có traits (dummy units, training dummies, etc.)
  if (unit.traits.length === 0) return false;
  
  // Loại bỏ các unit đặc biệt như VoidSpawn
  if (unit.apiName && unit.apiName.includes("TFT_VoidSpawn")) return false;
  
  return true;
};

async function debugData() {
  try {
    const response = await fetch(CDRAGON_URL);
    const data = await response.json();
    const setData = data.sets[TARGET_SET_ID];

    console.log('📊 TỔNG QUAN SAU KHI SỬA:');
    console.log(`Total champions trong Set ${TARGET_SET_ID}:`, setData.champions.length);
    
    // Phân tích theo cost
    for (let cost = 1; cost <= 5; cost++) {
      const champsByCost = setData.champions.filter(c => c.cost === cost);
      const validChamps = champsByCost.filter(isValidUnit);
      
      console.log(`\n💰 Cost ${cost}:`);
      console.log(`  - Tổng số: ${champsByCost.length}`);
      console.log(`  - Sau khi lọc: ${validChamps.length}`);
      console.log(`  - Bị loại: ${champsByCost.length - validChamps.length}`);
      
      // Hiển thị những tướng bị loại
      const filtered = champsByCost.filter(c => !isValidUnit(c));
      if (filtered.length > 0) {
        console.log(`  ❌ Bị loại:`);
        filtered.forEach(c => {
          console.log(`     - ${c.name} (${c.apiName}) - traits: ${c.traits.length}`);
        });
      }
    }
    
    console.log('\n✅ TỔNG KẾT:');
    const allValid = setData.champions.filter(isValidUnit);
    console.log(`Tổng số tướng hợp lệ: ${allValid.length}`);
    console.log(`Tổng số tướng bị loại: ${setData.champions.length - allValid.length}`);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

debugData();
