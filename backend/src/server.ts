import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });
const app = express();
const PORT = Number(process.env.PORT) || 3001;

type ValidationFailure = { error: string };
type ValidationSuccess<T> = { data: T };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const scryptAsync = promisify(scryptCallback);

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const upload = multer({ storage: multer.memoryStorage() });

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

/**
 * Returns the multiplication factor to convert `from` unit into `to` unit.
 * Returns null if no conversion is possible (incompatible unit families).
 */
const getUnitConversionFactor = (from: string, to: string): number | null => {
  if (from === to) return 1;
  if (from === "g"  && to === "kg") return 0.001;
  if (from === "kg" && to === "g")  return 1000;
  if (from === "ml" && to === "L")  return 0.001;
  if (from === "L"  && to === "ml") return 1000;
  return null; // incompatible families (e.g. g vs L)
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
const normalizeBoolean = (value: unknown) => {
  return typeof value === "boolean" ? value : null;
};

const getRequiredStallId = (req: Request) => {
  const stallId = normalizeString(req.header("x-stall-id"));
  return stallId.length > 0 ? stallId : null;
};

const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
};

const verifyPassword = async (password: string, storedHash: string) => {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedKeyBuffer = Buffer.from(key, "hex");

  return (
    derivedKey.length === storedKeyBuffer.length &&
    timingSafeEqual(derivedKey, storedKeyBuffer)
  );
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

const toInventoryItemCreateData = (stallId: string, payload: InventoryPayload) => {
  return {
    stallId,
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

const toInventoryItemUpdateData = (payload: InventoryPayload) => {
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


type SignupPayload = {
  email: string;
  password: string;
  name: string;
  stallName: string;
  location: string;
  stallCategories: string[];
  ingredientCategories: string[];
};

const validateSignupPayload = (body: unknown): ValidationResult<SignupPayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const email = normalizeString(body.email).toLowerCase();
  const password = normalizeString(body.password);
  const name = normalizeString(body.name);
  const stallName = normalizeString(body.stallName);
  const location = normalizeString(body.location);
  const stallCategories = normalizeStringArray(body.stallCategories);
  const ingredientCategories = normalizeStringArray(body.ingredientCategories);

  if (!email || !email.includes("@")) {
    return { error: "A valid email is required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  if (!name || !stallName || !location) {
    return { error: "name, stallName, and location are required." };
  }

  if (stallCategories.length === 0) {
    return { error: "At least one stall category is required." };
  }

  if (ingredientCategories.length === 0) {
    return { error: "At least one ingredient category is required." };
  }

  return {
    data: {
      email,
      password,
      name,
      stallName,
      location,
      stallCategories,
      ingredientCategories,
    },
  };
};

type LoginPayload = {
  email: string;
  password: string;
};

const validateLoginPayload = (body: unknown): ValidationResult<LoginPayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const email = normalizeString(body.email).toLowerCase();
  const password = normalizeString(body.password);

  if (!email || !email.includes("@")) {
    return { error: "A valid email is required." };
  }

  if (!password) {
    return { error: "password is required." };
  }

  return { data: { email, password } };
};

type SettingsPayload = {
  ownerName?: string;
  stallName?: string;
  location?: string;
  stallCategories?: string[];
  ingredientCategories?: string[];
  lowStockAlerts?: boolean;
  currency?: string;
  language?: string;
};

const validateSettingsPayload = (body: unknown): ValidationResult<SettingsPayload> => {
  if (!isObject(body)) {
    return { error: "Request body must be an object." };
  }

  const data: SettingsPayload = {};

  if ("ownerName" in body) {
    const ownerName = normalizeString(body.ownerName);
    if (!ownerName) {
      return { error: "ownerName must be a non-empty string." };
    }
    data.ownerName = ownerName;
  }

  if ("stallName" in body) {
    const stallName = normalizeString(body.stallName);
    if (!stallName) {
      return { error: "stallName must be a non-empty string." };
    }
    data.stallName = stallName;
  }

  if ("location" in body) {
    const location = normalizeString(body.location);
    if (!location) {
      return { error: "location must be a non-empty string." };
    }
    data.location = location;
  }

  if ("stallCategories" in body) {
    data.stallCategories = normalizeStringArray(body.stallCategories);
  }

  if ("ingredientCategories" in body) {
    data.ingredientCategories = normalizeStringArray(body.ingredientCategories);
  }

  if ("lowStockAlerts" in body) {
    const lowStockAlerts = normalizeBoolean(body.lowStockAlerts);
    if (lowStockAlerts === null) {
      return { error: "lowStockAlerts must be a boolean." };
    }
    data.lowStockAlerts = lowStockAlerts;
  }

  if ("currency" in body) {
    const currency = normalizeString(body.currency);
    if (!currency) {
      return { error: "currency must be a non-empty string." };
    }
    data.currency = currency;
  }

  if ("language" in body) {
    const language = normalizeString(body.language);
    if (!language) {
      return { error: "language must be a non-empty string." };
    }
    data.language = language;
  }

  return { data };
};

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res) => {
  const payload = validateSignupPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.data.email },
    });

    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(payload.data.password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: payload.data.email,
          passwordHash,
          name: payload.data.name,
        },
      });

      const stall = await tx.stall.create({
        data: {
          ownerId: user.id,
          stallName: payload.data.stallName,
          location: payload.data.location,
          stallCategories: payload.data.stallCategories,
          ingredientCategories: payload.data.ingredientCategories,
        },
      });

      const settings = await tx.stallSettings.create({
        data: {
          stallId: stall.id,
          lowStockAlerts: true,
          currency: "SGD",
          language: "English",
        },
      });

      return { user, stall, settings };
    });

    return res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      stall: {
        id: result.stall.id,
        stallName: result.stall.stallName,
        location: result.stall.location,
        stallCategories: result.stall.stallCategories,
        ingredientCategories: result.stall.ingredientCategories,
      },
      settings: {
        lowStockAlerts: result.settings.lowStockAlerts,
        currency: result.settings.currency,
        language: result.settings.language,
      },
    });
  } catch (error) {
    return sendInternalError(res, "Failed to create account.", error);
  }
});

