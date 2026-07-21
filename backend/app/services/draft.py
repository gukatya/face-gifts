"""
Draft set generation: combines algorithm + calculator to produce a full gift set draft.
"""
import re as _re
from typing import Optional
from sqlalchemy.orm import Session
from ..models import Event, GiftSet, Pigment, Consumable
from .algorithm import (
    select_brow_pigments,
    select_lip_pigments,
    select_eye_pigments,
    select_consumables,
    select_items_for_budget,
)
from .countries import get_country_profile


def _deduplicate_items(items: list) -> list:
    """
    Remove duplicate items from a gift set:
    - Exact duplicates: same (sku_type, sku_id)
    - Volume variants: same base product in different sizes
      e.g. "Вторичка ICE Gel 33мл" and "Вторичка ICE Gel 12мл (мини)" → keep first
    """
    seen_ids: set = set()
    seen_bases: set = set()
    result = []
    for item in items:
        uid = (item.get("sku_type"), item.get("sku_id"))
        if uid in seen_ids:
            continue
        # Normalize name: strip volume/size markers
        raw = (item.get("name") or "").lower()
        base = _re.sub(r"\s*\d+\s*мл\b|\s*\(мини\)|\s*\bмини\b", "", raw).strip()
        base = _re.sub(r"\s+", " ", base)
        if base and base in seen_bases:
            continue
        seen_ids.add(uid)
        if base:
            seen_bases.add(base)
        result.append(item)
    return result

# Nomination zone classification
BROW_NOMINATIONS = {
    "Брови — пудровое / градиент",
    "Брови — волоски (аппаратная)",
    "Брови — микроблейдинг",
    "Перекрытие бровей",
}
LIP_NOMINATIONS = {"Губы — акварель / помадный / омбрэ"}
EYE_NOMINATIONS = {"Стрелка с растушёвкой"}
MIXED_NOMINATIONS = {"Латекс"}

# Количество пигментов по уровню и месту
# п.7: в Скромном 1-е и 2-е место → 2 пигмента
# п.7: в Гран-при основа — сеты, пигменты как добавка
LEVEL_PIGMENT_COUNTS: dict[str, dict[str, int]] = {
    "Скромный":   {"1": 2, "2": 2, "3": 1, "участник": 1, "розыгрыш": 2},
    "Нормальный": {"1": 3, "2": 2, "3": 2, "участник": 1, "розыгрыш": 3},
    "Хороший":    {"1": 4, "2": 3, "3": 2, "участник": 1, "розыгрыш": 3},
    "Гран-при":   {"гран-при": 2},  # 2 дополнительных пигмента поверх сетов
}

# Страны, в которые отправляем REDY (там есть и бровные, и губные пигменты)
REDY_COUNTRIES = {"Казахстан", "Узбекистан", "Кыргызстан"}


def compute_place_budgets(
    total_budget: int,
    nominations: list,
    grand_prix_count: int,
    giveaways_count: int,
    participants_count: int,
    participants_budget: int,
) -> dict:
    """
    Distribute total_budget across gift tiers proportionally.
    Weights: Гран-при=4, 1st=3, 2nd=2, 3rd=1, Giveaway=2
    Participants are separate (use participants_budget directly).
    Returns dict with keys: 'гран-при', '1', '2', '3', 'розыгрыш', 'участник'
    """
    participants_total = participants_count * participants_budget
    remaining = max(0, total_budget - participants_total)

    n1 = sum(n.get("place1", 0) for n in nominations)
    n2 = sum(n.get("place2", 0) for n in nominations)
    n3 = sum(n.get("place3", 0) for n in nominations)

    # Weights 5:4:3 for places 1:2:3 — keeps ratio tight, reduces gap between places.
    # GP gets 8 (60% above 1st), giveaway = 4.
    weighted = (
        grand_prix_count * 8
        + n1 * 5
        + n2 * 4
        + n3 * 3
        + giveaways_count * 4
    )

    if weighted == 0:
        return {
            "гран-при": 0,
            "1": 0,
            "2": 0,
            "3": 0,
            "розыгрыш": 0,
            "участник": participants_budget,
        }

    unit = remaining / weighted

    return {
        "гран-при": int(unit * 8),
        "1": int(unit * 5),
        "2": int(unit * 4),
        "3": int(unit * 3),
        "розыгрыш": int(unit * 4),
        "участник": participants_budget,
    }


