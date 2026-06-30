export interface RegionRankingItem {
  pigment_id: number;
  rank: number;
}

export interface RegionRankingOut {
  region: string;
  zone: string;
  rankings: RegionRankingItem[];
}

export interface PigmentSettingsIn {
  region?: string | null;
  is_hidden: boolean;
  hide_reason?: string | null;
  is_promoted: boolean;
  sort_order: number;
}

export interface PigmentWithSettings {
  id: number;
  number?: number | null;
  zone?: string | null;
  line?: string | null;
  name?: string | null;
  role?: string | null;
  fitzpatrick?: string | null;
  is_corrector: boolean;
  priority?: string | null;
  price_ru?: number | null;
  price_eu?: number | null;
  is_mini: boolean;
  volume_ml?: string | null;
  is_hidden: boolean;
  hide_reason?: string | null;
  is_promoted: boolean;
  sort_order: number;
}

export interface PigmentCreate {
  zone: string;
  line?: string | null;
  name: string;
  temperature?: string | null;
  saturation?: string | null;
  role?: string | null;
  fitzpatrick?: string | null;
  is_corrector: boolean;
  priority?: string | null;
  price_ru?: number | null;
  price_eu?: number | null;
  is_mini: boolean;
  volume_ml?: string | null;
}

export interface ConsumableSettingsIn {
  region?: string | null;
  is_hidden: boolean;
  hide_reason?: string | null;
  gift_priority_override?: string | null;
  sort_order: number;
}

export interface ConsumableWithSettings {
  id: number;
  number?: number | null;
  name?: string | null;
  category?: string | null;
  zone?: string | null;
  price_ru?: number | null;
  price_eu?: number | null;
  has_mini: boolean;
  gift_priority?: string | null;
  is_hidden: boolean;
  hide_reason?: string | null;
  gift_priority_override?: string | null;
  sort_order: number;
}

export interface ConsumableCreate {
  name: string;
  category?: string | null;
  zone?: string | null;
  price_ru?: number | null;
  price_eu?: number | null;
  has_mini: boolean;
  gift_priority?: string | null;
}
