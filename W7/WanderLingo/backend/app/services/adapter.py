"""Adapter layer isolating googletrans==4.0.2 network calls, linguistic metadata, & typo suggestions."""
from __future__ import annotations

from dataclasses import dataclass, field
from importlib.metadata import PackageNotFoundError, version
import re
from typing import Any, Dict, List, Optional, Protocol
import googletrans
from googletrans import LANGUAGES, Translator

DEFAULT_CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)

# Fallback travel typo map used only when upstream omits `possible-mistakes`
COMMON_TRAVEL_TYPOS: Dict[str, str] = {
    "hpw": "how",
    "reverve": "reserve",
    "resreve": "reserve",
    "reservaton": "reservation",
    "tarin": "train",
    "airprot": "airport",
    "passprot": "passport",
    "restuarant": "restaurant",
    "accomodation": "accommodation",
    "lugage": "luggage",
    "cancle": "cancel",
    "chekc": "check",
    "teh": "the",
    "wih": "with",
    "recieve": "receive",
    "tommorow": "tomorrow",
    "breakfest": "breakfast",
    "availble": "available",
    "vegetarain": "vegetarian",
    "transporation": "transportation",
    "recomend": "recommend",
    "hotle": "hotel",
    "tickte": "ticket",
}

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HIGHLIGHT_TOKEN_RE = re.compile(r"<b><i>(.*?)</i></b>", re.IGNORECASE)
_WORD_TOKEN_RE = re.compile(r"[A-Za-z]+")


@dataclass
class RawDictionaryEntry:
    part_of_speech: str
    terms: List[str] = field(default_factory=list)


@dataclass
class RawDefinitionEntry:
    part_of_speech: str
    definition: str
    example: Optional[str] = None


@dataclass
class RawTranslatedResult:
    origin: str
    text: str
    src: str
    dest: str
    pronunciation: Optional[str] = None
    did_you_mean: Optional[str] = None
    corrected_tokens: List[str] = field(default_factory=list)
    alternatives: List[str] = field(default_factory=list)
    dictionary: List[RawDictionaryEntry] = field(default_factory=list)
    definitions: List[RawDefinitionEntry] = field(default_factory=list)


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


def normalize_detected_lang(raw_lang: Any) -> str:
    """Normalize googletrans detected lang which may be str, list[str], empty, or None."""
    if isinstance(raw_lang, list):
        for item in raw_lang:
            if isinstance(item, str) and item.strip():
                return item.strip().lower()
        return "en"
    if isinstance(raw_lang, str) and raw_lang.strip():
        return raw_lang.strip().lower()
    return "en"


def normalize_pronunciation(
    raw_pron: Any,
    translated_text: str,
    origin_text: str = "",
) -> Optional[str]:
    """Return pronunciation string only when present, non-empty, and distinct from origin & translated text."""
    if not isinstance(raw_pron, str):
        return None
    cleaned = raw_pron.strip()
    if not cleaned:
        return None
    if cleaned == translated_text.strip() or (origin_text and cleaned == origin_text.strip()):
        return None
    return cleaned


def extract_pronunciation(
    result: Any,
    translated_text: str,
    origin_text: str = "",
) -> Optional[str]:
    """Extract pronunciation from Translated object, including multi-sentence fallback in extra_data."""
    direct = normalize_pronunciation(
        getattr(result, "pronunciation", None),
        translated_text,
        origin_text,
    )
    if direct is not None:
        return direct

    extra_data = getattr(result, "extra_data", None)
    if isinstance(extra_data, dict):
        rows = extra_data.get("translation")
        if isinstance(rows, list) and rows:
            last_row = rows[-1]
            if (
                isinstance(last_row, list)
                and len(last_row) >= 3
                and last_row[0] is None
                and isinstance(last_row[2], str)
            ):
                return normalize_pronunciation(last_row[2], translated_text, origin_text)
    return None


def _preserve_case(original_word: str, replacement: str) -> str:
    if original_word.isupper():
        return replacement.upper()
    if original_word[:1].isupper():
        return replacement.capitalize()
    return replacement


def fallback_typo_suggestion(origin_text: str) -> tuple[Optional[str], List[str]]:
    """Lightweight travel typo fallback when upstream omits `possible-mistakes`."""
    corrected_tokens: List[str] = []

    def _replace_match(match: re.Match[str]) -> str:
        word = match.group(0)
        lower = word.lower()
        if lower in COMMON_TRAVEL_TYPOS:
            fixed = _preserve_case(word, COMMON_TRAVEL_TYPOS[lower])
            corrected_tokens.append(fixed)
            return fixed
        return word

    updated = _WORD_TOKEN_RE.sub(_replace_match, origin_text)
    if corrected_tokens and updated.strip().lower() != origin_text.strip().lower():
        return updated, corrected_tokens
    return None, []


