"""Centralized configuration for WanderLingo FastAPI backend.

No service URLs or operational limits are hardcoded inside route handlers.
"""
from __future__ import annotations

import os
from typing import Dict, List

APP_NAME = "WanderLingo — Multilingual Travel Companion API"
APP_VERSION = "1.0.0"

# Section 5 of the py-googletrans tutorial: Custom service URLs & direct API endpoint
SERVICE_URL_PRESETS: Dict[str, List[str]] = {
    "default": ["translate.google.com"],
    "direct": ["translate.googleapis.com"],
    "redundant": [
        "translate.google.com",
        "translate.google.co.kr",
        "translate.google.co.jp",
    ],
}

SERVICE_PRESET_LABELS: Dict[str, str] = {
    "default": "Default (translate.google.com)",
    "direct": "Direct API (translate.googleapis.com)",
    "redundant": "Multi-Domain Failover (.com / .co.kr / .co.jp)",
}

DEFAULT_SERVICE_PRESET = "default"

# Section 2 of the py-googletrans tutorial: Common travel-related languages
# Note: 'zh' in the tutorial maps to 'zh-cn' (Chinese Simplified) and 'zh-tw' (Chinese Traditional) in googletrans.LANGUAGES
PINNED_TRAVEL_LANGUAGE_CODES: List[str] = [
    "en",
    "vi",
    "fr",
    "es",
    "zh-cn",
    "ja",
    "ko",
    "th",
]

# Common language code aliases normalized automatically before calling googletrans
LANGUAGE_CODE_ALIASES: Dict[str, str] = {
    "zh": "zh-cn",
    "zh_cn": "zh-cn",
    "zh-hans": "zh-cn",
    "zh_tw": "zh-tw",
    "zh-hant": "zh-tw",
    "iw": "he",
    "jw": "jv",
}

# Validation & protection limits (Tutorial Section 7: Next Steps)
MAX_TEXT_LENGTH = int(os.getenv("WANDERLINGO_MAX_TEXT_LENGTH", "5000"))
MAX_BULK_ITEMS = int(os.getenv("WANDERLINGO_MAX_BULK_ITEMS", "25"))
BULK_CONCURRENCY_LIMIT = int(os.getenv("WANDERLINGO_BULK_CONCURRENCY", "3"))

# Cache configuration
CACHE_TTL_SECONDS = int(os.getenv("WANDERLINGO_CACHE_TTL_SECONDS", "1800"))
CACHE_MAX_ENTRIES = int(os.getenv("WANDERLINGO_CACHE_MAX_ENTRIES", "500"))

# Rate limiter configuration (sliding window per client IP)
RATE_LIMIT_REQUESTS = int(os.getenv("WANDERLINGO_RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("WANDERLINGO_RATE_LIMIT_WINDOW_SECONDS", "60"))

# Retry & failover configuration
RETRY_ATTEMPTS = int(os.getenv("WANDERLINGO_RETRY_ATTEMPTS", "2"))
RETRY_BACKOFF_SECONDS: List[float] = [0.35, 0.9]

# CORS Allowed Origins for local development
ALLOWED_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
