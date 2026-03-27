import { apiRequest } from './api';

const AUTH_STORAGE_KEY = 'managemee-auth';

type StallCategoryField = 'stallCategories' | 'ingredientCategories';

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

function normalizeCategoryList(categories: string[], fallback: string[]): string[] {
  const normalized = categories
    .map((category) => category.trim())
    .filter((category) => category.length > 0);

  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
}

export function saveAuthSession(session: AuthSession) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredAuthSession(): AuthSession | null {
  const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getStoredStallId(): string | null {
  return getStoredAuthSession()?.stall?.id ?? null;
}

export function getStoredStallCategories(): string[] {
  return normalizeCategoryList(getStoredAuthSession()?.stall?.stallCategories ?? [], ['Other']);
}

export function getStoredIngredientCategories(): string[] {
  return normalizeCategoryList(getStoredAuthSession()?.stall?.ingredientCategories ?? [], ['Other']);
}

export function setStoredStallCategoryList(
  field: StallCategoryField,
  categories: string[],
): string[] {
  const normalized = normalizeCategoryList(categories, ['Other']);
  const session = getStoredAuthSession();

  if (!session?.stall) {
    return normalized;
  }

  saveAuthSession({
    ...session,
    stall: {
      ...session.stall,
      [field]: normalized,
    },
  });

  return normalized;
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
