import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Event } from "../types";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Черновик",  cls: "bg-black/10 text-black/50" },
  pending:  { label: "Ожидает",   cls: "bg-black/90 text-white" },
  approved: { label: "Утверждён", cls: "bg-luxe-silver text-black/70" },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    await api.events.delete(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
  };

  useEffect(() => {
    api.events.list().then(setEvents).finally(() => setLoading(false));
  }, []);

  const filtered = events.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

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
        <Link to="/events/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Новое мероприятие
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          className="input max-w-sm"
          placeholder="Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-luxe-grey-mid text-sm tracking-widest uppercase">
          Загрузка...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-20">
          <p className="text-2xl font-black uppercase tracking-tight text-luxe-black mb-2">
            Нет мероприятий
          </p>
          <p className="text-luxe-grey-mid text-sm font-light mb-8">
            Создайте первое мероприятие, чтобы начать
          </p>
          <Link to="/events/new" className="btn-primary">
            Создать мероприятие
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const st = STATUS_LABELS[event.status] ?? STATUS_LABELS.draft;
            return (
              <div
                key={event.id}
                className="card flex items-center justify-between gap-4 hover:shadow-lg transition-shadow"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="font-semibold text-luxe-black truncate">
                      {event.name}
                    </span>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {event.level && (
                      <span className="badge bg-luxe-silver/60 text-black/60">
                        {event.level}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs font-light text-black/50">
                    <span>{event.date}</span>
                    <span>{event.country} / {event.region}</span>
                    <span>{event.warehouse}</span>
                    {event.grand_prix_count > 0 && (
                      <span>Гран-при × {event.grand_prix_count}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
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
                  {confirmDeleteId === event.id ? (
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
      )}
    </div>
  );
}
