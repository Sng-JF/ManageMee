import "dotenv/config";
import express from "express";
import type { Response } from "express";
import cors from "cors";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();
const PORT = Number(process.env.PORT) || 3001;

type ValidationFailure = { error: string };
type ValidationSuccess<T> = { data: T };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;


app.use(cors());
app.use(express.json({ limit: "25mb" }));

const sendInternalError = (res: Response, message: string, error: unknown) => {
  console.error(message, error);
  res.status(500).json({ error: message });
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isPrismaNotFound = (error: unknown) => {
  return isObject(error) && error.code === "P2025";
};

const normalizeString = (value: unknown) => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  return NaN;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => normalizeString(item))
    .filter((item) => item.length > 0);
};

const normalizePendingRestock = (value: unknown) => {
  if (!isObject(value)) {
    return null;
  }

  const quantity = normalizeNumber(value.quantity);
  const supplier = normalizeString(value.supplier);
  const estimatedCost = normalizeNumber(value.estimatedCost);
  const date = normalizeString(value.date);

  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(estimatedCost) ||
    supplier.length === 0 ||
    date.length === 0
  ) {
    return null;
  }

  return {
    quantity,
    supplier,
    estimatedCost,
    date,
  };
};

const convertUnitQuantity = (
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null => {
  if (fromUnit === toUnit) return quantity;

  if (fromUnit === 'g' && toUnit === 'kg') return quantity / 1000;
  if (fromUnit === 'kg' && toUnit === 'g') return quantity * 1000;

  if (fromUnit === 'ml' && toUnit === 'L') return quantity / 1000;
  if (fromUnit === 'L' && toUnit === 'ml') return quantity * 1000;

  return null;
};

const roundQuantity = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

type PendingRestockPayload = {
  quantity: number;
  supplier: string;
  estimatedCost: number;
  date: string;
};

type InventoryPayload = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  supplier: string;
  targetPrice: number;
  pendingRestock: PendingRestockPayload | null;
  image: string | null;
};

const validateInventoryPayload = (body: unknown): ValidationResult<InventoryPayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const name = normalizeString(body.name);
  const category = normalizeString(body.category);
  const quantity = normalizeNumber(body.quantity);
  const unit = normalizeString(body.unit);
  const minQuantity = normalizeNumber(body.minQuantity);
  const supplier = normalizeString(body.supplier);
  const targetPrice = normalizeNumber(body.targetPrice);
  const pendingRestock = normalizePendingRestock(body.pendingRestock);
  const imageValue = normalizeString(body.image);
  const image = imageValue.length > 0 ? imageValue : null;

  if (!name || !category || !unit || !supplier) {
    return {
      error: "name, category, unit, and supplier are required.",
    };
  }

  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(minQuantity) ||
    !Number.isFinite(targetPrice)
  ) {
    return {
      error: "quantity, minQuantity, and targetPrice must be valid numbers.",
    };
  }

  return {
    data: {
      name,
      category,
      quantity,
      unit,
      minQuantity,
      supplier,
      targetPrice,
      pendingRestock,
      image,
    },
  };
};

const toInventoryItemData = (
  payload: InventoryPayload
): Prisma.InventoryItemCreateInput => {
  return {
    name: payload.name,
    category: payload.category,
    quantity: roundQuantity(payload.quantity),
    unit: payload.unit,
    minQuantity: roundQuantity(payload.minQuantity),
    supplier: payload.supplier,
    targetPrice: payload.targetPrice,
    image: payload.image,
    pendingRestock:
      payload.pendingRestock === null
        ? Prisma.DbNull
        : (payload.pendingRestock as Prisma.InputJsonObject),
  };
};

type NormalizedIngredient = {
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: string;
};

type MenuPayload = {
  name: string;
  category: string;
  price: number;
  image: string | null;
  ingredients: NormalizedIngredient[];
};

