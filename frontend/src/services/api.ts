import type { Event, EventCreate, GiftSet, CalcLevels, Nomination, MonthlyBudget, DashboardStats, Proposal, ProposalCreate, ProposalMessage } from "../types";
import type {
  RegionRankingOut,
  RegionRankingItem,
  PigmentWithSettings,
  PigmentSettingsIn,
  PigmentCreate,
  ConsumableWithSettings,
  ConsumableSettingsIn,
  ConsumableCreate,
} from "../types/catalog";

const BASE = "/api";

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("face_auth");
    if (raw) return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {}
  return null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
      ...options?.headers,
    },
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
    delete: (id: number, reason: string) =>
      request<void>(`/events/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
    trash: () => request<Event[]>("/events/trash"),
    restore: (id: number) =>
      request<Event>(`/events/${id}/restore`, { method: "PATCH" }),
    generate: (id: number, variant: number = 0) =>
      request<GiftSet[]>(`/events/${id}/generate?variant=${variant}`, { method: "POST" }),
    sets: (id: number) => request<GiftSet[]>(`/events/${id}/sets`),
    updateSet: (eventId: number, setId: number, items: GiftSet["items"]) =>
      request<GiftSet>(`/events/${eventId}/sets/${setId}`, {
        method: "PUT",
        body: JSON.stringify({ items }),
      }),
    exportUrl: (id: number, format: "manager" | "organizer" = "manager") =>
      `/api/events/${id}/export?format=${format}`,
    submit: (id: number) =>
      request<Event>(`/events/${id}/submit`, { method: "PATCH" }),
    recall: (id: number) =>
      request<Event>(`/events/${id}/recall`, { method: "PATCH" }),
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
    createPigment: (data: PigmentCreate) =>
      request<PigmentWithSettings>("/catalog/pigments", { method: "POST", body: JSON.stringify(data) }),
    updatePigment: (id: number, data: PigmentCreate) =>
      request<PigmentWithSettings>(`/catalog/pigments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
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
    createConsumable: (data: ConsumableCreate) =>
      request<ConsumableWithSettings>("/catalog/consumables", { method: "POST", body: JSON.stringify(data) }),
    updateConsumable: (id: number, data: ConsumableCreate) =>
      request<ConsumableWithSettings>(`/catalog/consumables/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    updatePigmentPrice: (id: number, price_ru?: number, price_eu?: number) =>
      request<{ id: number; name: string; price_ru: number; price_eu: number }>(
        `/catalog/pigments/${id}/price`,
        { method: "PATCH", body: JSON.stringify({ price_ru, price_eu }) }
      ),
    updateConsumablePrice: (id: number, price_ru?: number, price_eu?: number) =>
      request<{ id: number; name: string; price_ru: number; price_eu: number }>(
        `/catalog/consumables/${id}/price`,
        { method: "PATCH", body: JSON.stringify({ price_ru, price_eu }) }
      ),
  },
  proposals: {
    list: () => request<Proposal[]>("/proposals/"),
    stats: () => request<{ new_count: number }>("/proposals/stats"),
    create: (data: ProposalCreate) =>
      request<Proposal>("/proposals/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: ProposalCreate) =>
      request<Proposal>(`/proposals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    decide: (id: number, decision: "approved" | "rejected", comment?: string) =>
      request<Proposal>(`/proposals/${id}/decide`, {
        method: "PATCH",
        body: JSON.stringify({ decision, comment: comment ?? null }),
      }),
    delete: (id: number) => request<void>(`/proposals/${id}`, { method: "DELETE" }),
    getMessages: (id: number) => request<ProposalMessage[]>(`/proposals/${id}/messages`),
    sendMessage: (id: number, author_label: string, text: string) =>
      request<ProposalMessage>(`/proposals/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ author_label, text }),
      }),
  },
  auth: {
    login: (username: string, password: string) =>
      request<{ role: "admin" | "employee"; token: string; name: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<{ role: "admin" | "employee" }>("/auth/me"),
  },
  admin: {
    backupDownloadUrl: () => `/api/admin/backup/download`,
    sendBackupToTelegram: () => request<{ status: string }>("/admin/backup/telegram", { method: "POST" }),
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
    itemsReport: (params: {
      date_from?: string;
      date_to?: string;
      sku_type?: string;
      category?: string;
      warehouse?: string;
      event_type?: string;
    }) => {
      const p = new URLSearchParams();
      if (params.date_from) p.set("date_from", params.date_from);
      if (params.date_to) p.set("date_to", params.date_to);
      if (params.sku_type) p.set("sku_type", params.sku_type);
      if (params.category) p.set("category", params.category);
      if (params.warehouse) p.set("warehouse", params.warehouse);
      if (params.event_type) p.set("event_type", params.event_type);
      const qs = p.toString() ? `?${p.toString()}` : "";
      return request<{
        items: { name: string; sku_type: string; category: string; volume_ml: string; qty: number; total_price: number }[];
        grand_total: number;
        consumable_categories: string[];
      }>(`/dashboard/items-report${qs}`);
    },
    geography: (params: {
      date_from?: string;
      date_to?: string;
      event_type?: string;
    }) => {
      const p = new URLSearchParams();
      if (params.date_from) p.set("date_from", params.date_from);
      if (params.date_to) p.set("date_to", params.date_to);
      if (params.event_type) p.set("event_type", params.event_type);
      const qs = p.toString() ? `?${p.toString()}` : "";
      return request<{ region: string; events_count: number; total_cost: number; countries: string[] }[]>(
        `/dashboard/geography${qs}`
      );
    },
  },
};
