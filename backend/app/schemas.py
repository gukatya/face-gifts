from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NominationInput(BaseModel):
    name: str
    place1: int = 0
    place2: int = 0
    place3: int = 0


class EventCreate(BaseModel):
    name: str
    date: str
    country: str
    region: Optional[str] = None   # auto-resolved from country if omitted
    warehouse: str = "Россия"
    recipients: str = "только победители"
    mode: str = "по номинациям"
    level: str = "Нормальный"
    grand_prix_count: int = 0
    has_trade_booth: bool = False
    has_speaker_nonstop: bool = False
    has_speaker_stage: bool = False
    giveaways_count: int = 0
    giveaway_mode: str = "одинаковые"
    participants_count: int = 0
    nominations: list[NominationInput] = []
    total_budget: Optional[int] = None
    participants_budget: int = 500
    participants_use_certificate: bool = False


class EventOut(BaseModel):
    id: int
    name: str
    date: str
    country: str
    region: str
    warehouse: str
    recipients: str = "только победители"
    mode: str
    level: str
    grand_prix_count: int = 0
    has_trade_booth: bool = False
    has_speaker_nonstop: bool = False
    has_speaker_stage: bool = False
    giveaways_count: int
    giveaway_mode: str = "одинаковые"
    participants_count: int
    nominations_data: Optional[list] = None
    status: str
    gifts_sent: bool = False
    shipped_date: Optional[str] = None
    created_at: datetime
    total_budget: Optional[int] = None
    participants_budget: int = 500
    participants_use_certificate: bool = False

    model_config = {"from_attributes": True}


class MonthlyBudgetIn(BaseModel):
    planned: int


class MonthlyBudgetOut(BaseModel):
    id: int
    month: str
    planned: int
    model_config = {"from_attributes": True}


class GiftSetItemOut(BaseModel):
    sku_type: str
    sku_id: int
    name: str
    qty: int
    price: float


class GiftSetOut(BaseModel):
    id: int
    event_id: int
    nomination_name: str
    place: str
    level: str
    items: list[dict]
    total_price: float

    model_config = {"from_attributes": True}


class GiftSetItemsUpdate(BaseModel):
    items: list[dict]


class CalcRequest(BaseModel):
    nominations: list[NominationInput]
    grand_prix_count: int = 0
    giveaways_count: int = 0
    participants_count: int = 0


class CalcResponse(BaseModel):
    Скромный: int
    Нормальный: int
    Хороший: int


class PigmentOut(BaseModel):
    id: int
    number: Optional[int]
    zone: Optional[str]
    line: Optional[str]
    name: Optional[str]
    temperature: Optional[str]
    saturation: Optional[str]
    role: Optional[str]
    fitzpatrick: Optional[str]
    is_corrector: bool
    geo_europe: bool
    geo_asia: bool
    priority: Optional[str]
    price_ru: Optional[float]

    model_config = {"from_attributes": True}


class ConsumableOut(BaseModel):
    id: int
    number: Optional[int]
    name: Optional[str]
    category: Optional[str]
    zone: Optional[str]
    price_ru: Optional[float]
    has_mini: bool
    gift_priority: Optional[str]

    model_config = {"from_attributes": True}


class RegionRankingItem(BaseModel):
    pigment_id: int
    rank: int


class RegionRankingOut(BaseModel):
    region: str
    zone: str
    rankings: list[RegionRankingItem]


class PigmentSettingsIn(BaseModel):
    region: Optional[str] = None
    is_hidden: bool = False
    hide_reason: Optional[str] = None
    is_promoted: bool = False
    sort_order: int = 0


class PigmentWithSettings(BaseModel):
    id: int
    number: Optional[int]
    zone: Optional[str]
    line: Optional[str]
    name: Optional[str]
    role: Optional[str]
    fitzpatrick: Optional[str]
    is_corrector: bool
    priority: Optional[str]
    price_ru: Optional[float]
    price_eu: Optional[float] = None
    is_mini: bool = False
    volume_ml: Optional[str] = None
    # settings for selected region
    is_hidden: bool = False
    hide_reason: Optional[str] = None
    is_promoted: bool = False
    sort_order: int = 0
    model_config = {"from_attributes": True}


class PigmentCreate(BaseModel):
    zone: str
    line: Optional[str] = None
    name: str
    temperature: Optional[str] = None
    saturation: Optional[str] = None
    role: Optional[str] = None
    fitzpatrick: Optional[str] = None
    is_corrector: bool = False
    priority: Optional[str] = "стандарт"
    price_ru: Optional[float] = None
    price_eu: Optional[float] = None
    is_mini: bool = False
    volume_ml: Optional[str] = None


class PigmentUpdate(PigmentCreate):
    pass


class ConsumableSettingsIn(BaseModel):
    region: Optional[str] = None
    is_hidden: bool = False
    hide_reason: Optional[str] = None
    gift_priority_override: Optional[str] = None
    sort_order: int = 0


class ConsumableWithSettings(BaseModel):
    id: int
    number: Optional[int]
    name: Optional[str]
    category: Optional[str]
    zone: Optional[str]
    price_ru: Optional[float]
    price_eu: Optional[float] = None
    has_mini: bool
    gift_priority: Optional[str]
    is_hidden: bool = False
    hide_reason: Optional[str] = None
    gift_priority_override: Optional[str] = None
    sort_order: int = 0
    model_config = {"from_attributes": True}


class ConsumableCreate(BaseModel):
    name: str
    category: Optional[str] = None
    zone: Optional[str] = None
    price_ru: Optional[float] = None
    price_eu: Optional[float] = None
    has_mini: bool = False
    gift_priority: Optional[str] = "средний"


class ConsumableUpdate(ConsumableCreate):
    pass
