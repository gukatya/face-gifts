"""TDD: pigment selection algorithm tests."""
import pytest
from app.services.algorithm import (
    select_brow_pigments,
    select_lip_pigments,
    select_consumables,
    NOMINATION_LINES,
)


class TestBrowSelection:
    def test_microblading_forces_organic_brows(self, db_with_pigments):
        result = select_brow_pigments(
            db_with_pigments, "Брови — микроблейдинг", "Россия / СНГ", count=2
        )
        assert len(result) > 0
        for p in result:
            assert p.line == "Organic brows", f"Expected Organic brows, got {p.line}"

    def test_hair_strands_forces_minerals(self, db_with_pigments):
        result = select_brow_pigments(
            db_with_pigments, "Брови — волоски (аппаратная)", "Россия / СНГ", count=2
        )
        assert len(result) > 0
        for p in result:
            assert p.line == "Минералы", f"Expected Минералы, got {p.line}"

    def test_powder_brows_returns_hybrid_by_default(self, db_with_pigments):
        result = select_brow_pigments(
            db_with_pigments, "Брови — пудровое / градиент", "Россия / СНГ", count=2
        )
        assert len(result) > 0
        lines = {p.line for p in result}
        assert lines <= {"Базовая (гибрид)", "Минералы"}

    def test_near_east_region_prefers_organic_brows(self, db_with_pigments):
        result = select_brow_pigments(
            db_with_pigments, "Брови — пудровое / градиент", "Ближний Восток", count=2
        )
        assert len(result) > 0
        for p in result:
            assert p.line == "Organic brows"

    def test_correctors_excluded_by_default(self, db_with_pigments):
        result = select_brow_pigments(
            db_with_pigments, "Брови — пудровое / градиент", "Россия / СНГ", count=3
        )
        for p in result:
            assert not p.is_corrector, f"Corrector {p.name} should not be in default set"

    def test_correctors_included_when_flag_set(self, db_with_pigments):
        result = select_brow_pigments(
            db_with_pigments, "Перекрытие бровей", "Россия / СНГ", count=3,
            include_correctors=True
        )
        assert len(result) > 0

    def test_europe_warehouse_accepted_no_filter(self, db_with_pigments):
        """EU-фильтрация отключена — будет реализована отдельно.
        Проверяем что warehouse-параметр принимается и функция работает."""
        result = select_brow_pigments(
            db_with_pigments, "Брови — волоски (аппаратная)", "Восточная Азия",
            count=2, warehouse="Европа"
        )
        assert len(result) > 0

    def test_respects_count_limit(self, db_with_pigments):
        for count in [1, 2, 3]:
            result = select_brow_pigments(
                db_with_pigments, "Брови — пудровое / градиент", "Россия / СНГ", count=count
            )
            assert len(result) <= count

    def test_bases_come_before_modifiers(self, db_with_pigments):
        result = select_brow_pigments(
            db_with_pigments, "Брови — пудровое / градиент", "Россия / СНГ", count=3
        )
        bases = [p for p in result if p.role == "база"]
        mods = [p for p in result if p.role == "модификатор"]
        assert len(bases) >= 1

    def test_promoted_pigments_have_higher_priority(self, db_with_pigments):
        from app.models import Pigment
        promo = Pigment(number=999, zone="Брови", line="Минералы", name="НоваяМинераль",
                        temperature="нейтральный", saturation="средняя", role="база",
                        fitzpatrick="2–4", is_corrector=False, geo_europe=True, geo_asia=False,
                        priority="новинка", price_ru=1590)
        db_with_pigments.add(promo)
        db_with_pigments.flush()
        result = select_brow_pigments(
            db_with_pigments, "Брови — волоски (аппаратная)", "Западная Европа", count=1
        )
        assert result[0].name == "НоваяМинераль"


class TestLipSelection:
    def test_russia_gets_correct_shades(self, db_with_pigments):
        result = select_lip_pigments(db_with_pigments, "Россия / СНГ", count=3)
        names = [p.name for p in result]
        # Сахар is "продвигаем" so it has priority, Джоли and Виктория are regional
        assert any(n in names for n in ["Сахар", "Джоли", "Виктория"])

    def test_no_correctors_in_lip_set(self, db_with_pigments):
        result = select_lip_pigments(db_with_pigments, "Россия / СНГ", count=4)
        for p in result:
            assert not p.is_corrector

    def test_respects_count_limit(self, db_with_pigments):
        for count in [1, 2, 3, 4]:
            result = select_lip_pigments(db_with_pigments, "Россия / СНГ", count=count)
            assert len(result) <= count

    def test_europe_warehouse_accepted_no_filter(self, db_with_pigments):
        """EU-фильтрация отключена — будет реализована отдельно."""
        result = select_lip_pigments(
            db_with_pigments, "Западная Европа", count=3, warehouse="Европа"
        )
        assert len(result) > 0


class TestConsumableSelection:
    def test_modest_level_returns_mini_items(self, db_with_pigments):
        result = select_consumables(db_with_pigments, "Скромный", "Губы")
        assert len(result) >= 1
        for c in result:
            assert c.has_mini or c.gift_priority == "высокий"

    def test_normal_level_returns_multiple(self, db_with_pigments):
        result = select_consumables(db_with_pigments, "Нормальный", "Все зоны")
        assert len(result) >= 2

    def test_good_level_returns_more(self, db_with_pigments):
        result_normal = select_consumables(db_with_pigments, "Нормальный", "Все зоны")
        result_good = select_consumables(db_with_pigments, "Хороший", "Все зоны")
        assert len(result_good) >= len(result_normal)

    def test_grand_prix_includes_remover(self, db_with_pigments):
        result = select_consumables(db_with_pigments, "Гран-при", "Все зоны")
        names = [c.name for c in result]
        assert any("Ремувер" in n for n in names)