const validateIngredients = (ingredients: unknown): ValidationResult<NormalizedIngredient[]> => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return { error: "ingredients must be a non-empty array." };
  }

  const normalized: NormalizedIngredient[] = [];

  for (const ingredient of ingredients) {
    if (!isObject(ingredient)) {
      return { error: "Each ingredient must be an object." };
    }

    const inventoryItemId = normalizeString(ingredient.inventoryItemId);
    const inventoryItemName = normalizeString(ingredient.inventoryItemName);
    const quantity = normalizeNumber(ingredient.quantity);
    const unit = normalizeString(ingredient.unit);

    if (!inventoryItemId || !inventoryItemName || !unit) {
      return {
        error: "Each ingredient must include inventoryItemId, inventoryItemName, and unit.",
      };
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      return {
        error: "Each ingredient quantity must be a valid non-negative number.",
      };
    }

    normalized.push({ inventoryItemId, inventoryItemName, quantity, unit });
  }

  return { data: normalized };
};

const validateMenuPayload = (body: unknown): ValidationResult<MenuPayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const name = normalizeString(body.name);
  const category = normalizeString(body.category);
  const price = normalizeNumber(body.price);
  const imageValue = normalizeString(body.image);
  const image = imageValue.length > 0 ? imageValue : null;
  const ingredientsResult = validateIngredients(body.ingredients);

  if (!name || !category) {
    return { error: "name and category are required." };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: "price must be a valid non-negative number." };
  }

  if ("error" in ingredientsResult) {
    return { error: ingredientsResult.error };
  }

  return {
    data: {
      name,
      category,
      price,
      image,
      ingredients: ingredientsResult.data,
    },
  };
};

type SupplierPayload = {
  name: string;
  phone: string;
  items: string[];
};

const validateSupplierPayload = (body: unknown): ValidationResult<SupplierPayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const name = normalizeString(body.name);
  const phone = normalizeString(body.phone);
  const items = normalizeStringArray(body.items);

  if (!name || !phone) {
    return { error: "name and phone are required." };
  }

  return {
    data: {
      name,
      phone,
      items,
    },
  };
};

type SupplierPricePayload = {
  supplierId: string;
  inventoryItemId: string;
  price: number;
};

const validateSupplierPricePayload = (body: unknown): ValidationResult<SupplierPricePayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const supplierId = normalizeString(body.supplierId);
  const inventoryItemId = normalizeString(body.inventoryItemId);
  const price = normalizeNumber(body.price);

  if (!supplierId || !inventoryItemId) {
    return { error: "supplierId and inventoryItemId are required." };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: "price must be a valid non-negative number." };
  }

  return {
    data: {
      supplierId,
      inventoryItemId,
      price,
    },
  };
};

type SalePayload = {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
};

const validateSalePayload = (body: unknown): ValidationResult<SalePayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const menuItemId = normalizeString(body.menuItemId);
  const menuItemName = normalizeString(body.menuItemName);
  const quantity = normalizeNumber(body.quantity);

  if (!menuItemId || !menuItemName) {
    return { error: "menuItemId and menuItemName are required." };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "quantity must be a positive integer." };
  }

  return {
    data: {
      menuItemId,
      menuItemName,
      quantity,
    },
  };
};

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/inventory/low-stock", async (_req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const lowStockItems = items.filter((item) => item.quantity < item.minQuantity);
    res.json(lowStockItems);
  } catch (error) {
    sendInternalError(res, "Failed to fetch low stock inventory.", error);
  }
});

app.get("/api/inventory", async (_req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json(items);
  } catch (error) {
    sendInternalError(res, "Failed to fetch inventory.", error);
  }
});

app.get("/api/inventory/:id", async (req, res) => {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
    });

    if (!item) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    return res.json(item);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch inventory item.", error);
  }
});

app.post("/api/inventory", async (req, res) => {
  const payload = validateInventoryPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const newItem = await prisma.inventoryItem.create({
      data: toInventoryItemData(payload.data),
    });

    return res.status(201).json(newItem);
  } catch (error) {
    return sendInternalError(res, "Failed to create inventory item.", error);
  }
});

