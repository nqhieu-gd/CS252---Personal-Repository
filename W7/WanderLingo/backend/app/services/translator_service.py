"""Core translation, language detection, bulk processing, and travel workflow engine.

Implements all sections of '2025 CT - API Translate.docx.pdf' with:
- Language code normalization & alias mapping ('zh' -> 'zh-cn')
- Bounded TTL LRU caching
- Retry with exponential backoff & service_urls failover
- Bounded concurrency (asyncio.Semaphore) for bulk operations
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple, TypeVar

from app.config import (
    BULK_CONCURRENCY_LIMIT,
    DEFAULT_SERVICE_PRESET,
    LANGUAGE_CODE_ALIASES,
    PINNED_TRAVEL_LANGUAGE_CODES,
    RETRY_ATTEMPTS,
    RETRY_BACKOFF_SECONDS,
    SERVICE_PRESET_LABELS,
    SERVICE_URL_PRESETS,
)
from app.schemas import (
    BulkItemResult,
    BulkSummary,
    BulkTranslateResponse,
    DefinitionEntryDTO,
    DestinationTranslateResponse,
    DetectResponse,
    DictionaryEntryDTO,
    HotelReviewInput,
    HotelReviewResult,
    HotelReviewTranslateResponse,
    LanguageItem,
    LanguagesResponse,
    MultiTargetItem,
    MultiTargetTranslateResponse,
    ServicePresetInfo,
    TranslateResponse,
    TravelInquiryReplyResponse,
    TravelInquiryResponse,
)
from app.services.adapter import (
    GoogleTrans4Adapter,
    RawDetectedResult,
    RawTranslatedResult,
    TranslatorAdapter,
    fallback_typo_suggestion,
    get_raw_languages,
)
from app.services.cache import TTLLRUCache

R = TypeVar("R")


class InvalidLanguageCodeError(ValueError):
    """Raised when a caller supplies an unsupported language code."""


class UpstreamTranslationError(RuntimeError):
    """Raised when all upstream Google Translate attempts fail."""


class TranslationEngine:
    """High-level service coordinating language validation, caching, retries, and travel workflows."""

    def __init__(
        self,
        adapter: Optional[TranslatorAdapter] = None,
        cache: Optional[TTLLRUCache[Any]] = None,
        retry_delays: Optional[List[float]] = None,
    ) -> None:
        self.adapter: TranslatorAdapter = adapter or GoogleTrans4Adapter()
        self.cache: TTLLRUCache[Any] = cache or TTLLRUCache()
        self.retry_delays = retry_delays if retry_delays is not None else list(RETRY_BACKOFF_SECONDS)
        self._raw_languages: Dict[str, str] = {
            k.lower(): v for k, v in get_raw_languages().items()
        }
        self._name_to_code: Dict[str, str] = {
            v.lower(): k.lower() for k, v in self._raw_languages.items()
        }

    def normalize_language_code(self, code: str, allow_auto: bool = False) -> str:
        if not isinstance(code, str) or not code.strip():
            raise InvalidLanguageCodeError("Language code must not be empty.")
        cleaned = code.strip().lower().replace("_", "-")
        if allow_auto and cleaned == "auto":
            return "auto"

        # 1. Check alias map first (e.g., 'zh' -> 'zh-cn')
        if cleaned in LANGUAGE_CODE_ALIASES:
            mapped = LANGUAGE_CODE_ALIASES[cleaned]
            if mapped in self._raw_languages:
                return mapped

        # 2. Direct code lookup in googletrans.LANGUAGES
        if cleaned in self._raw_languages:
            return cleaned

        # 3. Full language name lookup (e.g., 'vietnamese' -> 'vi', 'chinese' -> 'zh-cn')
        if cleaned in self._name_to_code:
            return self._name_to_code[cleaned]
        if cleaned == "chinese" and "zh-cn" in self._raw_languages:
            return "zh-cn"

        raise InvalidLanguageCodeError(
            f"Unsupported language code '{code}'. Use GET /api/languages for valid codes."
        )

    def get_language_name(self, code: str) -> str:
        if not code:
            return "Unknown"
        cleaned = code.strip().lower().replace("_", "-")
        if cleaned == "auto":
            return "Auto-Detect"
        if cleaned in LANGUAGE_CODE_ALIASES:
            cleaned = LANGUAGE_CODE_ALIASES[cleaned]
        raw_name = self._raw_languages.get(cleaned, cleaned)
        return raw_name.title()

    def get_service_presets_info(self) -> List[ServicePresetInfo]:
        return [
            ServicePresetInfo(
                key=key,
                label=SERVICE_PRESET_LABELS.get(key, key),
                urls=urls,
            )
            for key, urls in SERVICE_URL_PRESETS.items()
        ]

    def get_languages_catalog(self) -> LanguagesResponse:
        all_items = [
            LanguageItem(code=code, name=name.title())
            for code, name in sorted(self._raw_languages.items(), key=lambda kv: kv[1].lower())
        ]
        travel_items: List[LanguageItem] = []
        for code in PINNED_TRAVEL_LANGUAGE_CODES:
            norm = LANGUAGE_CODE_ALIASES.get(code, code)
            if norm in self._raw_languages:
                travel_items.append(
                    LanguageItem(code=norm, name=self._raw_languages[norm].title())
                )
        return LanguagesResponse(
            total_count=len(all_items),
            travel_languages=travel_items,
            all_languages=all_items,
            aliases=dict(LANGUAGE_CODE_ALIASES),
        )

    def _resolve_candidate_url_lists(self, service_preset: str) -> List[List[str]]:
        """Build ordered service_urls lists for primary attempt + failover retries."""
        primary = list(
            SERVICE_URL_PRESETS.get(
                service_preset,
                SERVICE_URL_PRESETS[DEFAULT_SERVICE_PRESET],
            )
        )
        candidates: List[List[str]] = [primary]
        # Rotate/failover across individual URLs in the preset or fallback endpoints
        for url in primary:
            single = [url]
            if single not in candidates:
                candidates.append(single)
        for fallback_url in ("translate.google.com", "translate.googleapis.com"):
            fb = [fallback_url]
            if fb not in candidates:
                candidates.append(fb)
        return candidates

    async def _execute_with_retry(
        self,
        service_preset: str,
        operation_fn: Callable[[List[str]], Awaitable[R]],
    ) -> R:
        url_candidates = self._resolve_candidate_url_lists(service_preset)
        total_attempts = 1 + max(0, RETRY_ATTEMPTS)
        last_exc: Optional[Exception] = None

        for attempt_idx in range(total_attempts):
            urls = url_candidates[min(attempt_idx, len(url_candidates) - 1)]
            try:
                return await operation_fn(urls)
            except Exception as exc:
                last_exc = exc
                if attempt_idx + 1 < total_attempts:
                    delay = (
                        self.retry_delays[min(attempt_idx, len(self.retry_delays) - 1)]
                        if self.retry_delays
                        else 0.0
                    )
                    if delay > 0:
                        await asyncio.sleep(delay)

        raise UpstreamTranslationError(
            f"Translation service failed after {total_attempts} attempt(s): {last_exc}"
        ) from last_exc

    async def detect(
        self,
        text: str,
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> DetectResponse:
        started = time.perf_counter()
        cleaned = text.strip()
        cache_key = ("detect", cleaned)
        cached_val: Optional[RawDetectedResult] = self.cache.get(cache_key)
        if cached_val is not None:
            norm_lang = self._safe_normalize_detected_code(cached_val.lang)
            return DetectResponse(
                text=cleaned,
                lang=norm_lang,
                lang_name=self.get_language_name(norm_lang),
                confidence=cached_val.confidence,
                cached=True,
                service_preset=service_preset,
                latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
            )

        raw_det = await self._execute_with_retry(
            service_preset,
            lambda urls: self.adapter.detect_text(cleaned, urls),
        )
        self.cache.set(cache_key, raw_det)
        norm_lang = self._safe_normalize_detected_code(raw_det.lang)
        return DetectResponse(
            text=cleaned,
            lang=norm_lang,
            lang_name=self.get_language_name(norm_lang),
            confidence=raw_det.confidence,
            cached=False,
            service_preset=service_preset,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )

    def _safe_normalize_detected_code(self, raw_code: str) -> str:
        try:
            return self.normalize_language_code(raw_code, allow_auto=False)
        except InvalidLanguageCodeError:
            return (raw_code or "en").strip().lower()

    async def translate(
        self,
        text: str,
        src: str = "auto",
        dest: str = "vi",
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> TranslateResponse:
        started = time.perf_counter()
        cleaned = text.strip()
        norm_src = self.normalize_language_code(src, allow_auto=True)
        norm_dest = self.normalize_language_code(dest, allow_auto=False)

        # Short-circuit if explicit source and destination are identical
        if norm_src != "auto" and norm_src == norm_dest:
            dym, dym_tokens = fallback_typo_suggestion(cleaned)
            return TranslateResponse(
                origin=cleaned,
                text=cleaned,
                src=norm_src,
                src_name=self.get_language_name(norm_src),
                dest=norm_dest,
                dest_name=self.get_language_name(norm_dest),
                pronunciation=None,
                confidence=1.0,
                did_you_mean=dym,
                corrected_tokens=dym_tokens,
                skipped=True,
                cached=False,
                service_preset=service_preset,
                latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
            )

        cache_key = ("translate", cleaned, norm_src, norm_dest)
        cached_val: Optional[Tuple[RawTranslatedResult, Optional[float]]] = self.cache.get(cache_key)
        if cached_val is not None:
            raw_res, cached_conf = cached_val
            actual_src = self._safe_normalize_detected_code(raw_res.src)
            is_skipped = actual_src == norm_dest and raw_res.text.strip() == cleaned
            return TranslateResponse(
                origin=cleaned,
                text=raw_res.text,
                src=actual_src,
                src_name=self.get_language_name(actual_src),
                dest=norm_dest,
                dest_name=self.get_language_name(norm_dest),
                pronunciation=raw_res.pronunciation,
                confidence=cached_conf,
                did_you_mean=raw_res.did_you_mean,
                corrected_tokens=list(raw_res.corrected_tokens),
                alternatives=list(raw_res.alternatives),
                dictionary=[
                    DictionaryEntryDTO(part_of_speech=d.part_of_speech, terms=list(d.terms))
                    for d in raw_res.dictionary
                ],
                definitions=[
                    DefinitionEntryDTO(
                        part_of_speech=df.part_of_speech,
                        definition=df.definition,
                        example=df.example,
                    )
                    for df in raw_res.definitions
                ],
                skipped=is_skipped,
                cached=True,
                service_preset=service_preset,
                latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
            )

        raw_res = await self._execute_with_retry(
            service_preset,
            lambda urls: self.adapter.translate_text(cleaned, norm_src, norm_dest, urls),
        )
        actual_src = self._safe_normalize_detected_code(raw_res.src)
        self.cache.set(cache_key, (raw_res, None))
        is_skipped = actual_src == norm_dest and raw_res.text.strip() == cleaned

        return TranslateResponse(
            origin=cleaned,
            text=raw_res.text,
            src=actual_src,
            src_name=self.get_language_name(actual_src),
            dest=norm_dest,
            dest_name=self.get_language_name(norm_dest),
            pronunciation=raw_res.pronunciation,
            confidence=None,
            did_you_mean=raw_res.did_you_mean,
            corrected_tokens=list(raw_res.corrected_tokens),
            alternatives=list(raw_res.alternatives),
            dictionary=[
                DictionaryEntryDTO(part_of_speech=d.part_of_speech, terms=list(d.terms))
                for d in raw_res.dictionary
            ],
            definitions=[
                DefinitionEntryDTO(
                    part_of_speech=df.part_of_speech,
                    definition=df.definition,
                    example=df.example,
                )
                for df in raw_res.definitions
            ],
            skipped=is_skipped,
            cached=False,
            service_preset=service_preset,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )

    async def translate_multi_target(
        self,
        text: str,
        src: str = "auto",
        targets: Optional[List[str]] = None,
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> MultiTargetTranslateResponse:
        """Translate a single travel phrase simultaneously into multiple target languages."""
        started = time.perf_counter()
        cleaned = text.strip()
        norm_src = self.normalize_language_code(src, allow_auto=True)
        unique_targets: List[str] = []
        for t_code in targets or ["vi", "ja", "ko"]:
            norm_t = self.normalize_language_code(t_code, allow_auto=False)
            if norm_t not in unique_targets:
                unique_targets.append(norm_t)

        sem = asyncio.Semaphore(BULK_CONCURRENCY_LIMIT)
        detected_src = norm_src if norm_src != "auto" else "en"
        did_you_mean: Optional[str] = None
        corrected_tokens: List[str] = []

        async def _translate_one_target(dest_code: str) -> Tuple[MultiTargetItem, Optional[str], Optional[str], List[str]]:
            async with sem:
                try:
                    tr = await self.translate(
                        cleaned,
                        src=norm_src,
                        dest=dest_code,
                        service_preset=service_preset,
                    )
                    return (
                        MultiTargetItem(
                            dest=tr.dest,
                            dest_name=tr.dest_name,
                            text=tr.text,
                            pronunciation=tr.pronunciation,
                            skipped=tr.skipped,
                            cached=tr.cached,
                        ),
                        tr.src,
                        tr.did_you_mean,
                        tr.corrected_tokens,
                    )
                except Exception as exc:
                    return (
                        MultiTargetItem(
                            dest=dest_code,
                            dest_name=self.get_language_name(dest_code),
                            error=str(exc),
                        ),
                        None,
                        None,
                        [],
                    )

        outcomes = await asyncio.gather(*[_translate_one_target(t) for t in unique_targets])
        items: List[MultiTargetItem] = []
        for item, s_code, dym, dym_toks in outcomes:
            items.append(item)
            if s_code and norm_src == "auto":
                detected_src = s_code
            if dym and did_you_mean is None:
                did_you_mean = dym
                corrected_tokens = dym_toks

        return MultiTargetTranslateResponse(
            origin=cleaned,
            src=detected_src,
            src_name=self.get_language_name(detected_src),
            did_you_mean=did_you_mean,
            corrected_tokens=corrected_tokens,
            results=items,
            service_preset=service_preset,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )

    async def translate_bulk(
        self,
        texts: List[str],
        src: str = "auto",
        dest: str = "vi",
        skip_same_language: bool = True,
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> BulkTranslateResponse:
        started = time.perf_counter()
        norm_src = self.normalize_language_code(src, allow_auto=True)
        norm_dest = self.normalize_language_code(dest, allow_auto=False)
        dest_name = self.get_language_name(norm_dest)
        sem = asyncio.Semaphore(BULK_CONCURRENCY_LIMIT)

        async def _process_one(idx: int, raw_text: str) -> BulkItemResult:
            cleaned = raw_text.strip()
            async with sem:
                try:
                    detected_conf: Optional[float] = None
                    effective_src = norm_src
                    was_cached = False

                    if skip_same_language and norm_src == "auto":
                        det = await self.detect(cleaned, service_preset=service_preset)
                        effective_src = det.lang
                        detected_conf = det.confidence
                        was_cached = det.cached
                        if det.lang == norm_dest:
                            return BulkItemResult(
                                index=idx,
                                origin=cleaned,
                                translated=cleaned,
                                src=det.lang,
                                src_name=det.lang_name,
                                dest=norm_dest,
                                dest_name=dest_name,
                                pronunciation=None,
                                confidence=detected_conf,
                                skipped=True,
                                cached=was_cached,
                                error=None,
                            )

                    tr = await self.translate(
                        cleaned,
                        src=effective_src,
                        dest=norm_dest,
                        service_preset=service_preset,
                    )
                    return BulkItemResult(
                        index=idx,
                        origin=cleaned,
                        translated=tr.text,
                        src=tr.src,
                        src_name=tr.src_name,
                        dest=norm_dest,
                        dest_name=dest_name,
                        pronunciation=tr.pronunciation,
                        confidence=detected_conf if detected_conf is not None else tr.confidence,
                        skipped=tr.skipped,
                        cached=tr.cached or was_cached,
                        error=None,
                    )
                except Exception as exc:
                    return BulkItemResult(
                        index=idx,
                        origin=cleaned,
                        translated=None,
                        src=None,
                        src_name=None,
                        dest=norm_dest,
                        dest_name=dest_name,
                        pronunciation=None,
                        confidence=None,
                        skipped=False,
                        cached=False,
                        error=str(exc),
                    )

        items = await asyncio.gather(
            *[_process_one(idx, text) for idx, text in enumerate(texts)]
        )
        summary = self._build_bulk_summary(
            items=items,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )
        return BulkTranslateResponse(
            items=list(items),
            summary=summary,
            service_preset=service_preset,
        )

    def _build_bulk_summary(
        self,
        items: List[BulkItemResult],
        latency_ms: float,
    ) -> BulkSummary:
        translated_count = 0
        skipped_count = 0
        failed_count = 0
        cached_count = 0
        breakdown: Dict[str, int] = {}

        for item in items:
            if item.cached:
                cached_count += 1
            if item.error is not None:
                failed_count += 1
                continue
            if item.src_name:
                breakdown[item.src_name] = breakdown.get(item.src_name, 0) + 1
            if item.skipped:
                skipped_count += 1
            else:
                translated_count += 1

        return BulkSummary(
            total=len(items),
            translated_count=translated_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            cached_count=cached_count,
            language_breakdown=breakdown,
            latency_ms=latency_ms,
        )

    # --- Tutorial Section 6, Example 1: Hotel Review Translation System ---
    async def translate_hotel_reviews(
        self,
        reviews: List[HotelReviewInput],
        target_language: str = "en",
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> HotelReviewTranslateResponse:
        started = time.perf_counter()
        norm_target = self.normalize_language_code(target_language, allow_auto=False)
        target_name = self.get_language_name(norm_target)
        sem = asyncio.Semaphore(BULK_CONCURRENCY_LIMIT)

        async def _translate_one_review(idx: int, rev: HotelReviewInput) -> Tuple[HotelReviewResult, BulkItemResult]:
            rev_id = rev.id or f"review-{idx + 1}"
            author = rev.author or f"Guest #{idx + 1}"
            cleaned_text = rev.text.strip()

            async with sem:
                try:
                    det = await self.detect(cleaned_text, service_preset=service_preset)
                    if det.lang == norm_target:
                        res = HotelReviewResult(
                            id=rev_id,
                            author=author,
                            hotel_name=rev.hotel_name,
                            rating=rev.rating,
                            stay_date=rev.stay_date,
                            original=cleaned_text,
                            translated=cleaned_text,
                            source_lang=det.lang,
                            source_lang_name=det.lang_name,
                            confidence=det.confidence,
                            pronunciation=None,
                            skipped=True,
                            cached=det.cached,
                            error=None,
                        )
                        stat = BulkItemResult(
                            index=idx,
                            origin=cleaned_text,
                            translated=cleaned_text,
                            src=det.lang,
                            src_name=det.lang_name,
                            dest=norm_target,
                            dest_name=target_name,
                            confidence=det.confidence,
                            skipped=True,
                            cached=det.cached,
                        )
                        return res, stat

                    tr = await self.translate(
                        cleaned_text,
                        src=det.lang,
                        dest=norm_target,
                        service_preset=service_preset,
                    )
                    res = HotelReviewResult(
                        id=rev_id,
                        author=author,
                        hotel_name=rev.hotel_name,
                        rating=rev.rating,
                        stay_date=rev.stay_date,
                        original=cleaned_text,
                        translated=tr.text,
                        source_lang=det.lang,
                        source_lang_name=det.lang_name,
                        confidence=det.confidence,
                        pronunciation=tr.pronunciation,
                        skipped=False,
                        cached=tr.cached and det.cached,
                        error=None,
                    )
                    stat = BulkItemResult(
                        index=idx,
                        origin=cleaned_text,
                        translated=tr.text,
                        src=det.lang,
                        src_name=det.lang_name,
                        dest=norm_target,
                        dest_name=target_name,
                        pronunciation=tr.pronunciation,
                        confidence=det.confidence,
                        skipped=False,
                        cached=tr.cached and det.cached,
                    )
                    return res, stat
                except Exception as exc:
                    err_msg = str(exc)
                    res = HotelReviewResult(
                        id=rev_id,
                        author=author,
                        hotel_name=rev.hotel_name,
                        rating=rev.rating,
                        stay_date=rev.stay_date,
                        original=cleaned_text,
                        translated=None,
                        source_lang=None,
                        source_lang_name=None,
                        confidence=None,
                        pronunciation=None,
                        skipped=False,
                        cached=False,
                        error=err_msg,
                    )
                    stat = BulkItemResult(
                        index=idx,
                        origin=cleaned_text,
                        dest=norm_target,
                        dest_name=target_name,
                        error=err_msg,
                    )
                    return res, stat

        pairs = await asyncio.gather(
            *[_translate_one_review(idx, r) for idx, r in enumerate(reviews)]
        )
        results = [p[0] for p in pairs]
        stats = [p[1] for p in pairs]
        summary = self._build_bulk_summary(
            items=stats,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )
        return HotelReviewTranslateResponse(
            target_language=norm_target,
            target_language_name=target_name,
            results=results,
            summary=summary,
            service_preset=service_preset,
        )

    # --- Tutorial Section 6, Example 2: Travel Inquiry Language Processor ---
    async def process_travel_inquiry(
        self,
        inquiry_text: str,
        target_language: str = "en",
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> TravelInquiryResponse:
        started = time.perf_counter()
        cleaned = inquiry_text.strip()
        norm_target = self.normalize_language_code(target_language, allow_auto=False)
        target_name = self.get_language_name(norm_target)

        det = await self.detect(cleaned, service_preset=service_preset)
        if det.lang == norm_target:
            dym, _ = fallback_typo_suggestion(cleaned)
            return TravelInquiryResponse(
                original_text=cleaned,
                detected_lang=det.lang,
                detected_language=det.lang_name,
                confidence=det.confidence,
                target_lang=norm_target,
                target_language=target_name,
                translated_text=cleaned,
                pronunciation=None,
                did_you_mean=dym,
                needs_translation=False,
                cached=det.cached,
                service_preset=service_preset,
                latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
            )

        tr = await self.translate(
            cleaned,
            src=det.lang,
            dest=norm_target,
            service_preset=service_preset,
        )
        return TravelInquiryResponse(
            original_text=cleaned,
            detected_lang=det.lang,
            detected_language=det.lang_name,
            confidence=det.confidence,
            target_lang=norm_target,
            target_language=target_name,
            translated_text=tr.text,
            pronunciation=tr.pronunciation,
            did_you_mean=tr.did_you_mean,
            needs_translation=True,
            cached=det.cached and tr.cached,
            service_preset=service_preset,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )

    async def translate_inquiry_reply(
        self,
        reply_text: str,
        staff_language: str,
        guest_language: str,
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> TravelInquiryReplyResponse:
        started = time.perf_counter()
        norm_staff = self.normalize_language_code(staff_language, allow_auto=True)
        norm_guest = self.normalize_language_code(guest_language, allow_auto=False)
        tr = await self.translate(
            reply_text,
            src=norm_staff,
            dest=norm_guest,
            service_preset=service_preset,
        )
        return TravelInquiryReplyResponse(
            staff_text=reply_text.strip(),
            translated_reply=tr.text,
            src=tr.src,
            src_name=tr.src_name,
            dest=tr.dest,
            dest_name=tr.dest_name,
            pronunciation=tr.pronunciation,
            skipped=tr.skipped,
            cached=tr.cached,
            service_preset=service_preset,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )

    # --- Tutorial Section 6, Example 3: Travel Destination Information Translator ---
    async def translate_destination_info(
        self,
        destination_data: Dict[str, Any],
        target_language: str = "vi",
        service_preset: str = DEFAULT_SERVICE_PRESET,
    ) -> DestinationTranslateResponse:
        started = time.perf_counter()
        norm_target = self.normalize_language_code(target_language, allow_auto=False)
        target_name = self.get_language_name(norm_target)

        translated_data: Dict[str, Any] = {}
        translated_fields: List[str] = []
        preserved_fields: List[str] = []
        field_errors: Dict[str, str] = {}
        cached_fields_count = 0
        sem = asyncio.Semaphore(BULK_CONCURRENCY_LIMIT)

        async def _handle_field(key: str, value: Any) -> Tuple[str, Any, str, Optional[str], bool]:
            # Exact rule from Tutorial Example 3 (page 10):
            # if isinstance(value, str) and value.strip(): translate, else preserve value
            if isinstance(value, str) and value.strip():
                async with sem:
                    try:
                        tr = await self.translate(
                            value.strip(),
                            src="auto",
                            dest=norm_target,
                            service_preset=service_preset,
                        )
                        return key, tr.text, "translated", None, tr.cached
                    except Exception as exc:
                        err_str = str(exc)
                        return key, value, "error", err_str, False
            else:
                return key, value, "preserved", None, False

        outcomes = await asyncio.gather(
            *[_handle_field(k, v) for k, v in destination_data.items()]
        )

        for key, out_val, status, err_msg, was_cached in outcomes:
            translated_data[key] = out_val
            if was_cached:
                cached_fields_count += 1
            if status == "translated":
                translated_fields.append(key)
            elif status == "preserved":
                preserved_fields.append(key)
            elif status == "error" and err_msg:
                field_errors[key] = err_msg

        return DestinationTranslateResponse(
            target_language=norm_target,
            target_language_name=target_name,
            original_data=dict(destination_data),
            translated_data=translated_data,
            translated_fields=translated_fields,
            preserved_fields=preserved_fields,
            field_errors=field_errors,
            cached_fields_count=cached_fields_count,
            service_preset=service_preset,
            latency_ms=round((time.perf_counter() - started) * 1000.0, 2),
        )
