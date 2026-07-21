import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..models import Pigment, Consumable, Nomination, PigmentSettings


def _next_pigment_number(db: Session) -> int:
    return (db.query(func.max(Pigment.number)).scalar() or 0) + 1

import os
from pathlib import Path

# Excel file lives in backend/data/ relative to this file's location
_HERE = Path(__file__).parent.parent.parent  # backend/
XLSX_PATH = str(_HERE / "data" / "База_знаний_FACE_v7.xlsx")


def _clean(val):
    if pd.isna(val):
        return None
    s = str(val).strip()
    return None if s in ("", "nan", "NaN") else s


def _bool_cell(val):
    s = _clean(val)
    if s is None:
        return False
    return s in ("✓", "да", "true", "True", "1")


def seed_pigments(db: Session) -> int:
    df = pd.read_excel(XLSX_PATH, sheet_name="Пигменты", header=1)
    df = df.dropna(subset=[df.columns[0]])
    count = 0
    for _, row in df.iterrows():
        try:
            num = int(row.iloc[0])
        except (ValueError, TypeError):
            continue
        existing = db.query(Pigment).filter(Pigment.number == num).first()
        if existing:
            continue
        p = Pigment(
            number=num,
            zone=_clean(row.iloc[1]),
            line=_clean(row.iloc[2]),
            name=_clean(row.iloc[3]),
            temperature=_clean(row.iloc[4]),
            saturation=_clean(row.iloc[5]),
            role=_clean(row.iloc[6]),
            fitzpatrick=_clean(row.iloc[7]),
            is_corrector=_clean(row.iloc[8]) == "да",
            geo_europe=_bool_cell(row.iloc[9]),
            geo_asia=_bool_cell(row.iloc[10]),
            priority=_clean(row.iloc[11]),
            price_ru=float(row.iloc[12]) if pd.notna(row.iloc[12]) else None,
            price_eu=float(row.iloc[13]) if pd.notna(row.iloc[13]) else None,
            recommended_mixes=_clean(row.iloc[14]),
            notes=_clean(row.iloc[15]),
        )
        db.add(p)
        count += 1
    db.commit()
    return count


def seed_consumables(db: Session) -> int:
    df = pd.read_excel(XLSX_PATH, sheet_name="Расходники и сеты", header=1)
    df = df.dropna(subset=[df.columns[0]])
    count = 0
    for _, row in df.iterrows():
        try:
            num = int(row.iloc[0])
        except (ValueError, TypeError):
            continue
        existing = db.query(Consumable).filter(Consumable.number == num).first()
        if existing:
            continue

        priority_raw = _clean(row.iloc[7])
        if priority_raw:
            p = priority_raw.lower()
            if "высок" in p:
                priority = "высокий"
            elif "средн" in p:
                priority = "средний"
            else:
                priority = "низкий"
        else:
            priority = "средний"

        c = Consumable(
            number=num,
            name=_clean(row.iloc[1]),
            category=_clean(row.iloc[2]),
            zone=_clean(row.iloc[3]),
            price_ru=float(row.iloc[4]) if pd.notna(row.iloc[4]) else None,
            price_eu=float(row.iloc[5]) if pd.notna(row.iloc[5]) else None,
            has_mini=_clean(row.iloc[6]) == "да",
            gift_priority=priority,
            notes=_clean(row.iloc[8]),
        )
        db.add(c)
        count += 1
    db.commit()
    return count


# Канонические названия линий — раньше одна и та же линия называлась
# по-разному в зависимости от зоны (см. LINE_RENAMES), что путало и
# объёмные тиры (часть позиций молчаливо выпадала), и потенциально подбор
# пигментов по линии. Реально линий всего три: Базовая (гибрид) /
# Органическая линия / Минералы.
HYBRID_LINE = "Базовая (гибрид)"
ORGANIC_LINE = "Органическая линия"
MINERAL_LINE = "Минералы"

LINE_RENAMES = {
    "Organic love": ORGANIC_LINE,
    "Organic brows": ORGANIC_LINE,
    "Базовая линия": HYBRID_LINE,
    "Базовая линия (веки)": HYBRID_LINE,
}


def seed_normalize_lines(db: Session) -> int:
    """Сводит исторически разные названия одной и той же линии к одному каноническому."""
    count = 0
    for old_name, new_name in LINE_RENAMES.items():
        rows = db.query(Pigment).filter(Pigment.line == old_name).all()
        for p in rows:
            p.line = new_name
            count += 1
    db.commit()
    return count


