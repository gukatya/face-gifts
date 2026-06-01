"""TDD: level calculator tests."""
import pytest
from app.services.calculator import calc_level_total, calc_all_levels, LEVEL_COSTS


def make_event(**kwargs):
    defaults = {
        "nominations": [{"name": "Брови", "place1": 1, "place2": 2, "place3": 3}],
        "grand_prix_count": 0,
        "giveaways_count": 0,
        "participants_count": 0,
    }
    defaults.update(kwargs)
    return defaults


class TestCalcLevelTotal:
    def test_zero_event_returns_zero(self):
        event = make_event(nominations=[], grand_prix_count=0)
        assert calc_level_total(event, "Нормальный") == 0

    def test_single_nomination_3_places(self):
        event = make_event(nominations=[{"name": "Брови", "place1": 1, "place2": 1, "place3": 1}])
        total = calc_level_total(event, "Нормальный")
        expected = (
            1 * LEVEL_COSTS["Нормальный"]["1"]
            + 1 * LEVEL_COSTS["Нормальный"]["2"]
            + 1 * LEVEL_COSTS["Нормальный"]["3"]
        )
        assert total == expected

    def test_grand_prix_adds_premium_cost(self):
        without = calc_level_total(make_event(), "Нормальный")
        with_gp = calc_level_total(make_event(grand_prix_count=1), "Нормальный")
        assert with_gp == without + LEVEL_COSTS["Гран-при"]["гран-при"]

    def test_giveaways_use_modest_price(self):
        event = make_event(nominations=[], giveaways_count=5)
        total = calc_level_total(event, "Нормальный")
        assert total == 5 * LEVEL_COSTS["Скромный"]["розыгрыш"]

    def test_participants_use_modest_price(self):
        event = make_event(nominations=[], participants_count=10)
        total = calc_level_total(event, "Хороший")
        assert total == 10 * LEVEL_COSTS["Скромный"]["участник"]

    def test_multiple_nominations_sum_correctly(self):
        event = make_event(nominations=[
            {"name": "Брови", "place1": 2, "place2": 3, "place3": 5},
            {"name": "Губы", "place1": 1, "place2": 2, "place3": 3},
        ])
        c = LEVEL_COSTS["Нормальный"]
        expected = (
            (2 + 1) * c["1"] + (3 + 2) * c["2"] + (5 + 3) * c["3"]
        )
        assert calc_level_total(event, "Нормальный") == expected

    def test_modest_level_cheaper_than_normal(self):
        event = make_event()
        assert calc_level_total(event, "Скромный") < calc_level_total(event, "Нормальный")

    def test_normal_cheaper_than_good(self):
        event = make_event()
        assert calc_level_total(event, "Нормальный") < calc_level_total(event, "Хороший")


class TestCalcAllLevels:
    def test_returns_all_three_levels(self):
        result = calc_all_levels(make_event())
        assert set(result.keys()) == {"Скромный", "Нормальный", "Хороший"}

    def test_all_values_are_positive(self):
        event = make_event(nominations=[{"name": "X", "place1": 1, "place2": 1, "place3": 1}])
        result = calc_all_levels(event)
        for level, val in result.items():
            assert val > 0, f"{level} should be positive"

    def test_ascending_order(self):
        event = make_event(nominations=[{"name": "X", "place1": 1, "place2": 1, "place3": 1}])
        result = calc_all_levels(event)
        assert result["Скромный"] < result["Нормальный"] < result["Хороший"]
