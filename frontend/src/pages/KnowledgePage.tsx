import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../services/api";
import type {
  RegionRankingItem,
  RegionRankingOut,
  PigmentWithSettings,
  PigmentSettingsIn,
  ConsumableWithSettings,
  ConsumableSettingsIn,
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
                      <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-0.5">
                        {filteredList.slice(0, 20).map((pig) => (
                          <button
                            key={pig.id}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50 flex flex-col"
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
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-48 shrink-0">
        <div className="card p-2">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedRegion === r
                  ? "bg-brand-500 text-white font-medium"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
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
                  ? "bg-brand-500 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {selectedRegion === "Глобально" && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <span className="text-base leading-none mt-0.5">⚠️</span>
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                    <div className="font-medium text-gray-900">{pig.name}</div>
                    <div className="text-xs text-gray-400">{pig.line} · {pig.zone}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{pig.fitzpatrick || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {pig.price_ru ? `${pig.price_ru.toLocaleString("ru")} ₽` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={pig.is_promoted}
                      onChange={(e) => handleChange(pig, { is_promoted: e.target.checked })}
                      className="w-4 h-4 accent-brand-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={pig.is_hidden}
                      onChange={(e) => handleChange(pig, { is_hidden: e.target.checked })}
                      className="w-4 h-4 accent-brand-500 cursor-pointer"
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
                  ? "bg-brand-500 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.category}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.zone || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {c.price_ru ? `${c.price_ru.toLocaleString("ru")} ₽` : "—"}
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
                      className="w-4 h-4 accent-brand-500 cursor-pointer"
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">База знаний</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-500 hover:text-gray-700"
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
