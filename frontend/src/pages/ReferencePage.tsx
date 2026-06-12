import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { RegionRankingOut, PigmentWithSettings } from "../types/catalog";

// ─── Fitzpatrick reference data ───────────────────────────────────────────────

const FITZ_TYPES = [
  {
    type: "I",
    label: "Очень светлая",
    description: "Молочная кожа, веснушки. Всегда обгорает, никогда не загорает.",
    color: "#FDE8D8",
    examples: "Северная Европа, Скандинавия",
    hair: "Рыжий, светло-русый",
    zones: ["Европа", "Скандинавия"],
  },
  {
    type: "II",
    label: "Светлая",
    description: "Светлая кожа. Легко обгорает, слабо загорает.",
    color: "#F5D5BA",
    examples: "Россия, Украина, Северная Европа",
    hair: "Русый, тёмно-русый",
    zones: ["Россия", "СНГ", "Европа"],
  },
  {
    type: "III",
    label: "Средняя",
    description: "Средняя кожа. Иногда обгорает, постепенно загорает.",
    color: "#E8B896",
    examples: "Южная Европа, Кавказ, Средняя Азия",
    hair: "Каштановый, тёмный",
    zones: ["Кавказ", "Центральная Азия", "Европа"],
  },
  {
    type: "IV",
    label: "Оливковая",
    description: "Оливковая кожа. Редко обгорает, хорошо загорает.",
    color: "#C8956C",
    examples: "Ближний Восток, Средиземноморье, Латинская Америка",
    hair: "Тёмно-каштановый, чёрный",
    zones: ["Ближний Восток", "ЮВА", "Латинская Америка"],
  },
  {
    type: "V",
    label: "Тёмная",
    description: "Тёмная кожа. Очень редко обгорает, легко загорает.",
    color: "#8B5E3C",
    examples: "Южная Азия, Индия, Африка",
    hair: "Чёрный",
    zones: ["Южная Азия", "Африка"],
  },
  {
    type: "VI",
    label: "Очень тёмная",
    description: "Глубоко пигментированная кожа. Никогда не обгорает.",
    color: "#4A2C1A",
    examples: "Центральная и Западная Африка",
    hair: "Чёрный",
    zones: ["Африка"],
  },
];

// Typical Fitzpatrick range per region (for the reference table)
const REGION_FITZ: Record<string, { min: number; max: number; label: string }> = {
  "Россия":             { min: 1, max: 3, label: "I–III" },
  "СНГ":               { min: 2, max: 3, label: "II–III" },
  "Кавказ":            { min: 3, max: 4, label: "III–IV" },
  "Центральная Азия":  { min: 2, max: 4, label: "II–IV" },
  "Турция":            { min: 3, max: 4, label: "III–IV" },
  "Балканы":           { min: 2, max: 4, label: "II–IV" },
  "Западная Европа":   { min: 1, max: 3, label: "I–III" },
  "Ближний Восток":    { min: 3, max: 5, label: "III–V" },
  "Европа":            { min: 1, max: 3, label: "I–III" },
  "ЮВА":               { min: 3, max: 5, label: "III–V" },
  "Восточная Азия":    { min: 2, max: 4, label: "II–IV" },
  "Китай":             { min: 2, max: 4, label: "II–IV" },
  "Латинская Америка": { min: 3, max: 5, label: "III–V" },
  "Северная Америка":  { min: 1, max: 4, label: "I–IV" },
  "Африка":            { min: 5, max: 6, label: "V–VI" },
  "Южная Азия":        { min: 4, max: 6, label: "IV–VI" },
  "США/Канада":        { min: 1, max: 4, label: "I–IV" },
  "Австралия":         { min: 1, max: 3, label: "I–III" },
  "Япония/Корея":      { min: 2, max: 4, label: "II–IV" },
};

// ─── Fitzpatrick helpers ───────────────────────────────────────────────────────

