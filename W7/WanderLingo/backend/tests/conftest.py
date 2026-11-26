"""Deterministic test fixtures and FakeGoogleTransAdapter for offline pytest execution."""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple
import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    set_rate_limiter,
    set_translation_engine,
)
from app.main import app
from app.services.adapter import (
    RawDefinitionEntry,
    RawDetectedResult,
    RawDictionaryEntry,
    RawTranslatedResult,
    fallback_typo_suggestion,
)
from app.services.cache import TTLLRUCache
from app.services.rate_limiter import SlidingWindowRateLimiter
from app.services.translator_service import TranslationEngine


class FakeGoogleTransAdapter:
    """In-memory deterministic fake implementing TranslatorAdapter."""

    def __init__(self) -> None:
        self.translate_calls: List[Tuple[str, str, str, Tuple[str, ...]]] = []
        self.detect_calls: List[Tuple[str, Tuple[str, ...]]] = []
        self.fail_next_translates: int = 0
        self.fail_on_texts: set[str] = set()

        self._known_detections: Dict[str, Tuple[str, Optional[float]]] = {
            "Hello, how are you?": ("en", 1.0),
            "I want to book a hotel in Hanoi": ("en", 1.0),
            "The rooftop breakfast overlooking the river was unforgettable": ("en", 0.99),
            "Khách sạn này rất tuyệt vời! Nhân viên thân thiện.": ("vi", 1.0),
            "Vị trí khách sạn thuận tiện, gần biển.": ("vi", 1.0),
            "Phòng sạch sẽ nhưng hơi nhỏ.": ("vi", 1.0),
            "Tôi muốn đặt phòng khách sạn ở Hà Nội": ("vi", 1.0),
            "¿Dónde está el hotel?": ("es", 1.0),
            "¿Hay tours disponibles para mañana?": ("es", 0.98),
            "空港からホテルまでの交通手段は？": ("ja", 1.0),
        }

        self._known_translations: Dict[Tuple[str, str], Tuple[str, Optional[str]]] = {
            ("Hello, how are you?", "vi"): ("Xin chào bạn khỏe không?", None),
            ("Hello, how are you?", "ja"): ("こんにちは、お元気ですか？", "Konnichiwa, ogenkidesuka?"),
            ("Hello, how are you?", "zh-cn"): ("你好，你好吗？", "Nǐ hǎo, nǐ hǎo ma?"),
            ("Khách sạn này rất tuyệt vời! Nhân viên thân thiện.", "en"): (
                "This hotel is great! Friendly staff.",
                None,
            ),
            ("Vị trí khách sạn thuận tiện, gần biển.", "en"): (
                "The hotel location is convenient, near the beach.",
                None,
            ),
            ("Phòng sạch sẽ nhưng hơi nhỏ.", "en"): (
                "The room is clean but a bit small.",
                None,
            ),
            ("Tôi muốn đặt phòng khách sạn ở Hà Nội", "en"): (
                "I want to book a hotel in Hanoi",
                None,
            ),
            ("¿Hay tours disponibles para mañana?", "en"): (
                "Are there tours available for tomorrow?",
                None,
            ),
            ("空港からホテルまでの交通手段は？", "en"): (
                "What are the transportation options from the airport to the hotel?",
                None,
            ),
        }

    async def detect_text(
        self,
        text: str,
        service_urls: List[str],
    ) -> RawDetectedResult:
        self.detect_calls.append((text, tuple(service_urls)))
        if text in self.fail_on_texts:
            raise RuntimeError(f"Simulated upstream failure on text: {text}")
        lang, conf = self._known_detections.get(text, ("en", 0.95))
        return RawDetectedResult(lang=lang, confidence=conf)

    async def translate_text(
        self,
        text: str,
        src: str,
        dest: str,
        service_urls: List[str],
    ) -> RawTranslatedResult:
        self.translate_calls.append((text, src, dest, tuple(service_urls)))
        if self.fail_next_translates > 0:
            self.fail_next_translates -= 1
            raise RuntimeError("Simulated transient upstream 503 error")
        if text in self.fail_on_texts:
            raise RuntimeError(f"Simulated upstream failure on text: {text}")

        detected_src = src
        detected_conf: Optional[float] = 1.0
        if src == "auto":
            detected_src, detected_conf = self._known_detections.get(text, ("en", 0.95))

        if detected_src == dest:
            translated, pron = text, None
        else:
            translated, pron = self._known_translations.get(
                (text, dest),
                (
                    f"[{dest}] {text}",
                    f"pron({dest}): {text}" if dest in ("ja", "ko", "zh-cn") else None,
                ),
            )
        dym, dym_tokens = fallback_typo_suggestion(text)
        alts = ["Làm cách nào để đặt phòng?"] if "reverve" in text.lower() and dest == "vi" else []
        dict_entries = (
            [RawDictionaryEntry(part_of_speech="verb", terms=["đặt trước", "dự trữ"])]
            if text.strip().lower() == "reserve"
            else []
        )
        def_entries = (
            [
                RawDefinitionEntry(
                    part_of_speech="verb",
                    definition="arrange for a room or seat to be kept for the use of a particular person.",
                    example="I would like to reserve a room in Hanoi.",
                )
            ]
            if text.strip().lower() == "reserve"
            else []
        )
        return RawTranslatedResult(
            origin=text,
            text=translated,
            src=detected_src,
            dest=dest,
            pronunciation=pron,
            confidence=detected_conf,
            did_you_mean=dym,
            corrected_tokens=dym_tokens,
            alternatives=alts,
            dictionary=dict_entries,
            definitions=def_entries,
        )


@pytest.fixture()
def fake_adapter() -> FakeGoogleTransAdapter:
    return FakeGoogleTransAdapter()


@pytest.fixture()
def engine(fake_adapter: FakeGoogleTransAdapter) -> TranslationEngine:
    return TranslationEngine(
        adapter=fake_adapter,
        cache=TTLLRUCache(max_entries=100, ttl_seconds=600),
        retry_delays=[0.0, 0.0],
    )


@pytest.fixture()
def client(engine: TranslationEngine) -> TestClient:
    limiter = SlidingWindowRateLimiter(max_requests=50, window_seconds=60)
    set_translation_engine(engine)
    set_rate_limiter(limiter)
    return TestClient(app)
