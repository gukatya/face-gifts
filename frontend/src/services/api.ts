import type { Event, EventCreate, GiftSet, CalcLevels, Nomination, MonthlyBudget, DashboardStats } from "../types";
import type {
  RegionRankingOut,
  RegionRankingItem,
  PigmentWithSettings,
  PigmentSettingsIn,
  ConsumableWithSettings,
  ConsumableSettingsIn,
} from "../types/catalog";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  events: {
    list: () => request<Event[]>("/events/"),
    get: (id: number) => request<Event>(`/events/${id}`),
    create: (data: EventCreate) =>
      request<Event>("/events/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: EventCreate) =>
      request<Event>(`/events/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/events/${id}`, { method: "DELETE" }),
    generate: (id: number, variant: number = 0) =>
      request<GiftSet[]>(`/events/${id}/generate?variant=${variant}`, { method: "POST" }),
    sets: (id: number) => request<GiftSet[]>(`/events/${id}/sets`),
    updateSet: (eventId: number, setId: number, items: GiftSet["items"]) =>
      request<GiftSet>(`/events/${eventId}/sets/${setId}`, {
        method: "PUT",
        body: JSON.stringify({ items }),
      }),
    exportUrl: (id: number) => `/api/events/${id}/export`,
    ship: (id: number, shippedDate?: string) =>
      request<Event>(`/events/${id}/ship`, {
        method: "PATCH",
        body: JSON.stringify({ shipped_date: shippedDate ?? null }),
      }),
    unship: (id: number) =>
      request<Event>(`/events/${id}/unship`, { method: "PATCH" }),
    approve: (id: number) =>
      request<Event>(`/events/${id}/approve`, { method: "PATCH" }),
    unapprove: (id: number) =>
      request<Event>(`/events/${id}/unapprove`, { method: "PATCH" }),
  },
  calculator: {
    calc: (data: { nominations: Nomination[]; grand_prix_count: number; giveaways_count: number; participants_count: number }) =>
      request<CalcLevels>("/events/calculate", { method: "POST", body: JSON.stringify(data) }),
  },
  knowledge: {
    nominations: () => request<{ id: number; name: string; zone: string; method: string }[]>("/knowledge/nominations"),
    countries: () => request<string[]>("/knowledge/countries"),
    regions: () => request<string[]>("/knowledge/regions"),
    countryProfile: (country: string) =>
      request<{ country: string; region: string; fitz_min: number; fitz_max: number; fitz_typical: number }>(
        `/knowledge/countries/${encodeURIComponent(country)}/profile`
      ),
  },
  catalog: {
    regions: () => request<string[]>("/catalog/regions"),
    regionRankings: (region: string) =>
      request<RegionRankingOut[]>(`/catalog/regions/${encodeURIComponent(region)}/rankings`),
    saveRankings: (region: string, zone: string, rankings: RegionRankingItem[]) =>
      request<RegionRankingOut>(`/catalog/regions/${encodeURIComponent(region)}/rankings/${encodeURIComponent(zone)}`, {
        method: "PUT",
        body: JSON.stringify(rankings),
      }),
    pigments: (region?: string, zone?: string) => {
      const params = new URLSearchParams();
      if (region) params.set("region", region);
      if (zone) params.set("zone", zone);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return request<PigmentWithSettings[]>(`/catalog/pigments${qs}`);
    },
    savePigmentSettings: (pigmentId: number, data: PigmentSettingsIn) =>
      request<PigmentWithSettings>(`/catalog/pigments/${pigmentId}/settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    consumables: (region?: string) => {
      const params = new URLSearchParams();
      if (region) params.set("region", region);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return request<ConsumableWithSettings[]>(`/catalog/consumables${qs}`);
    },
    saveConsumableSettings: (consumableId: number, data: ConsumableSettingsIn) =>
      request<ConsumableWithSettings>(`/catalog/consumables/${consumableId}/settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
  budgets: {
    list: () => request<MonthlyBudget[]>("/budgets/"),
    set: (month: string, planned: number) =>
      request<MonthlyBudget>(`/budgets/${month}`, {
        method: "PUT",
        body: JSON.stringify({ planned }),
      }),
  },
  dashboard: {
    stats: () => request<DashboardStats>("/dashboard/stats"),
  },
};
