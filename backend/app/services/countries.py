"""
Country → region + predominant Fitzpatrick type mapping.
Fitzpatrick scale: 1-2 = very light, 3-4 = medium, 5-6 = dark.
"""
from dataclasses import dataclass


@dataclass
class CountryProfile:
    region: str
    fitz_min: int
    fitz_max: int
    fitz_typical: int  # most common single value for tie-breaking


COUNTRY_DB: dict[str, CountryProfile] = {
    # Россия
    "Россия":           CountryProfile("Россия", 1, 3, 2),

    # СНГ
    "Украина":          CountryProfile("СНГ", 2, 3, 2),
    "Беларусь":         CountryProfile("СНГ", 2, 3, 2),
    "Молдова":          CountryProfile("СНГ", 2, 3, 2),

    # Кавказ
    "Грузия":           CountryProfile("Кавказ", 3, 4, 3),
    "Армения":          CountryProfile("Кавказ", 3, 4, 3),
    "Азербайджан":      CountryProfile("Кавказ", 3, 4, 3),

    # Центральная Азия
    "Казахстан":        CountryProfile("Центральная Азия", 4, 5, 4),
    "Кыргызстан":       CountryProfile("Центральная Азия", 4, 5, 4),
    "Узбекистан":       CountryProfile("Центральная Азия", 4, 5, 4),
    "Таджикистан":      CountryProfile("Центральная Азия", 4, 5, 4),
    "Туркменистан":     CountryProfile("Центральная Азия", 4, 5, 4),
    "Монголия":         CountryProfile("Центральная Азия", 4, 5, 4),

    # Турция
    "Турция":           CountryProfile("Турция", 3, 4, 3),

    # Балканы
    "Сербия":           CountryProfile("Балканы", 2, 4, 3),
    "Болгария":         CountryProfile("Балканы", 2, 4, 3),
    "Хорватия":         CountryProfile("Балканы", 2, 4, 3),
    "Босния":           CountryProfile("Балканы", 2, 4, 3),
    "Черногория":       CountryProfile("Балканы", 2, 4, 3),
    "Македония":        CountryProfile("Балканы", 2, 4, 3),
    "Албания":          CountryProfile("Балканы", 3, 4, 3),
    "Румыния":          CountryProfile("Балканы", 2, 4, 3),
    "Греция":           CountryProfile("Балканы", 3, 4, 3),

    # Западная Европа
    "Германия":         CountryProfile("Западная Европа", 1, 3, 2),
    "Франция":          CountryProfile("Западная Европа", 1, 3, 2),
    "Великобритания":   CountryProfile("Западная Европа", 1, 3, 2),
    "Нидерланды":       CountryProfile("Западная Европа", 1, 3, 2),
    "Бельгия":          CountryProfile("Западная Европа", 1, 3, 2),
    "Австрия":          CountryProfile("Западная Европа", 1, 3, 2),
    "Швейцария":        CountryProfile("Западная Европа", 1, 3, 2),
    "Швеция":           CountryProfile("Западная Европа", 1, 3, 2),
    "Норвегия":         CountryProfile("Западная Европа", 1, 3, 2),
    "Дания":            CountryProfile("Западная Европа", 1, 3, 2),
    "Финляндия":        CountryProfile("Западная Европа", 1, 3, 2),
    "Польша":           CountryProfile("Западная Европа", 1, 3, 2),
    "Чехия":            CountryProfile("Западная Европа", 1, 3, 2),
    "Словакия":         CountryProfile("Западная Европа", 1, 3, 2),
    "Венгрия":          CountryProfile("Западная Европа", 1, 3, 2),
    "Португалия":       CountryProfile("Западная Европа", 1, 3, 2),
    "Испания":          CountryProfile("Западная Европа", 1, 3, 2),
    "Италия":           CountryProfile("Западная Европа", 1, 3, 2),
    "Ирландия":         CountryProfile("Западная Европа", 1, 3, 2),
    "Австралия":        CountryProfile("Западная Европа", 1, 3, 2),
    "Новая Зеландия":   CountryProfile("Западная Европа", 1, 3, 2),

    # Ближний Восток
    "ОАЭ":              CountryProfile("Ближний Восток", 3, 5, 4),
    "Саудовская Аравия": CountryProfile("Ближний Восток", 3, 5, 4),
    "Израиль":          CountryProfile("Ближний Восток", 3, 5, 4),
    "Иордания":         CountryProfile("Ближний Восток", 3, 5, 4),
    "Ливан":            CountryProfile("Ближний Восток", 3, 5, 4),
    "Иран":             CountryProfile("Ближний Восток", 3, 5, 4),
    "Ирак":             CountryProfile("Ближний Восток", 3, 5, 4),
    "Кувейт":           CountryProfile("Ближний Восток", 3, 5, 4),
    "Катар":            CountryProfile("Ближний Восток", 3, 5, 4),
    "Бахрейн":          CountryProfile("Ближний Восток", 3, 5, 4),
    "Оман":             CountryProfile("Ближний Восток", 3, 5, 4),
    "Египет":           CountryProfile("Ближний Восток", 3, 5, 4),
    "Марокко":          CountryProfile("Ближний Восток", 3, 5, 4),
    "Тунис":            CountryProfile("Ближний Восток", 3, 5, 4),

    # ЮВА
    "Таиланд":          CountryProfile("ЮВА", 4, 5, 4),
    "Вьетнам":          CountryProfile("ЮВА", 4, 5, 4),
    "Индонезия":        CountryProfile("ЮВА", 4, 5, 4),
    "Малайзия":         CountryProfile("ЮВА", 4, 5, 4),
    "Филиппины":        CountryProfile("ЮВА", 4, 5, 4),
    "Сингапур":         CountryProfile("ЮВА", 4, 5, 4),
    "Камбоджа":         CountryProfile("ЮВА", 4, 5, 4),
    "Мьянма":           CountryProfile("ЮВА", 4, 5, 4),

    # Южная Азия
    "Индия":            CountryProfile("Южная Азия", 4, 6, 5),
    "Пакистан":         CountryProfile("Южная Азия", 4, 6, 5),
    "Бангладеш":        CountryProfile("Южная Азия", 4, 6, 5),
    "Шри-Ланка":        CountryProfile("Южная Азия", 4, 6, 5),

    # Восточная Азия
    "Китай":            CountryProfile("Восточная Азия", 3, 5, 4),
    "Япония":           CountryProfile("Восточная Азия", 3, 5, 4),
    "Южная Корея":      CountryProfile("Восточная Азия", 3, 5, 4),
    "Северная Корея":   CountryProfile("Восточная Азия", 3, 5, 4),
    "Тайвань":          CountryProfile("Восточная Азия", 3, 5, 4),
    "Гонконг":          CountryProfile("Восточная Азия", 3, 5, 4),

    # Латинская Америка
    "Бразилия":         CountryProfile("Латинская Америка", 3, 5, 4),
    "Мексика":          CountryProfile("Латинская Америка", 3, 5, 4),
    "Аргентина":        CountryProfile("Латинская Америка", 3, 5, 4),
    "Колумбия":         CountryProfile("Латинская Америка", 3, 5, 4),
    "Перу":             CountryProfile("Латинская Америка", 3, 5, 4),
    "Чили":             CountryProfile("Латинская Америка", 3, 5, 4),
    "Венесуэла":        CountryProfile("Латинская Америка", 3, 5, 4),
    "Эквадор":          CountryProfile("Латинская Америка", 3, 5, 4),
    "Боливия":          CountryProfile("Латинская Америка", 3, 5, 4),
    "Куба":             CountryProfile("Латинская Америка", 3, 5, 4),
    "Доминиканская Республика": CountryProfile("Латинская Америка", 3, 5, 4),

    # Северная Америка
    "США":              CountryProfile("Северная Америка", 2, 5, 3),
    "Канада":           CountryProfile("Северная Америка", 2, 5, 3),

    # Африка
    "ЮАР":              CountryProfile("Африка", 5, 6, 5),
    "Нигерия":          CountryProfile("Африка", 5, 6, 5),
    "Кения":            CountryProfile("Африка", 5, 6, 5),
    "Эфиопия":          CountryProfile("Африка", 5, 6, 5),
}

