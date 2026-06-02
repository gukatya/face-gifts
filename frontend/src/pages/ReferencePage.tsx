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
  "Ближний Восток":    { min: 3, max: 5, label: "III–V" },
  "Европа":            { min: 1, max: 3, label: "I–III" },
  "ЮВА":               { min: 3, max: 5, label: "III–V" },
  "Китай":             { min: 2, max: 4, label: "II–IV" },
  "Латинская Америка": { min: 3, max: 5, label: "III–V" },
  "Африка":            { min: 5, max: 6, label: "V–VI" },
  "США/Канада":        { min: 1, max: 4, label: "I–IV" },
  "Австралия":         { min: 1, max: 3, label: "I–III" },
  "Южная Азия":        { min: 4, max: 6, label: "IV–VI" },
  "Япония/Корея":      { min: 2, max: 4, label: "II–IV" },
};

// ─── Top sellers component ─────────────────────────────────────────────────────

function TopSellers({ region }: { region: string }) {
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

  if (loading) return <div className="text-xs text-black/30 py-4">Загрузка...</div>;

  const getPigmentName = (id: number) => {
    const p = pigments.find((x) => x.id === id);
    return p ? `${p.name}${p.line ? ` (${p.line})` : ""}` : `#${id}`;
  };

  const zones = rankings.filter((r) => r.rankings.length > 0);
  if (zones.length === 0) return (
    <div className="text-xs text-black/30 py-4 text-center">Рейтинг не настроен для этого региона</div>
  );

  return (
    <div className="grid grid-cols-2 gap-4 mt-3">
      {zones.map((zone) => (
        <div key={zone.zone}>
          <div className="text-xs font-medium tracking-wider uppercase text-black/40 mb-2">{zone.zone}</div>
          <ol className="space-y-1">
            {zone.rankings.slice(0, 8).map((r, i) => (
              <li key={r.pigment_id} className="flex items-center gap-2 text-sm">
                <span className={`text-xs font-black w-5 text-right ${i === 0 ? "text-luxe-black" : "text-black/30"}`}>
                  {i + 1}
                </span>
                <span className="text-black/70">{getPigmentName(r.pigment_id)}</span>
              </li>
            ))}
          </ol>
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
          <table className="w-full text-sm">
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
      </section>

      {/* ── 2. Region × Fitzpatrick ── */}
      <section>
        <h2 className="section-title mb-4">Типичные типы кожи по регионам</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
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
      </section>

      {/* ── 3. Top sellers by region ── */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="section-title">Топ продаж по регионам</h2>
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
          <div className="card">
            <TopSellers region={selectedRegion} />
          </div>
        )}
      </section>
    </div>
  );
}