function parseFitzpatrick(fitz: string | null | undefined): number[] {
  if (!fitz) return [];
  const str = fitz.trim().replace("—", "-").replace("–", "-");

  // Numeric range: "2-4", "3-5"
  const numRange = str.match(/^(\d)\s*-\s*(\d)$/);
  if (numRange) {
    const start = parseInt(numRange[1]);
    const end = parseInt(numRange[2]);
    if (start >= 1 && end <= 6 && start <= end)
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  // Single numeric: "3"
  const single = parseInt(str);
  if (!isNaN(single) && single >= 1 && single <= 6) return [single];

  // Roman range: "II-IV", "III-V"
  const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  const upper = str.toUpperCase();
  const romRange = upper.match(/^([IVX]+)\s*-\s*([IVX]+)$/);
  if (romRange) {
    const s = ROMAN[romRange[1]], e = ROMAN[romRange[2]];
    if (s && e) return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }
  const rom = ROMAN[upper];
  if (rom) return [rom];

  return [];
}

const NUM_TO_ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

function FitzBadge({ fitz }: { fitz: string | null | undefined }) {
  const nums = parseFitzpatrick(fitz);
  if (!nums.length) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const mid = Math.round((min + max) / 2);
  const bgColor = FITZ_TYPES[mid - 1]?.color ?? "#ddd";
  const label = min === max
    ? NUM_TO_ROMAN[min]
    : `${NUM_TO_ROMAN[min]}–${NUM_TO_ROMAN[max]}`;
  // Text color: white for dark tones (V-VI), black for light
  const textDark = mid <= 3;

  return (
    <span
      className={`inline-flex items-center shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${
        textDark ? "border-black/15 text-black/70" : "border-white/20 text-white"
      }`}
      style={{ backgroundColor: bgColor }}
      title={`Fitzpatrick ${label}`}
    >
      {label}
    </span>
  );
}

// ─── Pigments by region (infographic) ─────────────────────────────────────────

function PigmentsByRegion({ region }: { region: string }) {
  const [rankings, setRankings] = useState<RegionRankingOut[]>([]);
  const [pigments, setPigments] = useState<PigmentWithSettings[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!region) return;
    setLoading(true);
    Promise.all([
      api.catalog.regionRankings(region),
      api.catalog.pigments(region),
    ]).then(([r, p]) => {
      setRankings(r);
      setPigments(p);
    }).finally(() => setLoading(false));
  }, [region]);

  if (loading) return <div className="text-xs text-black/30 py-6 text-center">Загрузка...</div>;

  const getPigment = (id: number) => pigments.find((x) => x.id === id);

  const zones = rankings.filter((r) => r.rankings.length > 0);
  if (zones.length === 0) return (
    <div className="text-xs text-black/30 py-6 text-center">
      Рейтинг не настроен для этого региона
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-6">
      {zones.map((zone) => (
        <div key={zone.zone}>
          <div className="text-xs font-semibold tracking-widest uppercase text-black/40 mb-3">{zone.zone}</div>
          <div className="space-y-1.5">
            {zone.rankings.slice(0, 8).map((r, i) => {
              const pig = getPigment(r.pigment_id);
              if (!pig) return null;
              return (
                <div
                  key={r.pigment_id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-black/[0.025] hover:bg-black/5 transition-colors"
                >
                  <span className="text-xs font-black w-4 text-right shrink-0 text-black/25">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-black/90 leading-tight truncate">
                      {pig.name}
                    </div>
                    {pig.line && (
                      <div className="text-xs text-black/35 leading-tight truncate">{pig.line}</div>
                    )}
                  </div>
                  <FitzBadge fitz={pig.fitzpatrick} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReferencePage() {
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");

  useEffect(() => {
    api.catalog.regions().then((r) => {
      setRegions(r);
      if (r.length > 0) setSelectedRegion(r[0]);
    });
  }, []);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p className="text-xs tracking-widest uppercase text-luxe-grey-mid mb-1">Справочник</p>
        <h1 className="text-3xl font-black tracking-tight text-luxe-black uppercase">Памятка</h1>
      </div>

      {/* ── 1. Fitzpatrick scale ── */}
      <section>
        <h2 className="section-title mb-4">Шкала Фицпатрика</h2>
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium w-8">Тип</th>
                <th className="text-left px-5 py-3 font-medium w-24">Оттенок</th>
                <th className="text-left px-5 py-3 font-medium">Описание</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Типичные регионы</th>
              </tr>
            </thead>
            <tbody>
              {FITZ_TYPES.map((f) => (
                <tr key={f.type} className="border-b border-black/5">
                  <td className="px-5 py-3 font-black text-luxe-black">{f.type}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="text-xs text-black/50 font-medium">{f.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-black/60 font-light">{f.description}</td>
                  <td className="px-5 py-3 text-xs text-black/40 font-light hidden md:table-cell">{f.examples}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* ── 2. Region × Fitzpatrick ── */}
      <section>
        <h2 className="section-title mb-4">Типичные типы кожи по регионам</h2>
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Регион</th>
                <th className="text-left px-5 py-3 font-medium">Фицпатрик</th>
                <th className="px-5 py-3 font-medium w-48" />
              </tr>
            </thead>
            <tbody>
              {Object.entries(REGION_FITZ).map(([region, fitz]) => (
                <tr key={region} className="border-b border-black/5 hover:bg-black/5">
                  <td className="px-5 py-2.5 font-medium text-luxe-black">{region}</td>
                  <td className="px-5 py-2.5 font-black text-luxe-black">{fitz.label}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6].map((t) => (
                        <div
                          key={t}
                          className={`w-5 h-5 rounded-full border ${
                            t >= fitz.min && t <= fitz.max
                              ? "border-black/30"
                              : "border-black/10 opacity-20"
                          }`}
                          style={{ backgroundColor: FITZ_TYPES[t-1].color }}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* ── 3. Pigments by region (infographic) ── */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="section-title">Пигменты по регионам</h2>
          <select
            className="input text-sm py-1 px-3 w-auto"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {selectedRegion && (
          <div className="space-y-4">
            {/* Fitzpatrick range for this region */}
            {REGION_FITZ[selectedRegion] && (
              <div className="card flex flex-wrap items-center gap-3 py-3">
                <span className="text-xs tracking-widest uppercase text-black/40 w-full sm:w-auto">Типичный тип кожи</span>
                <div className="flex items-end gap-1.5 sm:gap-2.5">
                  {FITZ_TYPES.map((f, i) => {
                    const rf = REGION_FITZ[selectedRegion];
                    const inRange = (i + 1) >= rf.min && (i + 1) <= rf.max;
                    return (
                      <div
                        key={f.type}
                        className={`flex flex-col items-center gap-1 transition-opacity ${inRange ? "opacity-100" : "opacity-20"}`}
                      >
                        <div
                          className={`rounded-full border ${inRange ? "w-7 h-7 sm:w-9 sm:h-9 border-black/25" : "w-6 h-6 sm:w-7 sm:h-7 border-black/10"}`}
                          style={{ backgroundColor: f.color }}
                        />
                        <span className={`text-xs font-bold ${inRange ? "text-black" : "text-black/30"}`}>{f.type}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-base font-black text-luxe-black tracking-tight">
                  {REGION_FITZ[selectedRegion].label}
                </span>
              </div>
            )}

            {/* Pigment infographic */}
            <div className="card">
              <p className="text-xs text-black/30 mb-4 tracking-wide">
                Цвет метки справа — типичный тон кожи, для которого подходит пигмент.
                Рейтинг составлен для выбранного региона.
              </p>
              <PigmentsByRegion region={selectedRegion} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
