import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Event } from "../types";

const SHIP_DAYS = 14; // ship gifts this many days before the event

type SortMode = "created_asc" | "created_desc" | "date_asc" | "date_desc";

type Zone = "overdue" | "urgent" | "upcoming" | "past";

function getZone(ev: Event): Zone {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(ev.date);
  eventDate.setHours(0, 0, 0, 0);
  const shipBy = new Date(eventDate.getTime() - SHIP_DAYS * 86400_000);
  const daysToShip = Math.round((shipBy.getTime() - today.getTime()) / 86400_000);

  if (eventDate < today) return "past";
  if (!ev.gifts_sent && daysToShip <= 0) return "overdue";
  if (!ev.gifts_sent && daysToShip <= SHIP_DAYS) return "urgent";
  return "upcoming";
}

const ZONE_META: Record<Zone, { label: string; dot: string }> = {
  overdue:  { label: "Просрочена отгрузка", dot: "bg-red-500" },
  urgent:   { label: "Пора отгружать",      dot: "bg-amber-400" },
  upcoming: { label: "Предстоящие",          dot: "bg-luxe-black" },
  past:     { label: "Прошедшие",            dot: "bg-luxe-grey-mid" },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Черновик",          cls: "bg-black/10 text-black/50" },
  pending:  { label: "Наборы подобраны",  cls: "bg-luxe-silver text-black/70" },
  approved: { label: "Утверждён",         cls: "bg-luxe-black text-white" },
};

