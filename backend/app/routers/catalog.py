"""
Catalog management router.
Provides endpoints for managing pigment/consumable settings per region,
and region-based top-seller rankings.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pigment, Consumable, RegionRanking, PigmentSettings, ConsumableSettings
from ..schemas import (
    RegionRankingItem, RegionRankingOut,
    PigmentSettingsIn, PigmentWithSettings, PigmentCreate, PigmentUpdate,
    ConsumableSettingsIn, ConsumableWithSettings, ConsumableCreate, ConsumableUpdate,
)
from ..services.countries import ALL_REGIONS
from .auth import require_admin

router = APIRouter(prefix="/catalog", tags=["catalog"])


class PriceUpdate(BaseModel):
    price_ru: Optional[float] = None
    price_eu: Optional[float] = None


@router.get("/regions", response_model=List[str])
def list_regions():
    """List all 14 region names."""
    return ALL_REGIONS


@router.get("/regions/{region}/rankings", response_model=List[RegionRankingOut])
def get_region_rankings(region: str, db: Session = Depends(get_db)):
    """Get rankings for a region (both zones)."""
    result = []
    for zone in ["Брови", "Губы"]:
        rankings = (
            db.query(RegionRanking)
            .filter(RegionRanking.region == region, RegionRanking.zone == zone)
            .order_by(RegionRanking.rank)
            .all()
        )
        items = [RegionRankingItem(pigment_id=r.pigment_id, rank=r.rank) for r in rankings]
        result.append(RegionRankingOut(region=region, zone=zone, rankings=items))
    return result


@router.put("/regions/{region}/rankings/{zone}", response_model=RegionRankingOut, dependencies=[Depends(require_admin)])
def save_region_rankings(
    region: str,
    zone: str,
    rankings: List[RegionRankingItem],
    db: Session = Depends(get_db),
):
    """Save rankings for a region+zone (replaces existing)."""
    # Delete old rankings for this region+zone
    db.query(RegionRanking).filter(
        RegionRanking.region == region,
        RegionRanking.zone == zone,
    ).delete()

    # Insert new ones
    for item in rankings:
        entry = RegionRanking(
            region=region,
            zone=zone,
            pigment_id=item.pigment_id,
            rank=item.rank,
        )
        db.add(entry)

    db.commit()
    return RegionRankingOut(region=region, zone=zone, rankings=rankings)


@router.get("/pigments", response_model=List[PigmentWithSettings])
def list_pigments_with_settings(
    region: Optional[str] = None,
    zone: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """All pigments with their settings for a given region."""
    q = db.query(Pigment)
    if zone:
        q = q.filter(Pigment.zone == zone)
    pigments = q.order_by(Pigment.number).all()

    # Build settings lookup
    settings_map: dict[int, PigmentSettings] = {}
    if region is not None:
        # Region-specific settings first, then global fallback
        region_settings = (
            db.query(PigmentSettings)
            .filter(PigmentSettings.region == region)
            .all()
        )
        global_settings = (
            db.query(PigmentSettings)
            .filter(PigmentSettings.region == None)
            .all()
        )
        for s in global_settings:
            settings_map[s.pigment_id] = s
        for s in region_settings:
            settings_map[s.pigment_id] = s  # region overrides global
    else:
        global_settings = (
            db.query(PigmentSettings)
            .filter(PigmentSettings.region == None)
            .all()
        )
        for s in global_settings:
            settings_map[s.pigment_id] = s

    result = []
    for p in pigments:
        s = settings_map.get(p.id)
        result.append(PigmentWithSettings(
            id=p.id,
            number=p.number,
            zone=p.zone,
            line=p.line,
            name=p.name,
            role=p.role,
            fitzpatrick=p.fitzpatrick,
            is_corrector=p.is_corrector,
            priority=p.priority,
            price_ru=p.price_ru,
            price_eu=p.price_eu,
            is_mini=p.is_mini,
            volume_ml=p.volume_ml,
            is_hidden=s.is_hidden if s else False,
            hide_reason=s.hide_reason if s else None,
            is_promoted=s.is_promoted if s else False,
            sort_order=s.sort_order if s else 0,
        ))
    return result


def _pigment_to_schema(p: Pigment) -> PigmentWithSettings:
    return PigmentWithSettings(
        id=p.id, number=p.number, zone=p.zone, line=p.line, name=p.name,
        role=p.role, fitzpatrick=p.fitzpatrick, is_corrector=p.is_corrector,
        priority=p.priority, price_ru=p.price_ru, price_eu=p.price_eu,
        is_mini=p.is_mini, volume_ml=p.volume_ml,
    )


@router.post("/pigments", response_model=PigmentWithSettings, status_code=201, dependencies=[Depends(require_admin)])
def create_pigment(data: PigmentCreate, db: Session = Depends(get_db)):
    """Add a new pigment to the catalog."""
    max_num = db.query(func.max(Pigment.number)).scalar() or 0
    pigment = Pigment(number=max_num + 1, **data.model_dump())
    db.add(pigment)
    db.commit()
    db.refresh(pigment)
    return _pigment_to_schema(pigment)


@router.put("/pigments/{pigment_id}", response_model=PigmentWithSettings, dependencies=[Depends(require_admin)])
def update_pigment(pigment_id: int, data: PigmentUpdate, db: Session = Depends(get_db)):
    """Full edit of a pigment's catalog fields (not per-region settings)."""
    pigment = db.query(Pigment).filter(Pigment.id == pigment_id).first()
    if not pigment:
        raise HTTPException(status_code=404, detail="Pigment not found")
    for field, value in data.model_dump().items():
        setattr(pigment, field, value)
    db.commit()
    db.refresh(pigment)
    return _pigment_to_schema(pigment)


