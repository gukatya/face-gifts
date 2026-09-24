import json
import os
import urllib.parse
import urllib.request
from fastapi import APIRouter, Request, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Event
from fastapi import Depends

router = APIRouter(prefix="/telegram", tags=["telegram"])

TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_BOSS_CHAT = os.getenv("TELEGRAM_BOSS_CHAT_ID", "")
# Comma-separated Telegram user IDs who can approve (e.g. "230463637,987654321")
TG_APPROVER_IDS = set(
    x.strip() for x in os.getenv("TELEGRAM_APPROVER_IDS", "").split(",") if x.strip()
)


def _tg_api(method: str, **kwargs) -> dict:
    if not TG_TOKEN:
        return {}
    try:
        data = json.dumps(kwargs, ensure_ascii=False).encode()
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


@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()

    callback = body.get("callback_query")
    if not callback:
        return Response(status_code=200)

    user_id = str(callback.get("from", {}).get("id", ""))
    user_name = callback.get("from", {}).get("first_name", "Кто-то")
    data = callback.get("data", "")
    callback_id = callback.get("id", "")
    message = callback.get("message", {})
    chat_id = str(message.get("chat", {}).get("id", ""))
    message_id = message.get("message_id")

    # Always answer callback to remove loading spinner
    _tg_api("answerCallbackQuery", callback_query_id=callback_id)

    if not data.startswith(("boss_approve:", "boss_reject:")):
        return Response(status_code=200)

    action, event_id_str = data.split(":", 1)
    event_id = int(event_id_str)

    # Check authorization
    if user_id not in TG_APPROVER_IDS:
        _tg_api(
            "answerCallbackQuery",
            callback_query_id=callback_id,
            text="У тебя нет прав для согласования 🚫",
            show_alert=True,
        )
        return Response(status_code=200)

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return Response(status_code=200)

    if action == "boss_approve":
        event.boss_approval_status = "approved_boss"
        event.status = "approved"
        db.commit()

        # Edit original message — remove buttons, add approval mark
        original_caption = message.get("caption", "")
        new_caption = original_caption + f"\n\n✅ <b>Согласовано</b> — {user_name}"
        _tg_api(
            "editMessageCaption",
            chat_id=chat_id,
            message_id=message_id,
            caption=new_caption,
            parse_mode="HTML",
        )

    elif action == "boss_reject":
        event.boss_approval_status = "rejected_boss"
        db.commit()

        original_caption = message.get("caption", "")
        new_caption = original_caption + f"\n\n❌ <b>Не согласовано</b> — {user_name}"
        _tg_api(
            "editMessageCaption",
            chat_id=chat_id,
            message_id=message_id,
            caption=new_caption,
            parse_mode="HTML",
        )

    return Response(status_code=200)


@router.post("/set-webhook")
def set_webhook():
    """Register webhook URL with Telegram. Call once after deploy."""
    webhook_url = os.getenv("APP_URL", "").rstrip("/") + "/telegram/webhook"
    result = _tg_api("setWebhook", url=webhook_url)
    return result