def _item_from_pigment(p: Pigment, qty: int = 1) -> dict:
    name = f"{p.name} (мини)" if getattr(p, "is_mini", False) else p.name
    return {
        "sku_type": "pigment",
        "sku_id": p.id,
        "name": name,
        "line": p.line,
        "zone": p.zone,
        "qty": qty,
        "price": p.price_ru or 0,
    }


def _item_from_consumable(c: Consumable, qty: int = 1) -> dict:
    return {
        "sku_type": "consumable",
        "sku_id": c.id,
        "name": c.name,
        "category": c.category,
        "qty": qty,
        "price": c.price_ru or 0,
    }


def _item_from_sample(c: Consumable, qty: int = 1) -> dict:
    """Sample sets (mini pigment kits) — same as consumable but sku_type='sample'."""
    return {
        "sku_type": "sample",
        "sku_id": c.id,
        "name": c.name,
        "category": c.category,
        "qty": qty,
        "price": c.price_ru or 0,
    }


def _get_grand_prix_sets(db: Session, country: str) -> list:
    """
    Гран-при: один бровной сет + один губной сет.
    REDY отправляем только в Казахстан, Узбекистан, Кыргызстан (там бровные и губные).
    Приоритет бровного: Сет Минералс > Сет Organic Brows.
    """
    if country in REDY_COUNTRIES:
        redy = db.query(Consumable).filter(
            Consumable.name.ilike("%REDY%")
        ).first()
        if redy:
            return [redy]

    sets = []

    # Бровной сет: Минералс в приоритете
    brow_set = None
    for keyword in ["%Minerals%", "%Organic Brows%"]:
        s = db.query(Consumable).filter(
            Consumable.category == "Сеты",
            Consumable.name.ilike(keyword),
        ).first()
        if s:
            brow_set = s
            break
    if brow_set:
        sets.append(brow_set)

    # Губной сет: FACE x MARIA KOSKO в приоритете, затем FACE AND THE CITY
    lip_set = None
    for kw in ["%MARIA KOSKO%", "%FACE AND THE CITY%"]:
        lip_set = db.query(Consumable).filter(
            Consumable.category == "Сеты",
            Consumable.name.ilike(kw),
        ).first()
        if lip_set:
            break
    if lip_set:
        sets.append(lip_set)

    return sets


def _get_giveaway_set(db: Session, country: str):
    """
    Розыгрыш: хороший набор-сет.
    REDY — только для Казахстана, Узбекистана, Кыргызстана.
    """
    if country in REDY_COUNTRIES:
        s = db.query(Consumable).filter(
            Consumable.name.ilike("%REDY%")
        ).first()
        if s:
            return s

    for keyword in ["%Minerals%", "%MARIA KOSKO%", "%FACE AND THE CITY%"]:
        s = db.query(Consumable).filter(
            Consumable.category == "Сеты",
            Consumable.name.ilike(keyword),
        ).first()
        if s:
            return s
    return None


def _get_russia_sample(db: Session, nomination_name: str, items: list):
    """
    Для России/СНГ добавляем сэмпловый набор как бонус (приравниваем к пигментам).
    Логика: губные номинации → сэмплы губ, бровные → гибрид или минералы.
    """
    lines_used = {i.get("line") for i in items if i.get("sku_type") == "pigment"}

    if nomination_name in LIP_NOMINATIONS:
        return db.query(Consumable).filter(
            Consumable.category == "Сэмплы",
            Consumable.name.ilike("%Губы%"),
        ).first()
    elif nomination_name in BROW_NOMINATIONS:
        if "Минералы" in lines_used:
            return db.query(Consumable).filter(
                Consumable.category == "Сэмплы",
                Consumable.name.ilike("%Minerals%"),
            ).first()
        else:
            return db.query(Consumable).filter(
                Consumable.category == "Сэмплы",
                Consumable.name.ilike("%Гибрид%"),
            ).first()
    return None


