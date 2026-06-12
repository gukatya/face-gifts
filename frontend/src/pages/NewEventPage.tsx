import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import type { EventCreate, Nomination, CalcLevels } from "../types";
import StepIndicator from "../components/StepIndicator";

const NOMINATION_OPTIONS = [
  "Брови — пудровое / градиент",
  "Брови — волоски (аппаратная)",
  "Брови — микроблейдинг",
  "Губы — акварель / помадный / омбрэ",
  "Латекс",
  "Стрелка с растушёвкой",
  "Ареола",
  "Перекрытие бровей",
];

const EMPTY_NOM: Nomination = { name: "", place1: 1, place2: 1, place3: 1 };

const defaultForm: EventCreate = {
  name: "",
  date: new Date().toISOString().slice(0, 10),
  country: "",
  region: "",
  warehouse: "Россия",
  recipients: "только победители",
  mode: "по номинациям",
  level: "Нормальный",
  grand_prix_count: 0,
  has_trade_booth: false,
  has_speaker_nonstop: false,
  has_speaker_stage: false,
  giveaways_count: 0,
  giveaway_mode: "одинаковые",
  participants_count: 0,
  nominations: [{ ...EMPTY_NOM }],
  participants_budget: 500,
  participants_use_certificate: false,
};

function CountryAutocomplete({
  value,
  onChange,
  onRegionResolved,
}: {
  value: string;
  onChange: (v: string) => void;
  onRegionResolved: (region: string) => void;
}) {
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.knowledge.countries().then(setAllCountries);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (v: string) => {
    onChange(v);
    if (v.length >= 2) {
      const lower = v.toLowerCase();
      setSuggestions(allCountries.filter((c) => c.toLowerCase().includes(lower)).slice(0, 8));
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const select = async (country: string) => {
    onChange(country);
    setOpen(false);
    try {
      const profile = await api.knowledge.countryProfile(country);
      onRegionResolved(profile.region);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={ref} className="relative">
      <input
        className="input"
        placeholder="Начни вводить страну..."
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => value.length >= 2 && setOpen(true)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white/95 backdrop-blur border border-black/10 rounded-xl shadow-lg mt-1 max-h-48 overflow-auto">
          {suggestions.map((c) => (
            <li
              key={c}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-luxe-grey hover:text-luxe-black"
              onMouseDown={() => select(c)}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NewEventPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<EventCreate>(defaultForm);
  const [resolvedRegion, setResolvedRegion] = useState("");
  const [calcLevels, setCalcLevels] = useState<CalcLevels | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetSlider, setBudgetSlider] = useState<number | null>(null);
  // Winners thresholds fixed at step-3 entry — never recomputed from participants slider
  const [winnersThresholds, setWinnersThresholds] = useState<{ normal: number; good: number } | null>(null);

  // Load existing event data in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      api.events.get(Number(id)).then((event) => {
        const nominations = (event.nominations_data ?? event.nominations ?? []) as Nomination[];
        setForm({
          name: event.name,
          date: event.date,
          country: event.country,
          region: event.region,
          warehouse: event.warehouse,
          recipients: event.recipients,
          mode: event.mode,
          level: event.level,
          grand_prix_count: event.grand_prix_count ?? 0,
          has_trade_booth: event.has_trade_booth ?? false,
          has_speaker_nonstop: event.has_speaker_nonstop ?? false,
          has_speaker_stage: event.has_speaker_stage ?? false,
          giveaways_count: event.giveaways_count,
          giveaway_mode: event.giveaway_mode ?? "одинаковые",
          participants_count: event.participants_count,
          nominations: nominations.length > 0 ? nominations : [{ ...EMPTY_NOM }],
          participants_budget: event.participants_budget ?? 500,
          participants_use_certificate: event.participants_use_certificate ?? false,
          total_budget: event.total_budget ?? undefined,
        });
        setResolvedRegion(event.region || "");
      });
    }
  }, [isEditMode, id]);

  const update = (patch: Partial<EventCreate>) => setForm((f) => ({ ...f, ...patch }));

  const updateNom = (i: number, patch: Partial<Nomination>) =>
    update({ nominations: form.nominations.map((n, idx) => (idx === i ? { ...n, ...patch } : n)) });

  const addNom = () => update({ nominations: [...form.nominations, { ...EMPTY_NOM }] });
  const removeNom = (i: number) =>
    update({ nominations: form.nominations.filter((_, idx) => idx !== i) });

  // Winners level thresholds — use frozen values from state (set once in goToStep3)
  // so moving the participants slider never affects winner level badge.
  const adjustedNormal = winnersThresholds?.normal ?? 0;
  const adjustedGood   = winnersThresholds?.good   ?? 0;

  const autoLevel = (budget: number): EventCreate["level"] => {
    if (budget < adjustedNormal) return "Скромный";
    if (budget < adjustedGood)   return "Нормальный";
    return "Хороший";
  };

  const sliderMax = Math.max(Math.ceil((adjustedGood * 2) / 5000) * 5000, 10000);

  const sliderValue = budgetSlider !== null ? budgetSlider : adjustedNormal;

  const currentLevel = autoLevel(sliderValue);

  // Sync form.level with slider-derived level whenever winners slider moves
  useEffect(() => {
    if (step === 3 && winnersThresholds) {
      const derived = autoLevel(sliderValue);
      if (form.level !== derived) {
        setForm((f) => ({ ...f, level: derived }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderValue, step, winnersThresholds]);

  const goToStep3 = async () => {
    setCalcLoading(true);
    try {
      const result = await api.calculator.calc({
        nominations: form.nominations,
        grand_prix_count: form.grand_prix_count,
        giveaways_count: form.giveaways_count,
        participants_count: form.participants_count,
      });
      setCalcLevels(result);
      // Freeze winners-only thresholds once (subtract participants cost computed at this moment)
      const partTotal = form.participants_count * (form.participants_budget ?? 500);
      const tNormal = Math.max(0, result["Нормальный"] - partTotal);
      const tGood   = Math.max(0, result["Хороший"]   - partTotal);
      setWinnersThresholds({ normal: tNormal, good: tGood });
      // In edit mode, restore slider to saved winners-only budget
      if (isEditMode && form.total_budget) {
        const savedWinnersOnly = Math.max(0, form.total_budget - partTotal);
        setBudgetSlider(savedWinnersOnly);
      } else {
        setBudgetSlider(tNormal);
      }
      setStep(3);
    } catch {
      setError("Ошибка расчёта");
    } finally {
      setCalcLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        region: resolvedRegion || form.region || undefined,
        // Only include participants cost when they actually receive gifts
        total_budget: sliderValue + (hasParticipants ? (form.participants_budget ?? 500) * form.participants_count : 0),
        participants_budget: form.participants_budget,
        participants_use_certificate: form.participants_use_certificate,
      };
      let event;
      if (isEditMode && id) {
        event = await api.events.update(Number(id), payload as EventCreate);
      } else {
        event = await api.events.create(payload as EventCreate);
      }
      await api.events.generate(event.id);
      navigate(`/events/${event.id}/draft`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
      setSaving(false);
    }
  };

  const levelBadgeColor = (l: string) => {
    if (l === "Скромный") return "bg-black/8 text-black/50 border border-black/10";
    if (l === "Нормальный") return "bg-luxe-silver text-black/70 border border-luxe-silver";
    return "bg-luxe-black text-white border border-luxe-black";
  };

  const formatRub = (n: number) => Math.round(n).toLocaleString("ru-RU");

  const winnerGiftCount =
    form.nominations.reduce((s, n) => s + n.place1 + n.place2 + n.place3, 0) +
    form.grand_prix_count +
    form.giveaways_count;

  const onlyParticipants = form.recipients === "только участникам";
  const hasParticipants = form.recipients.includes("участники");

  // sliderValue = WINNERS budget only.
  // participants are budgeted separately (form.participants_budget × form.participants_count).
  const participantsBudget = form.participants_budget ?? 500;
  const participantsTotal = form.participants_count * participantsBudget;
  const perGift = winnerGiftCount > 0 ? sliderValue / winnerGiftCount : 0;
  // Only include participants cost when they actually receive gifts
  const totalBudget = sliderValue + (hasParticipants ? participantsTotal : 0);
  const step1Valid = form.name.trim() && form.country.trim();
  const step2Valid =
    (onlyParticipants && form.participants_count > 0) ||
    (!onlyParticipants && form.nominations.some((n) => n.name && (n.place1 + n.place2 + n.place3 > 0)));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-xs tracking-widest uppercase text-luxe-grey-mid mb-1">Конструктор наборов</p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-luxe-black uppercase">
          {isEditMode ? "Редактирование" : "Новое мероприятие"}
        </h1>
      </div>

      <StepIndicator current={step} steps={["Параметры", "Призовая структура", "Уровень подарка"]} />

      {error && (
        <div className="mb-4 p-4 bg-black/5 border border-black/10 rounded-xl text-sm text-black/70">
          {error}
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="card space-y-4">
          <div>
            <label className="label">Название мероприятия *</label>
            <input
              className="input"
              placeholder="Чемпионат Москва 2025"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Дата *</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => update({ date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Склад отправки *</label>
              <select
                className="input"
                value={form.warehouse}
                onChange={(e) => update({ warehouse: e.target.value as "Россия" | "Европа" })}
              >
                <option>Россия</option>
                <option>Европа</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Страна проведения *</label>
            <CountryAutocomplete
              value={form.country}
              onChange={(v) => update({ country: v })}
              onRegionResolved={(r) => setResolvedRegion(r)}
            />
            {resolvedRegion && (
              <p className="text-xs text-luxe-black mt-1.5 font-medium">
                ✓ Регион определён: <span className="font-semibold">{resolvedRegion}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Режим подбора</label>
              <select
                className="input"
                value={form.mode}
                onChange={(e) => update({ mode: e.target.value as EventCreate["mode"] })}
              >
                <option value="по номинациям">По номинациям</option>
                <option value="универсальный">Универсальный</option>
              </select>
            </div>
            <div>
              <label className="label">Кому дарим</label>
              <select
                className="input"
                value={form.recipients}
                onChange={(e) => update({ recipients: e.target.value })}
              >
                <option value="только победители">Только победителям</option>
                <option value="победители + участники">Победители + участники</option>
                <option value="только участникам">Только участникам</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Организатор предоставляет:</label>
            <div className="flex flex-wrap gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-black"
                  checked={form.has_trade_booth}
                  onChange={(e) => update({ has_trade_booth: e.target.checked })}
                />
                <span className="text-sm">Торговая точка</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-black"
                  checked={form.has_speaker_nonstop}
                  onChange={(e) => update({ has_speaker_nonstop: e.target.checked })}
                />
                <span className="text-sm">Спикерское место нонстоп</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-black"
                  checked={form.has_speaker_stage}
                  onChange={(e) => update({ has_speaker_stage: e.target.checked })}
                />
                <span className="text-sm">Спикерское место на сцене</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              className="btn-primary"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              Далее →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="card space-y-4">
          {/* Гран-при */}
          <div className="flex items-center justify-between py-2 border-b border-black/6">
            <span className="text-sm font-medium text-gray-700">Гран-при</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/15 bg-white/70 text-black/70 hover:bg-white disabled:opacity-30 text-base font-bold"
                onClick={() => update({ grand_prix_count: Math.max(0, form.grand_prix_count - 1) })}
                disabled={form.grand_prix_count === 0}
              >
                −
              </button>
              <span className="text-sm font-medium w-6 text-center">{form.grand_prix_count}</span>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/15 bg-white/70 text-black/70 hover:bg-white disabled:opacity-30 text-base font-bold"
                onClick={() => update({ grand_prix_count: Math.min(3, form.grand_prix_count + 1) })}
                disabled={form.grand_prix_count >= 3}
              >
                +
              </button>
            </div>
          </div>

          {/* Розыгрыш */}
          <div className="py-2 border-b border-black/6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Розыгрыш</span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-black"
                  checked={form.giveaways_count > 0}
                  onChange={(e) => update({ giveaways_count: e.target.checked ? 1 : 0 })}
                />
                <span className="text-sm text-gray-600">Есть</span>
              </label>
            </div>
            {form.giveaways_count > 0 && (
              <div className="mt-3 pl-1 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-36">Количество подарков:</label>
                  <input
                    type="number"
                    min={1}
                    className="input w-20 text-center"
                    value={form.giveaways_count}
                    onChange={(e) => update({ giveaways_count: Math.max(1, Number(e.target.value)) })}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="flex gap-2">
                  {(["одинаковые", "разные"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`px-4 py-1.5 text-sm rounded-full border transition-all ${
                        form.giveaway_mode === mode
                          ? "border-luxe-black bg-luxe-black text-white"
                          : "border-luxe-silver bg-white/70 text-black/60 hover:border-black/40"
                      }`}
                      onClick={() => update({ giveaway_mode: mode })}
                    >
                      {mode === "одинаковые" ? "Одинаковые" : "Разные"}
                    </button>
                  ))}
                  {form.giveaway_mode === "разные" && (
                    <span className="text-xs text-black/30 self-center">разные наборы для каждого</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Участники */}
          {form.recipients.includes("участники") && (
            <div className="flex items-center justify-between py-2 border-b border-black/6">
              <span className="text-sm font-medium text-gray-700">Участники</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Количество:</label>
                <input
                  type="number"
                  min={0}
                  className="input w-20 text-center"
                  value={form.participants_count}
                  onChange={(e) => update({ participants_count: Number(e.target.value) })}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
          )}

          {/* Nominations — hidden when "только участникам" */}
          {!onlyParticipants && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Номинации</h3>
              <button className="btn-secondary text-xs" onClick={addNom}>
                + Добавить номинацию
              </button>
            </div>

            <div className="space-y-3">
              {form.nominations.map((nom, i) => (
                <div key={i} className="border border-black/8 rounded-xl p-3 bg-white/40">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <select
                        className="input mb-2"
                        value={nom.name}
                        onChange={(e) => updateNom(i, { name: e.target.value })}
                      >
                        <option value="">— выберите номинацию —</option>
                        {NOMINATION_OPTIONS.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        {([1, 2, 3] as const).map((place) => (
                          <div key={place}>
                            <label className="block text-xs text-gray-500 mb-1">
                              {place} место (кол-во)
                            </label>
                            <input
                              type="number"
                              min={0}
                              className="input text-center"
                              value={nom[`place${place}`]}
                              onChange={(e) =>
                                updateNom(i, { [`place${place}`]: Number(e.target.value) })
                              }
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {form.nominations.length > 1 && (
                      <button
                        className="text-red-400 hover:text-red-600 mt-1 text-lg leading-none"
                        onClick={() => removeNom(i)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )} {/* end !onlyParticipants */}

          <div className="flex justify-between pt-2">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              ← Назад
            </button>
            <button
              className="btn-primary"
              disabled={calcLoading || !step2Valid}
              onClick={goToStep3}
            >
              {calcLoading ? "Считаем..." : "Рассчитать →"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && calcLevels && (
        <div className="card overflow-hidden p-0">

          {/* ── SECTION 1: Winners ───────────────────────────────────── */}
          {!onlyParticipants && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Подарки победителям</h3>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${levelBadgeColor(currentLevel)}`}>
                  {currentLevel}
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={0}
                max={sliderMax}
                step={500}
                value={sliderValue}
                onChange={(e) => setBudgetSlider(Number(e.target.value))}
                className="w-full accent-black"
              />

              {/* Amount + gift count pill */}
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-3xl font-bold text-gray-900 tabular-nums">
                    {formatRub(sliderValue)} ₽
                  </div>
                  {winnerGiftCount > 0 && (
                    <div className="text-sm text-gray-500 mt-0.5">
                      {winnerGiftCount} подарков
                      {" · "}≈ <span className="font-medium text-gray-700">{formatRub(perGift)} ₽</span> каждый
                    </div>
                  )}
                </div>
              </div>

              {/* Zone color bar */}
              {(() => {
                const pctNormal = Math.min((adjustedNormal / sliderMax) * 100, 100);
                const pctGood   = Math.min((adjustedGood   / sliderMax) * 100, 100);
                const pctSlider = Math.min((sliderValue    / sliderMax) * 100, 100);
                return (
                  <div className="relative mt-1">
                    <div className="flex h-2.5 rounded-full overflow-hidden">
                      <div className="bg-gray-200"    style={{ width: `${pctNormal}%` }} />
                      <div className="bg-blue-300"    style={{ width: `${pctGood - pctNormal}%` }} />
                      <div className="bg-amber-300"   style={{ width: `${100 - pctGood}%` }} />
                    </div>
                    <div
                      className="absolute top-0 h-2.5 w-0.5 bg-gray-700 rounded"
                      style={{ left: `${pctSlider}%`, transform: "translateX(-50%)" }}
                    />
                    <div className="relative mt-1 h-4 text-xs text-gray-400">
                      {adjustedNormal > 0 && (
                        <span className="absolute -translate-x-1/2" style={{ left: `${pctNormal}%` }}>
                          {formatRub(adjustedNormal)}
                        </span>
                      )}
                      {adjustedGood > 0 && (
                        <span className="absolute -translate-x-1/2 text-amber-500" style={{ left: `${Math.min(pctGood, 88)}%` }}>
                          {formatRub(adjustedGood)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── SECTION 2: Participants ──────────────────────────────── */}
          {hasParticipants && (
            <div className={`p-5 space-y-4 ${!onlyParticipants ? "border-t border-black/8 bg-black/3" : ""}`}>
              <h3 className="font-semibold text-gray-800">Подарки участникам</h3>

              {/* Count + gift type in one row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Количество:</label>
                  <input
                    type="number"
                    min={0}
                    className="input w-20 text-center"
                    value={form.participants_count}
                    onChange={(e) => update({ participants_count: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="flex gap-2">
                  {([false, true] as const).map((isCert) => (
                    <button
                      key={String(isCert)}
                      type="button"
                      className={`px-3 py-1 text-sm rounded-full border transition-all ${
                        form.participants_use_certificate === isCert
                          ? "border-luxe-black bg-luxe-black text-white"
                          : "border-luxe-silver bg-white/70 text-black/60 hover:border-black/40"
                      }`}
                      onClick={() => update({ participants_use_certificate: isCert })}
                    >
                      {isCert ? "Сертификат" : "Физический подарок"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-participant budget slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min={200}
                  max={3000}
                  step={100}
                  value={participantsBudget}
                  onChange={(e) => update({ participants_budget: Number(e.target.value) })}
                  className="w-full accent-black"
                />
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formatRub(participantsBudget)} ₽
                  </div>
                  {form.participants_count > 0 && (
                    <div className="text-sm text-gray-500">
                      {form.participants_count} чел.
                      {" = "}
                      <span className="font-medium text-gray-700">{formatRub(participantsTotal)} ₽</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">стоимость на одного участника</div>
              </div>

              {/* Warning: physical gift minimum cost */}
              {!form.participants_use_certificate && participantsBudget < 1500 && form.participants_count > 0 && (
                <div className="text-xs text-black/60 bg-black/5 border border-black/10 rounded-xl px-3 py-2 leading-relaxed">
                  Минимальная стоимость физического подарка — около&nbsp;1&nbsp;400–1&nbsp;500&nbsp;₽
                  (1 пигмент + обязательные расходники). При бюджете ниже этой суммы набор всё равно
                  будет собран, но его фактическая стоимость превысит указанный лимит.
                  Рассмотри вариант <button
                    type="button"
                    className="underline font-medium"
                    onClick={() => update({ participants_use_certificate: true })}
                  >сертификата</button>.
                </div>
              )}
            </div>
          )}

          {/* ── SECTION 3: Total ────────────────────────────────────── */}
          <div className="border-t border-black/8 bg-black/3 px-5 py-4">
            <div className="space-y-1.5 text-sm">
              {!onlyParticipants && winnerGiftCount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Победители ({winnerGiftCount} шт.)</span>
                  <span className="tabular-nums">{formatRub(sliderValue)} ₽</span>
                </div>
              )}
              {hasParticipants && form.participants_count > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Участники ({form.participants_count} чел.)</span>
                  <span className="tabular-nums">{formatRub(participantsTotal)} ₽</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1.5 border-t border-gray-200 mt-1">
                <span>Итого</span>
                <span className="tabular-nums">
                  {formatRub(onlyParticipants ? participantsTotal : totalBudget)} ₽
                </span>
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="px-5 pb-5 pt-3 space-y-3">
            {resolvedRegion && (
              <div className="text-xs text-black/50 bg-black/4 rounded-xl px-3 py-2 border border-black/8">
                {form.country} → <strong>{resolvedRegion}</strong>
                {" · "}подбор пигментов под местный цветотип
              </div>
            )}
            <div className="flex justify-between">
              <button className="btn-secondary" onClick={() => setStep(2)}>
                ← Назад
              </button>
              <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
                {saving
                  ? "Сохраняем..."
                  : isEditMode
                  ? "Сохранить изменения →"
                  : "Создать и сформировать набор →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
