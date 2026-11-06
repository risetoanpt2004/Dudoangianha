import type {
  AdminSummary,
  DashboardStats,
  HistoryItem,
  MapProperties,
  MarketStats,
  PageResult,
  PropertyFilters,
  PredictionInput,
  PredictionResult,
  User,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8088";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("estate-ai-token");
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status}).`;
    try {
      const body = await response.json();
      const detail = body.detail;
      message = Array.isArray(detail)
        ? detail.map((item: { msg?: string }) => item.msg ?? "").join(", ")
        : String(detail ?? message);
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function download(path: string): Promise<Blob> {
  const token = localStorage.getItem("estate-ai-token");
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status}).`;
    try {
      const body = await response.json();
      message = String(body.detail ?? message);
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.blob();
}

function filterQuery(filters: PropertyFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const api = {
  health: () => request<{ status: string; model_status: string; model_message: string | null; dataset_status: string }>("/api/health"),
  me: () => request<User>("/api/auth/me"),
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  dashboard: () => request<DashboardStats>("/api/stats/dashboard"),
  market: (filters: PropertyFilters = {}) =>
    request<MarketStats>(`/api/stats/market${filterQuery(filters)}`),
  predict: (data: PredictionInput) =>
    request<PredictionResult>("/api/predict", { method: "POST", body: JSON.stringify(data) }),
  history: (page: number, search: string, pageSize = 10) =>
    request<PageResult<HistoryItem>>(`/api/history?page=${page}&page_size=${pageSize}&search=${encodeURIComponent(search)}`),
  deleteHistory: (id: number) => request<{ deleted: boolean }>(`/api/history/${id}`, { method: "DELETE" }),
  mapProperties: (search: string, filters: PropertyFilters = {}) => {
    const params = new URLSearchParams({ search, limit: "80" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
    return request<MapProperties>(`/api/map/properties?${params.toString()}`);
  },
  adminSummary: () => request<AdminSummary>("/api/admin/summary"),
  downloadDataset: () => download("/api/admin/dataset.csv"),
  adminUsers: (page = 1) => request<PageResult<User>>(`/api/admin/users?page=${page}&page_size=50`),
  createAdminUser: (data: { name: string; email: string; password: string; role: User["role"] }) =>
    request<User>("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: Partial<Pick<User, "role" | "is_active">>) =>
    request<User>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<{ deleted: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" }),
};
