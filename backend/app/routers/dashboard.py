from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
from collections import defaultdict

from ..database import get_db
from ..models import Event, GiftSet, MonthlyBudget

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
    events = db.query(Event).all()
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

        # cost: use total_budget if set (reflects slider), else we'll leave 0
        ev_cost = ev.total_budget or 0
        m["actual_cost"] += ev_cost

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
