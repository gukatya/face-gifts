from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import io
import json
import os
import urllib.error
import urllib.parse
import urllib.request

from ..database import get_db
from ..models import Event, GiftSet
from ..schemas import EventCreate, EventOut, GiftSetOut, GiftSetItemsUpdate, CalcRequest, CalcResponse, DeleteEventPayload
from .auth import require_admin

TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_BOSS_CHAT = os.getenv("TELEGRAM_BOSS_CHAT_ID", "")
# Comma-separated list of Telegram user IDs allowed to approve
TG_APPROVER_IDS = set(
    x.strip() for x in os.getenv("TELEGRAM_APPROVER_IDS", "").split(",") if x.strip()
)


def _tg_api(method: str, **kwargs) -> dict:
    if not TG_TOKEN:
        return {}
    try:
        data = json.dumps(kwargs).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TG_TOKEN}/{method}",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except Exception as e:
        print(f"[telegram] {method} failed: {e}")
        return {}


def _send_telegram_message(chat_id: str, text: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token or not chat_id:
        return False
    try:
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception as e:
        print(f"[telegram] send failed: {e}")
        return False


class ShipPayload(BaseModel):
    shipped_date: Optional[str] = None  # ISO date string, defaults to today if None


class AddSetPayload(BaseModel):
    nomination_name: str = "Новый набор"
from ..services.calculator import calc_all_levels
from ..services.draft import generate_draft
from ..services.export_excel import export_event_to_excel
from ..services.countries import get_country_profile

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db)):
    return db.query(Event).filter(Event.deleted_at.is_(None)).order_by(Event.created_at.desc()).all()


@router.get("/trash", response_model=list[EventOut])
def list_trash(db: Session = Depends(get_db)):
    return db.query(Event).filter(Event.deleted_at.isnot(None)).order_by(Event.deleted_at.desc()).all()


@router.patch("/{event_id}/restore", response_model=EventOut)
def restore_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.deleted_at = None
    event.delete_reason = None
    db.commit()
    db.refresh(event)
    return event


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
        event_type=payload.event_type,
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
        created_by=payload.created_by,
        comment=payload.comment,
        training_format=payload.training_format,
        city=payload.city,
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
def delete_event(event_id: int, payload: DeleteEventPayload, db: Session = Depends(get_db)):
    from datetime import datetime as dt
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.deleted_at = dt.utcnow()
    event.delete_reason = payload.reason
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


@router.patch("/{event_id}/submit", response_model=EventOut)
def submit_event(event_id: int, db: Session = Depends(get_db)):
    """Employee manually submits draft for admin approval."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status == "draft":
        event.status = "pending"
        db.commit()
        db.refresh(event)
    return event


@router.patch("/{event_id}/recall", response_model=EventOut)
def recall_event(event_id: int, db: Session = Depends(get_db)):
    """Employee recalls submission — back to draft for more editing."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status == "pending":
        event.status = "draft"
        db.commit()
        db.refresh(event)
    return event


@router.patch("/{event_id}/approve", response_model=EventOut, dependencies=[Depends(require_admin)])
def approve_event(event_id: int, db: Session = Depends(get_db)):
    """Move event to approved status."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "approved"
    db.commit()
    db.refresh(event)
    return event


@router.patch("/{event_id}/unapprove", response_model=EventOut, dependencies=[Depends(require_admin)])
def unapprove_event(event_id: int, db: Session = Depends(get_db)):
    """Move approved event back to pending."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status == "approved":
        event.status = "pending"
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}/sets", response_model=list[GiftSetOut])
def get_event_sets(event_id: int, db: Session = Depends(get_db)):
    return db.query(GiftSet).filter(GiftSet.event_id == event_id).all()


@router.post("/{event_id}/sets", response_model=GiftSetOut)
def add_gift_set(event_id: int, payload: AddSetPayload, db: Session = Depends(get_db)):
    """Add a single empty set to a custom event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    gs = GiftSet(
        event_id=event_id,
        nomination_name=payload.nomination_name,
        place="набор",
        level=event.level or "Нормальный",
        items=[],
        total_price=0,
    )
    db.add(gs)
    db.commit()
    db.refresh(gs)
    return gs


@router.delete("/{event_id}/sets/{set_id}", status_code=204)
def delete_gift_set(event_id: int, set_id: int, db: Session = Depends(get_db)):
    """Delete a single set from a custom event."""
    gs = db.query(GiftSet).filter(GiftSet.id == set_id, GiftSet.event_id == event_id).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Gift set not found")
    db.delete(gs)
    db.commit()


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


class BossApprovalPayload(BaseModel):
    comment: Optional[str] = None
    sent_by: Optional[str] = None  # имя сотрудника, нажавшего кнопку


def _build_total(event: Event, sets: list) -> int:
    total_all = 0
    for gs in sets:
        set_total = sum(i.get("price", 0) * i.get("qty", 1) for i in (gs.items or []))
        multiplier = 1
        if gs.place not in ("набор", "гран-при", "розыгрыш", "участник"):
            noms = event.nominations_data or []
            nom = next((n for n in noms if n.get("name") == gs.nomination_name), None)
            if nom:
                key = f"place{gs.place}" if gs.place in ("1", "2", "3") else "place1"
                multiplier = max(nom.get(key, 1), 1)
        elif gs.place == "участник":
            multiplier = max(event.participants_count or 1, 1)
        elif gs.place == "гран-при":
            multiplier = max(event.grand_prix_count or 1, 1)
        elif gs.place == "розыгрыш":
            multiplier = max(event.giveaways_count or 1, 1)
        total_all += set_total * multiplier
    return int(total_all)


@router.post("/{event_id}/notify-boss")
def notify_boss(event_id: int, payload: BossApprovalPayload, db: Session = Depends(get_db)):
    """Send Excel + approval buttons to boss Telegram chat."""
    boss_chat = TG_BOSS_CHAT or os.getenv("TELEGRAM_BOSS_CHAT_ID", "")
    if not boss_chat:
        raise HTTPException(status_code=503, detail="TELEGRAM_BOSS_CHAT_ID не настроен")
    if not TG_TOKEN:
        raise HTTPException(status_code=503, detail="TELEGRAM_BOT_TOKEN не настроен")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    sets = db.query(GiftSet).filter(GiftSet.event_id == event_id).all()
    if not sets:
        raise HTTPException(status_code=400, detail="Наборы не сформированы")

    # generate Excel
    xlsx_bytes = export_event_to_excel(event, sets)
    total = _build_total(event, sets)

    _EVENT_TYPE_TAGS = {
        "чемпионат": "ЧЕМПИОНАТ",
        "мастер-класс": "МАСТЕР-КЛАСС",
        "блоггерская рассылка": "БЛОГГЕРСКАЯ РАССЫЛКА",
        "партнёрский ивент": "ПАРТНЁРСКИЙ ИВЕНТ",
        "собственное мероприятие FACE": "МЕРОПРИЯТИЕ FACE",
        "обучение": "ОБУЧЕНИЕ",
        "другое": "МЕРОПРИЯТИЕ",
    }
    event_tag = _EVENT_TYPE_TAGS.get(event.event_type or "", "МЕРОПРИЯТИЕ")
    city_part = f", {event.city}" if event.city else ""

    caption_parts = [
        f"<b>{event_tag}</b>  ·  на согласование",
        "",
        f"<b>{event.name}</b>",
        f"{event.date}  ·  {event.country}{city_part}",
        "",
        f"Сумма: <b>{total:,} ₽</b>".replace(",", " "),
    ]
    if payload.sent_by or payload.comment:
        caption_parts.append("")
        caption_parts.append("─────────────")
        if payload.sent_by:
            caption_parts.append(f"Отправил(а): {payload.sent_by}")
        if payload.comment:
            caption_parts.append(payload.comment)
    caption = "\n".join(caption_parts)

    inline_keyboard = {
        "inline_keyboard": [[
            {"text": "✅ Согласовано", "callback_data": f"boss_approve:{event_id}"},
            {"text": "❌ Не согласовано", "callback_data": f"boss_reject:{event_id}"},
        ]]
    }

    # send document with inline keyboard
    filename = f"FACE_Gift_{event.name.replace(' ', '_')}.xlsx"
    boundary = "----FaceBoundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="chat_id"\r\n\r\n{boss_chat}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="caption"\r\n\r\n{caption}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="reply_markup"\r\n\r\n{json.dumps(inline_keyboard, ensure_ascii=False)}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="document"; filename="{filename}"\r\n'
        f"Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n"
    ).encode() + xlsx_bytes + f"\r\n--{boundary}--\r\n".encode()

    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TG_TOKEN}/sendDocument",
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        msg_id = result.get("result", {}).get("message_id")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"[telegram] sendDocument failed: {e.code} {err_body}")
        raise HTTPException(status_code=502, detail=f"Telegram error {e.code}: {err_body}")
    except Exception as e:
        print(f"[telegram] sendDocument failed: {e}")
        raise HTTPException(status_code=502, detail="Не удалось отправить в Telegram")

    # save state
    event.boss_approval_status = "pending_boss"
    event.boss_approval_comment = payload.comment
    event.boss_tg_message_id = msg_id
    db.commit()
    db.refresh(event)
    return {"status": "sent", "message_id": msg_id}


@router.get("/{event_id}/export")
def export_event(
    event_id: int,
    format: str = Query("manager", regex="^(manager|organizer)$"),
    db: Session = Depends(get_db),
):
    from ..services.export_excel import export_event_organizer
    from urllib.parse import quote
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    sets = db.query(GiftSet).filter(GiftSet.event_id == event_id).all()
    if not sets:
        raise HTTPException(status_code=400, detail="Generate draft first")
    if format == "organizer":
        data = export_event_organizer(event, sets)
        safe_name = f"FACE_Organizer_{event.id}.xlsx"
        display_name = f"FACE_Organizer_{event.name.replace(' ', '_')}.xlsx"
    else:
        data = export_event_to_excel(event, sets)
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
