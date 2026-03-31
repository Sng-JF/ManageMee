import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new pg.Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });
const scryptAsync = promisify(scryptCallback);

const DEMO_USER = {
  email: 'demo@managemee.local',
  password: 'password123',
  name: 'Bryan Demo',
  stallName: 'Bryan Chicken & Noodles',
  location: 'Maxwell Food Centre #01-12',
  stallCategories: ['Rice Dishes', 'Noodle Dishes', 'Sides', 'Drinks'],
  ingredientCategories: ['Rice', 'Noodles', 'Protein', 'Vegetables', 'Condiments', 'Frozen'],
};

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

const sgtDateDaysAgo = (daysAgo: number, hour: number, minute = 0) => {
  const nowSgt = new Date(Date.now() + SGT_OFFSET_MS);

  return new Date(
    Date.UTC(
      nowSgt.getUTCFullYear(),
      nowSgt.getUTCMonth(),
      nowSgt.getUTCDate() - daysAgo,
      hour - 8,
      minute,
      0,
      0,
    ),
  );
};

const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
};

const cleanupExistingDemoData = async () => {
  const existingUser = await prisma.user.findUnique({
    where: { email: DEMO_USER.email },
    include: {
      stalls: {
        select: { id: true },
      },
    },
  });

  if (!existingUser) {
    return;
  }

  for (const stall of existingUser.stalls) {
    const [inventoryItems, suppliers, menuItems] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { stallId: stall.id }, select: { id: true } }),
      prisma.supplier.findMany({ where: { stallId: stall.id }, select: { id: true } }),
      prisma.menuItem.findMany({ where: { stallId: stall.id }, select: { id: true } }),
    ]);

    const inventoryItemIds = inventoryItems.map((item) => item.id);
    const supplierIds = suppliers.map((supplier) => supplier.id);
    const menuItemIds = menuItems.map((item) => item.id);

    await prisma.saleRecord.deleteMany({ where: { stallId: stall.id } });

    if (menuItemIds.length > 0) {
      await prisma.recipeIngredient.deleteMany({
        where: { menuItemId: { in: menuItemIds } },
      });
    }

    if (supplierIds.length > 0) {
      await prisma.supplierPrice.deleteMany({
        where: { supplierId: { in: supplierIds } },
      });
    }

    if (inventoryItemIds.length > 0) {
      await prisma.supplierPrice.deleteMany({
        where: { inventoryItemId: { in: inventoryItemIds } },
      });
    }

    await prisma.menuItem.deleteMany({ where: { stallId: stall.id } });
    await prisma.inventoryItem.deleteMany({ where: { stallId: stall.id } });
    await prisma.supplier.deleteMany({ where: { stallId: stall.id } });
    await prisma.stallSettings.deleteMany({ where: { stallId: stall.id } });
    await prisma.stall.delete({ where: { id: stall.id } });
  }

  await prisma.user.delete({ where: { id: existingUser.id } });
};