def _build_set_for_place(
    db: Session,
    nomination_name: str,
    place: str,
    level: str,
    region: str,
    country: str,
    warehouse: str,
    fitz_min: int = 1,
    fitz_max: int = 6,
    is_grand_prix: bool = False,
    is_giveaway: bool = False,
    offset: int = 0,
    budget: Optional[int] = None,
    variant: int = 0,
) -> dict:
    # Budget-based selection path (not for Grand Prix — they use fixed sets)
    if budget is not None and not is_grand_prix:
        zone = "Все зоны"
        if nomination_name in BROW_NOMINATIONS:
            zone = "Брови"
        elif nomination_name in LIP_NOMINATIONS:
            zone = "Губы"
        elif nomination_name in EYE_NOMINATIONS:
            zone = "Веки"

        result = select_items_for_budget(
            db, budget, zone, region, nomination_name,
            fitz_min, fitz_max, warehouse, place=place, variant=variant,
        )
        items = []
        items.extend([_item_from_pigment(p) for p in result["pigments"]])
        # consumables is a list of (Consumable, qty) tuples
        items.extend([_item_from_consumable(c, qty) for c, qty in result["consumables"]])
        items.extend([_item_from_sample(s) for s in result["samples"]])

        # Сэмпл уже учтён внутри select_items_for_budget (добавляется, только если
        # бюджет реально на него хватает — shade_count >= 3). Безусловного бонуса
        # сверх бюджета здесь больше нет: иначе подарки с тонким бюджетом (3-е место,
        # розыгрыш) превышали бы заданные рамки, а зона "Веки" (без сэмпла) выглядела
        # бы обделённой на их фоне — все номинации должны жить по одной бюджетной логике.

        total = sum(i["price"] * i["qty"] for i in items)
        return {"items": items, "total_price": total}

    pigment_count = LEVEL_PIGMENT_COUNTS.get(level, {}).get(place, 2)
    items = []

    if is_grand_prix:
        if budget is not None:
            # Budget-aware Grand Prix: add sets only if budget allows
            gp_sets = _get_grand_prix_sets(db, country)
            sets_cost = sum((s.price_ru or 0) for s in gp_sets)
            if sets_cost <= budget * 0.85:
                # Sets fit — add them, split remainder between pigments and consumables
                for s in gp_sets:
                    items.append(_item_from_consumable(s))
                remaining_after_sets = max(0, budget - sets_cost)
                # Reserve ~25% of remainder (max 4000) for GP consumables
                cons_reserve = min(int(remaining_after_sets * 0.25), 4000)
                pig_budget = remaining_after_sets - cons_reserve
                pig_count = max(1, int(pig_budget // 1400))
                extra_pigs = select_brow_pigments(
                    db, "Брови — пудровое / градиент", region, pig_count + 6, warehouse,
                    fitz_min=fitz_min, fitz_max=fitz_max,
                )
                if variant > 0 and len(extra_pigs) > pig_count:
                    skip = variant % max(1, len(extra_pigs))
                    extra_pigs = (extra_pigs[skip:] + extra_pigs[:skip])[:pig_count]
                else:
                    extra_pigs = extra_pigs[:pig_count]
                items.extend([_item_from_pigment(p) for p in extra_pigs])
                # GP consumables within budget
                pig_cost = sum(p.price_ru or 0 for p in extra_pigs)
                cons_budget = cons_reserve + max(0, pig_budget - pig_cost)
                gp_cons = select_consumables(db, "Гран-при", "Все зоны", warehouse)
                cons_spent = 0.0
                for c in gp_cons:
                    price = c.price_ru or 0
                    if cons_spent + price <= cons_budget:
                        items.append(_item_from_consumable(c))
                        cons_spent += price
            else:
                # Budget too small for sets — use budget-based selection
                result = select_items_for_budget(
                    db, budget, "Все зоны", region, "Брови — пудровое / градиент",
                    fitz_min, fitz_max, warehouse, variant=variant,
                )
                items.extend([_item_from_pigment(p) for p in result["pigments"]])
                items.extend([_item_from_consumable(c, qty) for c, qty in result["consumables"]])
                items.extend([_item_from_sample(s) for s in result["samples"]])
            # Early return — prevents fall-through to the consumables block below
            items = _deduplicate_items(items)
            total = sum(i["price"] * i["qty"] for i in items)
            return {"items": items, "total_price": total}
        else:
            # No budget — old behaviour: always add full sets
            gp_sets = _get_grand_prix_sets(db, country)
            for s in gp_sets:
                items.append(_item_from_consumable(s))
            pool = select_brow_pigments(
                db, "Брови — пудровое / градиент", region, pigment_count + 6, warehouse,
                fitz_min=fitz_min, fitz_max=fitz_max,
            )
            if variant > 0 and len(pool) >= pigment_count:
                skip = variant % max(1, len(pool))
                pool = pool[skip:] + pool[:skip]
            items.extend([_item_from_pigment(p) for p in pool[:pigment_count]])

    elif is_giveaway:
        gift_set = _get_giveaway_set(db, country)
        if gift_set:
            items.append(_item_from_consumable(gift_set))
        all_lip_pigs = select_lip_pigments(db, region, pigment_count + offset, warehouse, fitz_min, fitz_max)
        pigs = all_lip_pigs[offset:offset + pigment_count]
        if not pigs:
            pigs = all_lip_pigs[:pigment_count]
        items.extend([_item_from_pigment(p) for p in pigs])

    elif nomination_name in BROW_NOMINATIONS:
        include_corr = nomination_name == "Перекрытие бровей"
        pool = select_brow_pigments(
            db, nomination_name, region, pigment_count + 6,
            warehouse, include_corr, fitz_min=fitz_min, fitz_max=fitz_max,
        )
        if variant > 0 and len(pool) >= pigment_count:
            skip = variant % max(1, len(pool))
            pool = pool[skip:] + pool[:skip]
        pigs = pool[:pigment_count]
        items.extend([_item_from_pigment(p) for p in pigs])

    elif nomination_name in LIP_NOMINATIONS:
        pool = select_lip_pigments(
            db, region, pigment_count + 6, warehouse, fitz_min, fitz_max
        )
        if variant > 0 and len(pool) >= pigment_count:
            skip = variant % max(1, len(pool))
            pool = pool[skip:] + pool[:skip]
        pigs = pool[:pigment_count]
        items.extend([_item_from_pigment(p) for p in pigs])

    elif nomination_name in EYE_NOMINATIONS:
        pigs = select_eye_pigments(db, min(pigment_count, 3), warehouse)
        items.extend([_item_from_pigment(p) for p in pigs])

    elif nomination_name in MIXED_NOMINATIONS:
        lip_pigs = select_lip_pigments(db, region, 1, warehouse, fitz_min, fitz_max)
        brow_pigs = select_brow_pigments(
            db, "Брови — пудровое / градиент", region, 1, warehouse,
            fitz_min=fitz_min, fitz_max=fitz_max,
        )
        items.extend([_item_from_pigment(p) for p in lip_pigs])
        items.extend([_item_from_pigment(p) for p in brow_pigs])

    else:
        # Universal: mix lips + brows
        lip_count = max(1, pigment_count // 2)
        brow_count = pigment_count - lip_count
        lip_pigs = select_lip_pigments(db, region, lip_count, warehouse, fitz_min, fitz_max)
        brow_pigs = select_brow_pigments(
            db, "Брови — пудровое / градиент", region, brow_count, warehouse,
            fitz_min=fitz_min, fitz_max=fitz_max,
        )
        items.extend([_item_from_pigment(p) for p in lip_pigs])
        items.extend([_item_from_pigment(p) for p in brow_pigs])

    # Для России/СНГ добавляем сэмпловый набор как бонус
    if ("Россия" in region or "СНГ" in region) and not is_grand_prix and not is_giveaway:
        sample = _get_russia_sample(db, nomination_name, items)
        if sample:
            items.append(_item_from_sample(sample))

    # Расходники
    zone = "Все зоны"
    if nomination_name in BROW_NOMINATIONS:
        zone = "Брови"
    elif nomination_name in LIP_NOMINATIONS:
        zone = "Губы"

    consumable_level = "Гран-при" if (is_grand_prix or is_giveaway) else level
    consumables = select_consumables(db, consumable_level, zone, warehouse)
    items.extend([_item_from_consumable(c) for c in consumables])

    items = _deduplicate_items(items)
    total = sum(i["price"] * i["qty"] for i in items)
    return {"items": items, "total_price": total}


def generate_draft(db: Session, event: Event, variant: int = 0) -> list:
    db.query(GiftSet).filter(GiftSet.event_id == event.id).delete()
    db.flush()

    country = event.country or ""
    profile = get_country_profile(country)
    region = profile.region
    fitz_min = profile.fitz_min
    fitz_max = profile.fitz_max

    warehouse = event.warehouse or "Россия"
    level = event.level or "Нормальный"
    nominations = event.nominations_data or []

    # Compute place budgets if total_budget is set
    place_budgets = None
    total_budget = getattr(event, "total_budget", None)
    if total_budget and total_budget > 0:
        participants_budget_val = getattr(event, "participants_budget", None) or 500
        place_budgets = compute_place_budgets(
            total_budget=total_budget,
            nominations=nominations,
            grand_prix_count=getattr(event, "grand_prix_count", 0) or 0,
            giveaways_count=event.giveaways_count or 0,
            participants_count=event.participants_count or 0,
            participants_budget=participants_budget_val,
        )

    sets = []

    gp_count = getattr(event, "grand_prix_count", 0) or 0
    for gp_idx in range(gp_count):
        if gp_count == 1:
            gp_name = "Гран-при"
        else:
            gp_name = f"Гран-при {gp_idx + 1}"
        gp_budget = place_budgets["гран-при"] if place_budgets else None
        data = _build_set_for_place(
            db, gp_name, "гран-при", "Гран-при", region, country, warehouse,
            fitz_min, fitz_max, is_grand_prix=True, budget=gp_budget, variant=variant,
        )
        gs = GiftSet(event_id=event.id, nomination_name=gp_name,
                     place="гран-при", level="Гран-при",
                     items=data["items"], total_price=data["total_price"])
        db.add(gs)
        sets.append(gs)

    for nom in nominations:
        nom_name = nom.get("name", "Универсальный")
        for place_key, place_label in [("place1", "1"), ("place2", "2"), ("place3", "3")]:
            count = nom.get(place_key, 0)
            if count > 0:
                place_budget = place_budgets[place_label] if place_budgets else None
                data = _build_set_for_place(
                    db, nom_name, place_label, level, region, country, warehouse,
                    fitz_min, fitz_max, budget=place_budget, variant=variant,
                )
                gs = GiftSet(event_id=event.id, nomination_name=nom_name,
                             place=place_label, level=level,
                             items=data["items"], total_price=data["total_price"])
                db.add(gs)
                sets.append(gs)

    if event.giveaways_count > 0:
        giveaway_mode = getattr(event, "giveaway_mode", None) or "одинаковые"
        giveaway_budget = place_budgets["розыгрыш"] if place_budgets else None
        if giveaway_mode == "разные" and event.giveaways_count > 1:
            for i in range(event.giveaways_count):
                data = _build_set_for_place(
                    db, "Розыгрыш", "розыгрыш", level, region, country, warehouse,
                    fitz_min, fitz_max, is_giveaway=True, offset=i,
                    budget=giveaway_budget, variant=variant,
                )
                gs = GiftSet(event_id=event.id, nomination_name=f"Розыгрыш {i + 1}",
                             place="розыгрыш", level=level,
                             items=data["items"], total_price=data["total_price"])
                db.add(gs)
                sets.append(gs)
        else:
            data = _build_set_for_place(
                db, "Розыгрыш", "розыгрыш", level, region, country, warehouse,
                fitz_min, fitz_max, is_giveaway=True, budget=giveaway_budget, variant=variant,
            )
            gs = GiftSet(event_id=event.id, nomination_name="Розыгрыш",
                         place="розыгрыш", level=level,
                         items=data["items"], total_price=data["total_price"])
            db.add(gs)
            sets.append(gs)

    recipients = getattr(event, "recipients", "победители + участники") or "победители + участники"
    if event.participants_count > 0 and recipients != "только победители":
        participants_use_certificate = getattr(event, "participants_use_certificate", False)
        cert_value = getattr(event, "participants_budget", None) or 500

        if participants_use_certificate:
            cert_item = {
                "sku_type": "certificate",
                "sku_id": 0,
                "name": f"Сертификат {cert_value} ₽",
                "category": "Сертификат",
                "qty": 1,
                "price": cert_value,
            }
            gs = GiftSet(
                event_id=event.id,
                nomination_name="Участники",
                place="участник",
                level="Скромный",
                items=[cert_item],
                total_price=cert_value,
            )
            db.add(gs)
            sets.append(gs)
        else:
            participant_budget = place_budgets["участник"] if place_budgets else None
            data = _build_set_for_place(
                db, "Универсальный", "участник", "Скромный", region, country, warehouse,
                fitz_min, fitz_max, budget=participant_budget, variant=variant,
            )
            gs = GiftSet(event_id=event.id, nomination_name="Участники",
                         place="участник", level="Скромный",
                         items=data["items"], total_price=data["total_price"])
            db.add(gs)
            sets.append(gs)

    db.flush()
    return sets