app.put("/api/inventory/:id", async (req, res) => {
  const payload = validateInventoryPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const updatedItem = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: toInventoryItemData(payload.data),
    });

    return res.json(updatedItem);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    return sendInternalError(res, "Failed to update inventory item.", error);
  }
});

app.patch("/api/inventory/:id/quantity", async (req, res) => {
  const quantityDelta = normalizeNumber(isObject(req.body) ? req.body.quantityDelta : undefined);

  if (!Number.isFinite(quantityDelta)) {
    return res.status(400).json({ error: "quantityDelta must be a valid number." });
  }

  try {
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
      select: { quantity: true },
    });

    if (!existingItem) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    const updatedItem = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        quantity: roundQuantity(existingItem.quantity + quantityDelta),
      },
    });

    return res.json(updatedItem);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    return sendInternalError(res, "Failed to update inventory quantity.", error);
  }
});

app.delete("/api/inventory/:id", async (req, res) => {
  try {
    const recipeCount = await prisma.recipeIngredient.count({
      where: { inventoryItemId: req.params.id },
    });

    if (recipeCount > 0) {
      return res.status(409).json({
        error: "Cannot delete inventory item because it is used in one or more menu recipes.",
      });
    }

    await prisma.supplierPrice.deleteMany({
      where: { inventoryItemId: req.params.id },
    });

    const deletedItem = await prisma.inventoryItem.delete({
      where: { id: req.params.id },
    });

    return res.json(deletedItem);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    return sendInternalError(res, "Failed to delete inventory item.", error);
  }
});

app.get("/api/menu", async (_req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      include: { ingredients: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return res.json(menuItems);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch menu items.", error);
  }
});

app.get("/api/menu/:id", async (req, res) => {
  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
      include: { ingredients: true },
    });

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    return res.json(menuItem);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch menu item.", error);
  }
});

app.post("/api/menu", async (req, res) => {
  const payload = validateMenuPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const inventoryIds = payload.data.ingredients.map((ingredient) => ingredient.inventoryItemId);
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { id: { in: inventoryIds } },
      select: { id: true },
    });

    if (inventoryItems.length !== inventoryIds.length) {
      return res.status(400).json({
        error: "One or more ingredients reference inventory items that do not exist.",
      });
    }

    const newMenuItem = await prisma.menuItem.create({
      data: {
        name: payload.data.name,
        category: payload.data.category,
        price: payload.data.price,
        image: payload.data.image,
        ingredients: {
          create: payload.data.ingredients,
        },
      },
      include: { ingredients: true },
    });

    return res.status(201).json(newMenuItem);
  } catch (error) {
    return sendInternalError(res, "Failed to create menu item.", error);
  }
});

app.put("/api/menu/:id", async (req, res) => {
  const payload = validateMenuPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const inventoryIds = payload.data.ingredients.map((ingredient) => ingredient.inventoryItemId);
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { id: { in: inventoryIds } },
      select: { id: true },
    });

    if (inventoryItems.length !== inventoryIds.length) {
      return res.status(400).json({
        error: "One or more ingredients reference inventory items that do not exist.",
      });
    }

    const updatedMenuItem = await prisma.$transaction(async (tx) => {
      await tx.menuItem.update({
        where: { id: req.params.id },
        data: {
          name: payload.data.name,
          category: payload.data.category,
          price: payload.data.price,
          image: payload.data.image,
        },
      });

      await tx.recipeIngredient.deleteMany({
        where: { menuItemId: req.params.id },
      });

      await tx.recipeIngredient.createMany({
        data: payload.data.ingredients.map((ingredient) => ({
          menuItemId: req.params.id,
          inventoryItemId: ingredient.inventoryItemId,
          inventoryItemName: ingredient.inventoryItemName,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
      });

      return tx.menuItem.findUnique({
        where: { id: req.params.id },
        include: { ingredients: true },
      });
    });

    if (!updatedMenuItem) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    return res.json(updatedMenuItem);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    return sendInternalError(res, "Failed to update menu item.", error);
  }
});

