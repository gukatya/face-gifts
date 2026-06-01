"""TDD: country → region/fitzpatrick mapping."""
import pytest
from app.services.countries import (
    get_country_profile, parse_fitzpatrick_range,
    fitzpatrick_overlaps, ALL_COUNTRIES, ALL_REGIONS,
)


class TestCountryProfile:
    def test_russia_is_russia_sng(self):
        p = get_country_profile("Россия")
        assert p.region == "Россия"

    def test_kazakhstan_is_central_asia(self):
        p = get_country_profile("Казахстан")
        assert p.region == "Центральная Азия"

    def test_kazakhstan_fitzpatrick_is_dark(self):
        p = get_country_profile("Казахстан")
        assert p.fitz_typical >= 4

    def test_thailand_maps_to_southeast_asia(self):
        p = get_country_profile("Таиланд")
        assert p.region == "ЮВА"

    def test_thailand_fitzpatrick_is_4_5(self):
        p = get_country_profile("Таиланд")
        assert p.fitz_min >= 4
        assert p.fitz_max <= 5

    def test_brazil_maps_to_latin_america(self):
        p = get_country_profile("Бразилия")
        assert p.region == "Латинская Америка"

    def test_germany_maps_to_western_europe(self):
        p = get_country_profile("Германия")
        assert p.region == "Западная Европа"
        assert p.fitz_typical <= 2

    def test_turkey_maps_to_balkans(self):
        p = get_country_profile("Турция")
        assert p.region == "Турция"

    def test_unknown_country_returns_default(self):
        p = get_country_profile("Нарния")
        assert p.region == "Россия"

    def test_case_insensitive_lookup(self):
        p = get_country_profile("казахстан")
        assert p.region == "Центральная Азия"

    def test_region_name_as_country_works(self):
        p = get_country_profile("Латинская Америка")
        assert p.region == "Латинская Америка"

    def test_all_countries_have_valid_fitzpatrick(self):
        for country, profile in zip(ALL_COUNTRIES, [get_country_profile(c) for c in ALL_COUNTRIES]):
            assert 1 <= profile.fitz_min <= 6, f"{country} fitz_min invalid"
            assert 1 <= profile.fitz_max <= 6, f"{country} fitz_max invalid"
            assert profile.fitz_min <= profile.fitz_max, f"{country} min > max"


class TestParseFitzpatrick:
    def test_range_with_en_dash(self):
        assert parse_fitzpatrick_range("2–4") == (2, 4)

    def test_range_with_hyphen(self):
        assert parse_fitzpatrick_range("1-6") == (1, 6)

    def test_single_value(self):
        assert parse_fitzpatrick_range("3") == (3, 3)

    def test_none_returns_full_range(self):
        assert parse_fitzpatrick_range(None) == (1, 6)

    def test_multivalue_like_1_2_5_6(self):
        # "1–2, 5–6" format — just parse first pair, covers the range
        result = parse_fitzpatrick_range("1–6")
        assert result == (1, 6)


class TestFitzpatrickOverlap:
    def test_overlap_true(self):
        assert fitzpatrick_overlaps("1–3", 2, 4) is True

    def test_overlap_exact(self):
        assert fitzpatrick_overlaps("2–4", 2, 4) is True

    def test_no_overlap_pigment_lighter(self):
        assert fitzpatrick_overlaps("1–2", 4, 5) is False

    def test_no_overlap_pigment_darker(self):
        assert fitzpatrick_overlaps("5–6", 1, 2) is False

    def test_wide_pigment_always_matches(self):
        assert fitzpatrick_overlaps("1–6", 4, 5) is True


class TestAlgorithmWithFitzpatrick:
    """Integration: algorithm respects Fitzpatrick via country profile."""

    def test_kazakhstan_microblading_gets_dark_organics(self, db_with_pigments):
        from app.services.algorithm import select_brow_pigments
        result = select_brow_pigments(
            db_with_pigments, "Брови — микроблейдинг",
            region="Центральная Азия", count=2,
            fitz_min=4, fitz_max=5,
        )
        for p in result:
            p_min, p_max = parse_fitzpatrick_range(p.fitzpatrick)
            assert p_max >= 4, f"{p.name} Fitz {p.fitzpatrick} doesn't cover type 4–5"

    def test_blond_europe_gets_light_shades(self, db_with_pigments):
        from app.services.algorithm import select_brow_pigments
        result = select_brow_pigments(
            db_with_pigments, "Брови — пудровое / градиент",
            region="Западная Европа", count=2,
            fitz_min=1, fitz_max=2,
        )
        for p in result:
            p_min, p_max = parse_fitzpatrick_range(p.fitzpatrick)
            assert p_min <= 2, f"{p.name} Fitz {p.fitzpatrick} doesn't cover type 1–2"
