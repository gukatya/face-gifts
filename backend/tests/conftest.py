import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Pigment, Consumable, Nomination


TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def engine():
    e = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=e)
    return e


@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def db_with_pigments(db):
    """Seed a minimal set of pigments for algorithm tests."""
    pigments = [
        # Brows - hybrid line
        Pigment(number=35, zone="Брови", line="Базовая (гибрид)", name="Песочный",
                temperature="тёплый", saturation="мягкая", role="база",
                fitzpatrick="1–2", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1290),
        Pigment(number=36, zone="Брови", line="Базовая (гибрид)", name="Орех",
                temperature="нейтральный", saturation="средняя", role="база",
                fitzpatrick="2–4", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1290),
        Pigment(number=37, zone="Брови", line="Базовая (гибрид)", name="Корица",
                temperature="тёплый", saturation="средняя", role="модификатор",
                fitzpatrick="2–4", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1290),
        Pigment(number=38, zone="Брови", line="Базовая (гибрид)", name="Мокко",
                temperature="холодный", saturation="насыщенный", role="база",
                fitzpatrick="3–5", is_corrector=False, geo_europe=False, geo_asia=True,
                priority="стандарт", price_ru=1290),
        Pigment(number=40, zone="Брови", line="Базовая (гибрид)", name="Кирпичный",
                temperature="тёплый", saturation="средняя", role="корректор",
                fitzpatrick="2–5", is_corrector=True, geo_europe=True, geo_asia=True,
                priority="стандарт", price_ru=1290),
        # Brows - minerals
        Pigment(number=49, zone="Брови", line="Минералы", name="Блонд",
                temperature="нейтральный", saturation="мягкая", role="база",
                fitzpatrick="1–2", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1590),
        Pigment(number=50, zone="Брови", line="Минералы", name="Лайт",
                temperature="нейтральный", saturation="средняя", role="база",
                fitzpatrick="2–3", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1590),
        Pigment(number=51, zone="Брови", line="Минералы", name="Медиум",
                temperature="нейтральный", saturation="средняя", role="база",
                fitzpatrick="2–4", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1590),
        Pigment(number=52, zone="Брови", line="Минералы", name="Ворм",
                temperature="тёплый", saturation="средняя", role="модификатор",
                fitzpatrick="2–4", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1590),
        Pigment(number=53, zone="Брови", line="Минералы", name="Дарк",
                temperature="прохладный", saturation="насыщенный", role="база",
                fitzpatrick="4–5", is_corrector=False, geo_europe=False, geo_asia=True,
                priority="стандарт", price_ru=1590),
        # Brows - organic
        Pigment(number=43, zone="Брови", line="Organic brows", name="Лео",
                temperature="нейтральный", saturation="насыщенный", role="база",
                fitzpatrick="1–2", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1290),
        Pigment(number=44, zone="Брови", line="Organic brows", name="Питт",
                temperature="нейтральный", saturation="насыщенный", role="база",
                fitzpatrick="2–4", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1290),
        Pigment(number=47, zone="Брови", line="Organic brows", name="Киану",
                temperature="холодный", saturation="насыщенный", role="база",
                fitzpatrick="4–6", is_corrector=False, geo_europe=False, geo_asia=True,
                priority="стандарт", price_ru=1290),
        # Lips
        Pigment(number=1, zone="Губы", line="Organic love", name="Джоли",
                temperature="нейтральный", saturation="насыщенный", role="база",
                fitzpatrick="1–6", is_corrector=False, geo_europe=True, geo_asia=True,
                priority="стандарт", price_ru=1290),
        Pigment(number=7, zone="Губы", line="Organic love", name="Виктория",
                temperature="нейтральный", saturation="насыщенный", role="база",
                fitzpatrick="1–6", is_corrector=False, geo_europe=True, geo_asia=True,
                priority="стандарт", price_ru=1290),
        Pigment(number=16, zone="Губы", line="Базовая линия", name="Карамель",
                temperature="нейтральный", saturation="средняя", role="база",
                fitzpatrick="1–6", is_corrector=False, geo_europe=True, geo_asia=True,
                priority="стандарт", price_ru=1290),
        Pigment(number=34, zone="Губы", line="Базовая линия", name="Сахар",
                temperature="нейтральный", saturation="средняя", role="база",
                fitzpatrick="1–6", is_corrector=False, geo_europe=True, geo_asia=True,
                priority="продвигаем", price_ru=1290),
        Pigment(number=4, zone="Губы", line="Organic love", name="Тайра",
                temperature="холодный", saturation="насыщенный", role="акцент",
                fitzpatrick="1–4", is_corrector=False, geo_europe=True, geo_asia=False,
                priority="стандарт", price_ru=1290),
    ]
    db.add_all(pigments)
    db.flush()

    consumables = [
        Consumable(number=14, name="Заживляющий гель саше 5г (1 шт)", category="Гели / вазелин",
                   zone="Губы", price_ru=19, has_mini=True, gift_priority="высокий",
                   notes="Постуход для клиента"),
        Consumable(number=27, name="Уходовые салфетки с хлоргексидином (10шт)", category="Уход / прочее",
                   zone="Все зоны", price_ru=100, has_mini=True, gift_priority="высокий",
                   notes="Постуход"),
        Consumable(number=11, name="Вторичка ICE Gel 33мл", category="Анестезия",
                   zone="Все зоны", price_ru=1790, has_mini=False, gift_priority="высокий",
                   notes="Самый продаваемый"),
        Consumable(number=12, name="Вторичка ICE Gel 12мл (мини)", category="Анестезия",
                   zone="Все зоны", price_ru=590, has_mini=True, gift_priority="средний",
                   notes="Мини-версия"),
        Consumable(number=28, name="Ремувер FACE", category="Уход / прочее",
                   zone="Все зоны", price_ru=2590, has_mini=False, gift_priority="средний",
                   notes="Гран-при"),
    ]
    db.add_all(consumables)
    db.flush()
    return db
