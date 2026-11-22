"""Pydantic request and response schemas for WanderLingo REST API."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

from app.config import DEFAULT_SERVICE_PRESET, MAX_BULK_ITEMS, MAX_TEXT_LENGTH, SERVICE_URL_PRESETS

ServicePresetName = Literal["default", "direct", "redundant"]


class ServicePresetInfo(BaseModel):
    key: str
    label: str
    urls: List[str]


class HealthResponse(BaseModel):
    status: str = "ok"
    app_name: str
    app_version: str
    googletrans_version: str
    default_preset: str
    active_presets: List[ServicePresetInfo]
    cache_size: int
    cache_max_entries: int
    cache_ttl_seconds: int
    cache_hits: int
    cache_misses: int


class LanguageItem(BaseModel):
    code: str
    name: str


class LanguagesResponse(BaseModel):
    total_count: int
    travel_languages: List[LanguageItem]
    all_languages: List[LanguageItem]
    aliases: Dict[str, str]


class DetectRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    service_preset: str = Field(default=DEFAULT_SERVICE_PRESET)

    @field_validator("text")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Text must not be empty or whitespace only.")
        return stripped

    @field_validator("service_preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        if value not in SERVICE_URL_PRESETS:
            raise ValueError(f"Unsupported service_preset '{value}'. Allowed: {list(SERVICE_URL_PRESETS.keys())}")
        return value


class DetectResponse(BaseModel):
    text: str
    lang: str
    lang_name: str
    confidence: Optional[float] = None
    cached: bool
    service_preset: str
    latency_ms: float


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    src: str = Field(default="auto")
    dest: str = Field(default="vi")
    service_preset: str = Field(default=DEFAULT_SERVICE_PRESET)

    @field_validator("text")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Text must not be empty or whitespace only.")
        return stripped

    @field_validator("service_preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        if value not in SERVICE_URL_PRESETS:
            raise ValueError(f"Unsupported service_preset '{value}'. Allowed: {list(SERVICE_URL_PRESETS.keys())}")
        return value


class TranslateResponse(BaseModel):
    origin: str
    text: str
    src: str
    src_name: str
    dest: str
    dest_name: str
    pronunciation: Optional[str] = None
    confidence: Optional[float] = None
    skipped: bool = False
    cached: bool = False
    service_preset: str
    latency_ms: float


class BulkTranslateRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=MAX_BULK_ITEMS)
    src: str = Field(default="auto")
    dest: str = Field(default="vi")
    skip_same_language: bool = Field(default=True)
    service_preset: str = Field(default=DEFAULT_SERVICE_PRESET)

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, items: List[str]) -> List[str]:
        cleaned: List[str] = []
        for idx, item in enumerate(items):
            stripped = item.strip()
            if not stripped:
                raise ValueError(f"Item at index {idx} must not be empty or whitespace only.")
            if len(stripped) > MAX_TEXT_LENGTH:
                raise ValueError(f"Item at index {idx} exceeds {MAX_TEXT_LENGTH} characters.")
            cleaned.append(stripped)
        return cleaned

    @field_validator("service_preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        if value not in SERVICE_URL_PRESETS:
            raise ValueError(f"Unsupported service_preset '{value}'. Allowed: {list(SERVICE_URL_PRESETS.keys())}")
        return value


class BulkItemResult(BaseModel):
    index: int
    origin: str
    translated: Optional[str] = None
    src: Optional[str] = None
    src_name: Optional[str] = None
    dest: str
    dest_name: str
    pronunciation: Optional[str] = None
    confidence: Optional[float] = None
    skipped: bool = False
    cached: bool = False
    error: Optional[str] = None


class BulkSummary(BaseModel):
    total: int
    translated_count: int
    skipped_count: int
    failed_count: int
    cached_count: int
    language_breakdown: Dict[str, int]
    latency_ms: float


class BulkTranslateResponse(BaseModel):
    items: List[BulkItemResult]
    summary: BulkSummary
    service_preset: str


# --- Tutorial Example 1: Hotel Review Translation System ---
class HotelReviewInput(BaseModel):
    id: Optional[str] = None
    author: Optional[str] = "Guest"
    hotel_name: Optional[str] = None
    rating: Optional[float] = Field(default=5.0, ge=1.0, le=5.0)
    stay_date: Optional[str] = None
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)

    @field_validator("text")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Review text must not be empty.")
        return stripped


class HotelReviewTranslateRequest(BaseModel):
    reviews: List[HotelReviewInput] = Field(..., min_length=1, max_length=MAX_BULK_ITEMS)
    target_language: str = Field(default="en")
    service_preset: str = Field(default=DEFAULT_SERVICE_PRESET)

    @field_validator("service_preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        if value not in SERVICE_URL_PRESETS:
            raise ValueError(f"Unsupported service_preset '{value}'.")
        return value


class HotelReviewResult(BaseModel):
    id: str
    author: str
    hotel_name: Optional[str] = None
    rating: Optional[float] = None
    stay_date: Optional[str] = None
    original: str
    translated: Optional[str] = None
    source_lang: Optional[str] = None
    source_lang_name: Optional[str] = None
    confidence: Optional[float] = None
    pronunciation: Optional[str] = None
    skipped: bool = False
    cached: bool = False
    error: Optional[str] = None


class HotelReviewTranslateResponse(BaseModel):
    target_language: str
    target_language_name: str
    results: List[HotelReviewResult]
    summary: BulkSummary
    service_preset: str


# --- Tutorial Example 2: Travel Inquiry Language Processor ---
class TravelInquiryRequest(BaseModel):
    inquiry_text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    target_language: str = Field(default="en")
    service_preset: str = Field(default=DEFAULT_SERVICE_PRESET)

    @field_validator("inquiry_text")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Inquiry text must not be empty.")
        return stripped

    @field_validator("service_preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        if value not in SERVICE_URL_PRESETS:
            raise ValueError(f"Unsupported service_preset '{value}'.")
        return value


class TravelInquiryResponse(BaseModel):
    original_text: str
    detected_lang: str
    detected_language: str
    confidence: Optional[float] = None
    target_lang: str
    target_language: str
    translated_text: str
    pronunciation: Optional[str] = None
    needs_translation: bool
    cached: bool
    service_preset: str
    latency_ms: float


class TravelInquiryReplyRequest(BaseModel):
    reply_text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    staff_language: str = Field(default="en")
    guest_language: str = Field(...)
    service_preset: str = Field(default=DEFAULT_SERVICE_PRESET)

    @field_validator("reply_text")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Reply text must not be empty.")
        return stripped

    @field_validator("service_preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        if value not in SERVICE_URL_PRESETS:
            raise ValueError(f"Unsupported service_preset '{value}'.")
        return value


class TravelInquiryReplyResponse(BaseModel):
    staff_text: str
    translated_reply: str
    src: str
    src_name: str
    dest: str
    dest_name: str
    pronunciation: Optional[str] = None
    skipped: bool
    cached: bool
    service_preset: str
    latency_ms: float


# --- Tutorial Example 3: Travel Destination Information Translator ---
class DestinationTranslateRequest(BaseModel):
    destination_data: Dict[str, Any] = Field(...)
    target_language: str = Field(default="vi")
    service_preset: str = Field(default=DEFAULT_SERVICE_PRESET)

    @field_validator("destination_data")
    @classmethod
    def validate_dict_non_empty(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        if not value:
            raise ValueError("destination_data must contain at least one field.")
        if len(value) > 30:
            raise ValueError("destination_data cannot exceed 30 fields.")
        return value

    @field_validator("service_preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        if value not in SERVICE_URL_PRESETS:
            raise ValueError(f"Unsupported service_preset '{value}'.")
        return value


class DestinationTranslateResponse(BaseModel):
    target_language: str
    target_language_name: str
    original_data: Dict[str, Any]
    translated_data: Dict[str, Any]
    translated_fields: List[str]
    preserved_fields: List[str]
    field_errors: Dict[str, str]
    cached_fields_count: int
    service_preset: str
    latency_ms: float