# Region-level fallback profiles (when country not found)
REGION_FALLBACKS: dict[str, CountryProfile] = {
    "Россия":           CountryProfile("Россия", 1, 3, 2),
    "СНГ":              CountryProfile("СНГ", 2, 3, 2),
    "Кавказ":           CountryProfile("Кавказ", 3, 4, 3),
    "Центральная Азия": CountryProfile("Центральная Азия", 4, 5, 4),
    "Турция":           CountryProfile("Турция", 3, 4, 3),
    "Балканы":          CountryProfile("Балканы", 2, 4, 3),
    "Западная Европа":  CountryProfile("Западная Европа", 1, 3, 2),
    "Ближний Восток":   CountryProfile("Ближний Восток", 3, 5, 4),
    "ЮВА":              CountryProfile("ЮВА", 4, 5, 4),
    "Южная Азия":       CountryProfile("Южная Азия", 4, 6, 5),
    "Восточная Азия":   CountryProfile("Восточная Азия", 3, 5, 4),
    "Латинская Америка": CountryProfile("Латинская Америка", 3, 5, 4),
    "Северная Америка": CountryProfile("Северная Америка", 2, 5, 3),
    "Африка":           CountryProfile("Африка", 5, 6, 5),
    # Legacy region names for backward compatibility
    "Россия / СНГ":         CountryProfile("Россия", 2, 3, 2),
    "Балканы / Турция":     CountryProfile("Балканы", 2, 4, 3),
    "Юго-Восточная Азия":   CountryProfile("ЮВА", 4, 5, 4),
}

