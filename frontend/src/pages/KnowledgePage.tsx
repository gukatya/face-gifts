import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../services/api";
import type {
  RegionRankingItem,
  RegionRankingOut,
  PigmentWithSettings,
  PigmentSettingsIn,
  PigmentCreate,
  ConsumableWithSettings,
  ConsumableSettingsIn,
  ConsumableCreate,
} from "../types/catalog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REGION_COUNTRIES: Record<string, string[]> = {
  "Россия": ["Россия"],
  "СНГ": ["Украина", "Беларусь", "Молдова"],
  "Кавказ": ["Грузия", "Армения", "Азербайджан"],
  "Центральная Азия": ["Казахстан", "Кыргызстан", "Узбекистан", "Таджикистан", "Туркменистан", "Монголия"],
  "Турция": ["Турция"],
  "Балканы": ["Сербия", "Болгария", "Хорватия", "Босния", "Черногория", "Македония", "Албания", "Румыния", "Греция"],
  "Западная Европа": ["Германия", "Франция", "Великобритания", "Нидерланды", "Бельгия", "Австрия", "Швейцария", "Швеция", "Норвегия", "Дания", "Финляндия", "Польша", "Чехия", "Словакия", "Венгрия", "Португалия", "Испания", "Италия", "Ирландия", "Австралия", "Новая Зеландия"],
  "Ближний Восток": ["ОАЭ", "Саудовская Аравия", "Израиль", "Иордания", "Ливан", "Иран", "Ирак", "Кувейт", "Катар", "Бахрейн", "Оман", "Египет", "Марокко", "Тунис"],
  "ЮВА": ["Таиланд", "Вьетнам", "Индонезия", "Малайзия", "Филиппины", "Сингапур", "Камбоджа", "Мьянма"],
  "Южная Азия": ["Индия", "Пакистан", "Бангладеш", "Шри-Ланка"],
  "Восточная Азия": ["Китай", "Япония", "Южная Корея", "Северная Корея", "Тайвань", "Гонконг"],
  "Латинская Америка": ["Бразилия", "Мексика", "Аргентина", "Колумбия", "Перу", "Чили", "Венесуэла", "Эквадор", "Боливия", "Куба", "Доминиканская Республика"],
  "Северная Америка": ["США", "Канада"],
  "Африка": ["ЮАР", "Нигерия", "Кения", "Эфиопия"],
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Modals: add / edit pigment & consumable
// ---------------------------------------------------------------------------

const EMPTY_PIGMENT: PigmentCreate = {
  zone: "Брови", line: "", name: "", temperature: "", saturation: "", role: "база",
  fitzpatrick: "", is_corrector: false, priority: "стандарт", price_ru: undefined,
  price_eu: undefined, is_mini: false, volume_ml: "",
};

