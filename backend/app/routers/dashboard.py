from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from collections import defaultdict
from typing import Optional

from ..database import get_db
from ..models import Event, GiftSet, MonthlyBudget, Pigment, Consumable

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

SHIP_DAYS_BEFORE = 14  # send gifts 2 weeks before the event


def _ship_month(ev: Event) -> str:
    """Return YYYY-MM string for the month when gifts should be / were shipped."""
    if ev.shipped_date:
        try:
            return ev.shipped_date[:7]
        except Exception:
            pass
    try:
        ev_date = date.fromisoformat(ev.date)
        return (ev_date - timedelta(days=SHIP_DAYS_BEFORE)).strftime("%Y-%m")
    except Exception:
        return ev.date[:7] if ev.date else "0000-00"


def _set_multiplier(gs: GiftSet, ev: Event) -> int:
    place = gs.place
    if place == "участник":
        return max(ev.participants_count or 1, 1)
    if place == "гран-при":
        return max(ev.grand_prix_count or 1, 1)
    if place == "розыгрыш":
        return max(ev.giveaways_count or 1, 1)
    if place in ("1", "2", "3"):
        noms = ev.nominations_data or []
        nom = next((n for n in noms if n.get("name") == gs.nomination_name), None)
        if nom:
            return max(nom.get(f"place{place}", 1), 1)
    return 1


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    events = db.query(Event).filter(Event.deleted_at.is_(None)).all()
    budgets_rows = db.query(MonthlyBudget).all()
    budgets_map = {b.month: b.planned for b in budgets_rows}

    today = date.today()

    # ── monthly stats ────────────────────────────────────────────────────────
    monthly: dict = defaultdict(lambda: {
        "events_count": 0,
        "shipped_count": 0,
        "actual_cost": 0,
        "items": defaultdict(lambda: {"name": "", "sku_type": "", "qty": 0}),
    })

    # ── geography ────────────────────────────────────────────────────────────
    geo: dict = defaultdict(lambda: {"events_count": 0, "total_cost": 0, "countries": set()})

    for ev in events:
        month = _ship_month(ev)
        m = monthly[month]
        m["events_count"] += 1
        if ev.gifts_sent:
            m["shipped_count"] += 1
            # actual_cost: only shipped events, bucketed by actual shipped_date
            shipped_month = ev.shipped_date[:7] if ev.shipped_date else month
            sm = monthly[shipped_month]
            sets_for_ev = db.query(GiftSet).filter(GiftSet.event_id == ev.id).all()
            ev_cost = 0
            for gs in sets_for_ev:
                mult = _set_multiplier(gs, ev)
                ev_cost += gs.total_price * mult
            if ev_cost == 0:
                ev_cost = ev.total_budget or 0
            sm["actual_cost"] += ev_cost

        # items — only for sent events
        if ev.gifts_sent:
            sets = db.query(GiftSet).filter(GiftSet.event_id == ev.id).all()
            for gs in sets:
                mult = _set_multiplier(gs, ev)
                for item in (gs.items or []):
                    key = f"{item.get('sku_type')}:{item.get('sku_id')}"
                    entry = m["items"][key]
                    entry["name"] = item.get("name", "")
                    entry["sku_type"] = item.get("sku_type", "")
                    entry["qty"] += item.get("qty", 1) * mult

        # geography
        region = ev.region or "Прочее"
        geo[region]["events_count"] += 1
        geo[region]["total_cost"] += ev_cost
        geo[region]["countries"].add(ev.country or "")

    # ── build monthly_stats list ──────────────────────────────────────────────
    all_months = set(monthly.keys()) | set(budgets_map.keys())
    monthly_stats = []
    for month in sorted(all_months):
        m = monthly[month]
        top_items = sorted(
            m["items"].values(),
            key=lambda x: -x["qty"],
        )[:30]
        monthly_stats.append({
            "month": month,
            "planned": budgets_map.get(month, 0),
            "actual_cost": m["actual_cost"],
            "events_count": m["events_count"],
            "shipped_count": m["shipped_count"],
            "top_items": [{"name": i["name"], "sku_type": i["sku_type"], "qty": i["qty"]} for i in top_items],
        })

    # ── geography list ────────────────────────────────────────────────────────
    geo_stats = [
        {
            "region": region,
            "events_count": data["events_count"],
            "total_cost": data["total_cost"],
            "countries": sorted(c for c in data["countries"] if c),
        }
        for region, data in sorted(geo.items(), key=lambda x: -x[1]["events_count"])
    ]

    # ── upcoming shipping deadlines ───────────────────────────────────────────
    deadlines = []
    for ev in events:
        if ev.gifts_sent:
            continue
        try:
            ev_date = date.fromisoformat(ev.date)
        except Exception:
            continue
        ship_by = ev_date - timedelta(days=SHIP_DAYS_BEFORE)
        days_until_ship = (ship_by - today).days
        if days_until_ship <= 21:  # show if ≤ 3 weeks until ship deadline
            deadlines.append({
                "id": ev.id,
                "name": ev.name,
                "date": ev.date,
                "ship_by": ship_by.isoformat(),
                "days_until_ship": days_until_ship,
                "region": ev.region,
                "country": ev.country,
                "level": ev.level,
            })
    deadlines.sort(key=lambda x: x["days_until_ship"])

    return {
        "monthly_stats": monthly_stats,
        "geography": geo_stats,
        "upcoming_deadlines": deadlines,
    }


