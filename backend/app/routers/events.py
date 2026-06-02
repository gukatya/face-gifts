from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import io

from ..database import get_db
from ..models import Event, GiftSet
from ..schemas import EventCreate, EventOut, GiftSetOut, GiftSetItemsUpdate, CalcRequest, CalcResponse


class ShipPayload(BaseModel):
    shipped_date: Optional[str] = None  # ISO date string, defaults to today if None
from ..services.calculator import calc_all_levels
from ..services.draft import generate_draft
from ..services.export_excel import export_event_to_excel
from ..services.countries import get_country_profile

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db)):
    return db.query(Event).order_by(Event.created_at.desc()).all()


@router.post("/", response_model=EventOut, status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    # Auto-resolve region from country if not supplied
    region = payload.region
    if not region:
        region = get_country_profile(payload.country).region

    event = Event(
        name=payload.name,
        date=payload.date,
        country=payload.country,
        region=region,
        warehouse=payload.warehouse,
        recipients=payload.recipients,
        mode=payload.mode,
        level=payload.level,
        grand_prix_count=payload.grand_prix_count,
        has_trade_booth=payload.has_trade_booth,
        has_speaker_nonstop=payload.has_speaker_nonstop,
        has_speaker_stage=payload.has_speaker_stage,
        giveaways_count=payload.giveaways_count,
        participants_count=payload.participants_count,
        nominations_data=[n.model_dump() for n in payload.nominations],
        total_budget=payload.total_budget,
        participants_budget=payload.participants_budget,
        participants_use_certificate=payload.participants_use_certificate,
        status="draft",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()


@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventCreate, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in payload.model_dump().items():
        if field == "nominations":
            event.nominations_data = value
        elif hasattr(event, field):
            setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.post("/calculate", response_model=CalcResponse)
def calculate_levels(payload: CalcRequest):
    result = calc_all_levels({
        "nominations": [n.model_dump() for n in payload.nominations],
        "grand_prix_count": payload.grand_prix_count,
        "giveaways_count": payload.giveaways_count,
        "participants_count": payload.participants_count,
    })
    return result


@router.post("/{event_id}/generate", response_model=list[GiftSetOut])
def generate_event_draft(
    event_id: int,
    variant: int = Query(0, ge=0, le=20),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    sets = generate_draft(db, event, variant=variant)
    db.commit()
    return sets


@router.get("/{event_id}/sets", response_model=list[GiftSetOut])
def get_event_sets(event_id: int, db: Session = Depends(get_db)):
    return db.query(GiftSet).filter(GiftSet.event_id == event_id).all()


@router.put("/{event_id}/sets/{set_id}", response_model=GiftSetOut)
def update_gift_set(event_id: int, set_id: int, payload: GiftSetItemsUpdate, db: Session = Depends(get_db)):
    gs = db.query(GiftSet).filter(GiftSet.id == set_id, GiftSet.event_id == event_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Gift set not found")
    gs.items = payload.items
    gs.total_price = sum(i.get("price", 0) * i.get("qty", 1) for i in payload.items)
    db.commit()
    db.refresh(gs)
    return gs


@router.patch("/{event_id}/ship", response_model=EventOut)
def ship_event(event_id: int, payload: ShipPayload, db: Session = Depends(get_db)):
    """Mark event gifts as shipped. Sets shipped_date to today if not provided."""
    from datetime import date
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.gifts_sent = True
    event.shipped_date = payload.shipped_date or date.today().isoformat()
    db.commit()
    db.refresh(event)
    return event


@router.patch("/{event_id}/unship", response_model=EventOut)
def unship_event(event_id: int, db: Session = Depends(get_db)):
    """Unmark event as shipped."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.gifts_sent = False
    event.shipped_date = None
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}/export")
def export_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    sets = db.query(GiftSet).filter(GiftSet.event_id == event_id).all()
    if not sets:
        raise HTTPException(status_code=400, detail="Generate draft first")
    data = export_event_to_excel(event, sets)
    from urllib.parse import quote
    safe_name = f"FACE_Gift_{event.id}.xlsx"
    display_name = f"FACE_Gift_{event.name.replace(' ', '_')}.xlsx"
    encoded_name = quote(display_name, safe="")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_name}"; '
                f"filename*=UTF-8''{encoded_name}"
            )
        },
    )