@router.put("/pigments/{pigment_id}/settings", response_model=PigmentWithSettings, dependencies=[Depends(require_admin)])
def save_pigment_settings(
    pigment_id: int,
    data: PigmentSettingsIn,
    db: Session = Depends(get_db),
):
    """Save settings for pigment+region (upsert)."""
    pigment = db.query(Pigment).filter(Pigment.id == pigment_id).first()
    if not pigment:
        raise HTTPException(status_code=404, detail="Pigment not found")

    existing = (
        db.query(PigmentSettings)
        .filter(
            PigmentSettings.pigment_id == pigment_id,
            PigmentSettings.region == data.region,
        )
        .first()
    )

    if existing:
        existing.is_hidden = data.is_hidden
        existing.hide_reason = data.hide_reason
        existing.is_promoted = data.is_promoted
        existing.sort_order = data.sort_order
        s = existing
    else:
        s = PigmentSettings(
            pigment_id=pigment_id,
            region=data.region,
            is_hidden=data.is_hidden,
            hide_reason=data.hide_reason,
            is_promoted=data.is_promoted,
            sort_order=data.sort_order,
        )
        db.add(s)

    db.commit()
    db.refresh(s)

    return PigmentWithSettings(
        id=pigment.id,
        number=pigment.number,
        zone=pigment.zone,
        line=pigment.line,
        name=pigment.name,
        role=pigment.role,
        fitzpatrick=pigment.fitzpatrick,
        is_corrector=pigment.is_corrector,
        priority=pigment.priority,
        price_ru=pigment.price_ru,
        is_hidden=s.is_hidden,
        hide_reason=s.hide_reason,
        is_promoted=s.is_promoted,
        sort_order=s.sort_order,
    )


