import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Event, DashboardStats, DashboardMonthStat } from "../types";

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
  const [editingBudget, setEditingBudget] = useState<string | null>(null); // month
  const [budgetInput, setBudgetInput] = useState("");

  // Items month selector
  const [itemsMonth, setItemsMonth] = useState<string>(todayYm());

  // Calendar base month
  const [calBase, setCalBase] = useState<string>(addMonths(todayYm(), -1));

  useEffect(() => {
    Promise.all([api.events.list(), api.dashboard.stats()])
      .then(([evs, st]) => { setEvents(evs); setStats(st); })
      .finally(() => setLoading(false));
  }, []);

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
  const geography = stats?.geography ?? [];

  const calMonths = [calBase, addMonths(calBase, 1), addMonths(calBase, 2)];

  // Items for selected month
  const itemsStat = monthly_stats.find((s) => s.month === itemsMonth);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p className="text-xs tracking-widest uppercase text-luxe-grey-mid mb-1">Статистика</p>
        <h1 className="text-3xl font-black tracking-tight text-luxe-black uppercase">Аналитика</h1>
      </div>

      {/* ── 1. Shipping deadlines ── */}
      {upcoming_deadlines.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Срочно — подготовьте отгрузку</h2>
          <div className="space-y-2">
            {upcoming_deadlines.map((d) => {
              const overdue = d.days_until_ship < 0;
              const hot = !overdue && d.days_until_ship <= 7;
              return (
                <div key={d.id} className={`card flex items-center justify-between gap-4 border-l-4 ${
                  overdue ? "border-red-500" : hot ? "border-amber-400" : "border-black/20"
                }`}>
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <Link to={`/events/${d.id}/draft`} className="font-semibold text-luxe-black hover:underline">
                        {d.name}
                      </Link>
                      <span className="badge bg-black/10 text-black/50">{d.level}</span>
                    </div>
                    <div className="text-xs text-black/40 font-light flex gap-4">
                      <span>Ивент: {d.date}</span>
                      <span>Отгрузить до: {d.ship_by}</span>
                      <span>{d.region} · {d.country}</span>
                    </div>
                  </div>
                  <div className={`text-sm font-black shrink-0 ${overdue ? "text-red-500" : hot ? "text-amber-600" : "text-black/50"}`}>
                    {overdue
                      ? `Просрочено на ${Math.abs(d.days_until_ship)} дн.`
                      : d.days_until_ship === 0
                      ? "Сегодня!"
                      : `${d.days_until_ship} дн.`}
                  </div>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Месяц отгрузки</th>
                <th className="text-right px-5 py-3 font-medium">Мероприятий</th>
                <th className="text-right px-5 py-3 font-medium">Отгружено</th>
                <th className="text-right px-5 py-3 font-medium">План, ₽</th>
                <th className="text-right px-5 py-3 font-medium">Факт, ₽</th>
                <th className="text-right px-5 py-3 font-medium">Δ</th>
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
                const delta = s.actual_cost - s.planned;
                return (
                  <tr key={s.month} className="border-b border-black/5 hover:bg-black/5">
                    <td className="px-5 py-3 font-medium text-luxe-black">{monthLabel(s.month)}</td>
                    <td className="px-5 py-3 text-right text-black/50">{s.events_count}</td>
                    <td className="px-5 py-3 text-right text-black/50">{s.shipped_count}</td>
                    <td className="px-5 py-3 text-right text-black/60">
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
                      s.planned === 0 ? "text-black/20"
                        : delta > 0 ? "text-red-500"
                        : delta < 0 ? "text-black/40"
                        : "text-black/30"
                    }`}>
                      {s.planned > 0 && s.actual_cost > 0
                        ? (delta > 0 ? "+" : "") + delta.toLocaleString("ru-RU")
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
        <p className="text-xs text-black/30 mt-2 font-light">
          * Факт считается по месяцу отгрузки (дата ивента − {SHIP_DAYS} дней), сумма из поля «Бюджет» мероприятия.
        </p>
      </section>

      {/* ── 4. Items report ── */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="section-title">Отчёт по позициям</h2>
          <select
            className="input text-sm py-1 px-3 w-auto"
            value={itemsMonth}
            onChange={(e) => setItemsMonth(e.target.value)}
          >
            {monthly_stats.filter((s) => s.shipped_count > 0).map((s) => (
              <option key={s.month} value={s.month}>{monthLabel(s.month)}</option>
            ))}
            {monthly_stats.filter((s) => s.shipped_count > 0).length === 0 && (
              <option value={todayYm()}>Нет отгрузок</option>
            )}
          </select>
        </div>

        <div className="card overflow-hidden p-0">
          {!itemsStat || itemsStat.top_items.length === 0 ? (
            <div className="text-center py-10 text-black/30 text-xs tracking-widest uppercase">
              Нет отгруженных позиций за этот месяц
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">#</th>
                  <th className="text-left px-5 py-3 font-medium">Позиция</th>
                  <th className="text-left px-5 py-3 font-medium">Тип</th>
                  <th className="text-right px-5 py-3 font-medium">Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {itemsStat.top_items.map((item, i) => (
                  <tr key={i} className="border-b border-black/5 hover:bg-black/5">
                    <td className="px-5 py-2.5 text-black/30 text-xs">{i + 1}</td>
                    <td className="px-5 py-2.5 font-medium text-luxe-black">{item.name}</td>
                    <td className="px-5 py-2.5">
                      <span className="badge bg-black/10 text-black/50 text-xs">
                        {item.sku_type === "pigment" ? "Пигмент"
                          : item.sku_type === "sample" ? "Мини-сэт"
                          : item.sku_type === "consumable" ? "Расходник"
                          : "Сертификат"}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-black text-luxe-black">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-black/30 mt-2 font-light">
          * Считаются позиции из всех отгруженных мероприятий в выбранном месяце отгрузки.
        </p>
      </section>

      {/* ── 5. Geography ── */}
      <section>
        <h2 className="section-title mb-4">По регионам</h2>
        {geography.length === 0 ? (
          <div className="card text-center py-8 text-black/30 text-xs tracking-widest uppercase">
            Нет данных
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs text-black/30 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Регион</th>
                  <th className="text-left px-5 py-3 font-medium">Страны</th>
                  <th className="text-right px-5 py-3 font-medium">Мероприятий</th>
                  <th className="text-right px-5 py-3 font-medium">Объём, ₽</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {geography.map((g) => {
                  const maxCost = Math.max(...geography.map((x) => x.total_cost), 1);
                  const pct = (g.total_cost / maxCost) * 100;
                  return (
                    <tr key={g.region} className="border-b border-black/5 hover:bg-black/5">
                      <td className="px-5 py-3 font-semibold text-luxe-black">{g.region}</td>
                      <td className="px-5 py-3 text-xs text-black/40 font-light">{g.countries.join(", ")}</td>
                      <td className="px-5 py-3 text-right text-black/60">{g.events_count}</td>
                      <td className="px-5 py-3 text-right font-black text-luxe-black">
                        {g.total_cost > 0 ? g.total_cost.toLocaleString("ru-RU") : "—"}
                      </td>
                      <td className="px-5 py-3 w-32">
                        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-luxe-black rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
