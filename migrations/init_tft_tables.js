/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Bảng Tướng (Units)
    .createTable('static_units', (table) => {
      table.string('id').primary(); // apiName
      table.string('name').notNullable();
      table.integer('cost').notNullable();
      table.string('iconUrl');
      table.string('season').notNullable(); 
    })
    // 2. Bảng Tộc/Hệ (Traits)
    .createTable('static_traits', (table) => {
      table.string('id').primary(); // apiName
      table.string('name').notNullable();
      table.string('iconUrl');
      table.text('description'); 
      table.jsonb('effects');   
      table.string('season').notNullable();
    })
    // 3. Bảng Trang bị (Items) - MỚI THÊM
    .createTable('static_items', (table) => {
      table.string('id').primary(); // apiName (VD: TFT_Item_InfinityEdge)
      table.string('name');
      table.string('iconUrl');
      table.text('desc');
      table.jsonb('effects'); // Chỉ số (AD, AP...)
      table.string('season').notNullable();
    })
    // 4. Bảng trung gian (Unit - Trait)
    .createTable('unit_traits', (table) => {
      table.string('unitId').references('id').inTable('static_units').onDelete('CASCADE');
      table.string('traitId').references('id').inTable('static_traits').onDelete('CASCADE');
      table.primary(['unitId', 'traitId']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('unit_traits')
    .dropTableIfExists('static_items') // Nhớ xóa bảng này khi rollback
    .dropTableIfExists('static_traits')
    .dropTableIfExists('static_units');
};