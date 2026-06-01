import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Event } from "../types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Черновик", color: "bg-yellow-100 text-yellow-800" },
  pending: { label: "Ожидает", color: "bg-blue-100 text-blue-800" },
  approved: { label: "Утверждён", color: "bg-green-100 text-green-800" },
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мероприятия</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление подарочными наборами</p>
        </div>
        <Link to="/events/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Новое мероприятие
        </Link>
      </div>

      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">🎁</div>
          <p className="text-gray-500 text-lg">Мероприятий пока нет</p>
          <p className="text-gray-400 text-sm mt-1 mb-5">Создайте первое мероприятие, чтобы начать</p>
          <Link to="/events/new" className="btn-primary">
            Создать мероприятие
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const st = STATUS_LABELS[event.status] ?? STATUS_LABELS.draft;
            return (
              <div key={event.id} className="card flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 truncate">{event.name}</span>
                    <span className={`badge ${st.color}`}>{st.label}</span>
                    {event.level && (
                      <span className="badge bg-gray-100 text-gray-600">{event.level}</span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>📅 {event.date}</span>
                    <span>🌍 {event.country} / {event.region}</span>
                    <span>🏭 {event.warehouse}</span>
                    {event.grand_prix_count > 0 && <span>⭐ Гран-при × {event.grand_prix_count}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Link
                    to={`/events/${event.id}/draft`}
                    className="btn-secondary text-xs"
                  >
                    Открыть →
                  </Link>
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => navigate(`/events/${event.id}/edit`)}
                  >
                    Редактировать
                  </button>
                  {confirmDeleteId === event.id ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs text-gray-600">Удалить?</span>
                      <button
                        className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        onClick={() => handleDelete(event.id)}
                      >
                        Да
                      </button>
                      <button
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Нет
                      </button>
                    </span>
                  ) : (
                    <button
                      className="text-xs px-2 py-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Удалить"
                      onClick={() => setConfirmDeleteId(event.id)}
                    >
                      ✕
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