async function main() {
  console.log('Seeding demo data...');

  await cleanupExistingDemoData();

  const passwordHash = await hashPassword(DEMO_USER.password);

  const user = await prisma.user.create({
    data: {
      email: DEMO_USER.email,
      passwordHash,
      name: DEMO_USER.name,
    },
  });

  const stall = await prisma.stall.create({
    data: {
      ownerId: user.id,
      stallName: DEMO_USER.stallName,
      location: DEMO_USER.location,
      stallCategories: DEMO_USER.stallCategories,
      ingredientCategories: DEMO_USER.ingredientCategories,
    },
  });

  await prisma.stallSettings.create({
    data: {
      stallId: stall.id,
      lowStockAlerts: true,
      currency: 'SGD',
      language: 'English',
    },
  });

  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        stallId: stall.id,
        name: 'Ah Seng Trading',
        phone: '+65 9123 4567',
        items: ['Brown Rice', 'Yellow Noodles', 'Bee Hoon', 'Cooking Oil'],
      },
    }),
    prisma.supplier.create({
      data: {
        stallId: stall.id,
        name: 'Fresh Supplies Co',
        phone: '+65 9876 5432',
        items: ['Chicken Breast', 'Eggs', 'Prawns', 'Wontons'],
      },
    }),
    prisma.supplier.create({
      data: {
        stallId: stall.id,
        name: 'Green Veggie Market',
        phone: '+65 8765 4321',
        items: ['Bok Choy', 'Bean Sprouts', 'Spring Onion'],
      },
    }),
    prisma.supplier.create({
      data: {
        stallId: stall.id,
        name: 'Spice World',
        phone: '+65 9345 6789',
        items: ['Chili Paste', 'Soy Sauce', 'Lemon Sauce'],
      },
    }),
    prisma.supplier.create({
      data: {
        stallId: stall.id,
        name: 'Wholesale Direct',
        phone: '+65 9654 3210',
        items: ['Brown Rice', 'Chicken Breast', 'Cooking Oil'],
      },
    }),
  ]);

  const supplierByName = Object.fromEntries(suppliers.map((supplier) => [supplier.name, supplier]));

  const inventoryItems = await Promise.all([
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Brown Rice',
        category: 'Rice',
        quantity: 18,
        unit: 'kg',
        minQuantity: 10,
        supplier: 'Ah Seng Trading',
        targetPrice: 3.8,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Yellow Noodles',
        category: 'Noodles',
        quantity: 8,
        unit: 'kg',
        minQuantity: 5,
        supplier: 'Ah Seng Trading',
        targetPrice: 3.5,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Bee Hoon',
        category: 'Noodles',
        quantity: 6,
        unit: 'kg',
        minQuantity: 4,
        supplier: 'Ah Seng Trading',
        targetPrice: 4.2,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Chicken Breast',
        category: 'Protein',
        quantity: 14,
        unit: 'kg',
        minQuantity: 8,
        supplier: 'Fresh Supplies Co',
        targetPrice: 8.8,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Eggs',
        category: 'Protein',
        quantity: 24,
        unit: 'pcs',
        minQuantity: 30,
        supplier: 'Fresh Supplies Co',
        targetPrice: 0.35,
        pendingRestock: {
          quantity: 60,
          supplier: 'Fresh Supplies Co',
          estimatedCost: 21,
          date: sgtDateDaysAgo(-1, 7, 0).toISOString().slice(0, 10),
        },
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Prawns',
        category: 'Protein',
        quantity: 5,
        unit: 'kg',
        minQuantity: 3,
        supplier: 'Fresh Supplies Co',
        targetPrice: 18.5,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Wontons',
        category: 'Frozen',
        quantity: 80,
        unit: 'pcs',
        minQuantity: 40,
        supplier: 'Fresh Supplies Co',
        targetPrice: 0.4,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Bok Choy',
        category: 'Vegetables',
        quantity: 1.2,
        unit: 'kg',
        minQuantity: 3,
        supplier: 'Green Veggie Market',
        targetPrice: 2.8,
        pendingRestock: {
          quantity: 5,
          supplier: 'Green Veggie Market',
          estimatedCost: 14,
          date: sgtDateDaysAgo(1, 6, 30).toISOString().slice(0, 10),
        },
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Bean Sprouts',
        category: 'Vegetables',
        quantity: 4.5,
        unit: 'kg',
        minQuantity: 2,
        supplier: 'Green Veggie Market',
        targetPrice: 1.5,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Spring Onion',
        category: 'Vegetables',
        quantity: 2.2,
        unit: 'kg',
        minQuantity: 1,
        supplier: 'Green Veggie Market',
        targetPrice: 3.2,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Chili Paste',
        category: 'Condiments',
        quantity: 2,
        unit: 'kg',
        minQuantity: 1.5,
        supplier: 'Spice World',
        targetPrice: 12,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Soy Sauce',
        category: 'Condiments',
        quantity: 4,
        unit: 'L',
        minQuantity: 2,
        supplier: 'Spice World',
        targetPrice: 6.5,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Cooking Oil',
        category: 'Condiments',
        quantity: 12,
        unit: 'L',
        minQuantity: 8,
        supplier: 'Ah Seng Trading',
        targetPrice: 5.2,
      },
    }),
    prisma.inventoryItem.create({
      data: {
        stallId: stall.id,
        name: 'Lemon Sauce',
        category: 'Condiments',
        quantity: 3.5,
        unit: 'L',
        minQuantity: 1.5,
        supplier: 'Spice World',
        targetPrice: 7.2,
      },
    }),
  ]);

  const inventoryByName = Object.fromEntries(inventoryItems.map((item) => [item.name, item]));

  const supplierPriceData = [
    ['Ah Seng Trading', 'Brown Rice', 3.8],
    ['Wholesale Direct', 'Brown Rice', 3.6],
    ['Ah Seng Trading', 'Yellow Noodles', 3.5],
    ['Ah Seng Trading', 'Bee Hoon', 4.2],
    ['Fresh Supplies Co', 'Chicken Breast', 8.8],
    ['Wholesale Direct', 'Chicken Breast', 8.5],
    ['Fresh Supplies Co', 'Eggs', 0.35],
    ['Fresh Supplies Co', 'Prawns', 18.5],
    ['Fresh Supplies Co', 'Wontons', 0.4],
    ['Green Veggie Market', 'Bok Choy', 2.8],
    ['Green Veggie Market', 'Bean Sprouts', 1.5],
    ['Green Veggie Market', 'Spring Onion', 3.2],
    ['Spice World', 'Chili Paste', 12],
    ['Spice World', 'Soy Sauce', 6.5],
    ['Spice World', 'Lemon Sauce', 7.2],
    ['Ah Seng Trading', 'Cooking Oil', 5.2],
    ['Wholesale Direct', 'Cooking Oil', 4.9],
  ] as const;

  await prisma.supplierPrice.createMany({
    data: supplierPriceData.map(([supplierName, inventoryName, price]) => ({
      supplierId: supplierByName[supplierName].id,
      supplierName,
      inventoryItemId: inventoryByName[inventoryName].id,
      price,
    })),
  });

  const menuItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        stallId: stall.id,
        name: 'Roasted Chicken Rice',
        price: 5.5,
        category: 'Rice Dishes',
        ingredients: {
          create: [
            { inventoryItemId: inventoryByName['Brown Rice'].id, inventoryItemName: 'Brown Rice', quantity: 0.18, unit: 'kg' },
            { inventoryItemId: inventoryByName['Chicken Breast'].id, inventoryItemName: 'Chicken Breast', quantity: 0.16, unit: 'kg' },
            { inventoryItemId: inventoryByName['Bok Choy'].id, inventoryItemName: 'Bok Choy', quantity: 0.04, unit: 'kg' },
            { inventoryItemId: inventoryByName['Soy Sauce'].id, inventoryItemName: 'Soy Sauce', quantity: 0.01, unit: 'L' },
            { inventoryItemId: inventoryByName['Chili Paste'].id, inventoryItemName: 'Chili Paste', quantity: 0.005, unit: 'kg' },
          ],
        },
      },
    }),
    prisma.menuItem.create({
      data: {
        stallId: stall.id,
        name: 'Lemon Chicken Rice',
        price: 6.2,
        category: 'Rice Dishes',
        ingredients: {
          create: [
            { inventoryItemId: inventoryByName['Brown Rice'].id, inventoryItemName: 'Brown Rice', quantity: 0.18, unit: 'kg' },
            { inventoryItemId: inventoryByName['Chicken Breast'].id, inventoryItemName: 'Chicken Breast', quantity: 0.17, unit: 'kg' },
            { inventoryItemId: inventoryByName['Bok Choy'].id, inventoryItemName: 'Bok Choy', quantity: 0.04, unit: 'kg' },
            { inventoryItemId: inventoryByName['Lemon Sauce'].id, inventoryItemName: 'Lemon Sauce', quantity: 0.02, unit: 'L' },
          ],
        },
      },
    }),
    prisma.menuItem.create({
      data: {
        stallId: stall.id,
        name: 'Wonton Mee',
        price: 4.8,
        category: 'Noodle Dishes',
        ingredients: {
          create: [
            { inventoryItemId: inventoryByName['Yellow Noodles'].id, inventoryItemName: 'Yellow Noodles', quantity: 0.16, unit: 'kg' },
            { inventoryItemId: inventoryByName['Wontons'].id, inventoryItemName: 'Wontons', quantity: 4, unit: 'pcs' },
            { inventoryItemId: inventoryByName['Spring Onion'].id, inventoryItemName: 'Spring Onion', quantity: 0.01, unit: 'kg' },
            { inventoryItemId: inventoryByName['Soy Sauce'].id, inventoryItemName: 'Soy Sauce', quantity: 0.01, unit: 'L' },
          ],
        },
      },
    }),
    prisma.menuItem.create({
      data: {
        stallId: stall.id,
        name: 'Char Kway Teow',
        price: 5.2,
        category: 'Noodle Dishes',
        ingredients: {
          create: [
            { inventoryItemId: inventoryByName['Bee Hoon'].id, inventoryItemName: 'Bee Hoon', quantity: 0.15, unit: 'kg' },
            { inventoryItemId: inventoryByName['Eggs'].id, inventoryItemName: 'Eggs', quantity: 1, unit: 'pcs' },
            { inventoryItemId: inventoryByName['Prawns'].id, inventoryItemName: 'Prawns', quantity: 0.05, unit: 'kg' },
            { inventoryItemId: inventoryByName['Bean Sprouts'].id, inventoryItemName: 'Bean Sprouts', quantity: 0.04, unit: 'kg' },
            { inventoryItemId: inventoryByName['Cooking Oil'].id, inventoryItemName: 'Cooking Oil', quantity: 0.015, unit: 'L' },
            { inventoryItemId: inventoryByName['Soy Sauce'].id, inventoryItemName: 'Soy Sauce', quantity: 0.01, unit: 'L' },
          ],
        },
      },
    }),
  ]);

  const menuByName = Object.fromEntries(menuItems.map((item) => [item.name, item]));

  const salesData = [
    // Today: gives the dashboard recent sales, revenue, and hourly chart data.
    ['Roasted Chicken Rice', 2, sgtDateDaysAgo(0, 7, 20)],
    ['Wonton Mee', 1, sgtDateDaysAgo(0, 8, 10)],
    ['Char Kway Teow', 2, sgtDateDaysAgo(0, 9, 35)],
    ['Roasted Chicken Rice', 3, sgtDateDaysAgo(0, 11, 55)],
    ['Lemon Chicken Rice', 2, sgtDateDaysAgo(0, 12, 25)],
    ['Wonton Mee', 3, sgtDateDaysAgo(0, 13, 5)],
    ['Char Kway Teow', 1, sgtDateDaysAgo(0, 14, 15)],

    // Same weekday over the previous 4 weeks: gives the forecast route real history.
    ['Roasted Chicken Rice', 5, sgtDateDaysAgo(7, 12, 0)],
    ['Lemon Chicken Rice', 2, sgtDateDaysAgo(7, 12, 25)],
    ['Wonton Mee', 4, sgtDateDaysAgo(7, 13, 10)],
    ['Char Kway Teow', 3, sgtDateDaysAgo(7, 14, 5)],

    ['Roasted Chicken Rice', 4, sgtDateDaysAgo(14, 12, 10)],
    ['Lemon Chicken Rice', 2, sgtDateDaysAgo(14, 12, 40)],
    ['Wonton Mee', 5, sgtDateDaysAgo(14, 13, 20)],
    ['Char Kway Teow', 3, sgtDateDaysAgo(14, 14, 0)],

    ['Roasted Chicken Rice', 6, sgtDateDaysAgo(21, 12, 15)],
    ['Lemon Chicken Rice', 3, sgtDateDaysAgo(21, 12, 35)],
    ['Wonton Mee', 5, sgtDateDaysAgo(21, 13, 15)],
    ['Char Kway Teow', 4, sgtDateDaysAgo(21, 13, 55)],

    ['Roasted Chicken Rice', 5, sgtDateDaysAgo(28, 12, 5)],
    ['Lemon Chicken Rice', 2, sgtDateDaysAgo(28, 12, 30)],
    ['Wonton Mee', 4, sgtDateDaysAgo(28, 13, 0)],
    ['Char Kway Teow', 4, sgtDateDaysAgo(28, 13, 45)],

    // Recent extra history for weekly comparison and general analytics.
    ['Roasted Chicken Rice', 4, sgtDateDaysAgo(1, 12, 5)],
    ['Wonton Mee', 2, sgtDateDaysAgo(2, 13, 0)],
    ['Char Kway Teow', 3, sgtDateDaysAgo(3, 14, 10)],
    ['Lemon Chicken Rice', 2, sgtDateDaysAgo(5, 12, 40)],
    ['Roasted Chicken Rice', 3, sgtDateDaysAgo(6, 11, 55)],
  ] as const;

  await prisma.saleRecord.createMany({
    data: salesData.map(([menuName, quantity, timestamp]) => ({
      stallId: stall.id,
      menuItemId: menuByName[menuName].id,
      menuItemName: menuName,
      menuItemPrice: menuByName[menuName].price,
      quantity,
      timestamp,
    })),
  });

  console.log('✅ Demo seed complete');
  console.log(`Login email: ${DEMO_USER.email}`);
  console.log(`Login password: ${DEMO_USER.password}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