function PigmentFormModal({
  initial, onClose, onSaved,
}: {
  initial: (PigmentCreate & { id?: number }) | null;
  onClose: () => void;
  onSaved: (p: PigmentWithSettings) => void;
}) {
  const [form, setForm] = useState<PigmentCreate>(initial ?? EMPTY_PIGMENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!initial?.id;

  const set = <K extends keyof PigmentCreate>(key: K, value: PigmentCreate[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.zone.trim()) {
      setError("Название и зона обязательны");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: PigmentCreate = {
        ...form,
        line: form.line || null,
        fitzpatrick: form.fitzpatrick || null,
        volume_ml: form.volume_ml || null,
        price_ru: form.price_ru != null && (form.price_ru as unknown as string) !== "" ? Number(form.price_ru) : null,
        price_eu: form.price_eu != null && (form.price_eu as unknown as string) !== "" ? Number(form.price_eu) : null,
      };
      const result = isEdit
        ? await api.catalog.updatePigment(initial!.id!, payload)
        : await api.catalog.createPigment(payload);
      onSaved(result);
      onClose();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-4">{isEdit ? "Редактировать пигмент" : "Добавить пигмент"}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm col-span-2">
            <span className="label">Название</span>
            <input className="input w-full" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">Зона</span>
            <select className="input w-full" value={form.zone} onChange={(e) => set("zone", e.target.value)}>
              <option value="Брови">Брови</option>
              <option value="Губы">Губы</option>
              <option value="Веки">Веки</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="label">Линия</span>
            <input className="input w-full" value={form.line ?? ""} onChange={(e) => set("line", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">Роль</span>
            <select className="input w-full" value={form.role ?? ""} onChange={(e) => set("role", e.target.value)}>
              <option value="база">база</option>
              <option value="модификатор">модификатор</option>
              <option value="акцент">акцент</option>
              <option value="корректор">корректор</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="label">Fitzpatrick</span>
            <input className="input w-full" placeholder="напр. 2-4" value={form.fitzpatrick ?? ""} onChange={(e) => set("fitzpatrick", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">Цена ₽</span>
            <input type="number" className="input w-full" value={form.price_ru ?? ""} onChange={(e) => set("price_ru", e.target.value === "" ? undefined : Number(e.target.value))} />
          </label>
          <label className="text-sm">
            <span className="label">Цена €</span>
            <input type="number" className="input w-full" value={form.price_eu ?? ""} onChange={(e) => set("price_eu", e.target.value === "" ? undefined : Number(e.target.value))} />
          </label>
          <label className="text-sm">
            <span className="label">Объём (если есть размерность)</span>
            <select className="input w-full" value={form.volume_ml ?? ""} onChange={(e) => set("volume_ml", e.target.value)}>
              <option value="">—</option>
              <option value="6мл">6мл</option>
              <option value="12мл">12мл</option>
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 mt-5">
            <input type="checkbox" className="w-4 h-4 accent-black" checked={form.is_mini} onChange={(e) => set("is_mini", e.target.checked)} />
            <span>Мини (сэмпл)</span>
          </label>
          <label className="text-sm flex items-center gap-2 mt-5">
            <input type="checkbox" className="w-4 h-4 accent-black" checked={form.is_corrector} onChange={(e) => set("is_corrector", e.target.checked)} />
            <span>Корректор</span>
          </label>
        </div>
        {error && <div className="text-xs text-red-600 mt-3">{error}</div>}
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary text-sm" onClick={onClose}>Отмена</button>
          <button className="btn-primary text-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_CONSUMABLE: ConsumableCreate = {
  name: "", category: "", zone: "Все зоны", price_ru: undefined, price_eu: undefined,
  has_mini: false, gift_priority: "средний",
};

function ConsumableFormModal({
  initial, onClose, onSaved,
}: {
  initial: (ConsumableCreate & { id?: number }) | null;
  onClose: () => void;
  onSaved: (c: ConsumableWithSettings) => void;
}) {
  const [form, setForm] = useState<ConsumableCreate>(initial ?? EMPTY_CONSUMABLE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!initial?.id;

  const set = <K extends keyof ConsumableCreate>(key: K, value: ConsumableCreate[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Название обязательно");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: ConsumableCreate = {
        ...form,
        category: form.category || null,
        zone: form.zone || null,
        price_ru: form.price_ru != null && (form.price_ru as unknown as string) !== "" ? Number(form.price_ru) : null,
        price_eu: form.price_eu != null && (form.price_eu as unknown as string) !== "" ? Number(form.price_eu) : null,
      };
      const result = isEdit
        ? await api.catalog.updateConsumable(initial!.id!, payload)
        : await api.catalog.createConsumable(payload);
      onSaved(result);
      onClose();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-4">{isEdit ? "Редактировать расходник" : "Добавить расходник"}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm col-span-2">
            <span className="label">Название</span>
            <input className="input w-full" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">Категория</span>
            <input className="input w-full" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">Зона</span>
            <input className="input w-full" placeholder="Все зоны / Брови / Губы" value={form.zone ?? ""} onChange={(e) => set("zone", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="label">Цена ₽</span>
            <input type="number" className="input w-full" value={form.price_ru ?? ""} onChange={(e) => set("price_ru", e.target.value === "" ? undefined : Number(e.target.value))} />
          </label>
          <label className="text-sm">
            <span className="label">Цена €</span>
            <input type="number" className="input w-full" value={form.price_eu ?? ""} onChange={(e) => set("price_eu", e.target.value === "" ? undefined : Number(e.target.value))} />
          </label>
          <label className="text-sm">
            <span className="label">Приоритет в подарке</span>
            <select className="input w-full" value={form.gift_priority ?? ""} onChange={(e) => set("gift_priority", e.target.value)}>
              <option value="высокий">высокий</option>
              <option value="средний">средний</option>
              <option value="низкий">низкий</option>
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 mt-5">
            <input type="checkbox" className="w-4 h-4 accent-black" checked={form.has_mini} onChange={(e) => set("has_mini", e.target.checked)} />
            <span>Есть мини-версия</span>
          </label>
        </div>
        {error && <div className="text-xs text-red-600 mt-3">{error}</div>}
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary text-sm" onClick={onClose}>Отмена</button>
          <button className="btn-primary text-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Регионы
// ---------------------------------------------------------------------------

interface RegionsTabProps {
  regions: string[];
  allPigments: PigmentWithSettings[];
}

function RegionsTab({ regions, allPigments }: RegionsTabProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>(regions[0] || "");
  const [rankings, setRankings] = useState<Record<string, RegionRankingOut>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  // Slot states: zone -> array of 8 pigment_id | null
  const [slots, setSlots] = useState<Record<string, (number | null)[]>>({
    "Брови": Array(8).fill(null),
    "Губы": Array(8).fill(null),
  });
  const [searchTexts, setSearchTexts] = useState<Record<string, string[]>>({
    "Брови": Array(8).fill(""),
    "Губы": Array(8).fill(""),
  });
  const [showDropdowns, setShowDropdowns] = useState<Record<string, boolean[]>>({
    "Брови": Array(8).fill(false),
    "Губы": Array(8).fill(false),
  });

  const browPigments = allPigments.filter((p) => p.zone === "Брови");
  const lipPigments = allPigments.filter((p) => p.zone === "Губы");

  const loadRankings = useCallback(async (region: string) => {
    setLoading(true);
    try {
      const data = await api.catalog.regionRankings(region);
      const map: Record<string, RegionRankingOut> = {};
      data.forEach((r) => (map[r.zone] = r));
      setRankings(map);

      // Populate slots from loaded rankings
      const newSlots: Record<string, (number | null)[]> = { "Брови": Array(8).fill(null), "Губы": Array(8).fill(null) };
      const newSearchTexts: Record<string, string[]> = { "Брови": Array(8).fill(""), "Губы": Array(8).fill("") };

      for (const zone of ["Брови", "Губы"]) {
        const r = map[zone];
        if (r) {
          r.rankings.forEach((item) => {
            const idx = item.rank - 1;
            if (idx >= 0 && idx < 8) {
              newSlots[zone][idx] = item.pigment_id;
              const pig = allPigments.find((p) => p.id === item.pigment_id);
              newSearchTexts[zone][idx] = pig ? `${pig.name}${pig.line ? " — " + pig.line : ""}` : String(item.pigment_id);
            }
          });
        }
      }
      setSlots(newSlots);
      setSearchTexts(newSearchTexts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [allPigments]);

  useEffect(() => {
    if (selectedRegion) {
      loadRankings(selectedRegion);
    }
  }, [selectedRegion, loadRankings]);

  const handleSave = async (zone: string) => {
    setSaving(zone);
    const zoneSlots = slots[zone];
    const items: RegionRankingItem[] = zoneSlots
      .map((pid, idx) => (pid !== null ? { pigment_id: pid, rank: idx + 1 } : null))
      .filter((x): x is RegionRankingItem => x !== null);
    try {
      await api.catalog.saveRankings(selectedRegion, zone, items);
      setFeedback((f) => ({ ...f, [zone]: "Сохранено" }));
      setTimeout(() => setFeedback((f) => ({ ...f, [zone]: "" })), 2000);
    } catch {
      setFeedback((f) => ({ ...f, [zone]: "Ошибка сохранения" }));
    } finally {
      setSaving(null);
    }
  };

  const getPigmentList = (zone: string) => (zone === "Брови" ? browPigments : lipPigments);

  const handleSearchChange = (zone: string, idx: number, text: string) => {
    setSearchTexts((prev) => {
      const arr = [...prev[zone]];
      arr[idx] = text;
      return { ...prev, [zone]: arr };
    });
    // If text cleared, clear slot
    if (!text) {
      setSlots((prev) => {
        const arr = [...prev[zone]];
        arr[idx] = null;
        return { ...prev, [zone]: arr };
      });
    }
    setShowDropdowns((prev) => {
      const arr = [...prev[zone]];
      arr[idx] = true;
      return { ...prev, [zone]: arr };
    });
  };

  const handleSelectPigment = (zone: string, idx: number, pig: PigmentWithSettings) => {
    setSlots((prev) => {
      const arr = [...prev[zone]];
      arr[idx] = pig.id;
      return { ...prev, [zone]: arr };
    });
    setSearchTexts((prev) => {
      const arr = [...prev[zone]];
      arr[idx] = `${pig.name}${pig.line ? " — " + pig.line : ""}`;
      return { ...prev, [zone]: arr };
    });
    setShowDropdowns((prev) => {
      const arr = [...prev[zone]];
      arr[idx] = false;
      return { ...prev, [zone]: arr };
    });
  };

  const handleBlur = (zone: string, idx: number) => {
    setTimeout(() => {
      setShowDropdowns((prev) => {
        const arr = [...prev[zone]];
        arr[idx] = false;
        return { ...prev, [zone]: arr };
      });
    }, 150);
  };

  const renderZoneSection = (zone: string) => {
    const pigList = getPigmentList(zone);

    return (
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">{zone} (топ продаж)</h3>
          <div className="flex items-center gap-3">
            {feedback[zone] && (
              <span className={`text-xs ${feedback[zone] === "Сохранено" ? "text-green-600" : "text-red-500"}`}>
                {feedback[zone]}
              </span>
            )}
            <button
              className="btn-primary text-xs py-1.5 px-3"
              onClick={() => handleSave(zone)}
              disabled={saving === zone}
            >
              {saving === zone ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }, (_, idx) => {
              const searchText = searchTexts[zone][idx];
              const filteredList = pigList.filter((p) => {
                const label = `${p.name ?? ""} ${p.line ?? ""}`.toLowerCase();
                return !searchText || label.includes(searchText.toLowerCase());
              });
              return (
                <div key={idx} className="relative flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 shrink-0 text-right">{idx + 1}</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Начните вводить название..."
                      value={searchText}
                      onChange={(e) => handleSearchChange(zone, idx, e.target.value)}
                      onFocus={() =>
                        setShowDropdowns((prev) => {
                          const arr = [...prev[zone]];
                          arr[idx] = true;
                          return { ...prev, [zone]: arr };
                        })
                      }
                      onBlur={() => handleBlur(zone, idx)}
                    />
                    {showDropdowns[zone][idx] && filteredList.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 bg-white/95 backdrop-blur border border-black/10 rounded-xl shadow-lg max-h-40 overflow-y-auto mt-0.5">
                        {filteredList.slice(0, 20).map((pig) => (
                          <button
                            key={pig.id}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-luxe-grey flex flex-col"
                            onMouseDown={() => handleSelectPigment(zone, idx, pig)}
                          >
                            <span className="font-medium">{pig.name}</span>
                            {pig.line && <span className="text-xs text-gray-400">{pig.line}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          При отсутствии данных алгоритм подбирает по шкале Фицпатрика
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
      {/* Sidebar */}
      <div className="w-full sm:w-48 sm:shrink-0">
        <div className="card p-2">
          <div className="flex sm:flex-col overflow-x-auto sm:overflow-visible gap-1 pb-1 sm:pb-0">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`shrink-0 sm:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                selectedRegion === r
                  ? "bg-luxe-black text-white font-medium"
                  : "hover:bg-luxe-grey text-black/60"
              }`}
            >
              {r}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1">
        {selectedRegion ? (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{selectedRegion}</h2>
              {REGION_COUNTRIES[selectedRegion] && (
                <p className="text-xs text-gray-400 mt-1">
                  {REGION_COUNTRIES[selectedRegion].join(", ")}
                </p>
              )}
            </div>
            {renderZoneSection("Брови")}
            {renderZoneSection("Губы")}
          </>
        ) : (
          <div className="text-gray-400 text-sm">Выберите регион</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Пигменты
// ---------------------------------------------------------------------------

function PigmentsTab({ regions }: { regions: string[] }) {
  const [selectedRegion, setSelectedRegion] = useState<string>("Глобально");
  const [zoneFilter, setZoneFilter] = useState<string>("Все");
  const [pigments, setPigments] = useState<PigmentWithSettings[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [priceEditId, setPriceEditId] = useState<number | null>(null);
  const [priceRu, setPriceRu] = useState("");
  const [priceEu, setPriceEu] = useState("");
  const [formTarget, setFormTarget] = useState<(PigmentCreate & { id?: number }) | null | "new">(null);

  const regionOptions = ["Глобально", ...regions];
  const zoneOptions = ["Все", "Брови", "Губы", "Веки"];

  const loadPigments = useCallback(async () => {
    setLoading(true);
    try {
      const region = selectedRegion === "Глобально" ? undefined : selectedRegion;
      const zone = zoneFilter === "Все" ? undefined : zoneFilter;
      const data = await api.catalog.pigments(region, zone);
      setPigments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, zoneFilter]);

  useEffect(() => {
    loadPigments();
  }, [loadPigments]);

  const saveSettings = async (pig: PigmentWithSettings, patch: Partial<PigmentSettingsIn>) => {
    const payload: PigmentSettingsIn = {
      region: selectedRegion === "Глобально" ? null : selectedRegion,
      is_hidden: pig.is_hidden,
      hide_reason: pig.hide_reason ?? null,
      is_promoted: pig.is_promoted,
      sort_order: pig.sort_order,
      ...patch,
    };
    setSavingId(pig.id);
    try {
      await api.catalog.savePigmentSettings(pig.id, payload);
      setFeedback((f) => ({ ...f, [pig.id]: "ok" }));
      setTimeout(() => setFeedback((f) => ({ ...f, [pig.id]: "" })), 1500);
    } catch {
      setFeedback((f) => ({ ...f, [pig.id]: "err" }));
    } finally {
      setSavingId(null);
    }
  };

  const handleChange = (pig: PigmentWithSettings, patch: Partial<PigmentWithSettings>) => {
    // Optimistic update
    setPigments((prev) => prev.map((p) => (p.id === pig.id ? { ...p, ...patch } : p)));
    // Debounced save
    if (debounceTimers.current[pig.id]) clearTimeout(debounceTimers.current[pig.id]);
    debounceTimers.current[pig.id] = setTimeout(() => {
      saveSettings({ ...pig, ...patch }, patch as Partial<PigmentSettingsIn>);
    }, 600);
  };

  const startPriceEdit = (pig: PigmentWithSettings) => {
    setPriceEditId(pig.id);
    setPriceRu(pig.price_ru != null ? String(Math.round(pig.price_ru)) : "");
    setPriceEu(pig.price_eu != null ? String(Math.round(pig.price_eu)) : "");
  };

  const savePriceEdit = async () => {
    if (!priceEditId) return;
    try {
      const result = await api.catalog.updatePigmentPrice(
        priceEditId,
        priceRu ? Number(priceRu) : undefined,
        priceEu ? Number(priceEu) : undefined,
      );
      setPigments((prev) =>
        prev.map((p) => p.id === priceEditId ? { ...p, price_ru: result.price_ru, price_eu: result.price_eu } : p)
      );
    } catch { /* ignore */ }
    setPriceEditId(null);
  };

  const openEdit = (pig: PigmentWithSettings) => {
    setFormTarget({
      id: pig.id, zone: pig.zone ?? "Брови", line: pig.line ?? "", name: pig.name ?? "",
      temperature: "", saturation: "", role: pig.role ?? "", fitzpatrick: pig.fitzpatrick ?? "",
      is_corrector: pig.is_corrector, priority: pig.priority ?? "стандарт",
      price_ru: pig.price_ru ?? undefined, price_eu: pig.price_eu ?? undefined,
      is_mini: pig.is_mini, volume_ml: pig.volume_ml ?? "",
    });
  };

  const handleFormSaved = (saved: PigmentWithSettings) => {
    setPigments((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
    });
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div>
          <label className="label">Регион</label>
          <select
            className="input w-48 text-sm"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {regionOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 mt-5">
          {zoneOptions.map((z) => (
            <button
              key={z}
              onClick={() => setZoneFilter(z)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                zoneFilter === z
                  ? "bg-luxe-black text-white"
                  : "bg-white/70 border border-black/15 text-black/60 hover:bg-white"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
        <button className="btn-primary text-sm ml-auto" onClick={() => setFormTarget("new")}>
          + Добавить пигмент
        </button>
      </div>

      {selectedRegion === "Глобально" && (
        <div className="mb-4 flex items-start gap-2 bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-sm text-black/60">
          <span className="text-base leading-none mt-0.5 font-bold">!</span>
          <span>
            Вы редактируете <strong>глобальные</strong> настройки — они применяются ко всем регионам.
            Чтобы настроить «Продвигаем» только для одного региона — выберите его в списке выше.
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-black/3 border-b border-black/8">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Название</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fitzpatrick</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Цена</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Продвигаем</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Скрыт</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Причина</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-20">Порядок</th>
              </tr>
            </thead>
            <tbody>
              {pigments.map((pig, i) => (
                <tr key={pig.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 group">
                      <div>
                        <div className="font-medium text-gray-900">
                          {pig.name}{pig.is_mini && <span className="text-xs text-black/35 font-normal"> · мини</span>}
                          {pig.volume_ml && <span className="text-xs text-black/35 font-normal"> · {pig.volume_ml}</span>}
                        </div>
                        <div className="text-xs text-gray-400">{pig.line} · {pig.zone}</div>
                      </div>
                      <button
                        onClick={() => openEdit(pig)}
                        className="opacity-0 group-hover:opacity-100 text-black/25 hover:text-black/60 text-xs transition-opacity"
                        title="Редактировать"
                      >
                        ✏
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{pig.fitzpatrick || "—"}</td>
                  <td className="px-4 py-2.5">
                    {priceEditId === pig.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="input text-xs py-0.5 w-20 text-right"
                          value={priceRu}
                          onChange={(e) => setPriceRu(e.target.value)}
                          placeholder="₽"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") savePriceEdit(); if (e.key === "Escape") setPriceEditId(null); }}
                        />
                        <span className="text-xs text-black/30">₽</span>
                        <input
                          type="number"
                          className="input text-xs py-0.5 w-20 text-right"
                          value={priceEu}
                          onChange={(e) => setPriceEu(e.target.value)}
                          placeholder="€"
                          onKeyDown={(e) => { if (e.key === "Enter") savePriceEdit(); if (e.key === "Escape") setPriceEditId(null); }}
                        />
                        <span className="text-xs text-black/30">€</span>
                        <button onClick={savePriceEdit} className="text-xs font-semibold text-green-600 hover:text-green-700 px-1">OK</button>
                        <button onClick={() => setPriceEditId(null)} className="text-xs text-black/30 hover:text-black/60">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startPriceEdit(pig)}>
                        <span className="text-gray-600">{pig.price_ru ? `${pig.price_ru.toLocaleString("ru")} ₽` : "—"}</span>
                        {pig.price_eu != null && pig.price_eu > 0 && (
                          <span className="text-gray-400 text-xs">{pig.price_eu.toLocaleString("ru")} €</span>
                        )}
                        <span className="opacity-0 group-hover:opacity-100 text-black/25 text-xs transition-opacity select-none">✏</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={pig.is_promoted}
                      onChange={(e) => handleChange(pig, { is_promoted: e.target.checked })}
                      className="w-4 h-4 accent-black cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={pig.is_hidden}
                      onChange={(e) => handleChange(pig, { is_hidden: e.target.checked })}
                      className="w-4 h-4 accent-black cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {pig.is_hidden && (
                      <select
                        className="input text-xs py-1 w-32"
                        value={pig.hide_reason || ""}
                        onChange={(e) => handleChange(pig, { hide_reason: e.target.value || null })}
                      >
                        <option value="">—</option>
                        <option value="out_of_stock">нет на складе</option>
                        <option value="discontinued">выводим</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="number"
                      className="input text-xs py-1 w-16 text-center"
                      value={pig.sort_order}
                      onChange={(e) => handleChange(pig, { sort_order: Number(e.target.value) })}
                    />
                  </td>
                </tr>
              ))}
              {pigments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {formTarget && (
        <PigmentFormModal
          initial={formTarget === "new" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Расходники
// ---------------------------------------------------------------------------

function ConsumablesTab({ regions }: { regions: string[] }) {
  const [selectedRegion, setSelectedRegion] = useState<string>("Глобально");
  const [categoryFilter, setCategoryFilter] = useState<string>("Все");
  const [consumables, setConsumables] = useState<ConsumableWithSettings[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [cPriceEditId, setCPriceEditId] = useState<number | null>(null);
  const [cPriceRu, setCPriceRu] = useState("");
  const [cPriceEu, setCPriceEu] = useState("");
  const [formTarget, setFormTarget] = useState<(ConsumableCreate & { id?: number }) | null | "new">(null);

  const regionOptions = ["Глобально", ...regions];

  const allCategories = ["Все", ...Array.from(new Set(consumables.map((c) => c.category || "—")))];

  const loadConsumables = useCallback(async () => {
    setLoading(true);
    try {
      const region = selectedRegion === "Глобально" ? undefined : selectedRegion;
      const data = await api.catalog.consumables(region);
      setConsumables(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedRegion]);

  useEffect(() => {
    loadConsumables();
  }, [loadConsumables]);

  const saveSettings = async (c: ConsumableWithSettings, patch: Partial<ConsumableSettingsIn>) => {
    const payload: ConsumableSettingsIn = {
      region: selectedRegion === "Глобально" ? null : selectedRegion,
      is_hidden: c.is_hidden,
      hide_reason: c.hide_reason ?? null,
      gift_priority_override: c.gift_priority_override ?? null,
      sort_order: c.sort_order,
      ...patch,
    };
    try {
      await api.catalog.saveConsumableSettings(c.id, payload);
    } catch {
      // ignore
    }
  };

  const handleChange = (c: ConsumableWithSettings, patch: Partial<ConsumableWithSettings>) => {
    setConsumables((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    if (debounceTimers.current[c.id]) clearTimeout(debounceTimers.current[c.id]);
    debounceTimers.current[c.id] = setTimeout(() => {
      saveSettings({ ...c, ...patch }, patch as Partial<ConsumableSettingsIn>);
    }, 600);
  };

  const startCPriceEdit = (c: ConsumableWithSettings) => {
    setCPriceEditId(c.id);
    setCPriceRu(c.price_ru != null ? String(Math.round(c.price_ru)) : "");
    setCPriceEu(c.price_eu != null ? String(Math.round(c.price_eu)) : "");
  };

  const saveCPriceEdit = async () => {
    if (!cPriceEditId) return;
    try {
      const result = await api.catalog.updateConsumablePrice(
        cPriceEditId,
        cPriceRu ? Number(cPriceRu) : undefined,
        cPriceEu ? Number(cPriceEu) : undefined,
      );
      setConsumables((prev) =>
        prev.map((x) => x.id === cPriceEditId ? { ...x, price_ru: result.price_ru, price_eu: result.price_eu } : x)
      );
    } catch { /* ignore */ }
    setCPriceEditId(null);
  };

  const openEdit = (c: ConsumableWithSettings) => {
    setFormTarget({
      id: c.id, name: c.name ?? "", category: c.category ?? "", zone: c.zone ?? "",
      price_ru: c.price_ru ?? undefined, price_eu: c.price_eu ?? undefined,
      has_mini: c.has_mini, gift_priority: c.gift_priority ?? "средний",
    });
  };

  const handleFormSaved = (saved: ConsumableWithSettings) => {
    setConsumables((prev) => {
      const exists = prev.some((x) => x.id === saved.id);
      return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
    });
  };

  const filtered = consumables.filter(
    (c) => categoryFilter === "Все" || (c.category || "—") === categoryFilter
  );

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="label">Регион</label>
          <select
            className="input w-48 text-sm"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {regionOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-luxe-black text-white"
                  : "bg-white/70 border border-black/15 text-black/60 hover:bg-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button className="btn-primary text-sm ml-auto" onClick={() => setFormTarget("new")}>
          + Добавить расходник
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[580px]">
            <thead className="bg-black/3 border-b border-black/8">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Название</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Зона</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Цена</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Приоритет</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Скрыт</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Причина</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-20">Порядок</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 group">
                      <div>
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.category}</div>
                      </div>
                      <button
                        onClick={() => openEdit(c)}
                        className="opacity-0 group-hover:opacity-100 text-black/25 hover:text-black/60 text-xs transition-opacity"
                        title="Редактировать"
                      >
                        ✏
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.zone || "—"}</td>
                  <td className="px-4 py-2.5">
                    {cPriceEditId === c.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="input text-xs py-0.5 w-20 text-right"
                          value={cPriceRu}
                          onChange={(e) => setCPriceRu(e.target.value)}
                          placeholder="₽"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveCPriceEdit(); if (e.key === "Escape") setCPriceEditId(null); }}
                        />
                        <span className="text-xs text-black/30">₽</span>
                        <input
                          type="number"
                          className="input text-xs py-0.5 w-20 text-right"
                          value={cPriceEu}
                          onChange={(e) => setCPriceEu(e.target.value)}
                          placeholder="€"
                          onKeyDown={(e) => { if (e.key === "Enter") saveCPriceEdit(); if (e.key === "Escape") setCPriceEditId(null); }}
                        />
                        <span className="text-xs text-black/30">€</span>
                        <button onClick={saveCPriceEdit} className="text-xs font-semibold text-green-600 hover:text-green-700 px-1">OK</button>
                        <button onClick={() => setCPriceEditId(null)} className="text-xs text-black/30 hover:text-black/60">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startCPriceEdit(c)}>
                        <span className="text-gray-600">{c.price_ru ? `${c.price_ru.toLocaleString("ru")} ₽` : "—"}</span>
                        {c.price_eu != null && c.price_eu > 0 && (
                          <span className="text-gray-400 text-xs">{c.price_eu.toLocaleString("ru")} €</span>
                        )}
                        <span className="opacity-0 group-hover:opacity-100 text-black/25 text-xs transition-opacity select-none">✏</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="input text-xs py-1 w-28"
                      value={c.gift_priority_override || ""}
                      onChange={(e) =>
                        handleChange(c, { gift_priority_override: e.target.value || null })
                      }
                    >
                      <option value="">— авто ({c.gift_priority})</option>
                      <option value="высокий">высокий</option>
                      <option value="средний">средний</option>
                      <option value="низкий">низкий</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={c.is_hidden}
                      onChange={(e) => handleChange(c, { is_hidden: e.target.checked })}
                      className="w-4 h-4 accent-black cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {c.is_hidden && (
                      <select
                        className="input text-xs py-1 w-32"
                        value={c.hide_reason || ""}
                        onChange={(e) =>
                          handleChange(c, { hide_reason: e.target.value || null })
                        }
                      >
                        <option value="">—</option>
                        <option value="out_of_stock">нет на складе</option>
                        <option value="discontinued">выводим</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="number"
                      className="input text-xs py-1 w-16 text-center"
                      value={c.sort_order}
                      onChange={(e) => handleChange(c, { sort_order: Number(e.target.value) })}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {formTarget && (
        <ConsumableFormModal
          initial={formTarget === "new" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const TABS = ["Регионы", "Пигменты", "Расходники"] as const;
type Tab = (typeof TABS)[number];

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Регионы");
  const [regions, setRegions] = useState<string[]>([]);
  const [allPigments, setAllPigments] = useState<PigmentWithSettings[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    Promise.all([
      api.catalog.regions(),
      api.catalog.pigments(),
    ])
      .then(([regs, pigs]) => {
        setRegions(regs);
        setAllPigments(pigs);
      })
      .finally(() => setLoadingInit(false));
  }, []);

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Загрузка...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs tracking-widest uppercase text-luxe-grey-mid mb-1">Настройки</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-luxe-black uppercase">База знаний</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-black/10 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium tracking-wide transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-luxe-black text-luxe-black"
                : "border-transparent text-black/40 hover:text-black/70"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Регионы" && (
        <RegionsTab regions={regions} allPigments={allPigments} />
      )}
      {activeTab === "Пигменты" && <PigmentsTab regions={regions} />}
      {activeTab === "Расходники" && <ConsumablesTab regions={regions} />}
    </div>
  );
}