@router.get("/consumables", response_model=List[ConsumableWithSettings])
def list_consumables_with_settings(
    region: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """All consumables with their settings for a given region."""
    consumables = db.query(Consumable).order_by(Consumable.number).all()

    settings_map: dict[int, ConsumableSettings] = {}
    if region is not None:
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
    else:
        global_settings = (
            db.query(ConsumableSettings)
            .filter(ConsumableSettings.region == None)
            .all()
        )
        for s in global_settings:
            settings_map[s.consumable_id] = s

    result = []
    for c in consumables:
        s = settings_map.get(c.id)
        result.append(ConsumableWithSettings(
            id=c.id,
            number=c.number,
            name=c.name,
            category=c.category,
            zone=c.zone,
            price_ru=c.price_ru,
            price_eu=c.price_eu,
            has_mini=c.has_mini,
            gift_priority=c.gift_priority,
            is_hidden=s.is_hidden if s else False,
            hide_reason=s.hide_reason if s else None,
            gift_priority_override=s.gift_priority_override if s else None,
            sort_order=s.sort_order if s else 0,
        ))
    return result


def _consumable_to_schema(c: Consumable) -> ConsumableWithSettings:
    return ConsumableWithSettings(
        id=c.id, number=c.number, name=c.name, category=c.category, zone=c.zone,
        price_ru=c.price_ru, price_eu=c.price_eu, has_mini=c.has_mini,
        gift_priority=c.gift_priority,
    )


@router.post("/consumables", response_model=ConsumableWithSettings, status_code=201, dependencies=[Depends(require_admin)])
def create_consumable(data: ConsumableCreate, db: Session = Depends(get_db)):
    """Add a new consumable to the catalog."""
    max_num = db.query(func.max(Consumable.number)).scalar() or 0
    consumable = Consumable(number=max_num + 1, **data.model_dump())
    db.add(consumable)
    db.commit()
    db.refresh(consumable)
    return _consumable_to_schema(consumable)


@router.put("/consumables/{consumable_id}", response_model=ConsumableWithSettings, dependencies=[Depends(require_admin)])
def update_consumable(consumable_id: int, data: ConsumableUpdate, db: Session = Depends(get_db)):
    """Full edit of a consumable's catalog fields (not per-region settings)."""
    consumable = db.query(Consumable).filter(Consumable.id == consumable_id).first()
    if not consumable:
        raise HTTPException(status_code=404, detail="Consumable not found")
    for field, value in data.model_dump().items():
        setattr(consumable, field, value)
    db.commit()
    db.refresh(consumable)
    return _consumable_to_schema(consumable)


@router.put("/consumables/{consumable_id}/settings", response_model=ConsumableWithSettings, dependencies=[Depends(require_admin)])
def save_consumable_settings(
    consumable_id: int,
    data: ConsumableSettingsIn,
    db: Session = Depends(get_db),
):
    """Save settings for consumable+region (upsert)."""
    consumable = db.query(Consumable).filter(Consumable.id == consumable_id).first()
    if not consumable:
        raise HTTPException(status_code=404, detail="Consumable not found")

    existing = (
        db.query(ConsumableSettings)
        .filter(
            ConsumableSettings.consumable_id == consumable_id,
            ConsumableSettings.region == data.region,
        )
        .first()
    )

    if existing:
        existing.is_hidden = data.is_hidden
        existing.hide_reason = data.hide_reason
        existing.gift_priority_override = data.gift_priority_override
        existing.sort_order = data.sort_order
        s = existing
    else:
        s = ConsumableSettings(
            consumable_id=consumable_id,
            region=data.region,
            is_hidden=data.is_hidden,
            hide_reason=data.hide_reason,
            gift_priority_override=data.gift_priority_override,
            sort_order=data.sort_order,
        )
        db.add(s)

    db.commit()
    db.refresh(s)

    return ConsumableWithSettings(
        id=consumable.id,
        number=consumable.number,
        name=consumable.name,
        category=consumable.category,
        zone=consumable.zone,
        price_ru=consumable.price_ru,
        has_mini=consumable.has_mini,
        gift_priority=consumable.gift_priority,
        is_hidden=s.is_hidden,
        hide_reason=s.hide_reason,
        gift_priority_override=s.gift_priority_override,
        sort_order=s.sort_order,
    )


# ── Price editing (admin only) ────────────────────────────────────────────────

@router.patch("/pigments/{pigment_id}/price", dependencies=[Depends(require_admin)])
def update_pigment_price(pigment_id: int, data: PriceUpdate, db: Session = Depends(get_db)):
    """Manually update pigment price (persists across redeployments)."""
    pigment = db.query(Pigment).filter(Pigment.id == pigment_id).first()
    if not pigment:
        raise HTTPException(status_code=404, detail="Pigment not found")
    if data.price_ru is not None:
        pigment.price_ru = data.price_ru
    if data.price_eu is not None:
        pigment.price_eu = data.price_eu
    db.commit()
    return {"id": pigment.id, "name": pigment.name, "price_ru": pigment.price_ru, "price_eu": pigment.price_eu}


@router.patch("/consumables/{consumable_id}/price", dependencies=[Depends(require_admin)])
def update_consumable_price(consumable_id: int, data: PriceUpdate, db: Session = Depends(get_db)):
    """Manually update consumable price (persists across redeployments)."""
    consumable = db.query(Consumable).filter(Consumable.id == consumable_id).first()
    if not consumable:
        raise HTTPException(status_code=404, detail="Consumable not found")
    if data.price_ru is not None:
        consumable.price_ru = data.price_ru
    if data.price_eu is not None:
        consumable.price_eu = data.price_eu
    db.commit()
    return {"id": consumable.id, "name": consumable.name, "price_ru": consumable.price_ru, "price_eu": consumable.price_eu}

