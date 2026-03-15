import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Initialize the native Postgres connection pool
const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
// 2. Wrap it in the Prisma adapter
const adapter = new PrismaPg(pool);
// 3. Pass the adapter to PrismaClient
const prisma = new PrismaClient({ adapter });

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Get all inventory items
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Create a new inventory item
app.post('/api/inventory', async (req, res) => {
  try {
    const { name, category, quantity, unit, minQuantity, supplier, targetPrice, pendingRestock } = req.body;
    const newItem = await prisma.inventoryItem.create({
      data: {
        name,
        category,
        quantity,
        unit,
        minQuantity,
        supplier,
        targetPrice,
        pendingRestock: pendingRestock || null
      }
    });
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

// Update inventory quantity (e.g., after restock or daily prep)
app.patch('/api/inventory/:id/quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantityDelta } = req.body; // Positive to add, negative to subtract
    
    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: {
          increment: quantityDelta
        }
      }
    });
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update inventory quantity' });
  }
});


// Get all menu items with their ingredients
app.get('/api/menu', async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      include: {
        ingredients: true
      }
    });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// Create a new menu item with its recipe ingredients
app.post('/api/menu', async (req, res) => {
  try {
    const { name, price, category, ingredients } = req.body;
    
    const newMenuItem = await prisma.menuItem.create({
      data: {
        name,
        price,
        category,
        ingredients: {
          create: ingredients.map((ing: any) => ({
            inventoryItemId: ing.inventoryItemId,
            inventoryItemName: ing.inventoryItemName,
            quantity: ing.quantity,
            unit: ing.unit
          }))
        }
      },
      include: { ingredients: true }
    });
    
    res.status(201).json(newMenuItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// Record a sale and automatically deduct ingredients
app.post('/api/sales', async (req, res) => {
  try {
    const { menuItemId, menuItemName, quantity } = req.body;

    // 1. Record the sale transaction
    const sale = await prisma.saleRecord.create({
      data: {
        menuItemId,
        menuItemName,
        quantity
      }
    });

    // 2. Fetch the recipe to know what ingredients to deduct
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { ingredients: true }
    });

    if (menuItem) {
      // 3. Deduct inventory for each ingredient used in the order
      for (const ingredient of menuItem.ingredients) {
        const totalDeduction = ingredient.quantity * quantity;
        
        await prisma.inventoryItem.update({
          where: { id: ingredient.inventoryItemId },
          data: {
            quantity: {
              decrement: totalDeduction
            }
          }
        });
      }
    }

    res.status(201).json({ message: 'Sale recorded and inventory updated', sale });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record sale' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});