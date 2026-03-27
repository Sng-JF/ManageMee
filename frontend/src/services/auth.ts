import { apiRequest } from './api';

const AUTH_STORAGE_KEY = 'managemee-auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthStall {
  id: string;
  stallName: string;
  location: string;
  stallCategories: string[];
  ingredientCategories: string[];
}

export interface AuthSettings {
  lowStockAlerts: boolean;
  currency: string;
  language: string;
}

export interface AuthSession {
  user: AuthUser;
  stall: AuthStall | null;
  settings: AuthSettings | null;
}

export interface SignupPayload {
  email: string;
  password: string;
  name: string;
  stallName: string;
  location: string;
  stallCategories: string[];
  ingredientCategories: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getStoredStallId(): string | null {
  return getStoredAuthSession()?.stall?.id ?? null;
}

export async function registerUser(payload: SignupPayload) {
  const session = await apiRequest<AuthSession>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  saveAuthSession(session);
  return session;
}

export async function loginUser(payload: LoginPayload) {
  const session = await apiRequest<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  saveAuthSession(session);
  return session;
}