import pandas as pd
from sqlalchemy.orm import Session
from ..models import Pigment, Consumable, Nomination

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


# Оттенки, для которых заводим мини-версию (замена бумажным наборам сэмплов —
# теперь каждый мини-оттенок отдельная позиция в каталоге, тот же цвет, другой
# объём). Цена мини — производная от старых наборов сэмплов (2000-2500₽ за 3
# оттенка ≈ 650-830₽/оттенок): 650₽ для линий с полным размером 1290₽,
# 800₽ для линии Минералы (полный размер 1590₽).
MINI_SHADE_NAMES = [
    "Голд", "Медиум", "Дарк", "Орех", "Джонни", "Эспрессо",
    "Сахар", "Джоли", "Меган", "Виктория", "Нуар", "Космос",
    "Дженнифер", "Тайра", "Мокко", "Корица", "Карамель", "Шейк",
    "Ворм", "Лайт", "Кирпичный", "Вишня",
]
MINI_PRICE_BY_LINE = {"Минералы": 800.0}
MINI_PRICE_DEFAULT = 650.0
MINI_NUMBER_BASE = 9000


def seed_mini_pigments(db: Session) -> int:
    count = 0
    for offset, name in enumerate(MINI_SHADE_NAMES, start=1):
        if db.query(Pigment).filter(Pigment.name == name, Pigment.is_mini == True).first():  # noqa: E712
            continue
        parent = (
            db.query(Pigment)
            .filter(Pigment.name == name, Pigment.is_mini == False)  # noqa: E712
            .first()
        )
        if not parent:
            continue
        mini = Pigment(
            number=MINI_NUMBER_BASE + offset,
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
            price_ru=MINI_PRICE_BY_LINE.get(parent.line, MINI_PRICE_DEFAULT),
            price_eu=None,
            recommended_mixes=parent.recommended_mixes,
            notes="Мини-объём (сэмпл)",
            is_mini=True,
        )
        db.add(mini)
        count += 1
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


def seed_all(db: Session) -> dict:
    return {
        "pigments": seed_pigments(db),
        "mini_pigments": seed_mini_pigments(db),
        "consumables": seed_consumables(db),
        "nominations": seed_nominations(db),
    }
