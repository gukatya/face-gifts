"""
Level calculator for gift set pricing.
"""
from typing import TypedDict

# Approximate cost ranges per level and place (RU prices)
LEVEL_COSTS: dict[str, dict[str, int]] = {
    "Скромный": {
        "3": 650,
        "участник": 650,
        "розыгрыш": 650,
    },
    "Нормальный": {
        "3": 1750,
        "2": 3000,
        "1": 4500,
    },
    "Хороший": {
        "3": 3500,
        "2": 6000,
        "1": 8500,
    },
    "Гран-при": {
        "гран-при": 12500,
    },
}


class NominationInput(TypedDict):
    name: str
    place1: int  # count of 1st place
    place2: int
    place3: int


class EventInput(TypedDict):
    nominations: list[NominationInput]
    grand_prix_count: int
    giveaways_count: int
    participants_count: int


def calc_level_total(event: EventInput, level: str) -> int:
    """Calculate total cost for an event at a given gift level."""
    total = 0
    costs = LEVEL_COSTS.get(level, LEVEL_COSTS["Нормальный"])

    for nom in event["nominations"]:
        total += nom["place1"] * costs.get("1", costs.get("3", 650))
        total += nom["place2"] * costs.get("2", costs.get("3", 650))
        total += nom["place3"] * costs.get("3", 650)

    for _ in range(event.get("grand_prix_count", 0)):
        total += LEVEL_COSTS["Гран-при"]["гран-при"]

    modest_cost = LEVEL_COSTS["Скромный"]["участник"]
    total += event["giveaways_count"] * modest_cost
    total += event["participants_count"] * modest_cost

    return total


def calc_all_levels(event: EventInput) -> dict[str, int]:
    """Return totals for all three levels simultaneously."""
    return {
        "Скромный": calc_level_total(event, "Скромный"),
        "Нормальный": calc_level_total(event, "Нормальный"),
        "Хороший": calc_level_total(event, "Хороший"),
    }