app.post("/api/auth/login", async (req, res) => {
  const payload = validateLoginPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: payload.data.email },
      include: {
        stalls: {
          include: {
            settings: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await verifyPassword(payload.data.password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const primaryStall = user.stalls[0] ?? null;

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      stall: primaryStall
        ? {
            id: primaryStall.id,
            stallName: primaryStall.stallName,
            location: primaryStall.location,
            stallCategories: primaryStall.stallCategories,
            ingredientCategories: primaryStall.ingredientCategories,
          }
        : null,
      settings: primaryStall?.settings
        ? {
            lowStockAlerts: primaryStall.settings.lowStockAlerts,
            currency: primaryStall.settings.currency,
            language: primaryStall.settings.language,
          }
        : null,
    });
  } catch (error) {
    return sendInternalError(res, "Failed to log in.", error);
  }
});


app.get("/api/inventory/low-stock", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { stallId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const lowStockItems = items.filter((item) => item.quantity < item.minQuantity);
    return res.json(lowStockItems);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch low stock inventory.", error);
  }
});

app.get("/api/inventory", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { stallId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return res.json(items);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch inventory.", error);
  }
});

app.get("/api/inventory/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, stallId },
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateInventoryPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const newItem = await prisma.inventoryItem.create({
      data: toInventoryItemCreateData(stallId, payload.data),
    });

    return res.status(201).json(newItem);
  } catch (error) {
    return sendInternalError(res, "Failed to create inventory item.", error);
  }
});

app.put("/api/inventory/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateInventoryPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const existingItem = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, stallId },
      select: { id: true },
    });

    if (!existingItem) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    const updatedItem = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: toInventoryItemUpdateData(payload.data),
    });

    return res.json(updatedItem);
  } catch (error) {
    return sendInternalError(res, "Failed to update inventory item.", error);
  }
});

app.patch("/api/inventory/:id/quantity", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const quantityDelta = normalizeNumber(isObject(req.body) ? req.body.quantityDelta : undefined);

  if (!Number.isFinite(quantityDelta)) {
    return res.status(400).json({ error: "quantityDelta must be a valid number." });
  }

  try {
    const existingItem = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, stallId },
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
    return sendInternalError(res, "Failed to update inventory quantity.", error);
  }
});

app.delete("/api/inventory/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const existingItem = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, stallId },
      select: { id: true },
    });

    if (!existingItem) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

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
    return sendInternalError(res, "Failed to delete inventory item.", error);
  }
});

app.get("/api/menu", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { stallId },
      include: { ingredients: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return res.json(menuItems);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch menu items.", error);
  }
});

app.get("/api/menu/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const menuItem = await prisma.menuItem.findFirst({
      where: { id: req.params.id, stallId },
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateMenuPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const inventoryIds = payload.data.ingredients.map((ingredient) => ingredient.inventoryItemId);
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { stallId, id: { in: inventoryIds } },
      select: { id: true },
    });

    if (inventoryItems.length !== inventoryIds.length) {
      return res.status(400).json({
        error: "One or more ingredients reference inventory items that do not exist for this stall.",
      });
    }

    const newMenuItem = await prisma.menuItem.create({
      data: {
        stallId,
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateMenuPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const existingMenuItem = await prisma.menuItem.findFirst({
      where: { id: req.params.id, stallId },
      select: { id: true },
    });

    if (!existingMenuItem) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    const inventoryIds = payload.data.ingredients.map((ingredient) => ingredient.inventoryItemId);
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { stallId, id: { in: inventoryIds } },
      select: { id: true },
    });

    if (inventoryItems.length !== inventoryIds.length) {
      return res.status(400).json({
        error: "One or more ingredients reference inventory items that do not exist for this stall.",
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
    return sendInternalError(res, "Failed to update menu item.", error);
  }
});

app.delete("/api/menu/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const salesAction =
    req.query.salesAction === "delete" ? "delete" : "keep";

  try {
    const existingMenuItem = await prisma.menuItem.findFirst({
      where: { id: req.params.id, stallId },
      include: { ingredients: true },
    });

    if (!existingMenuItem) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    const deletedMenuItem = await prisma.$transaction(async (tx) => {
      if (salesAction === "delete") {
        await tx.saleRecord.deleteMany({
          where: { stallId, menuItemId: req.params.id },
        });
      } else {
        await tx.saleRecord.updateMany({
          where: { stallId, menuItemId: req.params.id },
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
    return sendInternalError(res, "Failed to delete menu item.", error);
  }
});

app.get("/api/menu/:id/delete-info", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const existingMenuItem = await prisma.menuItem.findFirst({
      where: { id: req.params.id, stallId },
      select: { id: true },
    });

    if (!existingMenuItem) {
      return res.status(404).json({ error: "Menu item not found." });
    }

    const salesCount = await prisma.saleRecord.count({
      where: { stallId, menuItemId: req.params.id },
    });

    return res.json({
      hasSales: salesCount > 0,
      salesCount,
    });
  } catch (error) {
    return sendInternalError(res, "Failed to fetch menu item delete info.", error);
  }
});

app.get("/api/suppliers", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where: { stallId },
      orderBy: { name: "asc" },
    });

    return res.json(suppliers);
  } catch (error) {
    return sendInternalError(res, "Failed to fetch suppliers.", error);
  }
});

app.get("/api/suppliers/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, stallId },
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateSupplierPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        stallId,
        ...payload.data,
      },
    });

    return res.status(201).json(supplier);
  } catch (error) {
    return sendInternalError(res, "Failed to create supplier.", error);
  }
});

app.put("/api/suppliers/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateSupplierPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const existingSupplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, stallId },
      select: { id: true },
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: "Supplier not found." });
    }

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
    return sendInternalError(res, "Failed to update supplier.", error);
  }
});

app.delete("/api/suppliers/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const existingSupplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, stallId },
      select: { id: true },
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    const deletedSupplier = await prisma.supplier.delete({
      where: { id: req.params.id },
    });

    return res.json(deletedSupplier);
  } catch (error) {
    return sendInternalError(res, "Failed to delete supplier.", error);
  }
});

app.get("/api/supplier-prices", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const where: Prisma.SupplierPriceWhereInput = {
      supplier: { stallId },
    };

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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const supplierPrice = await prisma.supplierPrice.findFirst({
      where: {
        id: req.params.id,
        supplier: { stallId },
      },
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateSupplierPricePayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const [supplier, inventoryItem] = await Promise.all([
      prisma.supplier.findFirst({
        where: { id: payload.data.supplierId, stallId },
      }),
      prisma.inventoryItem.findFirst({
        where: { id: payload.data.inventoryItemId, stallId },
      }),
    ]);

    if (!supplier) {
      return res.status(400).json({ error: "supplierId does not match an existing supplier for this stall." });
    }

    if (!inventoryItem) {
      return res.status(400).json({
        error: "inventoryItemId does not match an existing inventory item for this stall.",
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateSupplierPricePayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const existingRecord = await prisma.supplierPrice.findFirst({
      where: { id: req.params.id, supplier: { stallId } },
      select: { id: true },
    });

    if (!existingRecord) {
      return res.status(404).json({ error: "Supplier price record not found." });
    }

    const [supplier, inventoryItem] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: payload.data.supplierId, stallId } }),
      prisma.inventoryItem.findFirst({ where: { id: payload.data.inventoryItemId, stallId } }),
    ]);

    if (!supplier) {
      return res.status(400).json({ error: "supplierId does not match an existing supplier for this stall." });
    }

    if (!inventoryItem) {
      return res.status(400).json({
        error: "inventoryItemId does not match an existing inventory item for this stall.",
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
    return sendInternalError(res, "Failed to update supplier price record.", error);
  }
});

app.delete("/api/supplier-prices/:id", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const existingRecord = await prisma.supplierPrice.findFirst({
      where: { id: req.params.id, supplier: { stallId } },
      select: { id: true },
    });

    if (!existingRecord) {
      return res.status(404).json({ error: "Supplier price record not found." });
    }

    const deletedSupplierPrice = await prisma.supplierPrice.delete({
      where: { id: req.params.id },
    });

    return res.json(deletedSupplierPrice);
  } catch (error) {
    return sendInternalError(res, "Failed to delete supplier price record.", error);
  }
});

app.get("/api/sales", async (req, res) => {
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const where: { stallId: string; menuItemId?: string } = { stallId };

    if (typeof req.query.menuItemId === "string" && req.query.menuItemId.trim()) {
      where.menuItemId = req.query.menuItemId.trim();
    }

    const sales = await prisma.saleRecord.findMany({
      where,
      orderBy: { timestamp: "desc" },
    });

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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const sale = await prisma.saleRecord.findFirst({
      where: { id: req.params.id, stallId },
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateSalePayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const menuItem = await prisma.menuItem.findFirst({
      where: { id: payload.data.menuItemId, stallId },
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
          stallId,
          menuItemId: payload.data.menuItemId,
          menuItemName: payload.data.menuItemName,
          menuItemPrice: menuItem.price,
          quantity: payload.data.quantity,
          timestamp: new Date(),
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
  const stallId = getRequiredStallId(req);
  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

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
        stallId,
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

    const availableMenuItems = await prisma.menuItem.findMany({
      where: { stallId },
      include: {
        ingredients: true,
      },
      orderBy: { name: 'asc' },
    });

    const getSgtDayOfWeek = (timestamp: Date) =>
      new Date(timestamp.getTime() + SGT_OFFSET_MS).getUTCDay();

    const getSgtDateKey = (timestamp: Date) => {
      const saleSgt = new Date(timestamp.getTime() + SGT_OFFSET_MS);
      return `${saleSgt.getUTCFullYear()}-${saleSgt.getUTCMonth()}-${saleSgt.getUTCDate()}`;
    };

    // 2. Filter historical sales strictly to the same day of the week
    const sameDaySales = historicalSales.filter(
      sale => getSgtDayOfWeek(new Date(sale.timestamp)) === currentDayOfWeek
    );

    const salesForForecast = sameDaySales.length > 0 ? sameDaySales : historicalSales;
    const forecastSource =
      sameDaySales.length > 0
        ? 'same-weekday'
        : historicalSales.length > 0
          ? 'recent-history'
          : 'menu-baseline';

    const salesSampleDays = new Set(
      salesForForecast.map((sale) => getSgtDateKey(new Date(sale.timestamp))),
    ).size;

    const averagingWindow =
      forecastSource === 'same-weekday'
        ? 4
        : forecastSource === 'recent-history'
          ? Math.max(salesSampleDays, 1)
          : 1;

    // 3. Aggregate total portions sold per menu item
    const dishSalesCounts: Record<string, { totalQuantity: number, menuItem: any }> = {};

    salesForForecast.forEach((sale) => {
      if (!sale.menuItemId) return;
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
    const weatherFactor = forecastSource === 'menu-baseline' ? 1.0 : 0.9;
    const holidayFactor = 1.0; // 1.0 = No holiday effect

    if (Object.keys(dishSalesCounts).length === 0) {
      availableMenuItems.forEach((menuItem) => {
        prepRecommendations.push({
          id: menuItem.id,
          name: menuItem.name,
          prep: 1,
          change: 0,
          ingredients: menuItem.ingredients,
        });

        totalPredictedSales += menuItem.price;
        totalAverageSales += menuItem.price;
      });
    }

    // 4. Calculate predictions per dish
    for (const [menuItemId, data] of Object.entries(dishSalesCounts)) {
      // Average portions sold over the selected forecast window.
      const averagePortions = data.totalQuantity / averagingWindow;
      
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

    const confidence =
      forecastSource === 'same-weekday'
        ? 'High (85%)'
        : forecastSource === 'recent-history'
          ? 'Medium (70%)'
          : 'Low (55%)';

    // 6. Return payload matching frontend expectations
    res.json({
      date: nowSgt.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      weather: 'Rainy',
      confidence,
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

// ─── Voice Transcription ────────────────────────────────────────────────────

app.post('/api/voice/transcribe', upload.single('audio'), async (req: any, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Google Cloud API key not configured. Set GOOGLE_CLOUD_API_KEY in backend .env' });
    return;
  }

  const audioBase64 = req.file.buffer.toString('base64');
  const mimeType: string = (req.body?.mimeType as string) || req.file.mimetype || 'audio/webm';

  let encoding = 'WEBM_OPUS';
  if (mimeType.includes('ogg')) encoding = 'OGG_OPUS';
  else if (mimeType.includes('mp4') || mimeType.includes('m4a')) encoding = 'MP4';
  else if (mimeType.includes('wav')) encoding = 'LINEAR16';
  else if (mimeType.includes('flac')) encoding = 'FLAC';

  const sttConfig: Record<string, unknown> = {
    encoding,
    languageCode: 'en-SG',
    enableAutomaticPunctuation: true,
  };
  if (encoding === 'LINEAR16') {
    sttConfig.sampleRateHertz = 16000;
  }

  try {
    const sttResponse = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: sttConfig,
          audio: { content: audioBase64 },
        }),
      }
    );

    if (!sttResponse.ok) {
      const errorBody = await sttResponse.json().catch(() => ({}));
      sendInternalError(res, 'Google STT API returned an error', errorBody);
      return;
    }

    const data: any = await sttResponse.json();
    const transcript: string = data.results?.[0]?.alternatives?.[0]?.transcript ?? '';
    res.json({ transcript });
  } catch (error) {
    sendInternalError(res, 'Failed to transcribe audio', error);
  }
});

app.get("/api/settings", async (req, res) => {
  const stallId = getRequiredStallId(req);

  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  try {
    const stall = await prisma.stall.findUnique({
      where: { id: stallId },
      include: {
        owner: true,
        settings: true,
      },
    });

    if (!stall) {
      return res.status(404).json({ error: "Stall not found." });
    }

    const settings =
      stall.settings ??
      (await prisma.stallSettings.create({
        data: { stallId: stall.id },
      }));

    return res.json({
      stallId: stall.id,
      stallName: stall.stallName,
      ownerName: stall.owner.name,
      location: stall.location,
      stallCategories: stall.stallCategories,
      ingredientCategories: stall.ingredientCategories,
      lowStockAlerts: settings.lowStockAlerts,
      currency: settings.currency,
      language: settings.language,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    return sendInternalError(res, "Failed to fetch settings.", error);
  }
});

app.put("/api/settings", async (req, res) => {
  const stallId = getRequiredStallId(req);

  if (!stallId) {
    return res.status(400).json({ error: "Missing x-stall-id header." });
  }

  const payload = validateSettingsPayload(req.body);
  if ("error" in payload) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const existingStall = await prisma.stall.findUnique({
      where: { id: stallId },
      include: {
        owner: true,
        settings: true,
      },
    });

    if (!existingStall) {
      return res.status(404).json({ error: "Stall not found." });
    }

    const stallUpdateData: Record<string, unknown> = {};
    const settingsUpdateData: Record<string, unknown> = {};

    if (payload.data.stallName !== undefined) {
      stallUpdateData.stallName = payload.data.stallName;
    }

    if (payload.data.location !== undefined) {
      stallUpdateData.location = payload.data.location;
    }

    if (payload.data.stallCategories !== undefined) {
      stallUpdateData.stallCategories = payload.data.stallCategories;
    }

    if (payload.data.ingredientCategories !== undefined) {
      stallUpdateData.ingredientCategories = payload.data.ingredientCategories;
    }

    if (payload.data.lowStockAlerts !== undefined) {
      settingsUpdateData.lowStockAlerts = payload.data.lowStockAlerts;
    }

    if (payload.data.currency !== undefined) {
      settingsUpdateData.currency = payload.data.currency;
    }

    if (payload.data.language !== undefined) {
      settingsUpdateData.language = payload.data.language;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedOwner =
        payload.data.ownerName !== undefined
          ? await tx.user.update({
              where: { id: existingStall.ownerId },
              data: { name: payload.data.ownerName },
            })
          : existingStall.owner;

      const updatedStall =
        Object.keys(stallUpdateData).length > 0
          ? await tx.stall.update({
              where: { id: stallId },
              data: stallUpdateData,
            })
          : existingStall;

      const updatedSettings = await tx.stallSettings.upsert({
        where: { stallId },
        update: settingsUpdateData,
        create: {
          stallId,
          lowStockAlerts:
            payload.data.lowStockAlerts !== undefined
              ? payload.data.lowStockAlerts
              : true,
          currency:
            payload.data.currency !== undefined ? payload.data.currency : "SGD",
          language:
            payload.data.language !== undefined
              ? payload.data.language
              : "English",
        },
      });

      return {
        updatedOwner,
        updatedStall,
        updatedSettings,
      };
    });

    return res.json({
      stallId: result.updatedStall.id,
      stallName: result.updatedStall.stallName,
      ownerName: result.updatedOwner.name,
      location: result.updatedStall.location,
      stallCategories: result.updatedStall.stallCategories,
      ingredientCategories: result.updatedStall.ingredientCategories,
      lowStockAlerts: result.updatedSettings.lowStockAlerts,
      currency: result.updatedSettings.currency,
      language: result.updatedSettings.language,
      updatedAt: result.updatedSettings.updatedAt,
    });
  } catch (error) {
    return sendInternalError(res, "Failed to update settings.", error);
  }
});
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});