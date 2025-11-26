require('dotenv').config();

const TARGET_SET_ID = "15";
const CDRAGON_URL = "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";

// Hàm lọc hiện tại
const isValidUnit = (unit) => {
  if (unit.traits.length === 0 && unit.cost > 10) return false;
  if (unit.apiName && unit.apiName.includes("TFT_VoidSpawn")) return false;
  return true;
};

async function debugData() {
  try {
    const response = await fetch(CDRAGON_URL);
    const data = await response.json();
    const setData = data.sets[TARGET_SET_ID];

    console.log('📊 TỔNG QUAN:');
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
          console.log(`     - ${c.name} (${c.apiName})`);
          console.log(`       Lý do: traits=${c.traits.length}, cost=${c.cost}`);
        });
      }
      
      // Hiển thị những tướng hợp lệ
      if (validChamps.length > 0) {
        console.log(`  ✅ Hợp lệ:`);
        validChamps.forEach(c => {
          console.log(`     - ${c.name} (traits: ${c.traits.length})`);
        });
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

debugData();
