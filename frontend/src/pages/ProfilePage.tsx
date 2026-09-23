import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";

export default function ProfilePage() {
  const { role, name } = useAuth();
  const [tgSending, setTgSending] = useState(false);

  const handleSendBackup = async () => {
    setTgSending(true);
    try {
      await api.admin.sendBackupToTelegram();
      alert("Бэкап отправлен в Telegram ✓");
    } catch {
      alert("Не удалось отправить. Настроены ли TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID?");
    } finally {
      setTgSending(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Личный кабинет</h1>

      {/* User info */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-black/40">Профиль</h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-luxe-black flex items-center justify-center text-white font-black text-lg shrink-0">
            {(name ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-luxe-black">{name ?? "—"}</div>
            <div className="text-sm text-black/40">
              {role === "admin" ? "Администратор" : "Сотрудник"}
            </div>
          </div>
        </div>
      </div>

      {/* Admin-only: backup */}
      {role === "admin" && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-black/40">База данных</h2>
          <p className="text-sm text-black/50">
            Скачай резервную копию базы или отправь её в Telegram для хранения.
          </p>
          <div className="flex gap-2 flex-wrap">
            <a
              href={api.admin.backupDownloadUrl()}
              download
              className="btn-primary text-sm"
            >
              Скачать бэкап
            </a>
            <button
              onClick={handleSendBackup}
              disabled={tgSending}
              className="btn-primary text-sm opacity-70 hover:opacity-100 disabled:opacity-40"
            >
              {tgSending ? "Отправка..." : "Отправить в Telegram"}
            </button>
          </div>
          <p className="text-xs text-black/30">
            Автоматический бэкап отправляется каждый день в 21:00 МСК при настроенном боте.
          </p>
        </div>
      )}

      {/* Telegram settings info */}
      {role === "admin" && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-black/40">Telegram</h2>
          <div className="text-sm text-black/50 space-y-1">
            <p>Для работы уведомлений настрой переменные окружения в Railway:</p>
            <ul className="mt-2 space-y-1 text-xs font-mono bg-black/4 rounded-lg p-3">
              <li><span className="text-luxe-black font-semibold">TELEGRAM_BOT_TOKEN</span> — токен бота</li>
              <li><span className="text-luxe-black font-semibold">TELEGRAM_CHAT_ID</span> — твой личный чат (бэкапы)</li>
              <li><span className="text-luxe-black font-semibold">TELEGRAM_BOSS_CHAT_ID</span> — чат босса (согласование)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