app.delete("/api/menu/:id", async (req, res) => {
  const salesAction =
    req.query.salesAction === "delete" ? "delete" : "keep";

  try {
    const existingMenuItem = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
      include: { ingredients: true },
    });

    if (!existingMenuItem) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    const deletedMenuItem = await prisma.$transaction(async (tx) => {
      if (salesAction === "delete") {
        await tx.saleRecord.deleteMany({
          where: { menuItemId: req.params.id },
        });
      } else {
        await tx.saleRecord.updateMany({
          where: { menuItemId: req.params.id },
          data: { menuItemId: null },
        });
      }

      return tx.menuItem.delete({
        where: { id: req.params.id },
        include: { ingredients: true },
      });
    });

    return res.json(deletedMenuItem);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    return sendInternalError(res, "Failed to delete menu item.", error);
  }
});

app.get("/api/suppliers", async (_req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
    });

    return res.json(suppliers);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch suppliers.", error);
  }
});

app.get("/api/suppliers/:id", async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    return res.json(supplier);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch supplier.", error);
  }
});

app.post("/api/suppliers", async (req, res) => {
  const payload = validateSupplierPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: payload.data,
    });

    return res.status(201).json(supplier);
  } catch (error) {
    return sendInternalError(res, "Failed to create supplier.", error);
  }
});

app.put("/api/suppliers/:id", async (req, res) => {
  const payload = validateSupplierPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const updatedSupplier = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { id: req.params.id },
        data: payload.data,
      });

      await tx.supplierPrice.updateMany({
        where: { supplierId: req.params.id },
        data: { supplierName: payload.data.name },
      });

      return supplier;
    });

    return res.json(updatedSupplier);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    return sendInternalError(res, "Failed to update supplier.", error);
  }
});

app.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const deletedSupplier = await prisma.supplier.delete({
      where: { id: req.params.id },
    });

    return res.json(deletedSupplier);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    return sendInternalError(res, "Failed to delete supplier.", error);
  }
});

app.get("/api/supplier-prices", async (req, res) => {
  try {
    const where: { supplierId?: string; inventoryItemId?: string } = {};

    if (typeof req.query.supplierId === "string" && req.query.supplierId.trim()) {
      where.supplierId = req.query.supplierId.trim();
    }

    if (
      typeof req.query.inventoryItemId === "string" &&
      req.query.inventoryItemId.trim()
    ) {
      where.inventoryItemId = req.query.inventoryItemId.trim();
    }

    const supplierPrices = await prisma.supplierPrice.findMany({
      where,
      orderBy: [{ inventoryItemId: "asc" }, { price: "asc" }],
    });

    return res.json(supplierPrices);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch supplier prices.", error);
  }
});

app.get("/api/supplier-prices/:id", async (req, res) => {
  try {
    const supplierPrice = await prisma.supplierPrice.findUnique({
      where: { id: req.params.id },
    });

    if (!supplierPrice) {
      return res.status(404).json({ error: "Supplier price record not found." });
    }

    return res.json(supplierPrice);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch supplier price record.", error);
  }
});

app.post("/api/supplier-prices", async (req, res) => {
  const payload = validateSupplierPricePayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const [supplier, inventoryItem] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: payload.data.supplierId } }),
      prisma.inventoryItem.findUnique({ where: { id: payload.data.inventoryItemId } }),
    ]);

    if (!supplier) {
      return res.status(400).json({ error: "supplierId does not match an existing supplier." });
    }

    if (!inventoryItem) {
      return res.status(400).json({
        error: "inventoryItemId does not match an existing inventory item.",
      });
    }

    const supplierPrice = await prisma.supplierPrice.create({
      data: {
        supplierId: payload.data.supplierId,
        supplierName: supplier.name,
        inventoryItemId: payload.data.inventoryItemId,
        price: payload.data.price,
      },
    });

    return res.status(201).json(supplierPrice);
  } catch (error) {
    return sendInternalError(res, "Failed to create supplier price record.", error);
  }
});

