"""Unit tests for TranslationEngine, adapter normalization, caching, retry, and travel workflows."""
from __future__ import annotations

import pytest

from app.schemas import HotelReviewInput
from app.services.adapter import (
    extract_pronunciation,
    normalize_confidence,
    normalize_detected_lang,
    normalize_pronunciation,
)
from app.services.translator_service import (
    InvalidLanguageCodeError,
    TranslationEngine,
    UpstreamTranslationError,
)
from tests.conftest import FakeGoogleTransAdapter


def test_normalize_confidence_handles_polymorphic_values() -> None:
    assert normalize_confidence(0.987654) == 0.9877
    assert normalize_confidence(1) == 1.0
    assert normalize_confidence([0.85, 0.15]) == 0.85
    assert normalize_confidence([]) is None
    assert normalize_confidence(None) is None
    assert normalize_confidence("invalid") is None


def test_normalize_pronunciation_filters_echoed_origin_and_translated() -> None:
    assert normalize_pronunciation(None, "Xin chào", "Hello") is None
    assert normalize_pronunciation("", "Xin chào", "Hello") is None
    # Echoed origin must be filtered out (googletrans default fallback)
    assert normalize_pronunciation("Hello", "Xin chào", "Hello") is None
    # Echoed translation must be filtered out
    assert normalize_pronunciation("Xin chào", "Xin chào", "Hello") is None
    # Real phonetic romanization is preserved
    assert (
        normalize_pronunciation("Dōmo arigatōgozaimasu.", "どうもありがとうございます。", "Thank you")
        == "Dōmo arigatōgozaimasu."
    )


def test_normalize_detected_lang_and_multi_sentence_pronunciation() -> None:
    assert normalize_detected_lang(["VI", "en"]) == "vi"
    assert normalize_detected_lang(["", "fr"]) == "fr"
    assert normalize_detected_lang([]) == "en"
    assert normalize_detected_lang("") == "en"
    assert normalize_detected_lang(None) == "en"

    class DummyMultiSentenceTranslated:
        pronunciation = [[]]
        extra_data = {
            "translation": [
                ["1 行目: フエへようこそ。\n", "Line 1: Welcome to Hue.\n", None, None, 3],
                [None, None, "1-Gyō-me: Fue e yōkoso."],
            ]
        }

    assert (
        extract_pronunciation(
            DummyMultiSentenceTranslated(),
            "1 行目: フエへようこそ。",
            "Line 1: Welcome to Hue.",
        )
        == "1-Gyō-me: Fue e yōkoso."
    )


def test_language_code_normalization_and_aliases(engine: TranslationEngine) -> None:
    assert engine.normalize_language_code("auto", allow_auto=True) == "auto"
    assert engine.normalize_language_code("VI") == "vi"
    assert engine.normalize_language_code("zh") == "zh-cn"
    assert engine.normalize_language_code("zh_TW") == "zh-tw"
    assert engine.normalize_language_code("vietnamese") == "vi"

    with pytest.raises(InvalidLanguageCodeError):
        engine.normalize_language_code("auto", allow_auto=False)

    with pytest.raises(InvalidLanguageCodeError):
        engine.normalize_language_code("not-a-real-lang")


@pytest.mark.asyncio
async def test_single_translate_and_cache_hit(
    engine: TranslationEngine,
    fake_adapter: FakeGoogleTransAdapter,
) -> None:
    res1 = await engine.translate("Hello, how are you?", src="auto", dest="vi")
    assert res1.text == "Xin chào bạn khỏe không?"
    assert res1.src == "en"
    assert res1.dest == "vi"
    assert res1.cached is False
    assert len(fake_adapter.translate_calls) == 1

    # Second identical call hits TTL LRU cache (zero extra upstream calls)
    res2 = await engine.translate("Hello, how are you?", src="auto", dest="vi")
    assert res2.text == "Xin chào bạn khỏe không?"
    assert res2.cached is True
    assert len(fake_adapter.translate_calls) == 1


@pytest.mark.asyncio
async def test_retry_and_failover_succeeds_after_transient_error(
    engine: TranslationEngine,
    fake_adapter: FakeGoogleTransAdapter,
) -> None:
    fake_adapter.fail_next_translates = 1
    res = await engine.translate(
        "Hello, how are you?",
        src="en",
        dest="ja",
        service_preset="redundant",
    )
    assert res.text == "こんにちは、お元気ですか？"
    assert res.pronunciation == "Konnichiwa, ogenkidesuka?"
    assert len(fake_adapter.translate_calls) == 2


@pytest.mark.asyncio
async def test_retry_exhaustion_raises_upstream_error(
    engine: TranslationEngine,
    fake_adapter: FakeGoogleTransAdapter,
) -> None:
    fake_adapter.fail_next_translates = 5
    with pytest.raises(UpstreamTranslationError):
        await engine.translate("Hello, how are you?", src="en", dest="vi")


@pytest.mark.asyncio
async def test_hotel_reviews_skips_same_language_and_Isolates_errors(
    engine: TranslationEngine,
    fake_adapter: FakeGoogleTransAdapter,
) -> None:
    fake_adapter.fail_on_texts.add("BROKEN_REVIEW_TEXT")
    reviews = [
        HotelReviewInput(id="r1", author="Minh", text="Khách sạn này rất tuyệt vời! Nhân viên thân thiện."),
        HotelReviewInput(id="r2", author="Alex", text="I want to book a hotel in Hanoi"),
        HotelReviewInput(id="r3", author="Err", text="BROKEN_REVIEW_TEXT"),
    ]
    out = await engine.translate_hotel_reviews(reviews, target_language="en")
    assert out.summary.total == 3
    assert out.summary.translated_count == 1
    assert out.summary.skipped_count == 1
    assert out.summary.failed_count == 1

    # r1: Vietnamese -> translated to English
    assert out.results[0].skipped is False
    assert out.results[0].translated == "This hotel is great! Friendly staff."
    # r2: Already English -> skipped
    assert out.results[1].skipped is True
    assert out.results[1].translated == "I want to book a hotel in Hanoi"
    # r3: Error recorded cleanly without failing batch
    assert out.results[2].error is not None


@pytest.mark.asyncio
async def test_travel_inquiry_needs_translation_flag(engine: TranslationEngine) -> None:
    inq_vi = await engine.process_travel_inquiry(
        "Tôi muốn đặt phòng khách sạn ở Hà Nội",
        target_language="en",
    )
    assert inq_vi.needs_translation is True
    assert inq_vi.detected_lang == "vi"
    assert inq_vi.translated_text == "I want to book a hotel in Hanoi"

    inq_en = await engine.process_travel_inquiry(
        "I want to book a hotel in Hanoi",
        target_language="en",
    )
    assert inq_en.needs_translation is False
    assert inq_en.detected_lang == "en"
    assert inq_en.translated_text == "I want to book a hotel in Hanoi"


@pytest.mark.asyncio
async def test_destination_guide_preserves_non_string_fields(
    engine: TranslationEngine,
) -> None:
    payload = {
        "name": "Hanoi",
        "description": "The capital city of Vietnam",
        "estimated_daily_budget_usd": 45,
        "recommended_stay_days": 3,
        "empty_note": "   ",
    }
    res = await engine.translate_destination_info(payload, target_language="vi")
    assert "name" in res.translated_fields
    assert "description" in res.translated_fields
    assert "estimated_daily_budget_usd" in res.preserved_fields
    assert "recommended_stay_days" in res.preserved_fields
    assert "empty_note" in res.preserved_fields
    assert res.translated_data["estimated_daily_budget_usd"] == 45
    assert res.translated_data["recommended_stay_days"] == 3
