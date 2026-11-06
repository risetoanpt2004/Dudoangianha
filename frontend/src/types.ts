export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface DashboardStats {
  property_count: number;
  prediction_count: number;
  user_count: number;
  average_price_billion: number;
  average_price_vnd: number;
  median_area: number;
  model_status: "ready" | "unavailable";
}

export interface PropertyFilters {
  min_area?: number;
  max_area?: number;
  min_price?: number;
  max_price?: number;
}

export interface MarketStats {
  property_count: number;
  average_by_area: { name: string; price_billion: number }[];
  average_by_floors: { name: string; price_billion: number }[];
  floor_distribution: { name: string; count: number }[];
  price_distribution: { name: string; count: number }[];
  limitations: Record<string, string>;
}

export interface PredictionInput {
  Area: number;
  Floors: number | null;
  Bedrooms: number | null;
  Bathrooms: number | null;
  Frontage: number | null;
  "Access road": number | null;
  "Legal status": string | null;
  address?: string;
}

export interface PredictionResult {
  id: number;
  prediction_billion: number;
  prediction_vnd: number;
  address: string | null;
  inputs: Omit<PredictionInput, "address">;
  created_at: string;
}

export interface HistoryItem {
  id: number;
  code: string;
  address: string;
  area: number;
  prediction_billion: number;
  prediction_vnd: number;
  created_at: string;
  status: string;
  inputs: Omit<PredictionInput, "address">;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size?: number;
}

export interface MapProperties {
  items: {
    address: string;
    area: number | null;
    price_billion: number | null;
    latitude: number | null;
    longitude: number | null;
    location_precision: string;
  }[];
  coordinates_available: boolean;
  notice: string;
  total: number;
}

export interface AdminSummary {
  user_count: number;
  prediction_count: number;
  property_count: number;
  model: {
    name: string;
    status: string;
    artifact: string;
    features: string[];
    metrics: null | Record<string, number>;
    metrics_note: string;
  };
  dataset: {
    columns: string[];
    rows: number;
    missing_values: Record<string, number>;
  };
}