app.put("/api/supplier-prices/:id", async (req, res) => {
  const payload = validateSupplierPricePayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const [supplier, inventoryItem] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: payload.data.supplierId } }),
      prisma.inventoryItem.findUnique({ where: { id: payload.data.inventoryItemId } }),
    ]);

    if (!supplier) {
      return res.status(400).json({ error: "supplierId does not match an existing supplier." });
    }

    if (!inventoryItem) {
      return res.status(400).json({
        error: "inventoryItemId does not match an existing inventory item.",
      });
    }

    const updatedSupplierPrice = await prisma.supplierPrice.update({
      where: { id: req.params.id },
      data: {
        supplierId: payload.data.supplierId,
        supplierName: supplier.name,
        inventoryItemId: payload.data.inventoryItemId,
        price: payload.data.price,
      },
    });

    return res.json(updatedSupplierPrice);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Supplier price record not found." });
    }

    return sendInternalError(res, "Failed to update supplier price record.", error);
  }
});

app.delete("/api/supplier-prices/:id", async (req, res) => {
  try {
    const deletedSupplierPrice = await prisma.supplierPrice.delete({
      where: { id: req.params.id },
    });

    return res.json(deletedSupplierPrice);
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return res.status(404).json({ error: "Supplier price record not found." });
    }

    return sendInternalError(res, "Failed to delete supplier price record.", error);
  }
});

app.get("/api/sales", async (req, res) => {
  try {
    const where: { menuItemId?: string } = {};

    if (typeof req.query.menuItemId === "string" && req.query.menuItemId.trim()) {
      where.menuItemId = req.query.menuItemId.trim();
    }

    const sales = await prisma.saleRecord.findMany({
      where,
      orderBy: { timestamp: "desc" },
    });

    // Normalise timestamps to explicit UTC ISO strings so browsers never
    // misinterpret a missing-Z timestamp as local time (which would show 8 hrs off in SGT).
    const normalised = sales.map(s => ({
      ...s,
      timestamp: s.timestamp instanceof Date ? s.timestamp.toISOString() : String(s.timestamp),
    }));

    return res.json(normalised);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch sales history.", error);
  }
});

app.get("/api/sales/:id", async (req, res) => {
  try {
    const sale = await prisma.saleRecord.findUnique({
      where: { id: req.params.id },
    });

    if (!sale) {
      return res.status(404).json({ error: "Sale record not found." });
    }

    return res.json(sale);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch sale record.", error);
  }
});

app.post("/api/sales", async (req, res) => {
  const payload = validateSalePayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: payload.data.menuItemId },
      include: {
        ingredients: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    const ingredientDeductions: Array<{
      inventoryItemId: string;
      totalDeduction: number;
    }> = [];

    for (const ingredient of menuItem.ingredients) {
      const quantityPerPortionInInventoryUnit = convertUnitQuantity(
        ingredient.quantity,
        ingredient.unit,
        ingredient.inventoryItem.unit
      );

      if (quantityPerPortionInInventoryUnit === null) {
        return res.status(400).json({
          error: `Unit mismatch for ${ingredient.inventoryItemName}: recipe uses ${ingredient.unit}, inventory uses ${ingredient.inventoryItem.unit}.`,
        });
      }
      
      const totalDeduction = roundQuantity(
        quantityPerPortionInInventoryUnit * payload.data.quantity
      );

      if (ingredient.inventoryItem.quantity < totalDeduction) {
        return res.status(400).json({
          error: `Not enough stock for ${ingredient.inventoryItemName}. Required ${totalDeduction} ${ingredient.inventoryItem.unit}, available ${ingredient.inventoryItem.quantity} ${ingredient.inventoryItem.unit}.`,
        });
      }

      ingredientDeductions.push({
        inventoryItemId: ingredient.inventoryItemId,
        totalDeduction,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.saleRecord.create({
        data: {
          ...{
          ...payload.data,
          menuItemPrice: menuItem.price,
          timestamp: new Date(), // explicitly set so the DB stores the correct UTC moment
        },
        },
      });

      for (const deduction of ingredientDeductions) {
        const currentItem = await tx.inventoryItem.findUnique({
          where: { id: deduction.inventoryItemId },
          select: { quantity: true },
        });

        if (!currentItem) {
          throw new Error(`Inventory item not found: ${deduction.inventoryItemId}`);
        }

        const nextQuantity = roundQuantity(
          currentItem.quantity - deduction.totalDeduction
        );

        await tx.inventoryItem.update({
          where: { id: deduction.inventoryItemId },
          data: {
            quantity: nextQuantity,
          },
        });
      }

      return sale;
    });

    // Ensure timestamp is returned as an explicit UTC ISO string (with Z suffix)
    // so browsers never misinterpret it as local time.
    const saleWithUtcTimestamp = {
      ...result,
      timestamp: result.timestamp instanceof Date
        ? result.timestamp.toISOString()
        : String(result.timestamp),
    };

    return res.status(201).json({
      message: "Sale recorded and inventory updated.",
      sale: saleWithUtcTimestamp,
    });
  } catch (error) {
    return sendInternalError(res, "Failed to record sale.", error);
  }
});

