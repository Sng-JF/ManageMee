import * as dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scryptCallback);

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

  console.log("Creating user testing demo account...");

  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync("password123", salt, 64)) as Buffer;
  const validPasswordHash = `${salt}:${derivedKey.toString("hex")}`;

  const user = await prisma.user.create({
    data: {
      email: "demo@managemee.app",
      passwordHash: validPasswordHash,
      name: "Hawker Tester",
    },
  });

  console.log("Creating stall...");
  const stall = await prisma.stall.create({
    data: {
      ownerId: user.id,
      stallName: "Local Delights Noodle Stall",
      location: "Block 456, User Testing Food Centre",
      stallCategories: ["Noodle Dishes", "Local Fare"],
      ingredientCategories: ["Noodles", "Meat", "Egg", "Sauces", "Vegetables"],
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
  const noodleSupplier = await prisma.supplier.create({
    data: {
      stallId: stall.id,
      name: "Ah Seng Noodle Factory",
      phone: "91112222",
      items: ["Flat Noodles", "Egg Noodles"],
    },
  });

  const farmSupplier = await prisma.supplier.create({
    data: {
      stallId: stall.id,
      name: "Happy Hens Egg Farm",
      phone: "93334444",
      items: ["Eggs"],
    },
  });

  const meatSupplier = await prisma.supplier.create({
    data: {
      stallId: stall.id,
      name: "Chinatown Meats",
      phone: "95556666",
      items: ["Char Siew", "Wontons"],
    },
  });

  const sauceSupplier = await prisma.supplier.create({
    data: {
      stallId: stall.id,
      name: "Traditional Sauces Co",
      phone: "97778888",
      items: ["Dark Soy Sauce"],
    },
  });

  console.log("Seeding inventory items...");
  
  // TASK 2 Setup: Eggs are purposely set to LOW STOCK (12 pcs left, minimum is 60)
  const eggs = await prisma.inventoryItem.create({
    data: {
      stallId: stall.id,
      name: "Eggs",
      category: "Egg",
      quantity: 12,        // Intentionally low to trigger restock alert!
      unit: "pcs",
      minQuantity: 60,     // Threshold for alert
      supplier: farmSupplier.name,
      targetPrice: 0.25,
    },
  });

  const flatNoodles = await prisma.inventoryItem.create({
    data: { stallId: stall.id, name: "Flat Noodles (Kway Teow)", category: "Noodles", quantity: 30, unit: "kg", minQuantity: 10, supplier: noodleSupplier.name, targetPrice: 1.5 },
  });

  const eggNoodles = await prisma.inventoryItem.create({
    data: { stallId: stall.id, name: "Egg Noodles", category: "Noodles", quantity: 25, unit: "kg", minQuantity: 8, supplier: noodleSupplier.name, targetPrice: 2.0 },
  });

  const wontons = await prisma.inventoryItem.create({
    data: { stallId: stall.id, name: "Wontons", category: "Meat", quantity: 200, unit: "pcs", minQuantity: 50, supplier: meatSupplier.name, targetPrice: 0.3 },
  });

  const charSiew = await prisma.inventoryItem.create({
    data: { stallId: stall.id, name: "Char Siew", category: "Meat", quantity: 5, unit: "kg", minQuantity: 2, supplier: meatSupplier.name, targetPrice: 12.0 },
  });

  const darkSoySauce = await prisma.inventoryItem.create({
    data: { stallId: stall.id, name: "Dark Soy Sauce", category: "Sauces", quantity: 10, unit: "L", minQuantity: 3, supplier: sauceSupplier.name, targetPrice: 4.0 },
  });

  console.log("Seeding supplier prices...");
  await prisma.supplierPrice.createMany({
    data: [
      { supplierId: farmSupplier.id, supplierName: farmSupplier.name, inventoryItemId: eggs.id, price: 0.25 },
      { supplierId: noodleSupplier.id, supplierName: noodleSupplier.name, inventoryItemId: flatNoodles.id, price: 1.5 },
      { supplierId: noodleSupplier.id, supplierName: noodleSupplier.name, inventoryItemId: eggNoodles.id, price: 2.0 },
      { supplierId: meatSupplier.id, supplierName: meatSupplier.name, inventoryItemId: wontons.id, price: 0.3 },
      { supplierId: meatSupplier.id, supplierName: meatSupplier.name, inventoryItemId: charSiew.id, price: 12.0 },
      { supplierId: sauceSupplier.id, supplierName: sauceSupplier.name, inventoryItemId: darkSoySauce.id, price: 4.0 },
    ],
  });

  console.log("Seeding menu items...");
  
  // TASK 1 Setup: Char Kway Teow created
  const charKwayTeow = await prisma.menuItem.create({
    data: {
      stallId: stall.id,
      name: "Char Kway Teow",
      price: 5.0,
      category: "Noodle Dishes",
    },
  });

  // TASK 3 Setup: Wonton Mee created
  const wontonMee = await prisma.menuItem.create({
    data: {
      stallId: stall.id,
      name: "Wonton Mee",
      price: 4.5,
      category: "Noodle Dishes",
    },
  });

  console.log("Seeding recipe ingredients...");
  await prisma.recipeIngredient.createMany({
    data: [
      // Char Kway Teow Ingredients
      { menuItemId: charKwayTeow.id, inventoryItemId: flatNoodles.id, inventoryItemName: flatNoodles.name, quantity: 0.2, unit: "kg" },
      { menuItemId: charKwayTeow.id, inventoryItemId: eggs.id, inventoryItemName: eggs.name, quantity: 1, unit: "pcs" },
      { menuItemId: charKwayTeow.id, inventoryItemId: darkSoySauce.id, inventoryItemName: darkSoySauce.name, quantity: 0.02, unit: "L" },
      
      // Wonton Mee Ingredients
      { menuItemId: wontonMee.id, inventoryItemId: eggNoodles.id, inventoryItemName: eggNoodles.name, quantity: 0.15, unit: "kg" },
      { menuItemId: wontonMee.id, inventoryItemId: wontons.id, inventoryItemName: wontons.name, quantity: 4, unit: "pcs" },
      { menuItemId: wontonMee.id, inventoryItemId: charSiew.id, inventoryItemName: charSiew.name, quantity: 0.05, unit: "kg" },
    ],
  });

  console.log("Generating 4 weeks of historical sales data for Forecasting...");
  
  const today = new Date();
  let totalSalesCreated = 0;

  // Simulate 28 days of past sales to generate a solid forecast line
  for (let daysAgo = 28; daysAgo >= 0; daysAgo--) {
    const targetDate = new Date();
    targetDate.setDate(today.getDate() - daysAgo);

    // CKT is highly popular, generating ~30-50 portions a day
    const cktOrdersCount = Math.floor(Math.random() * 15) + 15; // 15 to 30 orders
    
    for (let i = 0; i < cktOrdersCount; i++) {
      const quantity = Math.floor(Math.random() * 2) + 1; // 1 or 2 portions per order
      const saleTime = new Date(targetDate);
      saleTime.setHours(11 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);

      await prisma.saleRecord.create({
        data: {
          stallId: stall.id,
          menuItemId: charKwayTeow.id,
          menuItemName: charKwayTeow.name,
          menuItemPrice: charKwayTeow.price,
          quantity,
          timestamp: saleTime,
        },
      });
      totalSalesCreated++;
    }

    // Wonton Mee generates steady sales too
    const wontonOrdersCount = Math.floor(Math.random() * 10) + 10;
    
    for (let i = 0; i < wontonOrdersCount; i++) {
      const quantity = Math.floor(Math.random() * 2) + 1;
      const saleTime = new Date(targetDate);
      saleTime.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

      await prisma.saleRecord.create({
        data: {
          stallId: stall.id,
          menuItemId: wontonMee.id,
          menuItemName: wontonMee.name,
          menuItemPrice: wontonMee.price,
          quantity,
          timestamp: saleTime,
        },
      });
      totalSalesCreated++;
    }
  }

  console.log(
    `✅ Success! Seeded user testing data with ${totalSalesCreated} historical sales.`
  );
  console.log(`\nLogin Details for User Testing:\nEmail: demo@managemee.app\nPassword: password123\n`);
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