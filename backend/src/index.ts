// backend/src/index.ts
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json()); 

app.use('/api/inventory', (req: Request, res: Response) => {
  res.json([
    { id: '1', name: 'Chicken', quantity: 15, unit: 'kg', lowStockThreshold: 5 },
    { id: '2', name: 'Rice', quantity: 50, unit: 'kg', lowStockThreshold: 20 }
  ]);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});