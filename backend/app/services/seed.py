import pandas as pd
from sqlalchemy.orm import Session
from ..models import Pigment, Consumable, Nomination

XLSX_PATH = "/Users/gukatya/Downloads/files/База_знаний_FACE_v7.xlsx"


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
        "consumables": seed_consumables(db),
        "nominations": seed_nominations(db),
    }