# Оттенки, для которых заводим мини-версию (замена бумажным наборам сэмплов —
# теперь каждый мини-оттенок отдельная позиция в каталоге, тот же цвет, другой
# объём — 3мл). Цена мини всегда производная от текущей цены полноразмерного
# (small/6мл) пигмента того же оттенка — половина цены, округлённая до 5₽.
MINI_SHADE_NAMES = [
    "Голд", "Медиум", "Дарк", "Орех", "Джонни", "Эспрессо",
    "Сахар", "Джоли", "Меган", "Виктория", "Нуар", "Космос",
    "Дженнифер", "Тайра", "Мокко", "Корица", "Карамель", "Шейк",
    "Ворм", "Лайт", "Кирпичный", "Вишня",
]
MINI_VOLUME = "3мл"
# Цены, которыми мини-пигменты были засеяны ДО перехода на формулу
# «половина цены полноразмерного» — используются только чтобы один раз
# поправить уже существующие строки, не трогая ручные правки админа позже.
_LEGACY_MINI_PRICES = {650.0, 800.0}


def _mini_price_for(parent: Pigment) -> float:
    base = parent.price_ru or 0
    return round(base / 2 / 5) * 5  # округление до 5₽


def seed_mini_pigments(db: Session) -> int:
    count = 0
    next_number = _next_pigment_number(db)
    for name in MINI_SHADE_NAMES:
        parent = (
            db.query(Pigment)
            .filter(Pigment.name == name, Pigment.is_mini == False)  # noqa: E712
            .filter((Pigment.volume_ml == None) | (Pigment.volume_ml == "6мл"))  # noqa: E711
            .first()
        )
        if not parent:
            continue

        existing = db.query(Pigment).filter(Pigment.name == name, Pigment.is_mini == True).first()  # noqa: E712
        if existing:
            # Одноразовая правка цены для строк, засеянных по старой (фиксированной) схеме.
            if existing.price_ru in _LEGACY_MINI_PRICES:
                existing.price_ru = _mini_price_for(parent)
            if not existing.volume_ml:
                existing.volume_ml = MINI_VOLUME
            continue

        mini = Pigment(
            number=next_number,
            zone=parent.zone,
            line=parent.line,
            name=parent.name,
            temperature=parent.temperature,
            saturation=parent.saturation,
            role=parent.role,
            fitzpatrick=parent.fitzpatrick,
            is_corrector=parent.is_corrector,
            geo_europe=parent.geo_europe,
            geo_asia=parent.geo_asia,
            priority=parent.priority,
            price_ru=_mini_price_for(parent),
            price_eu=None,
            recommended_mixes=parent.recommended_mixes,
            notes="Мини-объём (сэмпл)",
            is_mini=True,
            volume_ml=MINI_VOLUME,
        )
        db.add(mini)
        count += 1
        next_number += 1
    db.commit()
    return count


# Линии, для которых ведём два объёма (6мл / 12мл) — теперь все три реальные
# линии, не только гибрид/органика. Формат: line -> (small_price, large_price).
# Гибрид/органика: старая единая цена 1290₽ поднята один раз до 1490₽ (small),
# добавлена новая позиция 2290₽ (large). Минералы: цена 6мл НЕ менялась
# (1590₽, как и раньше) — добавляется только новая позиция 12мл, по той же
# пропорции small->large, что и у гибрида/органики (×2290/1490).
_MINERAL_LARGE = round(1590.0 * 2290.0 / 1490.0 / 10) * 10  # ≈2440₽
VOLUME_TIER_PRICES = {
    HYBRID_LINE:  (1490.0, 2290.0),
    ORGANIC_LINE: (1490.0, 2290.0),
    MINERAL_LINE: (1590.0, float(_MINERAL_LARGE)),
}
# Старая единая цена гибрида/органики — используется только чтобы один раз
# поднять уже существующие строки, не перетирая ручные правки админа позже.
_LEGACY_UNIT_PRICE = 1290.0


