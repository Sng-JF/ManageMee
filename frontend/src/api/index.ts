import type { InventoryItem, Supplier, SupplierPrice } from '../types/inventory';
import type { MenuItem } from '../types/menu';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export const fetchInventory = () =>
  request<InventoryItem[]>('/api/inventory');

export const createInventoryItem = (
  item: Omit<InventoryItem, 'id' | 'lastUpdated'>
) =>
  request<InventoryItem>('/api/inventory', {
    method: 'POST',
    body: JSON.stringify(item),
  });

export const updateInventoryItem = (
  id: string,
  item: Omit<InventoryItem, 'id' | 'lastUpdated'>
) =>
  request<InventoryItem>(`/api/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  });

export const deleteInventoryItem = (id: string) =>
  request<InventoryItem>(`/api/inventory/${id}`, { method: 'DELETE' });

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const fetchMenu = () =>
  request<MenuItem[]>('/api/menu');

export const createMenuItem = (item: Omit<MenuItem, 'id'>) =>
  request<MenuItem>('/api/menu', {
    method: 'POST',
    body: JSON.stringify(item),
  });

export const updateMenuItem = (id: string, item: Omit<MenuItem, 'id'>) =>
  request<MenuItem>(`/api/menu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  });

export const deleteMenuItem = (id: string) =>
  request<MenuItem>(`/api/menu/${id}`, { method: 'DELETE' });

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const fetchSuppliers = () =>
  request<Supplier[]>('/api/suppliers');

export const createSupplier = (supplier: Omit<Supplier, 'id'>) =>
  request<Supplier>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(supplier),
  });

export const updateSupplier = (id: string, supplier: Omit<Supplier, 'id'>) =>
  request<Supplier>(`/api/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(supplier),
  });

export const deleteSupplier = (id: string) =>
  request<Supplier>(`/api/suppliers/${id}`, { method: 'DELETE' });

// ─── Supplier Prices ─────────────────────────────────────────────────────────

export const fetchSupplierPrices = (inventoryItemId?: string) =>
  request<SupplierPrice[]>(
    inventoryItemId
      ? `/api/supplier-prices?inventoryItemId=${encodeURIComponent(inventoryItemId)}`
      : '/api/supplier-prices'
  );

export const createSupplierPrice = (data: {
  supplierId: string;
  inventoryItemId: string;
  price: number;
}) =>
  request<SupplierPrice>('/api/supplier-prices', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteSupplierPrice = (id: string) =>
  request<SupplierPrice>(`/api/supplier-prices/${id}`, { method: 'DELETE' });

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface SaleRecordFromApi {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  timestamp: string;
}

export const fetchSales = (menuItemId?: string) =>
  request<SaleRecordFromApi[]>(
    menuItemId
      ? `/api/sales?menuItemId=${encodeURIComponent(menuItemId)}`
      : '/api/sales'
  );

export const recordSale = (data: {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
}) =>
  request<{ message: string; sale: SaleRecordFromApi }>('/api/sales', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ─── Voice Transcription ──────────────────────────────────────────────────────

export const transcribeAudio = async (audioBlob: Blob, mimeType: string): Promise<string> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('mimeType', mimeType);

  const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Transcription failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.transcript as string;
};
