import * as dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Cleaning up existing data...");

  await prisma.saleRecord.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.supplierPrice.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.stallSettings.deleteMany();
  await prisma.stall.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating demo user...");
  const user = await prisma.user.create({
    data: {
      email: "demo@managemee.app",
      passwordHash: "demo-password-hash-placeholder",
      name: "Wang Le Ming",
    },
  });

  console.log("Creating stall...");
  const stall = await prisma.stall.create({
    data: {
      ownerId: user.id,
      stallName: "King Chicken Stall",
      location: "Block 123, Chinatown Food Centre",
      stallCategories: ["Rice Dishes", "Noodle Dishes", "Chicken Rice"],
      ingredientCategories: ["Meat", "Rice", "Noodles", "Vegetables", "Sauces"],
    },
  });

  console.log("Creating stall settings...");
  await prisma.stallSettings.create({
    data: {
      stallId: stall.id,
      lowStockAlerts: true,
      currency: "SGD",
      language: "English",
    },
  });

  console.log("Seeding suppliers...");
  const meatSupplier = await prisma.supplier.create({
    data: {
      stallId: stall.id,
      name: "Fresh Meat Supply Co.",
      phone: "91234567",
      items: ["Chicken", "Pork"],
    },
  });

  const vegSupplier = await prisma.supplier.create({
    data: {
      stallId: stall.id,
      name: "Green Market Veggies",
      phone: "98765432",
      items: ["Bok Choy", "Garlic", "Chili"],
    },
  });

  const dryGoodsSupplier = await prisma.supplier.create({
    data: {
      stallId: stall.id,
      name: "Ah Seng Dry Goods",
      phone: "99998888",
      items: ["Rice", "Noodles", "Soy Sauce"],
    },
  });

  console.log("Seeding inventory items...");
  const chicken = await prisma.inventoryItem.create({
    data: {
      stallId: stall.id,
      name: "Whole Chicken",
      category: "Meat",
      quantity: 50,
      unit: "kg",
      minQuantity: 15,
      supplier: meatSupplier.name,
      targetPrice: 4.5,
    },
  });

  const rice = await prisma.inventoryItem.create({
    data: {
      stallId: stall.id,
      name: "Jasmine Rice",
      category: "Rice",
      quantity: 100,
      unit: "kg",
      minQuantity: 25,
      supplier: dryGoodsSupplier.name,
      targetPrice: 1.2,
    },
  });

  const noodles = await prisma.inventoryItem.create({
    data: {
      stallId: stall.id,
      name: "Yellow Noodles",
      category: "Noodles",
      quantity: 20,
      unit: "kg",
      minQuantity: 5,
      supplier: dryGoodsSupplier.name,
      targetPrice: 2.0,
    },
  });

  const bokChoy = await prisma.inventoryItem.create({
    data: {
      stallId: stall.id,
      name: "Bok Choy",
      category: "Vegetables",
      quantity: 10,
      unit: "kg",
      minQuantity: 3,
      supplier: vegSupplier.name,
      targetPrice: 3.0,
    },
  });

  const soySauce = await prisma.inventoryItem.create({
    data: {
      stallId: stall.id,
      name: "Dark Soy Sauce",
      category: "Sauces",
      quantity: 5,
      unit: "L",
      minQuantity: 1,
      supplier: dryGoodsSupplier.name,
      targetPrice: 5.5,
    },
  });

  console.log("Seeding supplier prices...");
  await prisma.supplierPrice.createMany({
    data: [
      {
        supplierId: meatSupplier.id,
        supplierName: meatSupplier.name,
        inventoryItemId: chicken.id,
        price: 4.5,
      },
      {
        supplierId: dryGoodsSupplier.id,
        supplierName: dryGoodsSupplier.name,
        inventoryItemId: rice.id,
        price: 1.2,
      },
      {
        supplierId: dryGoodsSupplier.id,
        supplierName: dryGoodsSupplier.name,
        inventoryItemId: noodles.id,
        price: 2.0,
      },
      {
        supplierId: vegSupplier.id,
        supplierName: vegSupplier.name,
        inventoryItemId: bokChoy.id,
        price: 3.0,
      },
      {
        supplierId: dryGoodsSupplier.id,
        supplierName: dryGoodsSupplier.name,
        inventoryItemId: soySauce.id,
        price: 5.5,
      },
    ],
  });

  console.log("Seeding menu items...");
  const chickenRice = await prisma.menuItem.create({
    data: {
      stallId: stall.id,
      name: "Hainanese Chicken Rice",
      price: 4.5,
      category: "Rice Dishes",
    },
  });

  const chickenNoodles = await prisma.menuItem.create({
    data: {
      stallId: stall.id,
      name: "Chicken Noodle Soup",
      price: 4.0,
      category: "Noodle Dishes",
    },
  });

  console.log("Seeding recipe ingredients...");
  await prisma.recipeIngredient.createMany({
    data: [
      {
        menuItemId: chickenRice.id,
        inventoryItemId: chicken.id,
        inventoryItemName: chicken.name,
        quantity: 0.2,
        unit: "kg",
      },
      {
        menuItemId: chickenRice.id,
        inventoryItemId: rice.id,
        inventoryItemName: rice.name,
        quantity: 0.15,
        unit: "kg",
      },
      {
        menuItemId: chickenRice.id,
        inventoryItemId: soySauce.id,
        inventoryItemName: soySauce.name,
        quantity: 0.01,
        unit: "L",
      },
      {
        menuItemId: chickenNoodles.id,
        inventoryItemId: chicken.id,
        inventoryItemName: chicken.name,
        quantity: 0.15,
        unit: "kg",
      },
      {
        menuItemId: chickenNoodles.id,
        inventoryItemId: noodles.id,
        inventoryItemName: noodles.name,
        quantity: 0.2,
        unit: "kg",
      },
      {
        menuItemId: chickenNoodles.id,
        inventoryItemId: bokChoy.id,
        inventoryItemName: bokChoy.name,
        quantity: 0.05,
        unit: "kg",
      },
    ],
  });

  console.log("Generating 4 weeks of historical sales data...");
  const menuItems = await prisma.menuItem.findMany({
    where: { stallId: stall.id },
  });

  const today = new Date();
  let totalSalesCreated = 0;

  for (let daysAgo = 28; daysAgo >= 0; daysAgo--) {
    const targetDate = new Date();
    targetDate.setDate(today.getDate() - daysAgo);

    const dailyOrdersCount = Math.floor(Math.random() * 25) + 15;

    for (let i = 0; i < dailyOrdersCount; i++) {
      const randomDish = menuItems[Math.floor(Math.random() * menuItems.length)];
      const quantity = Math.floor(Math.random() * 4) + 1;

      const saleTime = new Date(targetDate);
      saleTime.setHours(
        10 + Math.floor(Math.random() * 11),
        Math.floor(Math.random() * 60),
        0,
        0
      );

      await prisma.saleRecord.create({
        data: {
          stallId: stall.id,
          menuItemId: randomDish.id,
          menuItemName: randomDish.name,
          menuItemPrice: randomDish.price,
          quantity,
          timestamp: saleTime,
        },
      });

      totalSalesCreated++;
    }
  }

  console.log(
    `✅ Success! Seeded demo user, stall, settings, and ${totalSalesCreated} historical sales.`
  );
}

main()
  .catch((e) => {
    console.error("Failed to seed database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });