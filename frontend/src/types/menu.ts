export interface RecipeIngredient {
  id?: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  ingredients: RecipeIngredient[];
  category: string;
  image?: string | null; // Optional image URL or data URL
}

export type MenuItemPayload = Omit<MenuItem, 'id'>;

export interface SaleRecord {
  id: string;
  menuItemId: string | null;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  timestamp: string;
}

export interface CreateSalePayload {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
}