import { apiRequest } from './api';
import type { MenuItem, MenuItemPayload } from '../types/menu';

export function getMenuItems() {
  return apiRequest<MenuItem[]>('/api/menu');
}

export function createMenuItem(payload: MenuItemPayload) {
  return apiRequest<MenuItem>('/api/menu', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMenuItem(id: string, payload: MenuItemPayload) {
  return apiRequest<MenuItem>(`/api/menu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteMenuItem(
  id: string,
  salesAction: 'keep' | 'delete' = 'keep'
) {
  return apiRequest(`/api/menu/${id}?salesAction=${salesAction}`, {
    method: 'DELETE',
  });
}