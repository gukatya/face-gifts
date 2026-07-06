from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Pigment(Base):
    __tablename__ = "pigments"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, unique=True)
    zone = Column(String(50))        # Губы / Брови / Веки
    line = Column(String(100))       # Organic love / Базовая (гибрид) / etc.
    name = Column(String(100))
    temperature = Column(String(50)) # тёплый / нейтральный / прохладный / холодный
    saturation = Column(String(50))  # мягкая / средняя / насыщенный
    role = Column(String(50))        # база / модификатор / акцент / корректор
    fitzpatrick = Column(String(20)) # e.g. "1–6", "2–4"
    is_corrector = Column(Boolean, default=False)
    geo_europe = Column(Boolean, default=False)
    geo_asia = Column(Boolean, default=False)
    priority = Column(String(50))    # стандарт / продвигаем / новинка / выводим
    price_ru = Column(Float, nullable=True)
    price_eu = Column(Float, nullable=True)
    recommended_mixes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_mini = Column(Boolean, default=False)  # мини-объём того же оттенка (замена набору сэмплов)
    volume_ml = Column(String(10), nullable=True)  # "6мл" / "12мл" — для линий с двумя объёмами


class Consumable(Base):
    __tablename__ = "consumables"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, unique=True)
    name = Column(String(200))
    category = Column(String(100))   # Сеты / Сэмплы / Анестезия / Гели / etc.
    zone = Column(String(100))
    price_ru = Column(Float, nullable=True)
    price_eu = Column(Float, nullable=True)
    has_mini = Column(Boolean, default=False)
    gift_priority = Column(String(50))  # высокий / средний / низкий
    notes = Column(Text, nullable=True)


class Nomination(Base):
    __tablename__ = "nominations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    zone = Column(String(100))
    method = Column(String(100))
    pigment_lines = Column(Text)     # comma-separated or JSON
    gift_description = Column(Text)
    frequency = Column(String(50))
    notes = Column(Text, nullable=True)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300))
    date = Column(String(20))        # ISO date string
    country = Column(String(100))
    region = Column(String(100))
    warehouse = Column(String(20))   # Россия / Европа
    recipients = Column(String(50))  # только победители / победители + участники
    mode = Column(String(30))        # по номинациям / универсальный
    level = Column(String(30))       # Скромный / Нормальный / Хороший
    has_grand_prix = Column(Boolean, default=False)  # kept for migration compat, unused
    grand_prix_count = Column(Integer, default=0)
    has_trade_booth = Column(Boolean, default=False)
    has_speaker_nonstop = Column(Boolean, default=False)
    has_speaker_stage = Column(Boolean, default=False)
    giveaways_count = Column(Integer, default=0)
    giveaway_mode = Column(String, default="одинаковые")
    participants_count = Column(Integer, default=0)
    nominations_data = Column(JSON)  # [{name, place1, place2, place3}]
    total_budget = Column(Integer, nullable=True)        # total budget from slider (₽)
    participants_budget = Column(Integer, default=500)   # per-participant gift price (₽)
    participants_use_certificate = Column(Boolean, default=False)
    status = Column(String(30), default="draft")  # draft / pending / approved
    gifts_sent = Column(Boolean, default=False)
    shipped_date = Column(String(20), nullable=True)  # ISO date of actual shipment
    created_at = Column(DateTime, default=datetime.utcnow)

    sets = relationship("GiftSet", back_populates="event", cascade="all, delete-orphan")


class GiftSet(Base):
    __tablename__ = "gift_sets"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    nomination_name = Column(String(200))
    place = Column(String(50))       # 1 / 2 / 3 / участник / гран-при / розыгрыш
    level = Column(String(30))
    items = Column(JSON)             # [{sku_type, sku_id, name, qty, price}]
    total_price = Column(Float, default=0)

    event = relationship("Event", back_populates="sets")


class MonthlyBudget(Base):
    """Planned marketing gift budget per calendar month."""
    __tablename__ = "monthly_budgets"
    id = Column(Integer, primary_key=True, index=True)
    month = Column(String(7), unique=True, nullable=False)  # "2025-06"
    planned = Column(Integer, default=0)  # ₽


class RegionRanking(Base):
    """Top-N pigment rankings per region+zone, filled manually by managers."""
    __tablename__ = "region_rankings"
    id = Column(Integer, primary_key=True, index=True)
    region = Column(String, nullable=False)
    zone = Column(String, nullable=False)  # "Брови" or "Губы"
    pigment_id = Column(Integer, ForeignKey("pigments.id"), nullable=False)
    rank = Column(Integer, nullable=False)  # 1 = top seller
    updated_at = Column(DateTime, default=datetime.utcnow)
    pigment = relationship("Pigment")


class PigmentSettings(Base):
    """Per-region settings: promoted, hidden, sort order."""
    __tablename__ = "pigment_settings"
    id = Column(Integer, primary_key=True, index=True)
    pigment_id = Column(Integer, ForeignKey("pigments.id"), nullable=False)
    region = Column(String, nullable=True)  # None = global
    is_hidden = Column(Boolean, default=False)
    hide_reason = Column(String, nullable=True)  # "out_of_stock" | "discontinued"
    is_promoted = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    pigment = relationship("Pigment")


class Proposal(Base):
    """Incoming event offer that needs a participation decision before becoming an Event."""
    __tablename__ = "proposals"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(300), nullable=False)
    date_text     = Column(String(100), nullable=True)   # free text: "26–27 сентября"
    city          = Column(String(200), nullable=True)
    social_link   = Column(String(500), nullable=True)   # instagram / website
    organizer_name    = Column(String(200), nullable=True)
    organizer_contact = Column(String(300), nullable=True)  # phone / email
    expected_min  = Column(Integer, nullable=True)
    expected_max  = Column(Integer, nullable=True)
    perks         = Column(JSON, nullable=True)   # list: speaker_stage / speaker_nonstop / stand / logo / smm / certificate
    requirements  = Column(Text, nullable=True)   # what they want from FACE
    raw_text      = Column(Text, nullable=True)   # paste original offer message
    status        = Column(String(20), default="new")  # new / approved / rejected
    decision_comment = Column(Text, nullable=True)
    decided_at    = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)


class ConsumableSettings(Base):
    """Per-region settings for consumables."""
    __tablename__ = "consumable_settings"
    id = Column(Integer, primary_key=True, index=True)
    consumable_id = Column(Integer, ForeignKey("consumables.id"), nullable=False)
    region = Column(String, nullable=True)
    is_hidden = Column(Boolean, default=False)
    hide_reason = Column(String, nullable=True)
    gift_priority_override = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    consumable = relationship("Consumable")
