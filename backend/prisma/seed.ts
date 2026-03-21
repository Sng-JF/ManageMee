import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();
// Initialize the native Postgres connection pool and adapter exactly like server.ts
const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching menu items...');
  const menuItems = await prisma.menuItem.findMany();

  if (menuItems.length === 0) {
    console.log('⚠️ No menu items found. Please add some dishes to your menu via the frontend first!');
    return;
  }

  console.log('Clearing old sale records to start fresh...');
  await prisma.saleRecord.deleteMany();

  console.log('Generating 4 weeks of historical sales data...');
  
  const today = new Date();
  let totalSalesCreated = 0;

  // Loop backwards from 28 days ago up to today
  for (let daysAgo = 28; daysAgo >= 0; daysAgo--) {
    const targetDate = new Date();
    targetDate.setDate(today.getDate() - daysAgo);

    // Generate random number of orders for the day (e.g., 15 to 40 orders)
    const dailyOrdersCount = Math.floor(Math.random() * 25) + 15;

    for (let i = 0; i < dailyOrdersCount; i++) {
      // Pick a random dish from your menu
      const randomDish = menuItems[Math.floor(Math.random() * menuItems.length)];
      
      // Randomize portions per order (1 to 4 portions)
      const quantity = Math.floor(Math.random() * 4) + 1;

      // Randomize the time of the sale (between 10 AM and 9 PM)
      const saleTime = new Date(targetDate);
      saleTime.setHours(10 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), 0, 0);

      await prisma.saleRecord.create({
        data: {
          menuItemId: randomDish.id,
          menuItemName: randomDish.name,
          quantity: quantity,
          timestamp: saleTime,
        }
      });
      
      totalSalesCreated++;
    }
  }

  console.log(`✅ Success! Generated ${totalSalesCreated} historical sale records across the last 28 days.`);
  console.log('Your demand forecasting dashboard should now display data!');
}

main()
  .catch((e) => {
    console.error('Failed to seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });