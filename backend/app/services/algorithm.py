"""
Pigment selection algorithm for gift set assembly.
All selection rules are derived from База_знаний_FACE_v7.xlsx and ТЗ_FACE_Gift_System.docx.

EU warehouse logic is intentionally disabled — it will be implemented as a separate
algorithm in a future iteration.
"""
from typing import Optional, List
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..models import Pigment, Consumable
from .countries import fitzpatrick_overlaps

# Nomination name → required pigment line(s) (None = flexible)
NOMINATION_LINES: dict[str, list[str]] = {
    "Брови — пудровое / градиент":        ["Базовая (гибрид)", "Минералы"],
    "Брови — волоски (аппаратная)":       ["Минералы"],
    "Брови — микроблейдинг":              ["Organic brows"],
    "Губы — акварель / помадный / омбрэ": ["Organic love", "Базовая линия"],
    "Латекс":                             ["Organic love", "Базовая линия", "Базовая (гибрид)", "Минералы"],
    "Стрелка с растушёвкой":              ["Базовая линия (веки)"],
    "Ареола":                             [],
    "Перекрытие бровей":                  ["Базовая (гибрид)", "Organic brows"],
}

# Region → preferred pigment names for brows (ordered by priority)
REGION_BROW_PRIORITY: dict[str, list[str]] = {
    "Россия":           ["Лайт", "Медиум", "Орех", "Мокко", "Дарк", "Корица"],
    "СНГ":              ["Орех", "Лайт", "Медиум", "Мокко", "Корина"],
    "Кавказ":           ["Орех", "Мокко", "Медиум", "Дарк", "Корица"],
    "Центральная Азия": ["Мокко", "Эспрессо", "Дарк", "Бронза", "Киану", "Серкан"],
    "Турция":           ["Киану", "Питт", "Мокко", "Дарк", "Серкан"],
    "Балканы":          ["Орех", "Мокко", "Медиум", "Дарк"],
    "Западная Европа":  ["Блонд", "Песочный", "Лайт", "Орех", "Медиум"],
    "Ближний Восток":   ["Киану", "Питт", "Серкан", "Мокко", "Дарк"],
    "ЮВА":              ["Мокко", "Эспрессо", "Дарк", "Киану", "Серкан"],
    "Южная Азия":       ["Эспрессо", "Дарк", "Киану", "Блэк Браун", "Серкан"],
    "Восточная Азия":   ["Мокко", "Эспрессо", "Дарк", "Блэк Браун", "Киану"],
    "Латинская Америка": ["Эспрессо", "Мокко", "Дарк", "Медиум", "Корица"],
    "Северная Америка": ["Орех", "Медиум", "Мокко", "Лайт", "Эспрессо"],
    "Африка":           ["Эспрессо", "Дарк", "Блэк Браун", "Киану"],
    # legacy keys
    "Россия / СНГ":         ["Лайт", "Медиум", "Орех", "Мокко", "Дарк", "Корица"],
    "Казахстан / Ср. Азия": ["Мокко", "Эспрессо", "Дарк", "Бронза", "Кирпичный", "Киану", "Серкан"],
    "Балканы / Турция":     ["Орех", "Мокко", "Медиум", "Дарк"],
    "Юго-Восточная Азия":   ["Мокко", "Эспрессо", "Дарк", "Киану", "Серкан"],
}

# Region → preferred pigment names for lips
REGION_LIP_PRIORITY: dict[str, list[str]] = {
    "Россия":           ["Сахар", "Нуар", "Виктория", "Джоли"],
    "СНГ":              ["Сахар", "Джоли", "Виктория", "Румянец"],
    "Кавказ":           ["Джоли", "Румянец", "Карамель", "Беллуччи"],
    "Центральная Азия": ["Ириска", "Ласт лав", "Клубника", "Пэрис"],
    "Турция":           ["Ириска", "Ласт лав", "Беллуччи", "Меган"],
    "Балканы":          ["Джоли", "Румянец", "Карамель", "Беллуччи"],
    "Западная Европа":  ["Щербет", "Кварц", "Марсала", "Вишня"],
    "Ближний Восток":   ["Ириска", "Ласт лав", "Беллуччи", "Меган"],
    "ЮВА":              ["Меган", "Пэрис", "Клубника", "Чили", "Ириска"],
    "Южная Азия":       ["Чили", "Меган", "Клубника", "Гранат"],
    "Восточная Азия":   ["Меган", "Пэрис", "Клубника", "Чили"],
    "Латинская Америка": ["Карамель", "Джоли", "Клубника", "Меган"],
    "Северная Америка": ["Джоли", "Карамель", "Клубника", "Виктория"],
    "Африка":           ["Чили", "Клубника", "Меган", "Гранат"],
    # legacy keys
    "Россия / СНГ":         ["Сахар", "Нуар", "Виктория", "Джоли"],
    "Казахстан / Ср. Азия": ["Ириска", "Ласт лав", "Клубника", "Пэрис"],
    "Балканы / Турция":     ["Джоли", "Румянец", "Карамель", "Беллуччи"],
    "Юго-Восточная Азия":   ["Меган", "Пэрис", "Клубника", "Чили", "Ириска"],
}

# Priority order for sorting pigments.
# "продвигаем" намеренно приравнен к "стандарт" — ручная приоритизация будет в UI каталога.
PRIORITY_ORDER = {"новинка": 0, "стандарт": 1, "продвигаем": 1, "выводим": 2}


def _get_db_rankings(db: Session, region: str, zone: str) -> List[int]:
    """Returns list of pigment_ids sorted by rank. Empty if no data."""
    from ..models import RegionRanking
    from .countries import SIMILAR_REGIONS

    rankings = db.query(RegionRanking).filter(
        RegionRanking.region == region,
        RegionRanking.zone == zone,
    ).order_by(RegionRanking.rank).all()

    if not rankings:
        similar = SIMILAR_REGIONS.get(region)
        if similar:
            rankings = db.query(RegionRanking).filter(
                RegionRanking.region == similar,
                RegionRanking.zone == zone,
            ).order_by(RegionRanking.rank).all()

    return [r.pigment_id for r in rankings]


PROMOTED_PRIORITIES = {"новинка"}  # "продвигаем" — regional, controlled via PigmentSettings


def _sort_pigments(pigments: list, preferred_names: list[str]) -> list:
    def key(p: Pigment):
        prio = PRIORITY_ORDER.get(p.priority or "стандарт", 1)
        try:
            name_rank = preferred_names.index(p.name)
        except ValueError:
            name_rank = len(preferred_names)
        return (prio, name_rank)
    return sorted(pigments, key=key)


def _sort_pigments_by_ids(pigments: list, ranked_ids: List[int]) -> list:
    """Sort pigments so ranked IDs come first (in rank order), unranked after."""
    ranked_set = set(ranked_ids)
    id_to_rank = {pid: i for i, pid in enumerate(ranked_ids)}

    ranked = [p for p in pigments if p.id in ranked_set]
    unranked = [p for p in pigments if p.id not in ranked_set]

    ranked.sort(key=lambda p: id_to_rank[p.id])
    return ranked + unranked


def _get_promoted_ids(db: Session, region: Optional[str] = None) -> set:
    """
    Возвращает множество pigment_id, которые «продвигаются» для данного региона.

    Логика (как в каталоге):
      1. Берём глобальные настройки (region IS NULL) как базу.
      2. Накладываем поверх region-специфичные настройки (они перекрывают глобальные).
      3. Возвращаем все pigment_id, где итоговое is_promoted = True.

    Если region=None — возвращаем только глобальные promoted.
    """
    from ..models import PigmentSettings
    promoted_map: dict = {}

    # Global settings
    global_rows = db.query(PigmentSettings).filter(
        PigmentSettings.region == None  # noqa: E711
    ).all()
    for s in global_rows:
        promoted_map[s.pigment_id] = s.is_promoted

    # Region-specific override
    if region:
        region_rows = db.query(PigmentSettings).filter(
            PigmentSettings.region == region
        ).all()
        for s in region_rows:
            promoted_map[s.pigment_id] = s.is_promoted

    return {pid for pid, promoted in promoted_map.items() if promoted}


def _sort_with_promotion(
    pigments: list,
    preferred_names: list[str],
    ranked_ids: Optional[List[int]] = None,
    promoted_ids: Optional[set] = None,
) -> list:
    """
    Сортировка с учётом продвижения.

    Пигменты идут в таком порядке:
      1. Отмечены как «продвигаем» в настройках (is_promoted) ИЛИ
         имеют priority «новинка» / «продвигаем» — отсортированные по ранкингу/именам.
      2. Все остальные — также отсортированные.

    Фицпатрик-фильтр применяется ДО этой функции.
    """
    def _is_promoted(p) -> bool:
        if promoted_ids is not None and p.id in promoted_ids:
            return True
        return (p.priority or "") in PROMOTED_PRIORITIES

    promoted = [p for p in pigments if _is_promoted(p)]
    regular  = [p for p in pigments if not _is_promoted(p)]

    def _sort_group(group: list) -> list:
        if not group:
            return group
        if ranked_ids:
            return _sort_pigments_by_ids(group, ranked_ids)
        return _sort_pigments(group, preferred_names)

    return _sort_group(promoted) + _sort_group(regular)


def select_brow_pigments(
    db: Session,
    nomination_name: str,
    region: str,
    count: int,
    warehouse: str = "Россия",  # EU filtering deferred — param kept for API compatibility
    include_correctors: bool = False,
    fitz_min: int = 1,
    fitz_max: int = 6,
    variant: int = 0,
) -> list:
    lines = NOMINATION_LINES.get(nomination_name, ["Базовая (гибрид)", "Минералы"])

    # Narrow lines based on region/nomination
    if len(lines) > 1 and ("Ближний Восток" in region or "Юго-Восточная Азия" in region or "ЮВА" in region):
        lines = ["Organic brows"]
    elif len(lines) > 1 and nomination_name == "Брови — пудровое / градиент":
        # Russia/Europe/Balkans/North America → Минералы; otherwise Базовая (гибрид)
        if any(r in region for r in ["Россия", "Западная Европа", "Балканы", "Северная Америка"]):
            lines = ["Минералы"]
        else:
            lines = [lines[0]]
    elif len(lines) > 1:
        lines = [lines[0]]

    query = db.query(Pigment).filter(
        Pigment.zone == "Брови",
        Pigment.line.in_(lines),
        Pigment.is_corrector == False,
        Pigment.is_mini == False,
        or_(Pigment.volume_ml == None, Pigment.volume_ml != "12мл"),  # noqa: E711
    )

    all_candidates = query.all()
    candidates = [p for p in all_candidates if fitzpatrick_overlaps(p.fitzpatrick, fitz_min, fitz_max)]
    if not candidates:
        candidates = all_candidates  # fallback: use all

    ranked_ids = _get_db_rankings(db, region, "Брови")
    preferred = REGION_BROW_PRIORITY.get(region, [])
    promoted_ids = _get_promoted_ids(db, region)
    sorted_pigments = _sort_with_promotion(candidates, preferred, ranked_ids or None, promoted_ids)

    bases = [p for p in sorted_pigments if p.role == "база"]
    mods = [p for p in sorted_pigments if p.role == "модификатор"]

    result = []
    result.extend(bases[:max(1, count - 1)])
    if len(result) < count and mods:
        result.append(mods[0])

    if include_correctors and len(result) < count:
        corr_query = db.query(Pigment).filter(
            Pigment.zone == "Брови",
            Pigment.line.in_(lines),
            Pigment.is_corrector == True,
            Pigment.is_mini == False,
            or_(Pigment.volume_ml == None, Pigment.volume_ml != "12мл"),  # noqa: E711
        )
        correctors = [p for p in corr_query.all()
                      if fitzpatrick_overlaps(p.fitzpatrick, fitz_min, fitz_max)]
        result.extend(correctors[:count - len(result)])

    return result[:count]


def select_lip_pigments(
    db: Session,
    region: str,
    count: int,
    warehouse: str = "Россия",  # EU filtering deferred
    fitz_min: int = 1,
    fitz_max: int = 6,
    variant: int = 0,
) -> list:
    query = db.query(Pigment).filter(
        Pigment.zone == "Губы",
        Pigment.is_corrector == False,
        Pigment.is_mini == False,
        or_(Pigment.volume_ml == None, Pigment.volume_ml != "12мл"),  # noqa: E711
    )

    all_candidates = query.all()
    candidates = [p for p in all_candidates if fitzpatrick_overlaps(p.fitzpatrick, fitz_min, fitz_max)]
    if not candidates:
        candidates = all_candidates

    ranked_ids = _get_db_rankings(db, region, "Губы")
    preferred = REGION_LIP_PRIORITY.get(region, ["Джоли", "Карамель", "Виктория", "Сахар"])
    promoted_ids = _get_promoted_ids(db, region)
    sorted_pigments = _sort_with_promotion(candidates, preferred, ranked_ids or None, promoted_ids)

    return sorted_pigments[:count]


def select_eye_pigments(db: Session, count: int, warehouse: str = "Россия") -> list:
    """
    Eye liner (Стрелка с растушёвкой):
    - 1 пигмент  → Космос
    - 2 пигмента → Космос + Уголь
    - 3 пигмента → Космос + Уголь + Кирпичный
    - 4 пигмента → Космос + Уголь + Кирпичный + Серкан
    - 5 пигментов → Космос + Уголь + Кирпичный + Серкан + Джонни
    """
    ordered_names = ["Космос", "Уголь", "Кирпичный", "Серкан", "Джонни"]
    result = []
    for name in ordered_names:
        if len(result) >= count:
            break
        p = db.query(Pigment).filter(Pigment.name == name, Pigment.is_mini == False).first()
        if p:
            result.append(p)
    return result[:count]


# Фиксированное количество оттенков по месту.
# Сэмпл = 3 оттенка. Полноразмерных пигментов = shade_count - 3 (если есть сэмпл).
PLACE_SHADE_COUNT: dict = {
    "1":        5,   # сэмпл(3) + 2 пигмента (или 5 без сэмпла)
    "2":        4,   # сэмпл(3) + 1 пигмент  (или 4 без сэмпла)
    "3":        3,   # только сэмпл(3)         (или 3 без сэмпла)
    "розыгрыш": 4,   # как 2-е место
    "участник": 1,
    "гран-при": 6,   # GP — отдельная логика в draft.py
}

# Обязательные расходники — входят в КАЖДЫЙ подарок независимо от уровня.
# Формат: (название, кол-во).
MANDATORY_CONSUMABLES = [
    ("Уходовые салфетки с хлоргексидином (10шт)", 1),   # 100р, уход/гигиена
    ("Заживляющий гель саше 5г (1 шт)",            5),   # 19р × 5 шт
]

# Допуск на небольшое превышение бюджета — последняя добавленная позиция (пигмент
# или расходник) может слегка вылезти за рамки. Лучше, чем останавливаться сильно
# не доходя до выделенной суммы.
BUDGET_OVERSHOOT = 1.15


def _mandatory_consumables_total(db: Session) -> float:
    from ..models import Consumable as C
    total = 0.0
    for name, qty in MANDATORY_CONSUMABLES:
        obj = db.query(C).filter(C.name == name).first()
        if obj:
            total += (obj.price_ru or 0) * qty
    return total


def _get_fixed_consumables(db: Session, leftover_budget: Optional[float], zone: str = "") -> list:
    """
    Возвращает расходники для подарка в виде списка (Consumable, qty):
    1. Всегда: салфетки (10шт×1) + саше 5г (5шт) — обязательный минимум
       (их стоимость уже зарезервирована заранее, в leftover_budget не входит).
    2. Дополнительно: высокоприоритетные расходники (gift_priority='высокий'),
       добавляются по одному, ПОКА ХВАТАЕТ leftover_budget (с допуском
       BUDGET_OVERSHOOT на последнюю позицию). leftover_budget=None — без
       ограничения (добавляем до 4 позиций, как раньше при максимальном уровне).
       Не более 1 позиции из одной категории.
       Категории «Сеты» и «Сэмплы» исключаются.

    Правила зональной фильтрации дополнительных позиций:
      - Загуститель (Сатин): только Губы
      - Разбавитель:         Все зоны
      - Кисти:               только Брови
      - Вторичка ICE Gel:    Все зоны (идёт первой)
    """
    from ..models import Consumable as C

    result: list = []
    mandatory_ids: set = set()

    # --- 1. Обязательные позиции (зону не проверяем) ---
    for name, qty in MANDATORY_CONSUMABLES:
        obj = db.query(C).filter(C.name == name).first()
        if obj:
            result.append((obj, qty))
            mandatory_ids.add(obj.id)

    # --- 2. Дополнительные высокоприоритетные — жадно, в рамках leftover_budget ---
    EXCLUDED_CATEGORIES = {"Сеты", "Сэмплы"}
    zone_lower = zone.lower()

    def _zone_ok(c: C) -> bool:
        cz = (c.zone or "").lower()
        if not cz:
            return True
        if "все" in cz:
            return True
        return zone_lower in cz

    high = db.query(C).filter(C.gift_priority == "высокий").all()
    high = [
        c for c in high
        if c.id not in mandatory_ids
        and (c.category or "") not in EXCLUDED_CATEGORIES
        and _zone_ok(c)
    ]
    # Вторичка (Анестезия) — первой, затем по цене (дешёвые вперёд)
    high.sort(key=lambda c: (
        0 if (c.category or "") == "Анестезия" else 1,
        c.price_ru or 9999,
    ))

    budget_cap = leftover_budget * BUDGET_OVERSHOOT if leftover_budget is not None else None

    # Не более 1 позиции из одной категории; добавляем, пока хватает бюджета
    seen_cats: set = set()
    selected: list = []
    spent = 0.0
    MAX_EXTRAS = 4
    for c in high:
        if len(selected) >= MAX_EXTRAS:
            break
        cat = c.category or ""
        if cat in seen_cats:
            continue
        price = c.price_ru or 0
        if budget_cap is not None and spent + price > budget_cap:
            continue
        seen_cats.add(cat)
        selected.append(c)
        spent += price

    result.extend((c, 1) for c in selected)

    return result


def select_items_for_budget(
    db: Session,
    budget: int,
    zone: str,
    region: str,
    nomination_name: str,
    fitz_min: int = 1,
    fitz_max: int = 6,
    warehouse: str = "Россия",
    include_samples: bool = True,
    place: Optional[str] = None,
    variant: int = 0,
) -> dict:
    """
    Подбор подарка по месту/бюджету.

    Единая жадная логика для ВСЕХ зон (Брови/Губы/Веки/смешанные): идём по
    кандидатам-оттенкам в порядке приоритета и для каждого пробуем сначала
    добавить ПОЛНОРАЗМЕРНЫЙ пигмент; если бюджет не тянет — добавляем тот же
    оттенок МИНИ-версией (дешевле, см. Pigment.is_mini в каталоге — замена
    бумажным наборам сэмплов отдельными позициями). Это именно то, для чего
    раньше служили наборы сэмплов: растянуть бюджет на большее число разных
    оттенков вместо одного дорогого набора. Останавливаемся по бюджету места
    (place) или по потолку числа оттенков из PLACE_SHADE_COUNT.

    Returns {"pigments": [...], "consumables": [...], "samples": []}
    (ключ "samples" сохранён для обратной совместимости вызовов — мини-пигменты
    теперь идут в "pigments" вместе с полноразмерными)
    """
    is_russia_region = "Россия" in region or "СНГ" in region
    # Потолок по количеству оттенков для этого места; без явного места — мягкий потолок.
    place_cap = PLACE_SHADE_COUNT.get(place, 6) if place else 6

    # --- 1. Пигменты-кандидаты (полноразмерные, по приоритету региона/линии) ---
    if zone == "Брови":
        candidates = select_brow_pigments(
            db, nomination_name, region, count=12,
            warehouse=warehouse, fitz_min=fitz_min, fitz_max=fitz_max, variant=variant,
        )
    elif zone == "Губы":
        candidates = select_lip_pigments(
            db, region, count=12,
            warehouse=warehouse, fitz_min=fitz_min, fitz_max=fitz_max, variant=variant,
        )
    elif zone == "Веки":
        candidates = select_eye_pigments(db, count=5, warehouse=warehouse)
    else:
        lip_c = select_lip_pigments(db, region, count=6,
                                    warehouse=warehouse, fitz_min=fitz_min, fitz_max=fitz_max,
                                    variant=variant)
        brow_c = select_brow_pigments(db, nomination_name, region, count=6,
                                      warehouse=warehouse, fitz_min=fitz_min, fitz_max=fitz_max,
                                      variant=variant)
        candidates = lip_c + brow_c

    # Вариант: сдвигаем пул кандидатов, чтобы появились другие пигменты.
    if variant > 0 and candidates:
        shift = variant % max(1, len(candidates))
        candidates = candidates[shift:] + candidates[:shift]

    # --- 2. Мини-версии тех же оттенков (если есть в каталоге для региона РФ/СНГ) ---
    minis_by_name: dict = {}
    if include_samples and is_russia_region:
        names = [p.name for p in candidates if p.name]
        if names:
            mini_rows = db.query(Pigment).filter(
                Pigment.name.in_(names), Pigment.is_mini == True,  # noqa: E712
            ).all()
            minis_by_name = {p.name: p for p in mini_rows}

    # --- 3. Жадно наполняем оттенки в рамках бюджета на это место ---
    mandatory_total = _mandatory_consumables_total(db)
    remaining = max(0.0, (budget or 0) - mandatory_total) if budget is not None else None
    budget_cap = remaining * BUDGET_OVERSHOOT if remaining is not None else None

    pigments: list = []
    spent = 0.0
    shade_count = 0

    for cand in candidates:
        if shade_count >= place_cap:
            break
        full_price = cand.price_ru or 0
        if budget_cap is None or spent + full_price <= budget_cap:
            pigments.append(cand)
            spent += full_price
            shade_count += 1
            continue
        mini = minis_by_name.get(cand.name)
        if mini is not None and (budget_cap is None or spent + (mini.price_ru or 0) <= budget_cap):
            pigments.append(mini)
            spent += mini.price_ru or 0
            shade_count += 1

    # Подарок без единого пигмента — не вариант, даже если бюджет совсем
    # тонкий: если ничего не влезло, берём самый дешёвый доступный вариант
    # (мини, если есть, иначе полный) — даже с небольшим превышением бюджета.
    # Применяется одинаково для всех зон/мест: при совсем тонком бюджете
    # подарки на разных местах могут совпасть по цене (бюджет не позволяет
    # различие), но порядок никогда не инвертируется.
    if not pigments and candidates:
        options = []
        for cand in candidates:
            options.append((cand.price_ru or 0, cand))
            mini = minis_by_name.get(cand.name)
            if mini is not None:
                options.append((mini.price_ru or 0, mini))
        price, obj = min(options, key=lambda o: o[0])
        pigments.append(obj)
        spent += price

    # --- 4. Расходники — жадно, в рамках оставшегося после пигментов бюджета ---
    leftover = max(0.0, remaining - spent) if remaining is not None else None
    consumables = _get_fixed_consumables(db, leftover, zone)

    return {"pigments": pigments, "consumables": consumables, "samples": []}


