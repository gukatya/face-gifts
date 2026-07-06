import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Proposal, ProposalCreate, ProposalPerk } from "../types";

// ─── Perks dictionary ────────────────────────────────────────────────────────

const PERK_LABELS: Record<ProposalPerk, string> = {
  speaker_stage:    "Спикер основная сцена",
  speaker_nonstop:  "Нон-стоп",
  stand:            "Стенд",
  logo:             "Логотип в программе",
  smm:              "Упоминание в SMM",
  certificate:      "Сертификат участника",
};

const PERK_ICONS: Record<ProposalPerk, string> = {
  speaker_stage:    "🎤",
  speaker_nonstop:  "🎬",
  stand:            "🏢",
  logo:             "📋",
  smm:              "📱",
  certificate:      "🎓",
};

const ALL_PERKS = Object.keys(PERK_LABELS) as ProposalPerk[];

// ─── Perk chip ────────────────────────────────────────────────────────────────

function PerkChip({ perk, active, onClick }: { perk: ProposalPerk; active?: boolean; onClick?: () => void }) {
  const base = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors select-none";
  const cls = active
    ? "bg-luxe-black text-white"
    : "bg-luxe-silver/60 text-black/50";
  return (
    <span className={`${base} ${cls} ${onClick ? "cursor-pointer hover:opacity-80" : ""}`} onClick={onClick}>
      {PERK_ICONS[perk]} {PERK_LABELS[perk]}
    </span>
  );
}

// ─── Decision modal ───────────────────────────────────────────────────────────

function DecideModal({
  proposal,
  decision,
  onConfirm,
  onClose,
}: {
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
  name: "",
  date_text: "",
  city: "",
  social_link: "",
  organizer_name: "",
  organizer_contact: "",
  expected_min: undefined,
  expected_max: undefined,
  perks: [],
  requirements: "",
  raw_text: "",
};

function ProposalFormModal({
  initial,
  onSave,
  onClose,
}: {
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
          {/* Name */}
          <div>
            <label className="label">Название мероприятия *</label>
            <input className="input w-full" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Чемпионат Сибири" />
          </div>

          {/* Date + City */}
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

          {/* Social link */}
          <div>
            <label className="label">Ссылка (Instagram / сайт)</label>
            <input className="input w-full" value={form.social_link ?? ""} onChange={(e) => set("social_link", e.target.value)} placeholder="https://instagram.com/..." />
          </div>

          {/* Organizer */}
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

          {/* Expected count */}
          <div>
            <label className="label">Ожидаемых участников</label>
            <div className="flex items-center gap-2">
              <input className="input w-24 text-center" type="number" min={0} value={form.expected_min ?? ""} onChange={(e) => set("expected_min", e.target.value ? +e.target.value : undefined)} placeholder="от" />
              <span className="text-black/30 text-sm">—</span>
              <input className="input w-24 text-center" type="number" min={0} value={form.expected_max ?? ""} onChange={(e) => set("expected_max", e.target.value ? +e.target.value : undefined)} placeholder="до" />
            </div>
          </div>

          {/* Perks */}
          <div>
            <label className="label">Что нам предлагают</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_PERKS.map((perk) => (
                <PerkChip key={perk} perk={perk} active={(form.perks ?? []).includes(perk)} onClick={() => togglePerk(perk)} />
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div>
            <label className="label">Что хотят от нас</label>
            <textarea className="input w-full h-20 resize-none text-sm" value={form.requirements ?? ""} onChange={(e) => set("requirements", e.target.value)} placeholder="Подарки для победителей, присутствие амбасадора..." />
          </div>

          {/* Raw text */}
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

function ProposalCard({
  proposal,
  onDecide,
  onEdit,
  onDelete,
}: {
  proposal: Proposal;
  onDecide: (p: Proposal, d: "approved" | "rejected") => void;
  onEdit: (p: Proposal) => void;
  onDelete: (p: Proposal) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const isNew = proposal.status === "new";

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
        {/* Edit / delete */}
        <div className="flex gap-1 shrink-0">
          <button className="text-black/25 hover:text-black/60 transition-colors text-xs px-1.5 py-1" onClick={() => onEdit(proposal)} title="Редактировать">✏</button>
          <button className="text-black/25 hover:text-red-500 transition-colors text-xs px-1.5 py-1" onClick={() => onDelete(proposal)} title="Удалить">×</button>
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
      {isNew && (
        <div className="flex gap-2 pt-1 border-t border-black/5">
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

      {/* Approved: link to create event */}
      {proposal.status === "approved" && (
        <div className="pt-1 border-t border-black/5">
          <a
            href={`/events/new?from_proposal=${proposal.id}&name=${encodeURIComponent(proposal.name)}&city=${encodeURIComponent(proposal.city ?? "")}`}
            className="btn-secondary text-sm py-1.5 inline-block"
          >
            + Создать мероприятие
          </a>
        </div>
      )}
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
  const approvedList = proposals.filter((p) => p.status === "approved");
  const rejectedList = proposals.filter((p) => p.status === "rejected");

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

      {/* New */}
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
            {newList.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onDecide={(proposal, decision) => setDecideTarget({ proposal, decision })}
                onEdit={(proposal) => { setEditTarget(proposal); setShowForm(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Approved */}
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
            {approvedList.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onDecide={(proposal, decision) => setDecideTarget({ proposal, decision })}
                onEdit={(proposal) => { setEditTarget(proposal); setShowForm(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Rejected */}
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
            {rejectedList.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onDecide={(proposal, decision) => setDecideTarget({ proposal, decision })}
                onEdit={(proposal) => { setEditTarget(proposal); setShowForm(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Form modal */}
      {showForm && (
        <ProposalFormModal
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {/* Decision modal */}
      {decideTarget && (
        <DecideModal
          proposal={decideTarget.proposal}
          decision={decideTarget.decision}
          onConfirm={handleDecide}
          onClose={() => setDecideTarget(null)}
        />
      )}
    </div>
  );
}