# Similar region fallback for DB rankings lookup
SIMILAR_REGIONS: dict[str, str] = {
    "СНГ": "Россия",
    "Кавказ": "Балканы",
    "Турция": "Ближний Восток",
    "Балканы": "Западная Европа",
    "Южная Азия": "ЮВА",
    "Северная Америка": "Западная Европа",
    "Африка": "Южная Азия",
}

ALL_REGIONS = sorted(set(p.region for p in COUNTRY_DB.values()))
ALL_COUNTRIES = sorted(COUNTRY_DB.keys())


def get_country_profile(country: str) -> CountryProfile:
    """Return profile for a country, with fuzzy fallback."""
    if country in COUNTRY_DB:
        return COUNTRY_DB[country]
    # Case-insensitive search
    lower = country.lower()
    for k, v in COUNTRY_DB.items():
        if k.lower() == lower:
            return v
    # Try region name as-is
    if country in REGION_FALLBACKS:
        return REGION_FALLBACKS[country]
    # Default: Russia
    return CountryProfile("Россия", 2, 3, 2)


def parse_fitzpatrick_range(fitz_str) -> tuple:
    """Parse '2–4' or '1-6' → (2, 4). Returns (1, 6) for unknown."""
    if not fitz_str:
        return (1, 6)
    # Normalise dash variants
    s = fitz_str.replace("–", "-").replace("—", "-").strip()
    if "-" in s:
        parts = s.split("-")
        try:
            return (int(parts[0].strip()), int(parts[1].strip()))
        except (ValueError, IndexError):
            pass
    try:
        v = int(s)
        return (v, v)
    except ValueError:
        return (1, 6)


def fitzpatrick_overlaps(pig_fitz, region_min: int, region_max: int) -> bool:
    """True if the pigment's Fitzpatrick range overlaps with the region's range."""
    p_min, p_max = parse_fitzpatrick_range(pig_fitz)
    return p_min <= region_max and p_max >= region_min