def seed_pigment_volume_tiers(db: Session) -> int:
    """Каждый полноразмерный пигмент существует в двух объёмах: 6мл и 12мл."""
    count = 0
    next_number = _next_pigment_number(db)
    small_rows = (
        db.query(Pigment)
        .filter(Pigment.line.in_(VOLUME_TIER_PRICES.keys()), Pigment.is_mini == False)  # noqa: E712
        .filter((Pigment.volume_ml == None) | (Pigment.volume_ml == "6мл"))  # noqa: E711
        .all()
    )
    for small in small_rows:
        small_price, large_price = VOLUME_TIER_PRICES[small.line]
        if small.price_ru in (_LEGACY_UNIT_PRICE, small_price):
            small.price_ru = small_price
        if not small.volume_ml:
            small.volume_ml = "6мл"

        has_large = (
            db.query(Pigment)
            .filter(Pigment.name == small.name, Pigment.line == small.line, Pigment.volume_ml == "12мл")
            .first()
        )
        if has_large:
            if has_large.price_ru != large_price and has_large.notes == "Большой объём (12мл)":
                has_large.price_ru = large_price
            continue
        large = Pigment(
            number=next_number,
            zone=small.zone,
            line=small.line,
            name=small.name,
            temperature=small.temperature,
            saturation=small.saturation,
            role=small.role,
            fitzpatrick=small.fitzpatrick,
            is_corrector=small.is_corrector,
            geo_europe=small.geo_europe,
            geo_asia=small.geo_asia,
            priority=small.priority,
            price_ru=large_price,
            price_eu=None,
            recommended_mixes=small.recommended_mixes,
            notes="Большой объём (12мл)",
            is_mini=False,
            volume_ml="12мл",
        )
        db.add(large)
        count += 1
        next_number += 1
    db.commit()
    return count


def seed_nominations(db: Session) -> int:
    df = pd.read_excel(XLSX_PATH, sheet_name="Номинации", header=2)
    df = df.dropna(subset=[df.columns[0]])
    count = 0
    for _, row in df.iterrows():
        name = _clean(row.iloc[0])
        if not name or name.startswith("Б.") or name.startswith("В.") or name.startswith("Использ") or name.startswith("Можно"):
            continue
        existing = db.query(Nomination).filter(Nomination.name == name).first()
        if existing:
            continue
        n = Nomination(
            name=name,
            zone=_clean(row.iloc[1]),
            method=_clean(row.iloc[2]),
            pigment_lines=_clean(row.iloc[3]),
            gift_description=_clean(row.iloc[4]),
            frequency=_clean(row.iloc[5]),
            notes=_clean(row.iloc[6]),
        )
        db.add(n)
        count += 1
    db.commit()
    return count


KOSKO_SET_NAME = "FACE x MARIA KOSKO"
_KOSKO_LIP_SHADES = ["Тауп", "Мусс", "Брауни", "Крем"]


def seed_collaboration_items(db: Session) -> dict:
    """Добавляет сет FACE x MARIA KOSKO и ставит продвижение губным оттенкам коллаборации."""
    from sqlalchemy import func as sqlfunc

    sets_added = 0
    existing_set = db.query(Consumable).filter(Consumable.name == KOSKO_SET_NAME).first()
    if not existing_set:
        max_num = db.query(sqlfunc.max(Consumable.number)).scalar() or 0
        c = Consumable(
            number=max_num + 1,
            name=KOSKO_SET_NAME,
            category="Сеты",
            zone="Губы",
            price_ru=10990.0,
            price_eu=None,
            has_mini=False,
            gift_priority="высокий",
            notes="Коллаборация FACE x Maria Kosko: пигменты Тауп, Мусс, Брауни, Крем + 4 тинта для губ",
        )
        db.add(c)
        sets_added += 1
    db.commit()

    promoted = 0
    for name in _KOSKO_LIP_SHADES:
        pig = (
            db.query(Pigment)
            .filter(
                Pigment.name == name,
                Pigment.zone == "Губы",
                Pigment.is_mini == False,  # noqa: E712
                Pigment.volume_ml == "6мл",
            )
            .first()
        )
        if not pig:
            continue
        settings = (
            db.query(PigmentSettings)
            .filter(PigmentSettings.pigment_id == pig.id, PigmentSettings.region == None)  # noqa: E711
            .first()
        )
        if not settings:
            db.add(PigmentSettings(pigment_id=pig.id, region=None, is_promoted=True))
            promoted += 1
        elif not settings.is_promoted:
            settings.is_promoted = True
            promoted += 1
    db.commit()

    return {"collab_sets_added": sets_added, "pigments_promoted": promoted}


def seed_all(db: Session) -> dict:
    result = {
        "pigments": seed_pigments(db),
        "line_renames": seed_normalize_lines(db),
        "volume_tiers": seed_pigment_volume_tiers(db),
        "mini_pigments": seed_mini_pigments(db),
        "consumables": seed_consumables(db),
        "nominations": seed_nominations(db),
    }
    result.update(seed_collaboration_items(db))
    return result
