"""TDD: API endpoint tests."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.services.seed import seed_all

TEST_DB_URL = "sqlite:///./test_api.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSession()
    seed_all(db)
    db.close()
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


SAMPLE_EVENT = {
    "name": "Чемпионат Москва 2025",
    "date": "2025-06-01",
    "country": "Россия",
    "region": "Россия / СНГ",
    "warehouse": "Россия",
    "recipients": "только победители",
    "mode": "по номинациям",
    "level": "Нормальный",
    "grand_prix_count": 1,
    "giveaways_count": 2,
    "participants_count": 0,
    "nominations": [
        {"name": "Брови — пудровое / градиент", "place1": 1, "place2": 2, "place3": 3},
        {"name": "Губы — акварель / помадный / омбрэ", "place1": 1, "place2": 1, "place3": 2},
    ],
}


class TestHealth:
    def test_health_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestEvents:
    def test_list_events_empty_initially(self, client):
        r = client.get("/api/events/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_event(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == SAMPLE_EVENT["name"]
        assert data["status"] == "draft"
        assert data["grand_prix_count"] == 1
        assert "id" in data

    def test_get_event(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        r2 = client.get(f"/api/events/{event_id}")
        assert r2.status_code == 200
        assert r2.json()["id"] == event_id

    def test_get_nonexistent_event_returns_404(self, client):
        r = client.get("/api/events/99999")
        assert r.status_code == 404

    def test_delete_event(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        r2 = client.delete(f"/api/events/{event_id}")
        assert r2.status_code == 204
        r3 = client.get(f"/api/events/{event_id}")
        assert r3.status_code == 404


class TestCalculator:
    def test_calculate_returns_three_levels(self, client):
        payload = {
            "nominations": [{"name": "Брови", "place1": 1, "place2": 2, "place3": 3}],
            "grand_prix_count": 0,
            "giveaways_count": 0,
            "participants_count": 0,
        }
        r = client.post("/api/events/calculate", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "Скромный" in data
        assert "Нормальный" in data
        assert "Хороший" in data

    def test_calculate_ascending_order(self, client):
        payload = {
            "nominations": [{"name": "X", "place1": 1, "place2": 1, "place3": 1}],
            "grand_prix_count": 0,
            "giveaways_count": 0,
            "participants_count": 0,
        }
        r = client.post("/api/events/calculate", json=payload)
        data = r.json()
        assert data["Скромный"] < data["Нормальный"] < data["Хороший"]


class TestDraftGeneration:
    def test_generate_creates_sets(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        r2 = client.post(f"/api/events/{event_id}/generate")
        assert r2.status_code == 200
        sets = r2.json()
        assert len(sets) > 0

    def test_draft_has_items(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        client.post(f"/api/events/{event_id}/generate")
        r2 = client.get(f"/api/events/{event_id}/sets")
        sets = r2.json()
        for s in sets:
            assert len(s["items"]) > 0, f"Set {s['nomination_name']}/{s['place']} has no items"

    def test_grand_prix_set_generated(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        r2 = client.post(f"/api/events/{event_id}/generate")
        places = [s["place"] for s in r2.json()]
        assert "гран-при" in places

    def test_giveaway_sets_generated(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        r2 = client.post(f"/api/events/{event_id}/generate")
        places = [s["place"] for s in r2.json()]
        assert "розыгрыш" in places

    def test_regenerate_replaces_sets(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        r2 = client.post(f"/api/events/{event_id}/generate")
        count1 = len(r2.json())
        r3 = client.post(f"/api/events/{event_id}/generate")
        count2 = len(r3.json())
        assert count1 == count2


class TestKnowledge:
    def test_list_pigments(self, client):
        r = client.get("/api/knowledge/pigments")
        assert r.status_code == 200
        pigments = r.json()
        assert len(pigments) > 50

    def test_filter_pigments_by_zone(self, client):
        r = client.get("/api/knowledge/pigments?zone=Губы")
        data = r.json()
        assert all(p["zone"] == "Губы" for p in data)

    def test_list_consumables(self, client):
        r = client.get("/api/knowledge/consumables")
        assert r.status_code == 200
        assert len(r.json()) > 10

    def test_list_nominations(self, client):
        r = client.get("/api/knowledge/nominations")
        assert r.status_code == 200
        assert len(r.json()) >= 8


class TestExport:
    def test_export_returns_xlsx(self, client):
        r = client.post("/api/events/", json=SAMPLE_EVENT)
        event_id = r.json()["id"]
        client.post(f"/api/events/{event_id}/generate")
        r2 = client.get(f"/api/events/{event_id}/export")
        assert r2.status_code == 200
        assert "spreadsheetml" in r2.headers["content-type"]
        assert len(r2.content) > 1000

    def test_export_without_draft_returns_400(self, client):
        r = client.post("/api/events/", json={**SAMPLE_EVENT, "name": "NoDraft"})
        event_id = r.json()["id"]
        r2 = client.get(f"/api/events/{event_id}/export")
        assert r2.status_code == 400
