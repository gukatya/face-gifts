from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pigment, Consumable, Nomination
from ..schemas import PigmentOut, ConsumableOut
from ..services.countries import ALL_COUNTRIES, ALL_REGIONS, get_country_profile

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("/pigments", response_model=list[PigmentOut])
def list_pigments(zone: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Pigment)
    if zone:
        q = q.filter(Pigment.zone == zone)
    return q.order_by(Pigment.number).all()


@router.get("/consumables", response_model=list[ConsumableOut])
def list_consumables(db: Session = Depends(get_db)):
    return db.query(Consumable).order_by(Consumable.number).all()


@router.get("/nominations")
def list_nominations(db: Session = Depends(get_db)):
    noms = db.query(Nomination).all()
    return [{"id": n.id, "name": n.name, "zone": n.zone, "method": n.method} for n in noms]


@router.get("/countries")
def list_countries():
    return ALL_COUNTRIES


@router.get("/countries/{country}/profile")
def country_profile(country: str):
    p = get_country_profile(country)
    return {
        "country": country,
        "region": p.region,
        "fitz_min": p.fitz_min,
        "fitz_max": p.fitz_max,
        "fitz_typical": p.fitz_typical,
    }


@router.get("/regions")
def list_regions():
    """List all region names (for country autocomplete region info)."""
    return ALL_REGIONS
