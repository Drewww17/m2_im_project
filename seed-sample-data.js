const fs = require('fs');
const path = require('path');
const { PrismaClient, products_source } = require('@prisma/client');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  let employee = await prisma.employees.findFirst({
    where: {
      employee_name: 'System Clerk',
      role: 'CLERK',
    },
  });

  if (!employee) {
    employee = await prisma.employees.create({
      data: {
        employee_name: 'System Clerk',
        role: 'CLERK',
      },
    });
  }

  const supplier1 = await prisma.suppliers.upsert({
    where: { supplier_name: 'AgriFeed Supply Co.' },
    update: { is_active: true },
    create: {
      supplier_name: 'AgriFeed Supply Co.',
      contact_number: '09171234567',
      is_active: true,
    },
  });

  const supplier2 = await prisma.suppliers.upsert({
    where: { supplier_name: 'FarmVet Traders' },
    update: { is_active: true },
    create: {
      supplier_name: 'FarmVet Traders',
      contact_number: '09179876543',
      is_active: true,
    },
  });

  const customer1 = await prisma.customers.upsert({
    where: { customer_name: 'Juan Dela Cruz' },
    update: { is_active: true, customer_type: 'REGULAR' },
    create: {
      customer_name: 'Juan Dela Cruz',
      customer_type: 'REGULAR',
      contact_number: '09991234567',
      is_active: true,
      status: 'ACTIVE',
    },
  });

  const customer2 = await prisma.customers.upsert({
    where: { customer_name: 'Maria Santos' },
    update: { is_active: true, customer_type: 'VIP' },
    create: {
      customer_name: 'Maria Santos',
      customer_type: 'VIP',
      contact_number: '09999887766',
      is_active: true,
      status: 'ACTIVE',
      credit_limit: 5000,
    },
  });

  const product1 = await prisma.products.upsert({
    where: { product_name: 'Hog Grower Feeds 25kg' },
    update: { is_active: true, supplier_id: supplier1.supplier_id },
    create: {
      product_name: 'Hog Grower Feeds 25kg',
      category: 'Feeds',
      unit_price: 1250,
      srp: 1300,
      dealer_price: 1225,
      reorder_level: 10,
      unit_type: 'sack',
      unit_quantity: 1,
      status: 'ACTIVE',
      source: products_source.local,
      is_active: true,
      supplier_id: supplier1.supplier_id,
    },
  });

  const product2 = await prisma.products.upsert({
    where: { product_name: 'Vitamin Premix 1kg' },
    update: { is_active: true, supplier_id: supplier2.supplier_id },
    create: {
      product_name: 'Vitamin Premix 1kg',
      category: 'Supplements',
      unit_price: 480,
      srp: 520,
      dealer_price: 470,
      reorder_level: 20,
      unit_type: 'pack',
      unit_quantity: 1,
      status: 'ACTIVE',
      source: products_source.import,
      is_active: true,
      supplier_id: supplier2.supplier_id,
    },
  });

  const existingInv1 = await prisma.inventory.findFirst({
    where: { product_id: product1.product_id, batch_number: 'BATCH-HGF-001' },
  });
  if (!existingInv1) {
    await prisma.inventory.create({
      data: {
        product_id: product1.product_id,
        current_stock: 45,
        batch_number: 'BATCH-HGF-001',
        is_active: true,
      },
    });
  }

  const existingInv2 = await prisma.inventory.findFirst({
    where: { product_id: product2.product_id, batch_number: 'BATCH-VPM-001' },
  });
  if (!existingInv2) {
    await prisma.inventory.create({
      data: {
        product_id: product2.product_id,
        current_stock: 22,
        batch_number: 'BATCH-VPM-001',
        is_active: true,
      },
    });
  }

  const existingSale = await prisma.sales.findFirst({
    where: {
      customer_id: customer1.customer_id,
      remarks: 'Sample seeded sale',
    },
  });

  if (!existingSale) {
    const sale = await prisma.sales.create({
      data: {
        sale_date: new Date(),
        sale_status: 'COMPLETED',
        process_type: 'WALK_IN',
        remarks: 'Sample seeded sale',
        customer_id: customer1.customer_id,
        employee_id: employee.employee_id,
        payment_method: 'CASH',
        total_amount: 2600,
        amount_paid: 2600,
        is_active: true,
      },
    });

    await prisma.sale_details.create({
      data: {
        sale_id: sale.sale_id,
        product_id: product1.product_id,
        quantity: 2,
        unit_price: 1300,
      },
    });
  }

  console.log('Sample data seeded successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to seed sample data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
