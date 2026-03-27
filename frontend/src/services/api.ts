const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const AUTH_STORAGE_KEY = 'managemee-auth';

function getStoredStallId() {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { stall?: { id?: string | null } | null };
    return parsed?.stall?.id ?? null;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  const stallId = getStoredStallId();

  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (stallId && !headers.has('x-stall-id')) {
    headers.set('x-stall-id', stallId);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}