import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.saleRecord.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.supplierPrice.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.inventoryItem.deleteMany();

  console.log("Database rows cleared.");
}

main()
  .catch((error) => {
    console.error("Failed to clear database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });