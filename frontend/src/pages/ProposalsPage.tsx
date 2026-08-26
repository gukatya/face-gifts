import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { Proposal, ProposalCreate, ProposalMessage, ProposalPerk } from "../types";

// ─── Perks dictionary ────────────────────────────────────────────────────────

const PERK_LABELS: Record<ProposalPerk, string> = {
  speaker_stage:   "Спикер основная сцена",
  speaker_nonstop: "Нон-стоп",
  stand:           "Стенд",
  logo:            "Логотип в программе",
  smm:             "Упоминание в SMM",
  certificate:     "Сертификат участника",
};

const PERK_ICONS: Record<ProposalPerk, string> = {
  speaker_stage:   "🎤",
  speaker_nonstop: "🎬",
  stand:           "🏢",
  logo:            "📋",
  smm:             "📱",
  certificate:     "🎓",
};

const ALL_PERKS = Object.keys(PERK_LABELS) as ProposalPerk[];

function PerkChip({ perk, active, onClick }: { perk: ProposalPerk; active?: boolean; onClick?: () => void }) {
  const base = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors select-none";
  const cls = active ? "bg-luxe-black text-white" : "bg-luxe-silver/60 text-black/50";
  return (
    <span className={`${base} ${cls} ${onClick ? "cursor-pointer hover:opacity-80" : ""}`} onClick={onClick}>
      {PERK_ICONS[perk]} {PERK_LABELS[perk]}
    </span>
  );
}

// ─── Chat modal ───────────────────────────────────────────────────────────────

const AUTHOR_OPTIONS = ["Катя", "Менеджер", "Коллега"];

function ChatModal({ proposal, onClose, onStatusChange }: {
  proposal: Proposal;
  onClose: () => void;
  onStatusChange: () => void;
}) {
  const [messages, setMessages] = useState<ProposalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState(() => {
    return localStorage.getItem("chat_author") || "Катя";
  });
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const msgs = await api.proposals.getMessages(proposal.id);
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMessages(); }, [proposal.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const msg = await api.proposals.sendMessage(proposal.id, author, trimmed);
      setMessages((prev) => [...prev, msg]);
      setText("");
      localStorage.setItem("chat_author", author);
      // статус мог измениться (new → chat)
      onStatusChange();
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ height: "min(90vh, 640px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/8">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{proposal.name}</div>
            <div className="text-xs text-black/40">Переписка</div>
          </div>
          <button className="text-black/30 hover:text-black/60 text-xl leading-none" onClick={onClose}>×</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && <p className="text-center text-sm text-black/35">Загрузка...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-black/35 py-8">
              Сообщений пока нет.<br />Напишите первое — сотрудники увидят.
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.author_label === author;
            return (
              <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-snug whitespace-pre-wrap ${
                  isMe ? "bg-luxe-black text-white rounded-br-sm" : "bg-luxe-silver/60 text-black rounded-bl-sm"
                }`}>
                  {msg.text}
                </div>
                <div className="text-[10px] text-black/35 px-1">
                  {msg.author_label} · {formatTime(msg.created_at)}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-black/8 px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-black/40">Пишу как:</span>
            <select
              className="text-xs bg-luxe-silver/50 rounded-lg px-2 py-1 border-0 outline-none"
              value={author}
              onChange={(e) => {
                setAuthor(e.target.value);
                localStorage.setItem("chat_author", e.target.value);
              }}
            >
              {AUTHOR_OPTIONS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              className="flex-1 input resize-none text-sm py-2"
              rows={2}
              placeholder="Написать сообщение... (Enter — отправить)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
            />
            <button
              className="btn-primary px-4 py-2 text-sm self-end"
              onClick={handleSend}
              disabled={sending || !text.trim()}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Decision modal ───────────────────────────────────────────────────────────

function DecideModal({ proposal, decision, onConfirm, onClose }: {
  proposal: Proposal;
  decision: "approved" | "rejected";
  onConfirm: (comment: string) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-1">
          {decision === "approved" ? "✓ Участвуем" : "✗ Пропускаем"}
        </h3>
        <p className="text-sm text-black/50 mb-4">{proposal.name}</p>
        <textarea
          className="input w-full h-24 text-sm resize-none"
          placeholder={decision === "approved" ? "Комментарий (необязательно)" : "Причина (необязательно)"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className={`btn-primary ${decision === "rejected" ? "!bg-red-500 hover:!bg-red-600" : ""}`}
            onClick={() => onConfirm(comment)}
          >
            {decision === "approved" ? "Участвуем" : "Пропустить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Proposal form modal ──────────────────────────────────────────────────────

const EMPTY_FORM: ProposalCreate = {
  name: "", date_text: "", city: "", social_link: "",
  organizer_name: "", organizer_contact: "",
  expected_min: undefined, expected_max: undefined,
  perks: [], requirements: "", raw_text: "",
};

function ProposalFormModal({ initial, onSave, onClose }: {
  initial?: Proposal;
  onSave: (data: ProposalCreate) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProposalCreate>(
    initial ? {
      name: initial.name,
      date_text: initial.date_text ?? "",
      city: initial.city ?? "",
      social_link: initial.social_link ?? "",
      organizer_name: initial.organizer_name ?? "",
      organizer_contact: initial.organizer_contact ?? "",
      expected_min: initial.expected_min ?? undefined,
      expected_max: initial.expected_max ?? undefined,
      perks: initial.perks ?? [],
      requirements: initial.requirements ?? "",
      raw_text: initial.raw_text ?? "",
    } : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ProposalCreate, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const togglePerk = (perk: ProposalPerk) => {
    const list = form.perks ?? [];
    set("perks", list.includes(perk) ? list.filter((p) => p !== perk) : [...list, perk]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/40 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mb-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-5">{initial ? "Редактировать предложение" : "Новое предложение"}</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Название мероприятия *</label>
            <input className="input w-full" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Чемпионат Сибири" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Дата</label>
              <input className="input w-full" value={form.date_text ?? ""} onChange={(e) => set("date_text", e.target.value)} placeholder="26–27 сентября" />
            </div>
            <div>
              <label className="label">Город</label>
              <input className="input w-full" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Омск" />
            </div>
          </div>
          <div>
            <label className="label">Ссылка (Instagram / сайт)</label>
            <input className="input w-full" value={form.social_link ?? ""} onChange={(e) => set("social_link", e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Организатор</label>
              <input className="input w-full" value={form.organizer_name ?? ""} onChange={(e) => set("organizer_name", e.target.value)} placeholder="Имя / компания" />
            </div>
            <div>
              <label className="label">Контакт</label>
              <input className="input w-full" value={form.organizer_contact ?? ""} onChange={(e) => set("organizer_contact", e.target.value)} placeholder="Телефон / email" />
            </div>
          </div>
          <div>
            <label className="label">Ожидаемых участников</label>
            <div className="flex items-center gap-2">
              <input className="input w-24 text-center" type="number" min={0} value={form.expected_min ?? ""} onChange={(e) => set("expected_min", e.target.value ? +e.target.value : undefined)} placeholder="от" />
              <span className="text-black/30 text-sm">—</span>
              <input className="input w-24 text-center" type="number" min={0} value={form.expected_max ?? ""} onChange={(e) => set("expected_max", e.target.value ? +e.target.value : undefined)} placeholder="до" />
            </div>
          </div>
          <div>
            <label className="label">Что нам предлагают</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_PERKS.map((perk) => (
                <PerkChip key={perk} perk={perk} active={(form.perks ?? []).includes(perk)} onClick={() => togglePerk(perk)} />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Что хотят от нас</label>
            <textarea className="input w-full h-20 resize-none text-sm" value={form.requirements ?? ""} onChange={(e) => set("requirements", e.target.value)} placeholder="Подарки для победителей, присутствие амбасадора..." />
          </div>
          <div>
            <label className="label">Оригинальный текст оффера</label>
            <textarea className="input w-full h-28 resize-none text-sm text-black/60 font-mono" value={form.raw_text ?? ""} onChange={(e) => set("raw_text", e.target.value)} placeholder="Вставьте сообщение от организатора как есть..." />
          </div>
        </div>
        <div className="flex gap-2 mt-6 justify-end">
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onDecide, onEdit, onDelete, onOpenChat }: {
  proposal: Proposal;
  onDecide: (p: Proposal, d: "approved" | "rejected") => void;
  onEdit: (p: Proposal) => void;
  onDelete: (p: Proposal) => void;
  onOpenChat: (p: Proposal) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const isNew = proposal.status === "new";
  const isChat = proposal.status === "chat";
  const hasMessages = proposal.messages_count > 0;

  return (
    <div className={`card flex flex-col gap-3 ${
      proposal.status === "approved" ? "opacity-70" :
      proposal.status === "rejected" ? "opacity-50" : ""
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-luxe-black">{proposal.name}</span>
            {proposal.status === "approved" && (
              <span className="badge bg-green-100 text-green-700">Участвуем</span>
            )}
            {proposal.status === "rejected" && (
              <span className="badge bg-red-100 text-red-600">Пропущено</span>
            )}
            {isChat && (
              <span className="badge bg-blue-100 text-blue-700">В переписке</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-black/45">
            {proposal.date_text && <span>{proposal.date_text}</span>}
            {proposal.city && <span>{proposal.city}</span>}
            {(proposal.expected_min || proposal.expected_max) && (
              <span>
                ~{proposal.expected_min && proposal.expected_max
                  ? `${proposal.expected_min}–${proposal.expected_max}`
                  : proposal.expected_min ?? proposal.expected_max} чел.
              </span>
            )}
            {proposal.social_link && (
              <a href={proposal.social_link} target="_blank" rel="noreferrer" className="hover:text-black/70 underline underline-offset-2 truncate max-w-[160px]">
                {proposal.social_link.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button className="text-black/50 hover:text-black transition-colors text-sm px-2 py-1 rounded-lg hover:bg-black/5" onClick={() => onEdit(proposal)} title="Редактировать">✏️</button>
          <button className="text-black/50 hover:text-red-500 transition-colors text-sm px-2 py-1 rounded-lg hover:bg-red-50" onClick={() => onDelete(proposal)} title="Удалить">✕</button>
        </div>
      </div>

      {/* Organizer */}
      {(proposal.organizer_name || proposal.organizer_contact) && (
        <div className="text-xs text-black/45 flex gap-x-4 gap-y-0.5 flex-wrap">
          {proposal.organizer_name && <span>👤 {proposal.organizer_name}</span>}
          {proposal.organizer_contact && <span>📞 {proposal.organizer_contact}</span>}
        </div>
      )}

      {/* Perks */}
      {(proposal.perks ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(proposal.perks as ProposalPerk[]).map((p) => (
            <PerkChip key={p} perk={p} active />
          ))}
        </div>
      )}

      {/* Requirements */}
      {proposal.requirements && (
        <div className="text-sm text-black/60 bg-luxe-silver/40 rounded-lg px-3 py-2">
          <span className="text-black/35 text-xs mr-2">Хотят:</span>{proposal.requirements}
        </div>
      )}

      {/* Decision comment */}
      {proposal.decision_comment && (
        <div className="text-sm text-black/50 italic">
          💬 {proposal.decision_comment}
        </div>
      )}

      {/* Raw text toggle */}
      {proposal.raw_text && (
        <div>
          <button className="text-xs text-black/35 hover:text-black/60 transition-colors" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? "▲ Скрыть оригинал" : "▼ Показать оригинал"}
          </button>
          {showRaw && (
            <pre className="mt-2 text-xs text-black/50 bg-luxe-silver/30 rounded-lg p-3 whitespace-pre-wrap font-mono">
              {proposal.raw_text}
            </pre>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1 border-t border-black/5">
        {(isNew || isChat) && (
          <div className="flex gap-2">
            <button
              className="btn-primary text-sm py-1.5 flex-1"
              onClick={() => onDecide(proposal, "approved")}
            >
              ✓ Участвуем
            </button>
            <button
              className="btn-secondary text-sm py-1.5 flex-1 !text-red-500 !border-red-200 hover:!bg-red-50"
              onClick={() => onDecide(proposal, "rejected")}
            >
              ✗ Пропустить
            </button>
          </div>
        )}

        {/* Chat button — always visible */}
        <button
          className="relative w-full btn-secondary text-sm py-1.5 flex items-center justify-center gap-2"
          onClick={() => onOpenChat(proposal)}
        >
          <span>💬 Переписка</span>
          {hasMessages && (
            <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {proposal.messages_count}
            </span>
          )}
        </button>

        {/* Approved: link to create event */}
        {proposal.status === "approved" && (
          <a
            href={`/events/new?from_proposal=${proposal.id}&name=${encodeURIComponent(proposal.name)}&city=${encodeURIComponent(proposal.city ?? "")}`}
            className="btn-secondary text-sm py-1.5 inline-block text-center"
          >
            + Создать мероприятие
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Proposal | null>(null);
  const [decideTarget, setDecideTarget] = useState<{ proposal: Proposal; decision: "approved" | "rejected" } | null>(null);
  const [chatTarget, setChatTarget] = useState<Proposal | null>(null);

  const load = async () => {
    setLoading(true);
    try { setProposals(await api.proposals.list()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: ProposalCreate) => {
    if (editTarget) {
      await api.proposals.update(editTarget.id, data);
    } else {
      await api.proposals.create(data);
    }
    setShowForm(false);
    setEditTarget(null);
    await load();
  };

  const handleDecide = async (comment: string) => {
    if (!decideTarget) return;
    await api.proposals.decide(decideTarget.proposal.id, decideTarget.decision, comment || undefined);
    setDecideTarget(null);
    await load();
  };

  const handleDelete = async (p: Proposal) => {
    if (!confirm(`Удалить предложение «${p.name}»?`)) return;
    await api.proposals.delete(p.id);
    await load();
  };

  const newList      = proposals.filter((p) => p.status === "new");
  const chatList     = proposals.filter((p) => p.status === "chat");
  const approvedList = proposals.filter((p) => p.status === "approved");
  const rejectedList = proposals.filter((p) => p.status === "rejected");

  const cardProps = (p: Proposal) => ({
    proposal: p,
    onDecide: (proposal: Proposal, decision: "approved" | "rejected") => setDecideTarget({ proposal, decision }),
    onEdit: (proposal: Proposal) => { setEditTarget(proposal); setShowForm(true); },
    onDelete: handleDelete,
    onOpenChat: (proposal: Proposal) => setChatTarget(proposal),
  });

  return (
    <div className="space-y-8">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-black/35 mb-1">Конструктор наборов</p>
          <h1 className="text-3xl font-black tracking-tight uppercase">Предложения</h1>
        </div>
        <button className="btn-primary" onClick={() => { setEditTarget(null); setShowForm(true); }}>
          + Новое предложение
        </button>
      </div>

      {loading && <p className="text-black/40 text-sm">Загрузка...</p>}

      {!loading && proposals.length === 0 && (
        <div className="card text-center py-12 text-black/35">
          <p className="text-lg mb-1">Предложений пока нет</p>
          <p className="text-sm">Добавляйте офферы от организаторов по мере поступления</p>
        </div>
      )}

      {/* Ожидают решения */}
      {newList.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
            <span className="text-xs font-semibold tracking-widest uppercase text-black/50">
              Ожидают решения — {newList.length}
            </span>
            <div className="flex-1 h-px bg-black/8 ml-1" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {newList.map((p) => <ProposalCard key={p.id} {...cardProps(p)} />)}
          </div>
        </section>
      )}

      {/* В переписке */}
      {chatList.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            <span className="text-xs font-semibold tracking-widest uppercase text-black/50">
              В переписке — {chatList.length}
            </span>
            <div className="flex-1 h-px bg-black/8 ml-1" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {chatList.map((p) => <ProposalCard key={p.id} {...cardProps(p)} />)}
          </div>
        </section>
      )}

      {/* Участвуем */}
      {approvedList.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            <span className="text-xs font-semibold tracking-widest uppercase text-black/50">
              Участвуем — {approvedList.length}
            </span>
            <div className="flex-1 h-px bg-black/8 ml-1" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {approvedList.map((p) => <ProposalCard key={p.id} {...cardProps(p)} />)}
          </div>
        </section>
      )}

      {/* Пропущено */}
      {rejectedList.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-black/20 inline-block"></span>
            <span className="text-xs font-semibold tracking-widest uppercase text-black/35">
              Пропущено — {rejectedList.length}
            </span>
            <div className="flex-1 h-px bg-black/8 ml-1" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {rejectedList.map((p) => <ProposalCard key={p.id} {...cardProps(p)} />)}
          </div>
        </section>
      )}

      {/* Modals */}
      {showForm && (
        <ProposalFormModal
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {decideTarget && (
        <DecideModal
          proposal={decideTarget.proposal}
          decision={decideTarget.decision}
          onConfirm={handleDecide}
          onClose={() => setDecideTarget(null)}
        />
      )}

      {chatTarget && (
        <ChatModal
          proposal={chatTarget}
          onClose={() => setChatTarget(null)}
          onStatusChange={load}
        />
      )}
    </div>
  );
}