function sortEvents(events: Event[], mode: SortMode): Event[] {
  return [...events].sort((a, b) => {
    if (mode === "created_asc")  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (mode === "created_desc") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (mode === "date_asc")     return a.date.localeCompare(b.date);
    if (mode === "date_desc")    return b.date.localeCompare(a.date);
    return 0;
  });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("date_asc");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [shipDate, setShipDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    api.events.list().then(setEvents).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    await api.events.delete(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
  };

  const handleShip = async (id: number) => {
    const updated = await api.events.ship(id, shipDate);
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    setShippingId(null);
  };

  const handleUnship = async (id: number) => {
    const updated = await api.events.unship(id);
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
  };

  const filtered = sortEvents(
    events.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())),
    sort,
  );

  // Group by zone (preserve zone order)
  const ZONE_ORDER: Zone[] = ["overdue", "urgent", "upcoming", "past"];
  const grouped: Record<Zone, Event[]> = { overdue: [], urgent: [], upcoming: [], past: [] };
  for (const ev of filtered) grouped[getZone(ev)].push(ev);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs tracking-widest uppercase text-luxe-grey-mid mb-1">
            Конструктор наборов
          </p>
          <h1 className="text-3xl font-black tracking-tight text-luxe-black uppercase">
            Мероприятия
          </h1>
        </div>
        <Link to="/events/new" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Новое мероприятие
        </Link>
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-center mb-6 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1 ml-auto flex-wrap">
          {([
            ["date_asc",     "По мероприятию ↑"],
            ["date_desc",    "По мероприятию ↓"],
            ["created_asc",  "По добавлению ↑"],
            ["created_desc", "По добавлению ↓"],
          ] as [SortMode, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                sort === key
                  ? "bg-luxe-black text-white border-luxe-black"
                  : "bg-white/60 border-black/10 text-black/50 hover:text-black/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-luxe-grey-mid text-sm tracking-widest uppercase">
          Загрузка...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-20">
          <p className="text-2xl font-black uppercase tracking-tight text-luxe-black mb-2">Нет мероприятий</p>
          <p className="text-luxe-grey-mid text-sm font-light mb-8">Создайте первое мероприятие, чтобы начать</p>
          <Link to="/events/new" className="btn-primary">Создать мероприятие</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {ZONE_ORDER.map((zone) => {
            const evs = grouped[zone];
            if (evs.length === 0) return null;
            const meta = ZONE_META[zone];
            const isPast = zone === "past";
            return (
              <section key={zone} className={isPast ? "opacity-50" : undefined}>
                {/* Zone header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="text-xs tracking-widest uppercase font-medium text-black/50">
                    {meta.label} — {evs.length}
                  </span>
                  <div className="flex-1 h-px bg-black/8 ml-2" />
                </div>

                <div className="space-y-2">
                  {evs.map((event) => {
                    const st = STATUS_LABELS[event.status] ?? STATUS_LABELS.draft;
                    const isConfirmingDelete = confirmDeleteId === event.id;
                    const isSettingShip = shippingId === event.id;

                    // Days until event
                    const today = new Date(); today.setHours(0,0,0,0);
                    const evDate = new Date(event.date); evDate.setHours(0,0,0,0);
                    const shipBy = new Date(evDate.getTime() - SHIP_DAYS * 86400_000);
                    const daysToEvent = Math.round((evDate.getTime() - today.getTime()) / 86400_000);
                    const daysToShip = Math.round((shipBy.getTime() - today.getTime()) / 86400_000);

                    return (
                      <div
                        key={event.id}
                        className="card flex items-start justify-between gap-4 hover:shadow-lg transition-shadow"
                      >
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                            <span className="font-semibold text-luxe-black truncate">{event.name}</span>
                            <span className={`badge ${st.cls}`}>{st.label}</span>
                            {event.level && (
                              <span className="badge bg-luxe-silver/60 text-black/60">{event.level}</span>
                            )}
                            {event.gifts_sent && (
                              <span className="badge bg-luxe-black text-white flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Отгружено
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs font-light text-black/50">
                            <span>{event.date}</span>
                            <span>{event.country} / {event.region}</span>
                            <span>{event.warehouse}</span>
                            {!isPast && !event.gifts_sent && (
                              <span className={daysToShip <= 0 ? "text-red-500 font-medium" : daysToShip <= 7 ? "text-amber-600 font-medium" : ""}>
                                {daysToShip <= 0
                                  ? `Отгрузка просрочена на ${Math.abs(daysToShip)} дн.`
                                  : `Отгрузить через ${daysToShip} дн. · ивент через ${daysToEvent} дн.`}
                              </span>
                            )}
                            {event.gifts_sent && event.shipped_date && (
                              <span className="text-black/40">Отгружено {event.shipped_date}</span>
                            )}
                          </div>

                          {/* Ship date picker */}
                          {isSettingShip && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-black/40">Дата отгрузки:</span>
                              <input
                                type="date"
                                value={shipDate}
                                onChange={(e) => setShipDate(e.target.value)}
                                className="input text-xs py-1 px-2 w-36"
                              />
                              <button
                                className="btn-primary text-xs py-1 px-3"
                                onClick={() => handleShip(event.id)}
                              >
                                Сохранить
                              </button>
                              <button
                                className="btn-secondary text-xs py-1 px-3"
                                onClick={() => setShippingId(null)}
                              >
                                Отмена
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {/* Mark shipped / unship */}
                          {!event.gifts_sent ? (
                            <button
                              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                              onClick={() => { setShippingId(event.id); setShipDate(new Date().toISOString().slice(0,10)); }}
                              title="Отметить как отгружено"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8 5-8-5m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8-5-8 5" />
                              </svg>
                              Отгружено
                            </button>
                          ) : (
                            <button
                              className="text-xs text-black/30 hover:text-black/60 px-2 py-1.5 transition-colors"
                              onClick={() => handleUnship(event.id)}
                              title="Снять отметку"
                            >
                              Отменить
                            </button>
                          )}

                          <Link
                            to={`/events/${event.id}/draft`}
                            className="btn-primary text-xs py-1.5 px-3"
                          >
                            Открыть
                          </Link>
                          <button
                            className="btn-secondary text-xs py-1.5 px-3"
                            onClick={() => navigate(`/events/${event.id}/edit`)}
                          >
                            Изменить
                          </button>

                          {isConfirmingDelete ? (
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs text-black/50">Удалить?</span>
                              <button
                                className="text-xs px-2.5 py-1 bg-luxe-black text-white rounded-lg hover:bg-black/80 transition-colors"
                                onClick={() => handleDelete(event.id)}
                              >
                                Да
                              </button>
                              <button
                                className="text-xs px-2.5 py-1 bg-luxe-silver text-black rounded-lg hover:bg-luxe-grey-mid transition-colors"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Нет
                              </button>
                            </span>
                          ) : (
                            <button
                              className="text-xs px-2 py-1 text-black/25 hover:text-black/60 transition-colors"
                              title="Удалить"
                              onClick={() => setConfirmDeleteId(event.id)}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
