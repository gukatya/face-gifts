import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { Event, GiftSet, GiftItem, Nomination } from "../types";
import type { PigmentWithSettings, ConsumableWithSettings } from "../types/catalog";

const PLACE_LABELS: Record<string, string> = {
  "1": "1 место",
  "2": "2 место",
  "3": "3 место",
  "гран-при": "Гран-при",
  "розыгрыш": "Розыгрыш",
  "участник": "Участник",
};

const LEVEL_COLORS: Record<string, string> = {
  Скромный: "bg-black/8 text-black/50",
  Нормальный: "bg-luxe-silver text-black/60",
  Хороший: "bg-luxe-black text-white",
  "Гран-при": "bg-luxe-black text-white",
};

const SKU_BADGE: Record<string, string> = {
  pigment: "bg-black/10 text-black/60",
  sample: "bg-luxe-silver text-black/70",
  certificate: "bg-black/5 text-black/50",
  consumable: "bg-black/5 text-black/40",
};

const SKU_LABEL: Record<string, string> = {
  pigment: "Пигмент",
  sample: "Мини-сэт",
  certificate: "Сертификат",
  consumable: "Расходник",
};

type CatalogEntry = {
  sku_id: number;
  sku_type: "pigment" | "consumable" | "sample";
  name: string;
  line?: string;
  zone?: string;
  category?: string;
  price: number;
};

export default function DraftPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { role } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [sets, setSets] = useState<GiftSet[]>([]);
  const [previousSets, setPreviousSets] = useState<GiftSet[] | null>(null);
  const [variant, setVariant] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Budget adjustment slider — shows absolute target, not increment
  const [targetBudget, setTargetBudget] = useState<number | null>(null);
  const [previousBudget, setPreviousBudget] = useState<number | null>(null);
  const [applyingBudget, setApplyingBudget] = useState(false);

  // Edit state
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<GiftItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Catalog for add-item search
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [ev, ss] = await Promise.all([api.events.get(eventId), api.events.sets(eventId)]);
    setEvent(ev);
    setSets(ss);
    if (ss.length > 0) setExpanded(new Set([ss[0].id]));
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  const loadCatalog = async () => {
    if (catalogLoaded) return;
    const [pigments, consumables] = await Promise.all([
      api.catalog.pigments(),
      api.catalog.consumables(),
    ]);
    const entries: CatalogEntry[] = [
      ...pigments
        .filter((p: PigmentWithSettings) => !p.is_hidden && p.name)
        .map((p: PigmentWithSettings) => ({
          sku_id: p.id,
          sku_type: "pigment" as const,
          name: p.name!,
          line: p.line ?? undefined,
          zone: p.zone ?? undefined,
          price: p.price_ru ?? 0,
        })),
      ...consumables
        .filter((c: ConsumableWithSettings) => !c.is_hidden && c.name)
        .map((c: ConsumableWithSettings) => ({
          sku_id: c.id,
          sku_type: (c.category === "Сэмплы" ? "sample" : "consumable") as "consumable" | "sample",
          name: c.name!,
          category: c.category ?? undefined,
          price: c.price_ru ?? 0,
        })),
    ];
    setCatalog(entries);
    setCatalogLoaded(true);
  };

  const handleGenerate = async () => {
    const nextVariant = variant + 1;
    setGenerating(true);
    setEditingSetId(null);
    try {
      const ss = await api.events.generate(eventId, nextVariant);
      setPreviousSets(sets.length > 0 ? sets : null);
      setSets(ss);
      setVariant(nextVariant);
      if (ss.length > 0) setExpanded(new Set([ss[0].id]));
    } finally {
      setGenerating(false);
    }
  };

  const buildEventPayload = (ev: Event, overrides: Partial<{ total_budget: number }> = {}) => {
    const nominations = ((ev.nominations_data ?? ev.nominations ?? []) as Nomination[]);
    return {
      name: ev.name,
      date: ev.date,
      country: ev.country,
      region: ev.region,
      warehouse: ev.warehouse,
      recipients: ev.recipients,
      mode: ev.mode,
      level: ev.level,
      grand_prix_count: ev.grand_prix_count ?? 0,
      has_trade_booth: ev.has_trade_booth ?? false,
      has_speaker_nonstop: ev.has_speaker_nonstop ?? false,
      has_speaker_stage: ev.has_speaker_stage ?? false,
      giveaways_count: ev.giveaways_count ?? 0,
      giveaway_mode: ((ev as unknown as { giveaway_mode?: string }).giveaway_mode ?? "одинаковые") as "одинаковые" | "разные",
      participants_count: ev.participants_count ?? 0,
      nominations,
      participants_budget: ev.participants_budget ?? 500,
      participants_use_certificate: ev.participants_use_certificate ?? false,
      total_budget: ev.total_budget,
      ...overrides,
    };
  };

  const handleUndo = async () => {
    if (!previousSets) return;
    setSets(previousSets);
    setPreviousSets(null);
    setVariant((v) => Math.max(0, v - 1));
    if (previousSets.length > 0) setExpanded(new Set([previousSets[0].id]));
    // Restore previous budget in DB and state
    if (previousBudget !== null && event) {
      setEvent((e) => e ? { ...e, total_budget: previousBudget } : e);
      setPreviousBudget(null);
      await api.events.update(eventId, buildEventPayload(event, { total_budget: previousBudget }));
    }
    setTargetBudget(null);
  };

  const handleApprove = async () => {
    const updated = await api.events.approve(eventId);
    setEvent(updated);
  };

  const handleUnapprove = async () => {
    const updated = await api.events.unapprove(eventId);
    setEvent(updated);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(api.events.exportUrl(eventId));
      if (!res.ok) throw new Error("Ошибка экспорта");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FACE_Gift_${eventId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Не удалось скачать файл. Убедитесь, что наборы сформированы.");
    } finally {
      setExporting(false);
    }
  };

  // How many real people does a GiftSet represent?
  const getSetCount = (gs: GiftSet): number => {
    if (!event) return 1;
    if (gs.place === "участник") return Math.max(event.participants_count || 1, 1);
    if (gs.place === "гран-при") return 1;
    if (gs.place === "розыгрыш") {
      const mode = (event as unknown as { giveaway_mode?: string }).giveaway_mode ?? "одинаковые";
      return mode === "разные" ? 1 : Math.max(event.giveaways_count || 1, 1);
    }
    const noms = (event.nominations_data ?? []) as Nomination[];
    const nom = noms.find((n) => n.name === gs.nomination_name);
    if (!nom) return 1;
    const key = `place${gs.place}` as "place1" | "place2" | "place3";
    return Math.max(nom[key] || 1, 1);
  };

  const totalGiftCount = sets.reduce((s, gs) => s + getSetCount(gs), 0);
  const totalCost = sets.reduce((s, gs) => s + gs.total_price * getSetCount(gs), 0);

  const handleApplyBudget = async () => {
    if (!event || targetBudget === null) return;
    setApplyingBudget(true);
    setEditingSetId(null);
    try {
      setPreviousBudget(event.total_budget ?? null);
      await api.events.update(eventId, buildEventPayload(event, { total_budget: targetBudget }));
      setEvent((e) => e ? { ...e, total_budget: targetBudget } : e);
      const ss = await api.events.generate(eventId, variant + 1);
      setPreviousSets(sets.length > 0 ? sets : null);
      setSets(ss);
      setVariant((v) => v + 1);
      setTargetBudget(null);
      if (ss.length > 0) setExpanded(new Set([ss[0].id]));
    } finally {
      setApplyingBudget(false);
    }
  };

  const toggleExpand = (setId: number) => {
    if (editingSetId === setId) return; // keep open while editing
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  };

  const startEdit = async (gs: GiftSet) => {
    setEditingSetId(gs.id);
    setEditItems(gs.items.map((i) => ({ ...i })));
    setAddQuery("");
    setShowDropdown(false);
    setExpanded((prev) => new Set([...prev, gs.id]));
    await loadCatalog();
  };

  const cancelEdit = () => {
    setEditingSetId(null);
    setEditItems([]);
    setAddQuery("");
    setShowDropdown(false);
  };

  const saveEdit = async () => {
    if (editingSetId === null) return;
    setSaving(true);
    try {
      const updated = await api.events.updateSet(eventId, editingSetId, editItems);
      setSets((prev) => prev.map((s) => (s.id === editingSetId ? updated : s)));
      setEditingSetId(null);
      setEditItems([]);
    } finally {
      setSaving(false);
    }
  };

  const removeItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = (entry: CatalogEntry) => {
    // Avoid exact duplicate (same sku_type + sku_id)
    if (editItems.some((i) => i.sku_type === entry.sku_type && i.sku_id === entry.sku_id)) return;
    const newItem: GiftItem = {
      sku_type: entry.sku_type,
      sku_id: entry.sku_id,
      name: entry.name,
      line: entry.line,
      zone: entry.zone,
      category: entry.category,
      qty: 1,
      price: entry.price,
    };
    setEditItems((prev) => [...prev, newItem]);
    setAddQuery("");
    setShowDropdown(false);
    addInputRef.current?.focus();
  };

  // Sort items: samples first → pigments (grouped by line, lines alpha) → consumables (alpha)
  const sortItems = (items: GiftItem[]): GiftItem[] => {
    const typeOrder: Record<string, number> = { sample: 0, pigment: 1, consumable: 2, certificate: 3 };
    return [...items].sort((a, b) => {
      const tA = typeOrder[a.sku_type] ?? 9;
      const tB = typeOrder[b.sku_type] ?? 9;
      if (tA !== tB) return tA - tB;
      const lineA = (a.line ?? "").toLowerCase();
      const lineB = (b.line ?? "").toLowerCase();
      if (lineA !== lineB) return lineA.localeCompare(lineB, "ru");
      return (a.name ?? "").localeCompare(b.name ?? "", "ru");
    });
  };

  const filteredCatalog = addQuery.trim().length >= 1
    ? catalog.filter((c) =>
        c.name.toLowerCase().includes(addQuery.toLowerCase()) ||
        (c.line ?? "").toLowerCase().includes(addQuery.toLowerCase())
      ).slice(0, 15)
    : [];

  if (loading) return <div className="text-center py-20 text-luxe-grey-mid text-sm tracking-widest uppercase">Загрузка...</div>;
  if (!event) return <div className="text-center py-20 text-black/40">Мероприятие не найдено</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <Link to="/" className="text-xs tracking-widest uppercase text-luxe-grey-mid hover:text-black/60 mb-2 inline-block transition-colors">
            ← Все мероприятия
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-luxe-black uppercase">{event.name}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-black/40 font-light">
            <span>{event.date}</span>
            <span>{event.region}</span>
            <span>{event.warehouse}</span>
            <span className={`badge ${LEVEL_COLORS[event.level] ?? "bg-black/10 text-black/50"}`}>
              {event.level}
            </span>
            <span className={`badge ${
              event.status === "draft"    ? "bg-black/10 text-black/50"
              : event.status === "approved" ? "bg-luxe-black text-white"
              : "bg-luxe-silver text-black/70"
            }`}>
              {event.status === "draft" ? "Черновик"
                : event.status === "approved" ? "Утверждён"
                : "Наборы подобраны"}
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-start sm:justify-end sm:shrink-0">
          {previousSets && (
            <button
              className="btn-secondary text-sm"
              onClick={handleUndo}
              title="Вернуться к предыдущей версии наборов"
            >
              Отменить
            </button>
          )}
          <button
            className="btn-secondary text-sm"
            onClick={() => navigate(`/events/${eventId}/edit`)}
          >
            Редактировать
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? "Подбираем..." : "Другой вариант"}
          </button>

          {/* Approve / unapprove — admin only */}
          {role === "admin" && event.status === "pending" && sets.length > 0 && (
            <button
              className="btn-primary text-sm flex items-center gap-1.5"
              onClick={handleApprove}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Утвердить
            </button>
          )}
          {role === "admin" && event.status === "approved" && (
            <button
              className="btn-secondary text-sm text-black/40"
              onClick={handleUnapprove}
              title="Снять утверждение"
            >
              Снять утверждение
            </button>
          )}

          <button
            className="btn-secondary text-sm"
            onClick={handleExport}
            disabled={exporting || sets.length === 0}
          >
            {exporting ? "Экспорт..." : "Экспорт Excel"}
          </button>
        </div>
      </div>

      {/* Pending approval banner */}
      {event.status === "pending" && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <div className="flex-1">
            {role === "admin" ? (
              <span className="text-sm font-semibold text-amber-900">
                Список ожидает вашего утверждения —{" "}
                <span className="font-normal text-amber-800">
                  после утверждения сотрудники смогут отгружать подарки
                </span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-amber-900">
                Наборы отправлены на согласование —{" "}
                <span className="font-normal text-amber-800">
                  отгрузка будет доступна после утверждения администратора
                </span>
              </span>
            )}
          </div>
          {role === "admin" && sets.length > 0 && (
            <button
              className="btn-primary text-sm shrink-0 flex items-center gap-1.5"
              onClick={handleApprove}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Утвердить
            </button>
          )}
        </div>
      )}

      {/* Summary */}
      {sets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-2xl font-black text-luxe-black">{totalGiftCount}</div>
            <div className="text-xs text-black/40 mt-0.5">подарков итого</div>
            {sets.length !== totalGiftCount && (
              <div className="text-xs text-black/30">{sets.length} видов наборов</div>
            )}
          </div>
          {(() => {
            const planned = event.total_budget && event.total_budget > 0 ? event.total_budget : totalCost;
            const sliderVal = targetBudget ?? planned;
            const sliderMin = Math.max(5000, Math.round(planned * 0.3 / 1000) * 1000);
            const sliderMax = Math.max(Math.round(planned * 2.5 / 10000) * 10000, 150000);
            const diff = sliderVal - planned;
            const changed = targetBudget !== null && Math.abs(diff) >= 1000;
            return (
              <div className="card col-span-1 flex flex-col gap-2">
                <div className="text-xs text-black/40 font-medium">Бюджет на подарки</div>
                <input
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={1000}
                  value={sliderVal}
                  onChange={(e) => setTargetBudget(Number(e.target.value))}
                  className="w-full accent-black"
                />
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xl font-black tabular-nums text-luxe-black">
                      {sliderVal.toLocaleString("ru-RU")} ₽
                    </span>
                    {changed && (
                      <span className={`ml-2 text-xs font-medium tabular-nums ${diff > 0 ? "text-black/50" : "text-black/40"}`}>
                        {diff > 0 ? `+${diff.toLocaleString("ru-RU")}` : diff.toLocaleString("ru-RU")} ₽
                      </span>
                    )}
                  </div>
                  {changed && (
                    <button
                      className="btn-primary text-xs py-1 px-3 shrink-0"
                      onClick={handleApplyBudget}
                      disabled={applyingBudget}
                    >
                      {applyingBudget ? "..." : "Пересобрать"}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
          <div className="card text-center">
            <div className="text-2xl font-black text-luxe-black">
              {totalCost.toLocaleString("ru-RU")} ₽
            </div>
            <div className="text-xs text-black/40 mt-0.5">итого по мероприятию</div>
            {event.total_budget && event.total_budget > 0 && (
              <div className={`text-xs mt-1 font-medium ${
                totalCost > event.total_budget * 1.05
                  ? "text-black/60"
                  : "text-black/30"
              }`}>
                запланировано {event.total_budget.toLocaleString("ru-RU")} ₽
                {totalCost > event.total_budget * 1.05 && " !"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sets */}
      {sets.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-black/40 mb-4">Черновик ещё не сформирован</p>
          <button className="btn-primary" onClick={handleGenerate}>
            Сформировать набор
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((gs) => {
            const isEditing = editingSetId === gs.id;
            const displayItems = sortItems(isEditing ? editItems : gs.items);
            const displayTotal = isEditing
              ? editItems.reduce((s, i) => s + i.price * i.qty, 0)
              : gs.total_price;

            return (
              <div key={gs.id} className={`card overflow-hidden p-0 ${isEditing ? "ring-2 ring-black/20" : ""}`}>
                {/* Row header */}
                <div className="w-full flex items-center justify-between px-5 py-3 hover:bg-black/5 transition-colors">
                  <button
                    className="flex items-center gap-3 flex-1 text-left"
                    onClick={() => toggleExpand(gs.id)}
                  >
                    <span className="font-semibold text-luxe-black">{gs.nomination_name}</span>
                    <span className="text-sm text-black/40">{PLACE_LABELS[gs.place] ?? gs.place}</span>
                    <span className={`badge ${LEVEL_COLORS[gs.level] ?? "bg-black/10 text-black/50"}`}>
                      {gs.level}
                    </span>
                  </button>

                  <div className="flex items-center gap-3">
                    {getSetCount(gs) > 1 && (
                      <span className="text-xs text-black/40 bg-black/10 px-2 py-0.5 rounded-full">
                        × {getSetCount(gs)} чел.
                      </span>
                    )}
                    <span className="text-sm font-semibold text-black/60">
                      {displayTotal.toLocaleString("ru-RU")} ₽
                    </span>

                    {isEditing ? (
                      <div className="flex gap-1.5">
                        <button
                          className="btn-primary text-xs px-3 py-1"
                          onClick={saveEdit}
                          disabled={saving}
                        >
                          {saving ? "..." : "Сохранить"}
                        </button>
                        <button
                          className="btn-secondary text-xs px-3 py-1"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-black/25 hover:text-black/70 transition-colors p-1"
                        title="Редактировать набор"
                        onClick={(e) => { e.stopPropagation(); startEdit(gs); }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    )}

                    <button
                      className="text-black/30 text-sm w-4"
                      onClick={() => toggleExpand(gs.id)}
                    >
                      {expanded.has(gs.id) ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {expanded.has(gs.id) && (
                  <div className="border-t border-black/5 px-3 sm:px-5 py-3">
                    <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm min-w-[420px]">
                      <thead>
                        <tr className="text-xs text-black/30 border-b border-black/5">
                          <th className="text-left pb-2 font-medium w-8">#</th>
                          <th className="text-left pb-2 font-medium">Наименование</th>
                          <th className="text-left pb-2 font-medium">Тип</th>
                          <th className="text-center pb-2 font-medium w-12">Кол</th>
                          <th className="text-right pb-2 font-medium w-24">Цена</th>
                          {isEditing && <th className="w-8" />}
                        </tr>
                      </thead>
                      <tbody>
                        {displayItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-black/5 hover:bg-black/5">
                            <td className="py-1.5 text-black/30 text-xs">{idx + 1}</td>
                            <td className="py-1.5 font-medium text-luxe-black">
                              {item.name}
                              {item.line && (
                                <span className="ml-1.5 text-xs text-black/30 font-normal">({item.line})</span>
                              )}
                            </td>
                            <td className="py-1.5">
                              <span className={`badge text-xs ${SKU_BADGE[item.sku_type] ?? "bg-black/10 text-black/50"}`}>
                                {SKU_LABEL[item.sku_type] ?? item.sku_type}
                              </span>
                            </td>
                            <td className="py-1.5 text-center text-black/50">{item.qty}</td>
                            <td className="py-1.5 text-right text-black/60">
                              {item.price.toLocaleString("ru-RU")} ₽
                            </td>
                            {isEditing && (
                              <td className="py-1.5 pl-2">
                                <button
                                  className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none"
                                  onClick={() => removeItem(idx)}
                                  title="Удалить"
                                >
                                  ×
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={isEditing ? 5 : 4} className="pt-2 text-right text-sm font-semibold text-black/50">
                            Итого набор:
                          </td>
                          <td className="pt-2 text-right font-black text-luxe-black" colSpan={isEditing ? 2 : 1}>
                            {displayTotal.toLocaleString("ru-RU")} ₽
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    </div>

                    {/* Add item row (edit mode only) */}
                    {isEditing && (
                      <div className="mt-3 relative">
                        <input
                          ref={addInputRef}
                          type="text"
                          className="input text-sm w-full"
                          placeholder="Добавить позицию — начните вводить название..."
                          value={addQuery}
                          onChange={(e) => { setAddQuery(e.target.value); setShowDropdown(true); }}
                          onFocus={() => { if (addQuery.trim()) setShowDropdown(true); }}
                          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                        />
                        {showDropdown && filteredCatalog.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white/95 backdrop-blur border border-black/10 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {filteredCatalog.map((entry) => {
                              const already = editItems.some(
                                (i) => i.sku_type === entry.sku_type && i.sku_id === entry.sku_id
                              );
                              return (
                                <button
                                  key={`${entry.sku_type}-${entry.sku_id}`}
                                  className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-black/5 transition-colors ${already ? "opacity-40 cursor-not-allowed" : ""}`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => !already && addItem(entry)}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className={`badge text-xs ${SKU_BADGE[entry.sku_type] ?? "bg-black/10 text-black/50"}`}>
                                      {SKU_LABEL[entry.sku_type]}
                                    </span>
                                    <span className="font-medium text-luxe-black">{entry.name}</span>
                                    {entry.line && <span className="text-black/30 text-xs">({entry.line})</span>}
                                  </span>
                                  <span className="text-black/40 shrink-0 ml-3">
                                    {entry.price.toLocaleString("ru-RU")} ₽
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {showDropdown && addQuery.trim().length >= 1 && filteredCatalog.length === 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white/95 backdrop-blur border border-black/10 rounded-xl shadow-lg px-4 py-3 text-sm text-black/40">
                            Ничего не найдено
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
