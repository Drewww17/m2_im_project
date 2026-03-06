/**
 * Restore original AgriVet data from MySQL dump to PostgreSQL/Supabase
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  
  // Delete in reverse dependency order
  await prisma.customer_credit.deleteMany();
  await prisma.PO_sales.deleteMany();
  await prisma.supply_details.deleteMany();
  await prisma.supply.deleteMany();
  await prisma.stock_log.deleteMany();
  await prisma.sale_details.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.sales.deleteMany();
  await prisma.purchase_order_details.deleteMany();
  await prisma.purchase_orders.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.products.deleteMany();
  await prisma.customers.deleteMany();
  await prisma.employees.deleteMany();
  await prisma.suppliers.deleteMany();
  await prisma.account_ledger.deleteMany();
  await prisma.agrivet_transactions.deleteMany();
  // Keep users table intact

  console.log('Inserting suppliers...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "suppliers" ("supplier_id", "supplier_name", "contact_number", "is_active", "created_at", "payable_balance") VALUES
    (1, 'Agrimex', NULL, true, '2026-02-25 17:51:26', 0.00),
    (2, 'Cedric Yu', NULL, true, '2026-02-25 17:51:26', 0.00),
    (3, 'DeolVet', NULL, true, '2026-02-25 17:51:26', 0.00),
    (4, 'Double Eagle', NULL, true, '2026-02-25 17:51:26', 0.00),
    (5, 'E3 BMEG', NULL, true, '2026-02-25 17:51:26', 0.00),
    (6, 'H&S Premiere Corp', NULL, true, '2026-02-25 17:51:26', 0.00),
    (7, 'Mars Agri Ventures INC', NULL, true, '2026-02-25 17:51:26', 0.00),
    (8, 'One Shop Vet', NULL, true, '2026-02-25 17:51:26', 0.00),
    (9, 'Pacifica Agrivet', NULL, true, '2026-02-25 17:51:26', 0.00),
    (10, 'Pet Options', NULL, true, '2026-02-25 17:51:26', 0.00),
    (11, 'MeowMix Distributor', NULL, true, '2026-02-25 17:51:26', 0.00),
    (12, 'Barktrade', NULL, true, '2026-02-25 17:51:26', 0.00),
    (13, 'Pet One', NULL, true, '2026-02-25 17:51:26', 0.00),
    (14, 'ProBalance Supply', NULL, true, '2026-02-25 17:51:26', 0.00),
    (15, 'ProDiet', NULL, true, '2026-02-25 17:51:26', 0.00),
    (16, 'AZU', NULL, true, '2026-02-25 17:51:26', 0.00),
    (17, 'Pepers', NULL, true, '2026-02-25 17:51:26', 0.00),
    (18, 'Mars Agri-Ventures', NULL, true, '2026-02-25 17:51:26', 0.00)
    ON CONFLICT ("supplier_name") DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"suppliers_supplier_id_seq"', (SELECT MAX(supplier_id) FROM "suppliers"))`);

  console.log('Inserting employees...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "employees" ("employee_id", "employee_name", "role") VALUES
    (1, 'Ejay', 'MOCK_Manager'),
    (2, 'Erwin', 'MOCK_Supervisor'),
    (3, 'Mae', 'MOCK_Employee'),
    (4, 'Natoy', 'MOCK_Employee'),
    (5, 'Sammy', 'MOCK_Employee'),
    (6, 'Ejay', 'MOCK_Manager'),
    (7, 'Erwin', 'MOCK_Supervisor'),
    (8, 'Mae', 'MOCK_Employee'),
    (9, 'Natoy', 'MOCK_Employee'),
    (10, 'Sammy', 'MOCK_Employee')
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"employees_employee_id_seq"', (SELECT MAX(employee_id) FROM "employees"))`);

  console.log('Inserting customers...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "customers" ("customer_id", "customer_name", "customer_type", "contact_number", "status", "created_at", "is_active", "credit_balance", "credit_limit") VALUES
    (1, 'Baquirel', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (3, 'Brize', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (4, 'Cayetano', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (5, 'Dencio', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (6, 'Gerard', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (7, 'Jephone', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (8, 'Jesan', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (10, 'Rex', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (11, 'Roy Bongoyan', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (12, 'White House', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (13, 'Sir Alex', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (14, 'Ully', 'VIP', '000-000-0000', 'ACTIVE', '2026-02-04 13:55:32', true, 0.00, 0.00),
    (26, 'testcustom', 'WALK_IN', '123445456', 'ACTIVE', '2026-02-28 06:32:13', false, 0.00, 20000.00),
    (27, 'test', 'WALK_IN', '09452458', 'ACTIVE', '2026-02-28 06:42:45', true, 0.00, 20000.00)
    ON CONFLICT ("customer_name") DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"customers_customer_id_seq"', (SELECT MAX(customer_id) FROM "customers"))`);

  console.log('Inserting products...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "products" ("product_id", "product_name", "category", "unit_price", "reorder_level", "inspection_interval", "unit_type", "unit_quantity", "status", "description", "product_code", "brand", "supplier_id", "source", "is_active", "created_at", "srp", "dealer_price", "barcode", "unit") VALUES
    (1, 'Pet Cure (Doxycycline Hyclate)', 'Medicine', 300.00, 10, 'Monthly', 'Tablet', 30, 'ACTIVE', 'PetOptions | 30 tablets | supplier: Pet Options - Doxycycline Hyclate 30 tabs | imported from:Pet Options', 'PO-PETCURE', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (2, 'Enropet (Enrofloxacin)', 'Medicine', 300.00, 10, 'Monthly', 'Tablet', 30, 'ACTIVE', 'PetOptions | 30 tablets | supplier: Pet Options - Enrofloxacin 30 tabs | imported from:Pet Options', 'PO-ENROPET', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (3, 'LIVERATOR 30ml', 'Herbal', 150.00, 10, 'Monthly', 'Bottle', 30, 'ACTIVE', 'PetOptions | 30ml | supplier: Pet Options - Liver supplement 30ml | imported from:Pet Options', 'PO-LIVER-30', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (4, 'LIVERATOR 120ml', 'Herbal', 300.00, 10, 'Monthly', 'Bottle', 120, 'ACTIVE', 'PetOptions | 120ml | supplier: Pet Options - Liver supplement 120ml | imported from:Pet Options', 'PO-LIVER-120', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (5, 'ZIST-O 120ml', 'Herbal', 365.00, 10, 'Monthly', 'Bottle', 120, 'ACTIVE', 'PetOptions | 120ml | supplier: Pet Options - Immunity enhancer 120ml | imported from:Pet Options', 'PO-ZISTO-120', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (6, 'TOPICURE 75ml', 'Herbal', 280.00, 10, 'Monthly', 'Spray', 75, 'ACTIVE', 'PetOptions | 75ml | supplier: Pet Options - Wound spray 75ml | imported from:Pet Options', 'PO-TOPI-75', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (7, 'PRAZILEX (Dewormer)', 'Dewormer', 1050.00, 10, 'Monthly', 'Tablet', 30, 'ACTIVE', 'PetOptions | 30 tablets | supplier: Pet Options - Levamisole + Praziquantel 30 tabs | imported from:Pet Options', 'PO-PRTR-30', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (8, 'PYRANEX 30ml', 'Dewormer', 200.00, 10, 'Monthly', 'Bottle', 30, 'ACTIVE', 'PetOptions | 30ml | supplier: Pet Options - Pyrantel Pamoate 30ml | imported from:Pet Options', 'PO-PYR-30', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (9, 'Pet Pals Grooming Shampoo', 'Grooming', 200.00, 10, 'Monthly', 'Bottle', 250, 'ACTIVE', 'PetOptions | 250ml | supplier: Pet Options - Grooming shampoo 250ml | imported from:Pet Options', 'PO-PP-SHAM', 'PetOptions', 10, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (10, 'Goodest Cat Chicken Chomp 85g', 'Pet Food', 1303.20, 20, 'Monthly', 'Can', 85, 'ACTIVE', 'Goodest | 85g | supplier: Mars Agri-Ventures - Goodest Chicken Chomp 85g (case price) | imported from:Mars Agri-Ventures', 'GD-CHOMP-85', 'Goodest', 18, 'local', true, '2026-02-25 17:51:26', 50.00, NULL, NULL, NULL),
    (11, 'Goodest Cat Tender Tuna 85g', 'Pet Food', 1303.20, 20, 'Monthly', 'Can', 85, 'ACTIVE', 'Goodest | 85g | supplier: Mars Agri-Ventures - Goodest Tender Tuna 85g (case price) | imported from:Mars Agri-Ventures', 'GD-TUNA-85', 'Goodest', 18, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (12, 'Goodest Cat Meaty Mackerel 85g', 'Pet Food', 1303.20, 20, 'Monthly', 'Can', 85, 'ACTIVE', 'Goodest | 85g | supplier: Mars Agri-Ventures - Goodest Meaty Mackerel 85g | imported from:Mars Agri-Ventures', 'GD-MACK-85', 'Goodest', 18, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (13, 'Goodest Cat Tender Tuna 400g', 'Pet Food', 731.40, 20, 'Monthly', 'Can', 400, 'ACTIVE', 'Goodest | 400g | supplier: Mars Agri-Ventures - Goodest Tender Tuna 400g | imported from:Mars Agri-Ventures', 'GD-TUNA-400', 'Goodest', 18, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (14, 'Meow Mix Original Choice 1.43kg', 'Pet Food', 4479.60, 20, 'Monthly', 'Bag', 1, 'ACTIVE', 'MeowMix | 1.43kg | supplier: MeowMix Distributor - Meow Mix Original 1.43kg | imported from:MeowMix Distributor', 'MM-ORIG-1.43', 'MeowMix', 11, 'local', true, '2026-02-25 17:51:26', NULL, 373.30, NULL, NULL),
    (15, 'Meow Mix Seafood Medley 1.43kg', 'Pet Food', 4479.60, 20, 'Monthly', 'Bag', 1, 'ACTIVE', 'MeowMix | 1.43kg | supplier: MeowMix Distributor - Seafood Medley 1.43kg | imported from:MeowMix Distributor', 'MM-SEA-1.43', 'MeowMix', 11, 'local', true, '2026-02-25 17:51:26', NULL, 373.30, NULL, NULL),
    (16, 'Meow Mix Hairball Control 1.43kg', 'Pet Food', 4479.60, 20, 'Monthly', 'Bag', 1, 'ACTIVE', 'MeowMix | 1.43kg | supplier: MeowMix Distributor - Hairball control 1.43kg | imported from:MeowMix Distributor', 'MM-HAIR-1.43', 'MeowMix', 11, 'local', true, '2026-02-25 17:51:26', NULL, 373.30, NULL, NULL),
    (18, 'AZU DOG FOOD 5kg', 'Pet Food', 715.00, 20, 'Monthly', 'Bag', 5, 'ACTIVE', 'AZU | 5kg | supplier: Barktrade - AZU dog food 5kg | imported from:Barktrade', 'AZU-5', 'AZU', 12, 'local', true, '2026-02-25 17:51:26', NULL, 644.00, NULL, NULL),
    (19, 'AZU DOG FOOD 1kg', 'Pet Food', 148.00, 20, 'Monthly', 'Bag', 1, 'ACTIVE', 'AZU | 1kg | supplier: Barktrade - AZU dog food 1kg | imported from:Barktrade', 'AZU-1', 'AZU', 12, 'local', true, '2026-02-25 17:51:26', 150.00, 133.00, NULL, NULL),
    (20, 'MYCAT Cat Food 10kg', 'Pet Food', 1540.00, 20, 'Monthly', 'Bag', 10, 'ACTIVE', 'MYCAT | 10kg | supplier: Barktrade - MYCAT cat food 10kg | imported from:Barktrade', 'MYCAT-10', 'MYCAT', 12, 'local', true, '2026-02-25 17:51:26', NULL, 1386.00, NULL, NULL),
    (21, 'SICAT Cat Food 10kg', 'Pet Food', 1350.00, 20, 'Monthly', 'Bag', 10, 'ACTIVE', 'SICAT | 10kg | supplier: Barktrade - SICAT cat food 10kg | imported from:Barktrade', 'SICAT-10', 'SICAT', 12, 'local', true, '2026-02-25 17:51:26', NULL, 1215.00, NULL, NULL),
    (22, 'Pet One Puppy 15kg', 'Pet Food', 1475.00, 20, 'Monthly', 'Bag', 15, 'ACTIVE', 'PetOne | 15kg | supplier: Pet One - Pet One Puppy 15kg | imported from:Pet One', 'PO-15PUP', 'PetOne', 13, 'local', true, '2026-02-25 17:51:26', NULL, 1475.00, NULL, NULL),
    (23, 'Pet One Adult 18.18kg', 'Pet Food', 1495.00, 20, 'Monthly', 'Bag', 18, 'ACTIVE', 'PetOne | 18.18kg | supplier: Pet One - Pet One Adult 18.18kg | imported from:Pet One', 'PO-18AD', 'PetOne', 13, 'local', true, '2026-02-25 17:51:26', NULL, 1495.00, NULL, NULL),
    (24, 'Hi Pro 20kg', 'Pet Food', 1950.00, 20, 'Monthly', 'Bag', 20, 'ACTIVE', 'HiPro | 20kg | supplier: Pet One - Hi Pro 20kg | imported from:Pet One', 'HP-20', 'HiPro', 13, 'local', true, '2026-02-25 17:51:26', NULL, 1950.00, NULL, NULL),
    (25, 'DogiBeef 22.7kg', 'Pet Food', 2360.00, 20, 'Monthly', 'Bag', 23, 'ACTIVE', 'DogiBeef | 22.7kg | supplier: Pet One - DogiBeef 22.7kg | imported from:Pet One', 'DB-22', 'DogiBeef', 13, 'local', true, '2026-02-25 17:51:26', NULL, 2127.00, NULL, NULL),
    (26, 'ProBalance Puppy 1.5kg', 'Pet Food', 2058.00, 20, 'Monthly', 'Bag', 2, 'ACTIVE', 'ProBalance | 1.5kg | supplier: ProBalance Supply - ProBalance Puppy pack 1.5kg | imported from:ProBalance Supply', 'PB-PUP-1.5', 'ProBalance', 14, 'local', true, '2026-02-25 17:51:26', NULL, 294.00, NULL, NULL),
    (27, 'ProBalance Adult 18.18kg', 'Pet Food', 1495.00, 20, 'Monthly', 'Bag', 18, 'ACTIVE', 'ProBalance | 18.18kg | supplier: ProBalance Supply - ProBalance Adult 18.18kg | imported from:ProBalance Supply', 'PB-ADULT-18.18', 'ProBalance', 14, 'local', true, '2026-02-25 17:51:26', NULL, 1495.00, NULL, NULL),
    (28, 'ProDiet Classic Tuna 8kg', 'Pet Food', 1392.00, 20, 'Monthly', 'Bag', 8, 'ACTIVE', 'ProDiet | 8kg | supplier: ProDiet - ProDiet Classic Tuna 8kg | imported from:ProDiet', 'PD-TUNA-8', 'ProDiet', 15, 'local', true, '2026-02-25 17:51:26', NULL, 29.00, NULL, NULL),
    (29, 'AZU Meat Jerky (Roasted Lamb Sticks)', 'Treats', 88.00, 10, 'Monthly', 'Pack', 1, 'ACTIVE', 'AZU | unit | supplier: Barktrade - AZU Meat Jerky | imported from:Barktrade', 'AZU-JERKY', 'AZU', 12, 'local', true, '2026-02-25 17:51:26', NULL, 79.00, NULL, NULL),
    (30, 'AZU Rawhide 5 inches', 'Treats', 144.00, 10, 'Monthly', 'Piece', 5, 'ACTIVE', 'AZU | unit | supplier: Barktrade - AZU Rawhide 5" | imported from:Barktrade', 'AZU-RAW-5', 'AZU', 12, 'local', true, '2026-02-25 17:51:26', NULL, 130.00, NULL, NULL),
    (31, 'Pepers Training Pad Medium', 'Accessories', 1648.62, 10, 'Monthly', 'Pack', 30, 'ACTIVE', 'Pepers | pack | supplier: Pepers - Training pad medium | imported from:Pepers', 'PP-TRAIN-M', 'Pepers', 17, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (32, 'Pepers Wet Wipes', 'Accessories', 729.00, 10, 'Monthly', 'Pack', 50, 'ACTIVE', 'Pepers | 50pcs | supplier: Pepers - Wet wipes 50pcs | imported from:Pepers', 'PP-WIPES', 'Pepers', 17, 'local', true, '2026-02-25 17:51:26', NULL, 60.75, NULL, NULL),
    (64, 'Pet Cure (Doxycycline)', 'Medicine', 300.00, NULL, 'Monthly', 'Tablet', 30, 'ACTIVE', 'Doxycycline 30 tabs', NULL, NULL, NULL, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (66, 'Goodest Cat Chomp 85g', 'Pet Food', 1303.20, 20, 'Monthly', 'Can', 85, 'ACTIVE', 'Case price', NULL, NULL, NULL, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (67, 'Meow Mix 1.43kg', 'Pet Food', 4479.60, 20, 'Monthly', 'Bag', 1, 'ACTIVE', 'Retail bag', NULL, NULL, NULL, 'local', true, '2026-02-25 17:51:26', NULL, NULL, NULL, NULL),
    (68, 'AZU Dog Food 20kg', 'Pet Food', 2700.00, 20, 'Monthly', 'Bag', 20, 'ACTIVE', 'Large bag', NULL, NULL, NULL, 'local', true, '2026-02-25 17:51:26', 10000.00, NULL, NULL, NULL),
    (75, 'TEST', 'Medicine', 100.00, 10, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'local', true, '2026-02-28 05:31:04', 100.00, NULL, '352342452', 'pcs')
    ON CONFLICT ("product_name") DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"products_product_id_seq"', (SELECT MAX(product_id) FROM "products"))`);

  console.log('Inserting inventory...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "inventory" ("inventory_id", "product_id", "current_stock", "expiration_date", "batch_number", "is_active") VALUES
    (1, 1, 127, '2026-12-31', NULL, true),
    (2, 2, 80, '2026-11-30', NULL, true),
    (3, 4, 60, '2027-01-01', NULL, true),
    (4, 10, 238, NULL, NULL, true),
    (5, 14, 86, NULL, NULL, true),
    (6, 5, 50, NULL, NULL, true),
    (7, 22, 30, NULL, NULL, true),
    (8, 26, 40, NULL, NULL, true),
    (9, 10, 50, NULL, NULL, true),
    (10, 11, 50, NULL, NULL, true),
    (11, 12, 50, NULL, NULL, true),
    (12, 13, 50, NULL, NULL, true),
    (13, 14, 40, NULL, NULL, true),
    (14, 15, 50, NULL, NULL, true),
    (15, 16, 50, NULL, NULL, true),
    (16, 5, 50, NULL, NULL, true),
    (17, 18, 50, NULL, NULL, true),
    (18, 19, 50, NULL, NULL, true),
    (19, 20, 50, NULL, NULL, true),
    (20, 21, 50, NULL, NULL, true),
    (21, 22, 50, NULL, NULL, true),
    (22, 23, 50, NULL, NULL, true),
    (23, 24, 50, NULL, NULL, true),
    (24, 25, 50, NULL, NULL, true),
    (25, 26, 50, NULL, NULL, true),
    (26, 27, 50, NULL, NULL, true),
    (27, 28, 50, NULL, NULL, true),
    (28, 1, 120, '2026-12-31', NULL, true),
    (29, 64, 120, '2026-12-31', NULL, true),
    (31, 2, 80, '2026-11-30', NULL, true),
    (32, 2, 80, '2026-11-30', NULL, true),
    (34, 10, 240, NULL, NULL, true),
    (35, 11, 240, NULL, NULL, true),
    (36, 12, 240, NULL, NULL, true),
    (37, 13, 240, NULL, NULL, true),
    (38, 66, 240, NULL, NULL, true),
    (41, 14, 86, NULL, NULL, true),
    (42, 15, 96, NULL, NULL, true),
    (43, 16, 96, NULL, NULL, true),
    (44, 67, 96, NULL, NULL, true),
    (48, 5, 50, NULL, NULL, true),
    (49, 18, 50, NULL, NULL, true),
    (50, 19, 50, NULL, NULL, true),
    (51, 29, 50, NULL, NULL, true),
    (52, 30, 50, NULL, NULL, true),
    (53, 68, 0, '2026-03-01', NULL, true),
    (54, 7, 2, '2026-03-01', NULL, true)
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"inventory_inventory_id_seq"', (SELECT MAX(inventory_id) FROM "inventory"))`);

  console.log('Inserting sales...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "sales" ("sale_id", "sale_date", "sale_status", "process_type", "customer_id", "employee_id", "sale_type", "created_at", "updated_at", "amount_paid", "is_active", "payment_method", "total_amount", "remarks") VALUES
    (1, '2026-02-21', 'COMPLETED', 'Walk-in', 1, 1, 'regular', '2026-02-25 08:07:28', '2026-02-28 07:38:11', 0.00, false, NULL, 0.00, NULL),
    (5, '2026-02-28', 'PAID', NULL, 3, NULL, 'regular', '2026-02-27 23:23:26', '2026-02-27 23:23:26', 100.00, true, 'CASH', 50.00, NULL),
    (6, '2026-02-28', 'PAID', NULL, NULL, NULL, 'regular', '2026-02-27 23:37:02', '2026-02-27 23:37:02', 10000.00, true, 'CASH', 10000.00, NULL),
    (7, '2026-02-28', 'PAID', 'PO', NULL, NULL, 'regular', '2026-02-28 00:25:55', '2026-02-28 00:25:55', 1000.00, true, 'CASH', 50.00, NULL)
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"sales_sale_id_seq"', (SELECT MAX(sale_id) FROM "sales"))`);

  console.log('Inserting sale_details...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "sale_details" ("sale_detail_id", "sale_id", "product_id", "quantity", "unit_price") VALUES
    (2, 1, 1, 2, NULL),
    (3, 1, 7, 2, NULL),
    (4, 5, 10, 1, 50.00),
    (5, 6, 68, 1, 10000.00),
    (6, 7, 10, 1, 50.00)
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"sale_details_sale_detail_id_seq"', (SELECT MAX(sale_detail_id) FROM "sale_details"))`);

  console.log('Inserting delivery...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "delivery" ("delivery_id", "sale_id", "delivery_date", "delivery_address", "delivery_status") VALUES
    (1, 7, '2026-03-01', 'Davao City', 'PENDING')
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"delivery_delivery_id_seq"', (SELECT MAX(delivery_id) FROM "delivery"))`);

  console.log('Inserting stock_log...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "stock_log" ("log_id", "product_id", "change_type", "quantity", "reason", "log_date", "employee_id") VALUES
    (1, 68, 'ADJUSTMENT', 0, 'Inventory update: Expiry: N/A -> 3/1/2026 - test', '2026-02-28 06:54:12', 1),
    (2, 68, 'ADJUSTMENT', -49, 'Inventory update: Stock: 50 -> 1', '2026-02-28 07:12:33', 1),
    (3, 10, 'SALE', -1, 'Sale #5', '2026-02-28 07:23:27', NULL),
    (4, 68, 'SALE', -1, 'Sale #6', '2026-02-28 07:37:02', NULL),
    (5, 1, 'RETURN', 2, 'Void sale #1: No reason provided', '2026-02-28 07:38:10', NULL),
    (6, 7, 'RETURN', 2, 'Void sale #1: No reason provided', '2026-02-28 07:38:10', NULL),
    (7, 10, 'SALE', -1, 'Sale #7', '2026-02-28 08:25:55', NULL),
    (8, 7, 'ADJUSTMENT', 0, 'Inventory update: Expiry: N/A -> 3/1/2026', '2026-02-28 08:28:31', 1)
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"stock_log_log_id_seq"', (SELECT MAX(log_id) FROM "stock_log"))`);

  console.log('Inserting account_ledger...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "account_ledger" ("ledger_id", "account_type", "account_id", "reference_type", "reference_id", "debit", "credit", "created_at") VALUES
    (1, 'customer', 1, 'VOID_SALE', 1, 0.00, 0.00, '2026-02-27 23:38:11')
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"account_ledger_ledger_id_seq"', (SELECT MAX(ledger_id) FROM "account_ledger"))`);

  console.log('Inserting agrivet_transactions...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "agrivet_transactions" ("transaction_id", "ref_id", "transaction_date", "transaction_type", "account_name", "fund_source", "amount", "remarks") VALUES
    (1, 'T-751', '2026-01-29', 'Cash_Advance', 'JJ', 'Checkings', 65000.00, 'Cleared'),
    (2, 'T-750', '2026-01-29', 'Cash_Advance', 'JJ', 'Checkings', 100000.00, NULL),
    (3, 'T-749', '2026-01-29', 'Cash_Advance', 'JJ', 'Petty Cash', 4000.00, NULL),
    (4, 'T-748', '2026-01-29', 'Procurement', 'Madayaw', 'Petty Cash', 3465.00, NULL),
    (5, 'T-747', '2026-01-29', 'Procurement', 'Iggy Piggy', 'Petty Cash', 639.00, NULL),
    (7, 'T-745', '2026-01-28', 'Payment', 'Agrimex', 'Petty Cash', 2989.00, NULL),
    (8, 'T-744', '2026-01-28', 'Procurement', 'Cedric Yu', 'Checkings', 26335.00, NULL),
    (9, 'T-468', '2025-09-27', 'Expenses', 'Gas', 'Petty Cash', 2000.00, NULL),
    (10, 'T-467', '2025-09-27', 'Expenses', 'Cellophane', 'Petty Cash', 3501.00, NULL),
    (11, 'T-466', '2025-09-25', 'Supplier_Credit', 'H&S Premiere Corp', '0', 2904.00, NULL),
    (12, 'T-465', '2025-09-25', 'Procurement', 'Cedric Yu', 'Checkings', 38726.00, 'Cleared'),
    (13, 'T-464', '2025-09-24', 'Expenses', 'Office Supply', 'Petty Cash', 60.00, NULL),
    (14, 'T-463', '2025-09-24', 'Expenses', 'Rice', 'Petty Cash', 540.00, NULL),
    (15, 'T-462', '2025-09-23', 'Expenses', 'Labor', 'Petty Cash', 650.00, NULL),
    (16, 'T-461', '2025-09-23', 'Payment', 'Double Eagle', 'Petty Cash', 34867.00, NULL),
    (17, 'T-460', '2025-09-23', 'Procurement', 'Tatay Felix', 'Petty Cash', 2550.00, NULL),
    (18, 'T-751', '2026-01-29', 'Cash_Advance', 'JJ', 'Checkings', 65000.00, NULL),
    (19, 'T-750', '2026-01-29', 'Cash_Advance', 'JJ', 'Checkings', 100000.00, NULL),
    (20, 'T-749', '2026-01-29', 'Cash_Advance', 'JJ', 'Petty Cash', 4000.00, NULL),
    (21, 'T-748', '2026-01-29', 'Procurement', 'Madayaw', 'Petty Cash', 3465.00, NULL),
    (22, 'T-747', '2026-01-29', 'Procurement', 'Iggy Piggy', 'Petty Cash', 639.00, NULL),
    (23, 'T-746', '2026-01-28', 'Expenses', 'Bookeeper CA', 'Gcash', 14000.00, NULL),
    (24, 'T-745', '2026-01-28', 'Payment', 'Agrimex', 'Petty Cash', 2989.00, NULL),
    (25, 'T-744', '2026-01-28', 'Procurement', 'Cedric Yu', 'Checkings', 26335.00, NULL),
    (26, 'T-468', '2025-09-27', 'Expenses', 'Gas', 'Petty Cash', 2000.00, NULL),
    (27, 'T-467', '2025-09-27', 'Expenses', 'Cellophane', 'Petty Cash', 3501.00, NULL),
    (28, 'T-466', '2025-09-25', 'Supplier_Credit', 'H&S Premiere Corp', '0', 2904.00, NULL),
    (29, 'T-465', '2025-09-25', 'Procurement', 'Cedric Yu', 'Checkings', 38726.00, 'Cleared'),
    (30, 'T-464', '2025-09-24', 'Expenses', 'Office Supply', 'Petty Cash', 60.00, NULL),
    (31, 'T-463', '2025-09-24', 'Expenses', 'Rice', 'Petty Cash', 540.00, NULL),
    (32, 'T-462', '2025-09-23', 'Expenses', 'Labor', 'Petty Cash', 650.00, NULL),
    (33, 'T-461', '2025-09-23', 'Payment', 'Double Eagle', 'Petty Cash', 34867.00, NULL),
    (34, 'T-460', '2025-09-23', 'Procurement', 'Tatay Felix', 'Petty Cash', 2550.00, NULL),
    (35, 'T-900', '2026-02-01', 'Payment', 'Test Account', 'Cash', 5000.00, NULL),
    (36, 'T-100', '2025-09-01', 'Expenses', 'Office', 'Petty Cash', 500.00, 'Stationery'),
    (37, 'T-101', '2025-09-02', 'Procurement', 'Vendor A', 'Checkings', 1200.00, 'Stock'),
    (38, 'T-102', '2025-09-03', 'Payment', 'Supplier X', 'Bank', 20000.00, 'Invoice Payment'),
    (39, 'T-103', '2025-09-04', 'Cash_Advance', 'JJ', 'Checkings', 65000.00, 'Advance'),
    (40, 'T-104', '2025-09-05', 'Expenses', 'Fuel', 'Petty Cash', 1500.00, 'Transport'),
    (44, 'T-999', '2026-02-01', 'Payment', 'Test Account', 'Cash', 5000.00, 'Proc call'),
    (50, '5', '2026-02-28', 'SALE', 'Customer #3', NULL, 50.00, 'Sale #5'),
    (51, '6', '2026-02-28', 'SALE', 'Walk-in', NULL, 10000.00, 'Sale #6'),
    (52, '7', '2026-02-28', 'SALE', 'Walk-in', NULL, 50.00, 'Sale #7')
  `);
  await prisma.$executeRawUnsafe(`SELECT setval('"agrivet_transactions_transaction_id_seq"', (SELECT MAX(transaction_id) FROM "agrivet_transactions"))`);

  // Ensure admin user exists
  console.log('Ensuring admin user...');
  const bcrypt = require('bcryptjs');
  const adminHash = await bcrypt.hash('AdminPass1234!', 12);
  await prisma.users.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: adminHash,
      full_name: 'System Manager',
      role: 'MANAGER',
      is_active: true,
      updated_at: new Date()
    }
  });

  console.log('\n✅ Original data restored successfully!');
  
  // Print counts
  const counts = await Promise.all([
    prisma.products.count(),
    prisma.inventory.count(),
    prisma.customers.count(),
    prisma.suppliers.count(),
    prisma.sales.count(),
    prisma.employees.count()
  ]);
  
  console.log(`
Record counts:
- Products: ${counts[0]}
- Inventory: ${counts[1]}
- Customers: ${counts[2]}
- Suppliers: ${counts[3]}
- Sales: ${counts[4]}
- Employees: ${counts[5]}
`);
}

main()
  .catch((e) => {
    console.error('Error restoring data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
