require('dotenv').config();
const knex = require('knex')({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  }
});

// --- CONFIGURATION ---
const TARGET_SET_ID = "15"; // Đổi mùa ở đây
const CDRAGON_URL = "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";
const BASE_IMAGE_URL = "https://raw.communitydragon.org/latest/game/";

// --- HELPER FUNCTIONS ---
const processIconUrl = (rawPath) => {
  if (!rawPath) return "";
  return BASE_IMAGE_URL + rawPath.toLowerCase().replace(".tex", ".png");
};

// Lọc tướng rác
const isValidUnit = (unit) => {
  // Loại bỏ units không có traits (dummy units, training dummies, etc.)
  if (unit.traits.length === 0) return false;
  
  // Loại bỏ các unit đặc biệt như VoidSpawn
  if (unit.apiName && unit.apiName.includes("TFT_VoidSpawn")) return false;
  
  return true;
};

// Lọc trang bị rác (MỚI)
const isValidItem = (item) => {
  // 1. Phải có tên
  if (!item.name || item.name === "") return false;
  
  // 2. Loại bỏ các item không có apiName hoặc là item hệ thống
  if (!item.apiName) return false;

  // 3. Loại bỏ Lõi công nghệ (Augments) - Thường chúng ta lưu Augment ở bảng riêng
  // Nếu bạn muốn lưu cả Augment vào bảng item thì xóa 2 dòng dưới
  if (item.apiName.includes("TFT_Augment")) return false; 
  if (item.icon && item.icon.includes("Augments")) return false;

  // 4. Loại bỏ các item admin/debug
  if (item.name.includes("DEBUG") || item.name.includes("TFT_Item_Admin")) return false;

  return true;
};

// --- MAIN PROCESS ---
async function syncTFTData() {
  console.log(`🚀 [Knex] Bắt đầu đồng bộ TFT Set ${TARGET_SET_ID}...`);

  try {
    const response = await fetch(CDRAGON_URL);
    const data = await response.json();
    const setData = data.sets[TARGET_SET_ID];

    // Lấy danh sách item từ root data (vì items thường dùng chung cho các mùa)
    const itemsSource = data.items;

    if (!setData) throw new Error(`❌ Set ${TARGET_SET_ID} not found.`);

    // --- 1. XỬ LÝ TRAITS ---
    console.log("⚙️  Processing Traits...");
    const traitNameMap = new Map();
    const traitsData = [];

    for (const trait of setData.traits) {
      if (!trait.name || (trait.apiName && trait.apiName.includes("Hidden"))) continue;
      traitNameMap.set(trait.name, trait.apiName);
      traitsData.push({
        id: trait.apiName,
        name: trait.name,
        iconUrl: processIconUrl(trait.icon),
        description: trait.desc,
        effects: JSON.stringify(trait.effects),
        season: TARGET_SET_ID
      });
    }

    if (traitsData.length > 0) {
      await knex('static_traits').insert(traitsData).onConflict('id').merge();
    }
    console.log(`✅ Synced ${traitsData.length} Traits.`);

    // --- 2. XỬ LÝ ITEMS (MỚI THÊM) ---
    console.log("⚙️  Processing Items...");
    const itemsData = [];

    for (const item of itemsSource) {
      if (!isValidItem(item)) continue;

      itemsData.push({
        id: item.apiName, // Sử dụng apiName làm ID (VD: TFT_Item_InfinityEdge)
        name: item.name,
        iconUrl: processIconUrl(item.icon),
        desc: item.desc,
        effects: JSON.stringify(item.effects), // Convert JSON object sang string để lưu DB
        season: TARGET_SET_ID
      });
    }

    // Insert Items theo batch (chia nhỏ) để tránh query quá nặng
    if (itemsData.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < itemsData.length; i += BATCH_SIZE) {
        const batch = itemsData.slice(i, i + BATCH_SIZE);
        await knex('static_items').insert(batch).onConflict('id').merge();
      }
    }
    console.log(`✅ Synced ${itemsData.length} Items.`);


    // --- 3. XỬ LÝ UNITS & RELATIONS ---
    console.log("⚙️  Processing Units & Relations...");
    await knex.transaction(async (trx) => {
      for (const champ of setData.champions) {
        if (!isValidUnit(champ)) continue;

        const unitData = {
          id: champ.apiName,
          name: champ.name,
          cost: champ.cost,
          iconUrl: processIconUrl(champ.icon),
          season: TARGET_SET_ID
        };

        await trx('static_units').insert(unitData).onConflict('id').merge();

        const traitIds = champ.traits
          .map(name => traitNameMap.get(name))
          .filter(id => id !== undefined);

        if (traitIds.length > 0) {
          await trx('unit_traits').where({ unitId: unitData.id }).del();
          const relationData = traitIds.map(tId => ({
            unitId: unitData.id,
            traitId: tId
          }));
          await trx('unit_traits').insert(relationData).onConflict(['unitId', 'traitId']).ignore();
        }
      }
    });

    console.log(`✅ Synced Units successfully.`);
    console.log(`🎉 DONE SET ${TARGET_SET_ID}!`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await knex.destroy();
  }
}

syncTFTData();