@router.get("/items-report")
def items_report(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sku_type: Optional[str] = Query(None),      # pigment / consumable / sample / certificate / all
    category: Optional[str] = Query(None),      # consumable sub-category (Сеты / Сэмплы / etc.)
    warehouse: Optional[str] = Query(None),     # Россия / Европа
    event_type: Optional[str] = Query(None),    # comma-separated event types
    master_names: Optional[str] = Query(None),  # comma-separated created_by values (any match)
    db: Session = Depends(get_db),
):
    """Items shipment report for a custom date range with filters."""
    q = db.query(Event).filter(Event.gifts_sent == True, Event.deleted_at.is_(None))

    if warehouse:
        q = q.filter(Event.warehouse == warehouse)

    if event_type:
        types = [t.strip() for t in event_type.split(",") if t.strip()]
        if types:
            q = q.filter(Event.event_type.in_(types))

    if master_names:
        names = [n.strip() for n in master_names.split("|||") if n.strip()]
        if names:
            from sqlalchemy import or_, func
            conditions = [func.lower(Event.name) == name.lower() for name in names]
            q = q.filter(or_(*conditions))

    events = q.all()

    # Build pigment & consumable lookup for enrichment
    pigments_map = {p.id: p for p in db.query(Pigment).all()}
    consumables_map = {c.id: c for c in db.query(Consumable).all()}

    result: dict = {}  # key → {name, sku_type, category, volume_ml, qty, total_price}

    for ev in events:
        shipped = ev.shipped_date or ""
        if date_from and shipped < date_from:
            continue
        if date_to and shipped > date_to:
            continue

        sets = db.query(GiftSet).filter(GiftSet.event_id == ev.id).all()
        for gs in sets:
            mult = _set_multiplier(gs, ev)
            for item in (gs.items or []):
                t = item.get("sku_type", "")
                if sku_type and sku_type != "all" and t != sku_type:
                    continue

                # Enrich with catalog data
                item_category = item.get("category", "")
                item_volume = item.get("volume_ml", "")
                if t == "pigment":
                    pig = pigments_map.get(item.get("sku_id"))
                    if pig:
                        item_volume = pig.volume_ml or ""
                elif t in ("consumable", "sample"):
                    con = consumables_map.get(item.get("sku_id"))
                    if con:
                        item_category = con.category or item_category

                # Filter by consumable category
                if category and t in ("consumable", "sample") and item_category != category:
                    continue

                # For pigments, use (name + volume) as key so 6мл vs 12мл are separate rows
                sku_id = item.get("sku_id")
                key = f"{t}:{sku_id}:{item_volume}" if (t == "pigment" and item_volume) else f"{t}:{sku_id}"
                if key not in result:
                    result[key] = {
                        "name": item.get("name", ""),
                        "sku_type": t,
                        "category": item_category,
                        "volume_ml": item_volume,
                        "qty": 0,
                        "total_price": 0.0,
                    }
                qty = item.get("qty", 1) * mult
                price = item.get("price", 0) * qty
                result[key]["qty"] += qty
                result[key]["total_price"] += price

    items = sorted(result.values(), key=lambda x: -x["qty"])
    grand_total = sum(i["total_price"] for i in items)

    # Collect distinct consumable categories present in results
    categories = sorted({i["category"] for i in items if i["sku_type"] in ("consumable", "sample") and i["category"]})

    return {"items": items, "grand_total": grand_total, "consumable_categories": categories}


@router.get("/geography")
def geography_report(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Geography stats with optional filters."""
    q = db.query(Event).filter(Event.deleted_at.is_(None))

    if event_type:
        types = [t.strip() for t in event_type.split(",") if t.strip()]
        if types:
            q = q.filter(Event.event_type.in_(types))

    events = q.all()

    geo: dict = defaultdict(lambda: {"events_count": 0, "total_cost": 0, "countries": set()})

    for ev in events:
        # Filter by shipped_date if provided, fallback to event date
        ref_date = ev.shipped_date or ev.date or ""
        if date_from and ref_date < date_from:
            continue
        if date_to and ref_date > date_to:
            continue

        region = ev.region or "Прочее"
        geo[region]["events_count"] += 1
        geo[region]["total_cost"] += ev.total_budget or 0
        geo[region]["countries"].add(ev.country or "")

    return [
        {
            "region": region,
            "events_count": data["events_count"],
            "total_cost": data["total_cost"],
            "countries": sorted(c for c in data["countries"] if c),
        }
        for region, data in sorted(geo.items(), key=lambda x: -x[1]["events_count"])
        if data["events_count"] > 0
    ]
