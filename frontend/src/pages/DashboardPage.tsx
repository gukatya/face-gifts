import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { Event, DeleteReason } from "../types";

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
  draft:    { label: "Черновик",           cls: "bg-black/10 text-black/50" },
  pending:  { label: "На согласовании",    cls: "bg-amber-100 border border-amber-300/70 text-amber-800" },
  approved: { label: "Утверждён",          cls: "bg-luxe-black text-white" },
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

const EVENT_TYPE_LABELS: Record<string, string> = {
  "чемпионат": "Чемпионат",
  "мастер-класс": "Обучение",
  "блоггерская рассылка": "Рассылка",
  "партнёрский ивент": "Партнёрский",
  "собственное мероприятие FACE": "FACE",
  "другое": "Другое",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { role, name: userName } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("date_asc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState<DeleteReason>("ошибка");
  const [deleteWarning, setDeleteWarning] = useState(false);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [shipDate, setShipDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newProposalsCount, setNewProposalsCount] = useState(0);
  const [trash, setTrash] = useState<Event[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [tgSending, setTgSending] = useState(false);

  useEffect(() => {
    api.events.list().then(setEvents).finally(() => setLoading(false));
    api.proposals.stats().then((s) => setNewProposalsCount(s.new_count)).catch(() => {});
    api.events.trash().then(setTrash).catch(() => {});
  }, []);

  const handleRestore = async (id: number) => {
    const restored = await api.events.restore(id);
    setTrash((prev) => prev.filter((e) => e.id !== id));
    setEvents((prev) => [restored, ...prev]);
  };

  const openDeleteModal = (ev: Event) => {
    setDeleteModal({ id: ev.id, name: ev.name });
    setDeleteReason("ошибка");
    setDeleteWarning(false);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    if (deleteReason === "напрямую" && !deleteWarning) {
      setDeleteWarning(true);
      return;
    }
    await api.events.delete(deleteModal.id, deleteReason);
    setEvents((prev) => prev.filter((e) => e.id !== deleteModal.id));
    setDeleteModal(null);
    setDeleteWarning(false);
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

  const handleQuickApprove = async (id: number) => {
    const updated = await api.events.approve(id);
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
  };

  const visibleEvents = role === "employee"
    ? events.filter((e) => !e.created_by || e.created_by === userName)
    : events;

  const filtered = sortEvents(
    visibleEvents.filter((e) => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || e.event_type === typeFilter;
      return matchSearch && matchType;
    }),
    sort,
  );

  const presentTypes = [...new Set(visibleEvents.map((e) => e.event_type))].filter(Boolean);

  // Group by zone (preserve zone order)
  const ZONE_ORDER: Zone[] = ["overdue", "urgent", "upcoming", "past"];
  const grouped: Record<Zone, Event[]> = { overdue: [], urgent: [], upcoming: [], past: [] };
  for (const ev of filtered) grouped[getZone(ev)].push(ev);

  return (
    <div>
      {/* Proposals notification */}
      {newProposalsCount > 0 && (
        <Link
          to="/proposals"
          className="flex items-center justify-between gap-3 mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
            <span className="text-sm text-amber-800 font-medium">
              {newProposalsCount} {newProposalsCount === 1 ? "предложение ожидает решения" : newProposalsCount < 5 ? "предложения ожидают решения" : "предложений ожидают решения"}
            </span>
          </div>
          <span className="text-xs text-amber-600 font-medium shrink-0">Посмотреть →</span>
        </Link>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between mb-6 sm:mb-8">
        <div>
          <p className="text-xs tracking-widest uppercase text-luxe-grey-mid mb-1">
            Конструктор наборов
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-luxe-black uppercase">
            Мероприятия
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {role === "admin" && (
            <>
              <a
                href={api.admin.backupDownloadUrl()}
                download
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-luxe-grey-mid/40 text-luxe-grey-mid hover:bg-luxe-grey-mid/10 transition-colors"
                title="Скачать базу данных"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Бэкап
              </a>
              <button
                onClick={async () => {
                  setTgSending(true);
                  try { await api.admin.sendBackupToTelegram(); alert("Бэкап отправлен в Telegram ✓"); }
                  catch { alert("Не удалось отправить. Настроены ли переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID?"); }
                  finally { setTgSending(false); }
                }}
                disabled={tgSending}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-luxe-grey-mid/40 text-luxe-grey-mid hover:bg-luxe-grey-mid/10 transition-colors disabled:opacity-50"
                title="Отправить бэкап в Telegram"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {tgSending ? "Отправка..." : "→ TG"}
              </button>
            </>
          )}
          <Link to="/events/new" className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Новое мероприятие
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-3 flex-col sm:flex-row">
          <input
            className="input w-full sm:max-w-xs"
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs text-black/40 whitespace-nowrap">Сортировка:</span>
            <select
              className="input py-1.5 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="date_asc">По дате (ближайшие)</option>
              <option value="date_desc">По дате (поздние)</option>
              <option value="created_desc">Сначала новые</option>
              <option value="created_asc">Сначала старые</option>
            </select>
          </div>
        </div>

        {/* Фильтр по типу ивента */}
        {presentTypes.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTypeFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === "all"
                  ? "bg-luxe-black text-white border-luxe-black"
                  : "border-black/15 text-black/50 hover:border-black/30"
              }`}
            >
              Все
            </button>
            {presentTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  typeFilter === t
                    ? "bg-luxe-black text-white border-luxe-black"
                    : "border-black/15 text-black/50 hover:border-black/30"
                }`}
              >
                {EVENT_TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-black text-luxe-black text-lg uppercase tracking-tight mb-1">
              Удалить мероприятие?
            </h3>
            <p className="text-sm text-black/50 mb-5 font-light">«{deleteModal.name}»</p>

            <p className="text-xs uppercase tracking-widest text-black/40 mb-2 font-medium">Причина</p>
            <div className="flex flex-col gap-2 mb-5">
              {(["ошибка", "отказ", "напрямую"] as DeleteReason[]).map((r) => (
                <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  deleteReason === r ? "border-luxe-black bg-luxe-silver/40" : "border-black/10 hover:border-black/20"
                }`}>
                  <input
                    type="radio"
                    name="delete_reason"
                    value={r}
                    checked={deleteReason === r}
                    onChange={() => { setDeleteReason(r); setDeleteWarning(false); }}
                    className="accent-luxe-black"
                  />
                  <span className="text-sm text-luxe-black">
                    {r === "ошибка" && "Создали по ошибке"}
                    {r === "отказ" && "Отказались от сотрудничества"}
                    {r === "напрямую" && "Отгрузили напрямую"}
                  </span>
                </label>
              ))}
            </div>

            {deleteWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">⚠️ Подожди!</p>
                <p className="font-light">Если подарки уже отправлены — нам всё равно лучше об этом знать. Мы собираем статистику. Не совершай ошибок! Точно удалить?</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => { setDeleteModal(null); setDeleteWarning(false); }}
              >
                Отмена
              </button>
              <button
                className="flex-1 px-4 py-2 bg-luxe-black text-white rounded-xl text-sm font-semibold hover:bg-black/80 transition-colors"
                onClick={handleDelete}
              >
                {deleteWarning ? "Всё равно удалить" : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    const isConfirmingDelete = deleteModal?.id === event.id;
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
                        className={`card flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:shadow-lg transition-shadow overflow-hidden relative ${
                          event.status === "pending" ? "border-l-[3px] border-amber-400 pl-[calc(1rem-1px)] sm:pl-[calc(1.25rem-1px)]" : ""
                        }`}
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
                          {/* Counts + budget summary */}
                          {(() => {
                            const winners = (event.nominations_data || []).reduce(
                              (s, n) => s + (n.place1 || 0) + (n.place2 || 0) + (n.place3 || 0), 0
                            ) + (event.grand_prix_count || 0) + (event.giveaways_count || 0);
                            const hasWinners = winners > 0;
                            const hasParticipants = (event.participants_count || 0) > 0 &&
                              event.recipients !== "только победители";
                            const parts: string[] = [];
                            if (hasWinners) parts.push(`победители — ${winners}`);
                            if (hasParticipants) parts.push(`участники — ${event.participants_count}`);
                            const budgetStr = event.total_budget
                              ? event.total_budget.toLocaleString("ru-RU") + " ₽"
                              : null;
                            if (!parts.length && !budgetStr) return null;
                            return (
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-black/40">
                                {parts.length > 0 && <span>{parts.join(", ")}</span>}
                                {budgetStr && <span className="font-medium text-black/55">{budgetStr}</span>}
                              </div>
                            );
                          })()}

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
                        <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end sm:shrink-0">
                          {/* Ship / approve / unship logic */}
                          {event.gifts_sent ? (
                            <button
                              className="text-xs text-black/30 hover:text-black/60 px-2 py-1.5 transition-colors"
                              onClick={() => handleUnship(event.id)}
                              title="Снять отметку об отгрузке"
                            >
                              Отменить
                            </button>
                          ) : event.status === "approved" ? (
                            <button
                              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                              onClick={() => { setShippingId(event.id); setShipDate(new Date().toISOString().slice(0, 10)); }}
                              title="Отметить как отгружено"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8 5-8-5m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8-5-8 5" />
                              </svg>
                              Отгружено
                            </button>
                          ) : event.status === "pending" && role === "admin" ? (
                            <button
                              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                              onClick={() => handleQuickApprove(event.id)}
                              title="Утвердить список подарков"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Утвердить
                            </button>
                          ) : event.status === "pending" ? (
                            <span className="text-xs text-amber-700 font-medium px-2">
                              Ожидает согласования
                            </span>
                          ) : null}

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

                          <button
                            className="text-xs px-2 py-1 text-black/25 hover:text-black/60 transition-colors"
                            title="Удалить"
                            onClick={() => openDeleteModal(event)}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
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

      {/* Trash */}
      {trash.length > 0 && (
        <section className="mt-10 opacity-60 hover:opacity-80 transition-opacity">
          <button
            className="flex items-center gap-2 text-xs tracking-widest uppercase font-medium text-black/40 hover:text-black/70 mb-3"
            onClick={() => setTrashOpen((v) => !v)}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Корзина — {trash.length} {trashOpen ? "▲" : "▼"}
          </button>
          {trashOpen && (
            <div className="space-y-2">
              {trash.map((ev) => (
                <div key={ev.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/5 border-dashed">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-black/50 truncate">{ev.name}</div>
                    <div className="text-xs text-black/30 font-light mt-0.5 flex flex-wrap gap-3">
                      <span>{ev.date}</span>
                      <span>{ev.country}</span>
                      <span className="italic">
                        {ev.delete_reason === "ошибка" && "Создали по ошибке"}
                        {ev.delete_reason === "отказ" && "Отказались от сотрудничества"}
                        {ev.delete_reason === "напрямую" && "Отгружено напрямую"}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                    onClick={() => handleRestore(ev.id)}
                  >
                    Восстановить
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