def select_consumables(
    db: Session,
    level: str,
    zone: str,
    warehouse: str = "Россия",
    region: Optional[str] = None,
) -> list:
    """
    Логика отбора расходников.
    Цель — больше позиций при равном бюджете:
    - внутри каждого приоритета сначала мини-версии
    - не допускаем монополии высокоприоритетных позиций
    - уважаем ConsumableSettings (is_hidden, gift_priority_override, sort_order)
    """
    from ..models import ConsumableSettings

    all_consumables = db.query(Consumable).all()
    zone_lower = zone.lower() if zone else ""

    # Build settings lookup if region is provided
    settings_map: dict[int, ConsumableSettings] = {}
    if region:
        region_settings = (
            db.query(ConsumableSettings)
            .filter(ConsumableSettings.region == region)
            .all()
        )
        global_settings = (
            db.query(ConsumableSettings)
            .filter(ConsumableSettings.region == None)
            .all()
        )
        for s in global_settings:
            settings_map[s.consumable_id] = s
        for s in region_settings:
            settings_map[s.consumable_id] = s

    def zone_match(c: Consumable) -> bool:
        if not c.zone:
            return True
        z = c.zone.lower()
        return "все" in z or zone_lower in z

    def is_visible(c: Consumable) -> bool:
        s = settings_map.get(c.id)
        if s and s.is_hidden:
            return False
        return True

    def effective_priority(c: Consumable) -> str:
        s = settings_map.get(c.id)
        if s and s.gift_priority_override:
            return s.gift_priority_override
        return c.gift_priority or "средний"

    def effective_sort_order(c: Consumable) -> int:
        s = settings_map.get(c.id)
        if s:
            return s.sort_order
        return 0

    # "Сеты" (full pigment sets) and "Сэмплы" (mini sample kits) are handled by
    # dedicated code paths (_get_grand_prix_sets / samples path in select_items_for_budget).
    # Exclude them here so they never compete with real consumables.
    EXCLUDED_CATEGORIES = {"Сеты", "Сэмплы"}
    pool = [c for c in all_consumables
            if zone_match(c) and is_visible(c) and (c.category or "") not in EXCLUDED_CATEGORIES]

    # Внутри тира: sort_order first, then мини-версии, then by descending price
    def tier_sort(c: Consumable):
        return (effective_sort_order(c), 0 if c.has_mini else 1, -(c.price_ru or 0))

    high = sorted([c for c in pool if effective_priority(c) == "высокий"], key=tier_sort)
    medium = sorted([c for c in pool if effective_priority(c) == "средний"], key=tier_sort)

    if level == "Скромный":
        h = high[:1]
        m = [c for c in medium if c not in h][:1]
        return h + m

    if level == "Нормальный":
        h = high[:1]
        m = [c for c in medium if c not in h][:2]
        return h + m

    if level == "Хороший":
        h = high[:1]
        m = [c for c in medium if c not in h][:3]
        return h + m

    # Гран-при / Розыгрыш
    h = high[:2]
    m = [c for c in medium if c not in h][:3]
    picks = h + m
    remover = db.query(Consumable).filter(Consumable.name.ilike("%Ремувер%")).first()
    if remover and remover not in picks:
        picks.append(remover)
    return picks