def extract_did_you_mean(result: Any, origin_text: str) -> tuple[Optional[str], List[str]]:
    """Extract 'Did you mean' spelling/grammar suggestion from googletrans extra_data['possible-mistakes']."""
    extra_data = getattr(result, "extra_data", None)
    if isinstance(extra_data, dict):
        mistakes = extra_data.get("possible-mistakes")
        if isinstance(mistakes, list) and len(mistakes) >= 2:
            raw_html = mistakes[0] if isinstance(mistakes[0], str) else ""
            clean_suggestion = mistakes[1] if isinstance(mistakes[1], str) else ""
            if not clean_suggestion and raw_html:
                clean_suggestion = _HTML_TAG_RE.sub("", raw_html)
            clean_suggestion = clean_suggestion.strip()
            if clean_suggestion and clean_suggestion.lower() != origin_text.strip().lower():
                tokens = [
                    _HTML_TAG_RE.sub("", t).strip()
                    for t in _HIGHLIGHT_TOKEN_RE.findall(raw_html)
                    if t.strip()
                ]
                return clean_suggestion, tokens

    return fallback_typo_suggestion(origin_text)


def extract_alternatives(result: Any, primary_translation: str) -> List[str]:
    """Extract alternative phrasings from googletrans extra_data['possible-translations']."""
    extra_data = getattr(result, "extra_data", None)
    if not isinstance(extra_data, dict):
        return []
    pt = extra_data.get("possible-translations")
    if not isinstance(pt, list) or len(pt) != 1:
        return []
    first_seg = pt[0]
    if not isinstance(first_seg, list) or len(first_seg) < 3 or not isinstance(first_seg[2], list):
        return []

    primary_clean = primary_translation.strip().lower()
    seen = {primary_clean}
    alternatives: List[str] = []
    for cand in first_seg[2]:
        if isinstance(cand, list) and cand and isinstance(cand[0], str):
            text_cand = cand[0].strip()
            if text_cand and text_cand.lower() not in seen:
                seen.add(text_cand.lower())
                alternatives.append(text_cand)
                if len(alternatives) >= 5:
                    break
    return alternatives


def extract_dictionary_and_definitions(
    result: Any,
) -> tuple[List[RawDictionaryEntry], List[RawDefinitionEntry]]:
    """Extract part-of-speech dictionary terms and definitions from googletrans extra_data."""
    extra_data = getattr(result, "extra_data", None)
    if not isinstance(extra_data, dict):
        return [], []

    dict_entries: List[RawDictionaryEntry] = []
    all_trans = extra_data.get("all-translations")
    if isinstance(all_trans, list):
        for group in all_trans[:4]:
            if (
                isinstance(group, list)
                and len(group) >= 2
                and isinstance(group[0], str)
                and isinstance(group[1], list)
            ):
                pos = group[0].strip()
                terms = [str(t).strip() for t in group[1] if isinstance(t, str) and t.strip()][:6]
                if pos and terms:
                    dict_entries.append(RawDictionaryEntry(part_of_speech=pos, terms=terms))

    def_entries: List[RawDefinitionEntry] = []
    raw_defs = extra_data.get("definitions")
    if isinstance(raw_defs, list):
        for group in raw_defs[:3]:
            if (
                isinstance(group, list)
                and len(group) >= 2
                and isinstance(group[0], str)
                and isinstance(group[1], list)
            ):
                pos = group[0].strip()
                for item in group[1][:2]:
                    if isinstance(item, list) and item and isinstance(item[0], str):
                        gloss = _HTML_TAG_RE.sub("", item[0]).strip()
                        example = (
                            _HTML_TAG_RE.sub("", item[2]).strip()
                            if len(item) > 2 and isinstance(item[2], str) and item[2].strip()
                            else None
                        )
                        if gloss:
                            def_entries.append(
                                RawDefinitionEntry(
                                    part_of_speech=pos,
                                    definition=gloss,
                                    example=example,
                                )
                            )
    return dict_entries, def_entries


def _configure_translator(translator: Translator, service_urls: List[str]) -> Translator:
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
            src_code = normalize_detected_lang(getattr(result, "src", src))
            dest_code = str(getattr(result, "dest", dest)).lower()
            pron = extract_pronunciation(result, translated_str, origin_str)
            did_you_mean, corrected_tokens = extract_did_you_mean(result, origin_str)
            alternatives = extract_alternatives(result, translated_str)
            dictionary, definitions = extract_dictionary_and_definitions(result)
            return RawTranslatedResult(
                origin=origin_str,
                text=translated_str,
                src=src_code,
                dest=dest_code,
                pronunciation=pron,
                did_you_mean=did_you_mean,
                corrected_tokens=corrected_tokens,
                alternatives=alternatives,
                dictionary=dictionary,
                definitions=definitions,
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
            lang_code = normalize_detected_lang(getattr(detection, "lang", "en"))
            conf = normalize_confidence(getattr(detection, "confidence", None))
            return RawDetectedResult(lang=lang_code, confidence=conf)


def get_googletrans_version() -> str:
    try:
        return version("googletrans")
    except PackageNotFoundError:
        return getattr(googletrans, "__version__", "4.0.2")


def get_raw_languages() -> dict[str, str]:
    return dict(LANGUAGES)