app.get('/api/forecast/today', async (req, res) => {
  try {
    // All date logic in SGT (UTC+8) so "today" and day-of-week
    // match what the hawker stall owner sees on their phone.
    const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

    const nowSgt = new Date(Date.now() + SGT_OFFSET_MS);

    // Day of week in SGT (0 = Sunday … 6 = Saturday)
    const currentDayOfWeek = nowSgt.getUTCDay();

    // SGT midnight expressed as UTC — any sale on/after this is "today" and excluded.
    const sgtMidnightUtc = new Date(
      Date.UTC(nowSgt.getUTCFullYear(), nowSgt.getUTCMonth(), nowSgt.getUTCDate()) - SGT_OFFSET_MS
    );

    const fourWeeksAgoUtc = new Date(sgtMidnightUtc);
    fourWeeksAgoUtc.setUTCDate(fourWeeksAgoUtc.getUTCDate() - 28);

    const historicalSales = await prisma.saleRecord.findMany({
      where: {
        timestamp: {
          gte: fourWeeksAgoUtc,
          lt: sgtMidnightUtc, // strictly before SGT midnight — today's sales never affect the forecast
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

    // 3. Aggregate total portions sold per menu item
    const dishSalesCounts: Record<string, { totalQuantity: number, menuItem: any }> = {};

    sameDaySales.forEach((sale) => {
      const existingEntry = dishSalesCounts[sale.menuItemId];

      if (existingEntry) {
        existingEntry.totalQuantity += sale.quantity;
        return;
      }

      dishSalesCounts[sale.menuItemId] = {
        totalQuantity: sale.quantity,
        menuItem: sale.menuItem,
      };
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
      date: nowSgt.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
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

app.get("/api/settings", async (_req, res) => {
  try {
    // @ts-ignore - StallSettings might not be in generated types yet
    let settings = await (prisma as any).stallSettings.findFirst();
    
    // Create default settings if none exist
    if (!settings) {
      settings = await (prisma as any).stallSettings.create({ data: {} });
    }
    
    return res.json(settings);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch settings.", error);
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const { stallName, ownerName, location, lowStockAlerts, currency, language } = req.body;
    
    let settings = await (prisma as any).stallSettings.findFirst();
    if (!settings) {
      settings = await (prisma as any).stallSettings.create({ data: {} });
    }
    
    const updatedSettings = await (prisma as any).stallSettings.update({
      where: { id: settings.id },
      data: {
        stallName: typeof stallName === 'string' ? stallName : settings.stallName,
        ownerName: typeof ownerName === 'string' ? ownerName : settings.ownerName,
        location: typeof location === 'string' ? location : settings.location,
        lowStockAlerts: typeof lowStockAlerts === 'boolean' ? lowStockAlerts : settings.lowStockAlerts,
        currency: typeof currency === 'string' ? currency : settings.currency,
        language: typeof language === 'string' ? language : settings.language,
      }
    });
    
    return res.json(updatedSettings);
  } catch (error) {
    return sendInternalError(res, "Failed to update settings.", error);
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});