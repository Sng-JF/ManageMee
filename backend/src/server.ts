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

app.get('/api/forecast/today', async (req, res) => {
  try {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
    
    // 1. Fetch sales from the past 4 weeks to establish a baseline
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const historicalSales = await prisma.saleRecord.findMany({
      where: {
        timestamp: {
          gte: fourWeeksAgo
        }
      },
      include: {
        menuItem: {
          include: { ingredients: true }
        }
      }
    });

    // 2. Filter historical sales strictly to the same day of the week
    const sameDaySales = historicalSales.filter(
      sale => new Date(sale.timestamp).getDay() === currentDayOfWeek
    );

    // 3. Aggregate total portions sold per menu item over those 4 matching days
    const dishSalesCounts: Record<string, { totalQuantity: number, menuItem: any }> = {};

    sameDaySales.forEach(sale => {
      if (!dishSalesCounts[sale.menuItemId]) {
        dishSalesCounts[sale.menuItemId] = { totalQuantity: 0, menuItem: sale.menuItem };
      }
      dishSalesCounts[sale.menuItemId].totalQuantity += sale.quantity;
    });

    const prepRecommendations = [];
    let totalPredictedSales = 0;
    let totalAverageSales = 0;

    // Mock External Factors for the forecast algorithm
    const weatherFactor = 0.9; // 10% reduction due to "Rainy" weather
    const holidayFactor = 1.0; // 1.0 = No holiday effect

    // 4. Calculate predictions per dish
    for (const [menuItemId, data] of Object.entries(dishSalesCounts)) {
      // Average portions sold on this weekday over the last 4 weeks
      const averagePortions = data.totalQuantity / 4; 
      
      // Apply forecasting algorithm
      const predictedPortions = Math.ceil(averagePortions * weatherFactor * holidayFactor);
      
      // Calculate % change compared to the average
      const changePercentage = averagePortions > 0 
        ? Math.round(((predictedPortions - averagePortions) / averagePortions) * 100) 
        : 0;
      
      prepRecommendations.push({
        id: menuItemId,
        name: data.menuItem.name,
        prep: predictedPortions,
        change: changePercentage,
        ingredients: data.menuItem.ingredients
      });

      totalPredictedSales += predictedPortions * data.menuItem.price;
      totalAverageSales += averagePortions * data.menuItem.price;
    }

    // 5. Calculate total Ingredients Needed based on predicted prep
    const ingredientsNeededMap = new Map();

    prepRecommendations.forEach(dish => {
      dish.ingredients.forEach((ingredient: any) => {
        const current = ingredientsNeededMap.get(ingredient.inventoryItemId) || {
          id: ingredient.inventoryItemId,
          name: ingredient.inventoryItemName,
          quantity: 0,
          unit: ingredient.unit
        };
        
        // Convert quantities similarly to your SalesPrediction.tsx logic
        let quantityPerPortion = ingredient.quantity;
        let displayUnit = ingredient.unit;
        
        if (ingredient.unit === 'g') {
          quantityPerPortion = ingredient.quantity / 1000;
          displayUnit = 'kg';
        } else if (ingredient.unit === 'ml') {
          quantityPerPortion = ingredient.quantity / 1000;
          displayUnit = 'L';
        }

        current.quantity += quantityPerPortion * dish.prep;
        current.unit = displayUnit; // Set to the normalized display unit
        
        ingredientsNeededMap.set(ingredient.inventoryItemId, current);
      });
    });

    const ingredientsNeeded = Array.from(ingredientsNeededMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    // 6. Return payload matching frontend expectations
    res.json({
      date: today.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
      weather: 'Rainy',
      confidence: 'High (85%)',
      predictedSales: totalPredictedSales.toFixed(2),
      averageWeekdaySales: totalAverageSales.toFixed(2),
      prepRecommendations: prepRecommendations.map(p => ({
        name: p.name,
        prep: p.prep,
        change: p.change
      })),
      ingredientsNeeded
    });

  } catch (error) {
    console.error('Forecast generation failed:', error);
    res.status(500).json({ error: 'Failed to generate demand forecast' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});