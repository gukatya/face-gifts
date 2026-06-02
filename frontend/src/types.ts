export interface Nomination {
  name: string;
  place1: number;
  place2: number;
  place3: number;
}

export interface EventCreate {
  name: string;
  date: string;
  country: string;
  region: string;
  warehouse: "Россия" | "Европа";
  recipients: string;
  mode: "по номинациям" | "универсальный";
  level: "Скромный" | "Нормальный" | "Хороший";
  grand_prix_count: number;
  has_trade_booth: boolean;
  has_speaker_nonstop: boolean;
  has_speaker_stage: boolean;
  giveaways_count: number;
  giveaway_mode: "одинаковые" | "разные";
  participants_count: number;
  nominations: Nomination[];
  total_budget?: number;
  participants_budget: number;
  participants_use_certificate: boolean;
}

export interface Event extends EventCreate {
  id: number;
  status: "draft" | "pending" | "approved";
  gifts_sent: boolean;
  shipped_date: string | null;
  created_at: string;
  nominations_data: Nomination[] | null;
}

export interface MonthlyBudget {
  id: number;
  month: string;   // "2025-06"
  planned: number; // ₽
}

export interface DashboardMonthStat {
  month: string;
  planned: number;
  actual_cost: number;
  events_count: number;
  shipped_count: number;
  top_items: { name: string; sku_type: string; qty: number }[];
}

export interface DashboardGeo {
  region: string;
  events_count: number;
  total_cost: number;
  countries: string[];
}

export interface ShippingDeadline {
  id: number;
  name: string;
  date: string;
  ship_by: string;
  days_until_ship: number;
  region: string;
  country: string;
  level: string;
}

export interface DashboardStats {
  monthly_stats: DashboardMonthStat[];
  geography: DashboardGeo[];
  upcoming_deadlines: ShippingDeadline[];
}

export interface GiftItem {
  sku_type: "pigment" | "consumable" | "sample" | "certificate";
  sku_id: number;
  name: string;
  line?: string;
  zone?: string;
  category?: string;
  qty: number;
  price: number;
}

export interface GiftSet {
  id: number;
  event_id: number;
  nomination_name: string;
  place: string;
  level: string;
  items: GiftItem[];
  total_price: number;
}

export interface CalcLevels {
  Скромный: number;
  Нормальный: number;
  Хороший: number;
}
