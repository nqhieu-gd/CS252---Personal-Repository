"""Adapter layer isolating googletrans==4.0.2 network calls for clean testing & failover."""
from __future__ import annotations

from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from typing import Any, List, Optional, Protocol
import googletrans
from googletrans import LANGUAGES, Translator

DEFAULT_CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)


@dataclass
class RawTranslatedResult:
    origin: str
    text: str
    src: str
    dest: str
    pronunciation: Optional[str] = None


@dataclass
class RawDetectedResult:
    lang: str
    confidence: Optional[float] = None


def normalize_confidence(raw_conf: Any) -> Optional[float]:
    """Normalize googletrans confidence which may be float, int, list, or None."""
    if raw_conf is None:
        return None
    if isinstance(raw_conf, list):
        if not raw_conf:
            return None
        raw_conf = raw_conf[0]
    try:
        val = float(raw_conf)
        return round(max(0.0, min(1.0, val)), 4)
    except (TypeError, ValueError):
        return None


def normalize_pronunciation(
    raw_pron: Any,
    translated_text: str,
    origin_text: str = "",
) -> Optional[str]:
    """Return pronunciation string only when present, non-empty, and distinct from origin & translated text.

    Note: googletrans initializes `pron = origin` when no romanization row exists in Google's payload.
    Checking against both `translated_text` and `origin_text` prevents echoing the input text as pronunciation.
    """
    if not isinstance(raw_pron, str):
        return None
    cleaned = raw_pron.strip()
    if not cleaned:
        return None
    if cleaned == translated_text.strip() or (origin_text and cleaned == origin_text.strip()):
        return None
    return cleaned


def _configure_translator(translator: Translator, service_urls: List[str]) -> Translator:
    """Configure Translator instance for live reliability.

    In googletrans 4.0.2:
    - `DEFAULT_RAISE_EXCEPTION` is False, which silently returns DUMMY_DATA on HTTP 403/429.
    - `client_type='webapp'` uses legacy TKK scraping that returns HTTP 403 on translate.google.com,
      and `client_type='gtx'` is frequently rate-limited (HTTP 429) on shared IPs.
    - Setting `raise_exception=True`, `client_type='dict-chrome-ex'`, and preserving `service_urls`
      enables real live translations across all tutorial service_urls presets.
    """
    translator.raise_exception = True
    translator.client_type = "dict-chrome-ex"
    if service_urls:
        translator.service_urls = list(service_urls)
    return translator


class TranslatorAdapter(Protocol):
    """Protocol implemented by both live GoogleTrans4Adapter and test fakes."""

    async def translate_text(
        self,
        text: str,
        src: str,
        dest: str,
        service_urls: List[str],
    ) -> RawTranslatedResult:
        ...

    async def detect_text(
        self,
        text: str,
        service_urls: List[str],
    ) -> RawDetectedResult:
        ...


class GoogleTrans4Adapter:
    """Production adapter backed by py-googletrans (googletrans==4.0.2)."""

    async def translate_text(
        self,
        text: str,
        src: str,
        dest: str,
        service_urls: List[str],
    ) -> RawTranslatedResult:
        async with Translator(
            service_urls=service_urls,
            user_agent=DEFAULT_CHROME_UA,
            raise_exception=True,
        ) as translator:
            _configure_translator(translator, service_urls)
            result = await translator.translate(text, src=src, dest=dest)
            translated_str = str(getattr(result, "text", text))
            origin_str = str(getattr(result, "origin", text))
            src_code = str(getattr(result, "src", src)).lower()
            dest_code = str(getattr(result, "dest", dest)).lower()
            pron = normalize_pronunciation(
                getattr(result, "pronunciation", None),
                translated_str,
                origin_str,
            )
            return RawTranslatedResult(
                origin=origin_str,
                text=translated_str,
                src=src_code,
                dest=dest_code,
                pronunciation=pron,
            )

    async def detect_text(
        self,
        text: str,
        service_urls: List[str],
    ) -> RawDetectedResult:
        async with Translator(
            service_urls=service_urls,
            user_agent=DEFAULT_CHROME_UA,
            raise_exception=True,
        ) as translator:
            _configure_translator(translator, service_urls)
            detection = await translator.detect(text)
            lang_code = str(getattr(detection, "lang", "en")).lower()
            conf = normalize_confidence(getattr(detection, "confidence", None))
            return RawDetectedResult(lang=lang_code, confidence=conf)


def get_googletrans_version() -> str:
    try:
        return version("googletrans")
    except PackageNotFoundError:
        return getattr(googletrans, "__version__", "4.0.2")


def get_raw_languages() -> dict[str, str]:
    return dict(LANGUAGES)
