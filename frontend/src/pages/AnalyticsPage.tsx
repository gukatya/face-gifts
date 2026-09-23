import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Event, DashboardStats, DashboardMonthStat } from "../types";

const ALL_EVENT_TYPES = [
  "чемпионат",
  "мастер-класс",
  "блоггерская рассылка",
  "партнёрский ивент",
  "собственное мероприятие FACE",
  "другое",
];

const EVENT_TYPE_LABEL: Record<string, string> = {
  "чемпионат": "Чемпионат",
  "мастер-класс": "Обучение",
  "блоггерская рассылка": "Рассылка",
  "партнёрский ивент": "Партнёрский ивент",
  "собственное мероприятие FACE": "FACE",
  "другое": "Другое",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const SHIP_DAYS = 14;

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const months = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
  return `${months[+mo - 1]} ${y}`;
}

function todayYm(): string {
  return new Date().toISOString().slice(0, 7);
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function firstDayOfWeek(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  // 0=Sun…6=Sat → convert to Mon=0
  const d = new Date(y, m - 1, 1).getDay();
  return (d + 6) % 7;
}

function eventsForDay(events: Event[], ym: string, day: number): Event[] {
  const iso = `${ym}-${String(day).padStart(2, "0")}`;
  return events.filter((e) => e.date === iso);
}

function shipByDate(eventDate: string): string {
  const d = new Date(eventDate);
  d.setDate(d.getDate() - SHIP_DAYS);
  return d.toISOString().slice(0, 10);
}

function shipDeadlinesForDay(events: Event[], ym: string, day: number): Event[] {
  const iso = `${ym}-${String(day).padStart(2, "0")}`;
  return events.filter((e) => !e.gifts_sent && shipByDate(e.date) === iso);
}

// ─── SVG bar chart ─────────────────────────────────────────────────────────────

function BudgetChart({ stats }: { stats: DashboardMonthStat[] }) {
  const recent = stats.slice(-8);
  if (recent.length === 0) return null;

  const maxVal = Math.max(...recent.flatMap((s) => [s.planned, s.actual_cost]), 1);
  const H = 120;
  const barW = 18;
  const gap = 8;
  const groupW = barW * 2 + gap;
  const paddingX = 8;
  const totalW = recent.length * (groupW + 16) + paddingX * 2;

  return (
    <svg viewBox={`0 0 ${totalW} ${H + 40}`} className="w-full" style={{ maxHeight: 180 }}>
      {recent.map((s, i) => {
        const x = paddingX + i * (groupW + 16);
        const plannedH = s.planned > 0 ? (s.planned / maxVal) * H : 0;
        const actualH = s.actual_cost > 0 ? (s.actual_cost / maxVal) * H : 0;
        return (
          <g key={s.month}>
            {/* Planned bar */}
            <rect
              x={x}
              y={H - plannedH}
              width={barW}
              height={plannedH}
              fill="#DDDDDD"
              rx={3}
            />
            {/* Actual bar */}
            <rect
              x={x + barW + gap}
              y={H - actualH}
              width={barW}
              height={actualH}
              fill="#000000"
              rx={3}
            />
            {/* Month label */}
            <text
              x={x + groupW / 2}
              y={H + 16}
              textAnchor="middle"
              fontSize={9}
              fill="#999999"
            >
              {monthLabel(s.month).slice(0, 3)}
            </text>
            {/* Actual value */}
            {s.actual_cost > 0 && (
              <text
                x={x + barW + gap + barW / 2}
                y={H - actualH - 4}
                textAnchor="middle"
                fontSize={8}
                fill="#333"
              >
                {Math.round(s.actual_cost / 1000)}k
              </text>
            )}
          </g>
        );
      })}
      {/* Legend */}
      <rect x={paddingX} y={H + 28} width={10} height={8} fill="#DDDDDD" rx={2} />
      <text x={paddingX + 14} y={H + 36} fontSize={9} fill="#888">План</text>
      <rect x={paddingX + 50} y={H + 28} width={10} height={8} fill="#000" rx={2} />
      <text x={paddingX + 64} y={H + 36} fontSize={9} fill="#888">Факт</text>
    </svg>
  );
}

// ─── Calendar month ────────────────────────────────────────────────────────────

function CalendarMonth({
  ym,
  events,
}: {
  ym: string;
  events: Event[];
}) {
  const days = daysInMonth(ym);
  const startDay = firstDayOfWeek(ym);
  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  // pad to complete weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="text-xs font-medium tracking-widest uppercase text-black/50 mb-2">
        {monthLabel(ym)}
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d) => (
          <div key={d} className="text-center text-[10px] text-black/30 font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const iso = `${ym}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsForDay(events, ym, day);
          const deadlines = shipDeadlinesForDay(events, ym, day);
          const isToday = iso === today;
          return (
            <div
              key={idx}
              className={`rounded-md p-0.5 min-h-[38px] ${
                isToday ? "bg-luxe-black" : "bg-white/30 hover:bg-white/60 transition-colors"
              }`}
            >
              <div className={`text-[10px] font-medium text-right pr-1 ${isToday ? "text-white" : "text-black/40"}`}>
                {day}
              </div>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {dayEvents.map((ev) => (
                  <Link
                    key={ev.id}
                    to={`/events/${ev.id}/draft`}
                    className={`text-[9px] leading-tight truncate px-1 rounded ${
                      ev.gifts_sent
                        ? "bg-luxe-black/20 text-black/60"
                        : "bg-luxe-black text-white"
                    }`}
                    title={ev.name}
                  >
                    {ev.name}
                  </Link>
                ))}
                {deadlines.map((ev) => (
                  <Link
                    key={`ship-${ev.id}`}
                    to={`/events/${ev.id}/draft`}
                    className="text-[9px] leading-tight truncate px-1 rounded bg-amber-400/80 text-black"
                    title={`Отгрузить: ${ev.name}`}
                  >
                    ↑ {ev.name}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Budget edit state
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");

  // Items report filters
  const [itemsDateFrom, setItemsDateFrom] = useState<string>("");
  const [itemsDateTo, setItemsDateTo] = useState<string>("");
  const [itemsSkuType, setItemsSkuType] = useState<string>("all");
  const [itemsCategory, setItemsCategory] = useState<string>("");
  const [itemsWarehouse, setItemsWarehouse] = useState<string>("");
  const [itemsEventTypes, setItemsEventTypes] = useState<string[]>([]);
  const [itemsMasterGroup, setItemsMasterGroup] = useState<string>(""); // normalized master group key
  const [itemsSearch, setItemsSearch] = useState<string>("");
  const [itemsReport, setItemsReport] = useState<{
    items: { name: string; sku_type: string; category: string; volume_ml: string; qty: number; total_price: number }[];
    grand_total: number;
    consumable_categories: string[];
  } | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Geography filters
  const [geoDateFrom, setGeoDateFrom] = useState<string>("");
  const [geoDateTo, setGeoDateTo] = useState<string>("");
  const [geoEventTypes, setGeoEventTypes] = useState<string[]>([]);
  const [geography, setGeography] = useState<{ region: string; events_count: number; total_cost: number; countries: string[] }[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  // Calendar base month
  const [calBase, setCalBase] = useState<string>(addMonths(todayYm(), -1));

  // Ship from deadline card
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [shipDate, setShipDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    Promise.all([api.events.list(), api.dashboard.stats()])
      .then(([evs, st]) => { setEvents(evs); setStats(st); })
      .finally(() => setLoading(false));
  }, []);

  // Fuzzy name normalization: sort words alphabetically, lowercase → groups duplicates
  function normalizeName(name: string): string {
    return name.toLowerCase().trim().split(/\s+/).sort().join(" ");
  }

  // Build master groups from мастер-класс events
  const masterGroups: Map<string, { display: string; names: string[] }> = (() => {
    const map = new Map<string, { display: string; names: string[] }>();
    events
      .filter((e) => e.event_type === "мастер-класс" && e.created_by)
      .forEach((e) => {
        const raw = e.created_by!;
        const key = normalizeName(raw);
        if (!map.has(key)) {
          map.set(key, { display: raw, names: [raw] });
        } else {
          const g = map.get(key)!;
          if (!g.names.includes(raw)) g.names.push(raw);
        }
      });
    return map;
  })();

  const selectedMasterNames = itemsMasterGroup
    ? masterGroups.get(itemsMasterGroup)?.names ?? []
    : [];

  const exportItemsReport = () => {
    const searchLower = itemsSearch.toLowerCase();
    const filtered = (itemsReport?.items ?? []).filter((item) =>
      !itemsSearch || item.name.toLowerCase().includes(searchLower)
    );
    if (filtered.length === 0) return;

    const filterLines: string[] = [];
    if (itemsDateFrom || itemsDateTo) filterLines.push(`Дата отгрузки: ${itemsDateFrom || "—"} — ${itemsDateTo || "—"}`);
    if (itemsWarehouse) filterLines.push(`Склад: ${itemsWarehouse}`);
    if (itemsSkuType !== "all") filterLines.push(`Тип позиции: ${itemsSkuType}`);
    if (itemsCategory) filterLines.push(`Подкатегория: ${itemsCategory}`);
    if (itemsEventTypes.length > 0) filterLines.push(`Тип мероприятия: ${itemsEventTypes.map((t) => EVENT_TYPE_LABEL[t] ?? t).join(", ")}`);
    if (itemsMasterGroup) filterLines.push(`Мастер: ${masterGroups.get(itemsMasterGroup)?.display ?? itemsMasterGroup}`);
    if (itemsSearch) filterLines.push(`Поиск: ${itemsSearch}`);

    const rows: string[][] = [];
    rows.push(["Отчёт по позициям FACE Gifts"]);
    rows.push([`Выгружено: ${new Date().toLocaleDateString("ru-RU")}`]);
    if (filterLines.length > 0) {
      rows.push(["Фильтры:"]);
      filterLines.forEach((l) => rows.push([`  ${l}`]));
    }
    rows.push([]);
    rows.push(["#", "Позиция", "Тип", "Объём", "Категория", "Кол-во", "Сумма, ₽"]);
    filtered.forEach((item, i) => {
      rows.push([
        String(i + 1),
        item.name,
        item.sku_type === "pigment" ? "Пигмент" : item.sku_type === "sample" ? "Мини-сэт" : item.sku_type === "consumable" ? "Расходник" : "Сертификат",
        item.volume_ml || "",
        item.category || "",
        String(item.qty),
        item.total_price > 0 ? String(Math.round(item.total_price)) : "0",
      ]);
    });
    const totalQty = filtered.reduce((s, i) => s + i.qty, 0);
    const totalPrice = filtered.reduce((s, i) => s + i.total_price, 0);
    rows.push(["", "ИТОГО", "", "", "", String(totalQty), String(Math.round(totalPrice))]);

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const bom = "﻿";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FACE_items_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadItemsReport = useCallback(() => {
    setItemsLoading(true);
    api.dashboard.itemsReport({
      date_from: itemsDateFrom || undefined,
      date_to: itemsDateTo || undefined,
      sku_type: itemsSkuType === "all" ? undefined : itemsSkuType,
      category: itemsCategory || undefined,
      warehouse: itemsWarehouse || undefined,
      event_type: itemsEventTypes.length > 0 ? itemsEventTypes.join(",") : undefined,
      master_names: selectedMasterNames.length > 0 ? selectedMasterNames : undefined,
    }).then(setItemsReport).finally(() => setItemsLoading(false));
  }, [itemsDateFrom, itemsDateTo, itemsSkuType, itemsCategory, itemsWarehouse, itemsEventTypes, selectedMasterNames.join("|")]);

  useEffect(() => { loadItemsReport(); }, [loadItemsReport]);

  const loadGeography = useCallback(() => {
    setGeoLoading(true);
    api.dashboard.geography({
      date_from: geoDateFrom || undefined,
      date_to: geoDateTo || undefined,
      event_type: geoEventTypes.length > 0 ? geoEventTypes.join(",") : undefined,
    }).then(setGeography).finally(() => setGeoLoading(false));
  }, [geoDateFrom, geoDateTo, geoEventTypes]);

  useEffect(() => { loadGeography(); }, [loadGeography]);

  const handleShip = async (id: number) => {
    await api.events.ship(id, shipDate);
    const [evs, st] = await Promise.all([api.events.list(), api.dashboard.stats()]);
    setEvents(evs);
    setStats(st);
    setShippingId(null);
  };

  const saveBudget = async (month: string) => {
    const val = parseInt(budgetInput.replace(/\s/g, ""), 10);
    if (isNaN(val) || val < 0) return;
    await api.budgets.set(month, val);
    const updated = await api.dashboard.stats();
    setStats(updated);
    setEditingBudget(null);
  };

  if (loading) return (
    <div className="text-center py-16 text-luxe-grey-mid text-sm tracking-widest uppercase">Загрузка...</div>
  );

  const upcoming_deadlines = stats?.upcoming_deadlines ?? [];
  const monthly_stats = stats?.monthly_stats ?? [];

  const calMonths = [calBase, addMonths(calBase, 1), addMonths(calBase, 2)];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p className="text-xs tracking-widest uppercase text-luxe-grey-mid mb-1">Статистика</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-luxe-black uppercase">Аналитика</h1>
      </div>

      {/* ── 1. Shipping deadlines ── */}
      {upcoming_deadlines.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Срочно — подготовьте отгрузку</h2>
          <div className="space-y-2">
            {upcoming_deadlines.map((d) => {
              const overdue = d.days_until_ship < 0;
              const hot = !overdue && d.days_until_ship <= 7;
              const isShipping = shippingId === d.id;
              return (
                <div key={d.id} className={`card border-l-4 ${
                  overdue ? "border-red-500" : hot ? "border-amber-400" : "border-black/20"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: info — whole block is a link */}
                    <Link
                      to={`/events/${d.id}/draft`}
                      className="flex-1 min-w-0 group"
                    >
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className="font-semibold text-luxe-black group-hover:underline">{d.name}</span>
                        <span className="badge bg-black/10 text-black/50">{d.level}</span>
                      </div>
                      <div className="text-xs text-black/40 font-light flex flex-wrap gap-3">
                        <span>Ивент: {d.date}</span>
                        <span>До: {d.ship_by}</span>
                        <span>{d.region}</span>
                      </div>
                    </Link>

                    {/* Right: urgency + ship button */}
                    <div className="flex items-center gap-3 sm:shrink-0">
                      <div className={`text-sm font-black ${overdue ? "text-red-500" : hot ? "text-amber-600" : "text-black/50"}`}>
                        {overdue
                          ? `−${Math.abs(d.days_until_ship)} дн.`
                          : d.days_until_ship === 0
                          ? "Сегодня!"
                          : `${d.days_until_ship} дн.`}
                      </div>
                      <button
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0"
                        onClick={() => { setShippingId(d.id); setShipDate(new Date().toISOString().slice(0,10)); }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8 5-8-5m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8-5-8 5" />
                        </svg>
                        Отгрузить
                      </button>
                    </div>
                  </div>

                  {/* Inline ship date picker */}
                  {isShipping && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-black/5">
                      <span className="text-xs text-black/40">Дата отгрузки:</span>
                      <input
                        type="date"
                        value={shipDate}
                        onChange={(e) => setShipDate(e.target.value)}
                        className="input text-xs py-1 px-2 w-36"
                        autoFocus
                      />
                      <button className="btn-primary text-xs py-1 px-3" onClick={() => handleShip(d.id)}>
                        Сохранить
                      </button>
                      <button className="btn-secondary text-xs py-1 px-3" onClick={() => setShippingId(null)}>
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 2. Calendar ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Календарь</h2>
          <div className="flex gap-1">
            <button
              className="btn-secondary text-xs px-3 py-1"
              onClick={() => setCalBase((b) => addMonths(b, -1))}
            >←</button>
            <button
              className="btn-secondary text-xs px-3 py-1"
              onClick={() => setCalBase(addMonths(todayYm(), -1))}
            >Сегодня</button>
            <button
              className="btn-secondary text-xs px-3 py-1"
              onClick={() => setCalBase((b) => addMonths(b, 1))}
            >→</button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-4 text-[10px] text-black/50 font-light">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded bg-luxe-black inline-block" /> Мероприятие
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded bg-amber-400 inline-block" /> Дата отгрузки (↑ ивент)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded bg-black/20 inline-block" /> Уже отгружено
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {calMonths.map((ym) => (
            <div key={ym} className="card">
              <CalendarMonth ym={ym} events={events} />
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. Budget ── */}
      <section>
        <h2 className="section-title mb-4">Маркетинговый бюджет</h2>

        {/* Chart */}
        {monthly_stats.length > 0 && (
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs tracking-widest uppercase text-black/40">
                План vs Факт (по месяцу отгрузки, ₽)
              </span>
            </div>
            <BudgetChart stats={monthly_stats} />
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                <th className="text-left px-4 sm:px-5 py-3 font-medium">Месяц</th>
                <th className="text-right px-4 sm:px-5 py-3 font-medium">Ивентов</th>
                <th className="text-right px-4 sm:px-5 py-3 font-medium">Отгружено</th>
                <th className="text-right px-4 sm:px-5 py-3 font-medium">План, ₽</th>
                <th className="text-right px-4 sm:px-5 py-3 font-medium">Факт, ₽</th>
                <th className="text-right px-4 sm:px-5 py-3 font-medium">Δ</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {monthly_stats.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-black/30 text-xs">
                    Пока нет данных
                  </td>
                </tr>
              )}
              {monthly_stats.map((s) => {
                const isEditing = editingBudget === s.month;
                // delta: positive = under budget (green), negative = over budget (red)
                const hasBoth = s.planned > 0 && s.actual_cost > 0;
                const savings = s.planned - s.actual_cost; // positive = saved money
                return (
                  <tr key={s.month} className="border-b border-black/5 hover:bg-black/5">
                    <td className="px-4 sm:px-5 py-3 font-medium text-luxe-black">{monthLabel(s.month)}</td>
                    <td className="px-4 sm:px-5 py-3 text-right text-black/50">{s.events_count}</td>
                    <td className="px-4 sm:px-5 py-3 text-right text-black/50">{s.shipped_count}</td>
                    <td className="px-4 sm:px-5 py-3 text-right text-black/60">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            className="input text-xs py-0.5 px-2 w-28 text-right"
                            value={budgetInput}
                            autoFocus
                            onChange={(e) => setBudgetInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveBudget(s.month);
                              if (e.key === "Escape") setEditingBudget(null);
                            }}
                          />
                          <button className="btn-primary text-xs py-0.5 px-2" onClick={() => saveBudget(s.month)}>
                            OK
                          </button>
                        </div>
                      ) : (
                        <span>{s.planned > 0 ? s.planned.toLocaleString("ru-RU") : "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-luxe-black">
                      {s.actual_cost > 0 ? s.actual_cost.toLocaleString("ru-RU") : "—"}
                    </td>
                    <td className={`px-5 py-3 text-right text-xs font-medium ${
                      !hasBoth ? "text-black/20"
                        : savings >= 0 ? "text-green-600"
                        : "text-red-500"
                    }`}>
                      {hasBoth
                        ? (savings >= 0 ? "+" : "") + savings.toLocaleString("ru-RU")
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        className="text-black/20 hover:text-black/60 transition-colors"
                        title="Установить план"
                        onClick={() => {
                          setEditingBudget(s.month);
                          setBudgetInput(s.planned > 0 ? String(s.planned) : "");
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        <p className="text-xs text-black/30 mt-2 font-light">
          * Факт считается по месяцу отгрузки (дата ивента − {SHIP_DAYS} дней), сумма из поля «Бюджет» мероприятия.
        </p>
      </section>

      {/* ── 4. Items report ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Отчёт по позициям</h2>
          {(itemsReport?.items ?? []).length > 0 && (
            <button
              onClick={exportItemsReport}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
              title="Скачать CSV с текущими фильтрами"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Экспорт CSV
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card mb-4 space-y-4">
          {/* Date range */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">Дата отгрузки с</label>
              <input
                type="date"
                className="input text-sm py-1.5 px-3 w-40"
                value={itemsDateFrom}
                onChange={(e) => setItemsDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">по</label>
              <input
                type="date"
                className="input text-sm py-1.5 px-3 w-40"
                value={itemsDateTo}
                onChange={(e) => setItemsDateTo(e.target.value)}
              />
            </div>
            {(itemsDateFrom || itemsDateTo) && (
              <button
                className="text-xs text-black/30 hover:text-black/60 px-2 py-1.5"
                onClick={() => { setItemsDateFrom(""); setItemsDateTo(""); }}
              >
                Сбросить даты
              </button>
            )}
          </div>

          {/* Search by name */}
          <div>
            <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">Поиск по позиции</label>
            <input
              type="text"
              className="input text-sm py-1.5 px-3 w-full sm:w-72"
              placeholder="Например: Marshmallow, Анестезия..."
              value={itemsSearch}
              onChange={(e) => setItemsSearch(e.target.value)}
            />
          </div>

          {/* Category + sub-category + warehouse */}
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">Тип позиции</label>
              <select
                className="input text-sm py-1.5 px-3"
                value={itemsSkuType}
                onChange={(e) => { setItemsSkuType(e.target.value); setItemsCategory(""); }}
              >
                <option value="all">Все позиции</option>
                <option value="pigment">Только пигменты</option>
                <option value="consumable">Только расходники</option>
                <option value="sample">Мини-сэты</option>
                <option value="certificate">Сертификаты</option>
              </select>
            </div>
            {(itemsSkuType === "consumable" || itemsSkuType === "sample" || itemsSkuType === "all") &&
              (itemsReport?.consumable_categories ?? []).length > 0 && (
              <div>
                <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">Подкатегория расходников</label>
                <select
                  className="input text-sm py-1.5 px-3"
                  value={itemsCategory}
                  onChange={(e) => setItemsCategory(e.target.value)}
                >
                  <option value="">Все подкатегории</option>
                  {(itemsReport?.consumable_categories ?? []).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">Склад</label>
              <select
                className="input text-sm py-1.5 px-3"
                value={itemsWarehouse}
                onChange={(e) => setItemsWarehouse(e.target.value)}
              >
                <option value="">Все склады</option>
                <option value="Россия">Россия</option>
                <option value="Европа">Европа</option>
              </select>
            </div>
          </div>

          {/* Event types */}
          <div>
            <label className="block text-xs text-black/40 mb-2 uppercase tracking-wider">Тип мероприятия</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENT_TYPES.map((t) => {
                const active = itemsEventTypes.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setItemsEventTypes((prev) =>
                        active ? prev.filter((x) => x !== t) : [...prev, t]
                      );
                      // Clear master filter if мастер-класс deselected
                      if (t === "мастер-класс" && active) setItemsMasterGroup("");
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      active
                        ? "bg-luxe-black text-white border-luxe-black"
                        : "bg-white/60 border-black/10 text-black/50 hover:border-black/30"
                    }`}
                  >
                    {EVENT_TYPE_LABEL[t] ?? t}
                  </button>
                );
              })}
              {itemsEventTypes.length > 0 && (
                <button
                  className="text-xs px-2 py-1 text-black/30 hover:text-black/60"
                  onClick={() => { setItemsEventTypes([]); setItemsMasterGroup(""); }}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Master sub-filter — shown when мастер-класс is selected */}
          {(itemsEventTypes.includes("мастер-класс") || itemsEventTypes.length === 0) && masterGroups.size > 0 && (
            <div>
              <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">Мастер (обучение)</label>
              <select
                className="input text-sm py-1.5 px-3 w-full sm:w-72"
                value={itemsMasterGroup}
                onChange={(e) => setItemsMasterGroup(e.target.value)}
              >
                <option value="">Все мастера</option>
                {Array.from(masterGroups.entries()).sort((a, b) => a[1].display.localeCompare(b[1].display, "ru")).map(([key, g]) => (
                  <option key={key} value={key}>
                    {g.display}{g.names.length > 1 ? ` (+${g.names.length - 1} вар.)` : ""}
                  </option>
                ))}
              </select>
              {itemsMasterGroup && masterGroups.get(itemsMasterGroup)!.names.length > 1 && (
                <p className="text-xs text-black/30 mt-1">
                  Варианты написания: {masterGroups.get(itemsMasterGroup)!.names.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Results table */}
        {(() => {
          const searchLower = itemsSearch.toLowerCase();
          const filtered = (itemsReport?.items ?? []).filter((item) =>
            !itemsSearch || item.name.toLowerCase().includes(searchLower)
          );
          const filteredTotal = filtered.reduce((s, i) => s + i.total_price, 0);
          const filteredQty = filtered.reduce((s, i) => s + i.qty, 0);
          return (
            <div className="card overflow-hidden p-0">
              {itemsLoading ? (
                <div className="text-center py-10 text-black/30 text-xs tracking-widest uppercase">Загрузка...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-black/30 text-xs tracking-widest uppercase">
                  Нет позиций по выбранным фильтрам
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                        <th className="text-left px-5 py-3 font-medium">#</th>
                        <th className="text-left px-5 py-3 font-medium">Позиция</th>
                        <th className="text-left px-4 py-3 font-medium">Детали</th>
                        <th className="text-right px-5 py-3 font-medium">Кол-во</th>
                        <th className="text-right px-5 py-3 font-medium">Сумма, ₽</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item, i) => (
                        <tr key={i} className="border-b border-black/5 hover:bg-black/5">
                          <td className="px-5 py-2.5 text-black/30 text-xs">{i + 1}</td>
                          <td className="px-5 py-2.5 font-medium text-luxe-black">{item.name}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              <span className="badge bg-black/10 text-black/50 text-xs">
                                {item.sku_type === "pigment" ? "Пигмент"
                                  : item.sku_type === "sample" ? "Мини-сэт"
                                  : item.sku_type === "consumable" ? "Расходник"
                                  : "Сертификат"}
                              </span>
                              {item.volume_ml && (
                                <span className="badge bg-blue-50 text-blue-600 text-xs">{item.volume_ml}</span>
                              )}
                              {item.category && item.sku_type !== "pigment" && (
                                <span className="badge bg-black/5 text-black/40 text-xs">{item.category}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right font-black text-luxe-black">{item.qty}</td>
                          <td className="px-5 py-2.5 text-right text-black/60">
                            {item.total_price > 0 ? item.total_price.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-black/10 bg-black/5">
                        <td colSpan={3} className="px-5 py-3 text-xs uppercase tracking-wider text-black/40 font-medium">
                          Итого{itemsSearch ? ` (фильтр: «${itemsSearch}»)` : ""}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-luxe-black">{filteredQty}</td>
                        <td className="px-5 py-3 text-right font-black text-luxe-black">
                          {filteredTotal > 0 ? filteredTotal.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽" : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
        <p className="text-xs text-black/30 mt-2 font-light">
          * Считаются позиции из отгруженных мероприятий за выбранный период. Сумма — цена позиции × количество.
        </p>
      </section>

      {/* ── 5. Geography ── */}
      <section>
        <h2 className="section-title mb-4">По регионам</h2>

        {/* Geo filters */}
        <div className="card mb-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">Дата с</label>
              <input
                type="date"
                className="input text-sm py-1.5 px-3 w-40"
                value={geoDateFrom}
                onChange={(e) => setGeoDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">по</label>
              <input
                type="date"
                className="input text-sm py-1.5 px-3 w-40"
                value={geoDateTo}
                onChange={(e) => setGeoDateTo(e.target.value)}
              />
            </div>
            {(geoDateFrom || geoDateTo) && (
              <button
                className="text-xs text-black/30 hover:text-black/60 px-2 py-1.5"
                onClick={() => { setGeoDateFrom(""); setGeoDateTo(""); }}
              >
                Сбросить
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs text-black/40 mb-2 uppercase tracking-wider">Тип мероприятия</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENT_TYPES.map((t) => {
                const active = geoEventTypes.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => setGeoEventTypes((prev) =>
                      active ? prev.filter((x) => x !== t) : [...prev, t]
                    )}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      active
                        ? "bg-luxe-black text-white border-luxe-black"
                        : "bg-white/60 border-black/10 text-black/50 hover:border-black/30"
                    }`}
                  >
                    {EVENT_TYPE_LABEL[t] ?? t}
                  </button>
                );
              })}
              {geoEventTypes.length > 0 && (
                <button className="text-xs px-2 py-1 text-black/30 hover:text-black/60" onClick={() => setGeoEventTypes([])}>
                  Сбросить
                </button>
              )}
            </div>
          </div>
        </div>

        {geoLoading ? (
          <div className="card text-center py-8 text-black/30 text-xs tracking-widest uppercase">Загрузка...</div>
        ) : geography.length === 0 ? (
          <div className="card text-center py-8 text-black/30 text-xs tracking-widest uppercase">Нет данных</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[460px]">
              <thead>
                <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                  <th className="text-left px-4 sm:px-5 py-3 font-medium">Регион</th>
                  <th className="text-left px-4 sm:px-5 py-3 font-medium hidden sm:table-cell">Страны</th>
                  <th className="text-right px-4 sm:px-5 py-3 font-medium">Ивентов</th>
                  <th className="text-right px-4 sm:px-5 py-3 font-medium">Объём, ₽</th>
                  <th className="px-4 sm:px-5 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {geography.map((g) => {
                  const maxCost = Math.max(...geography.map((x) => x.total_cost), 1);
                  const pct = (g.total_cost / maxCost) * 100;
                  return (
                    <tr key={g.region} className="border-b border-black/5 hover:bg-black/5">
                      <td className="px-4 sm:px-5 py-3 font-semibold text-luxe-black">{g.region}</td>
                      <td className="px-4 sm:px-5 py-3 text-xs text-black/40 font-light hidden sm:table-cell">{g.countries.join(", ")}</td>
                      <td className="px-4 sm:px-5 py-3 text-right text-black/60">{g.events_count}</td>
                      <td className="px-4 sm:px-5 py-3 text-right font-black text-luxe-black">
                        {g.total_cost > 0 ? g.total_cost.toLocaleString("ru-RU") : "—"}
                      </td>
                      <td className="px-4 sm:px-5 py-3 w-20 sm:w-32">
                        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                          <div className="h-full bg-luxe-black rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
        <p className="text-xs text-black/30 mt-2 font-light">
          * Фильтрация по дате — по дате отгрузки (если указана) или дате мероприятия.
        </p>
      </section>
    </div>
  );
}
