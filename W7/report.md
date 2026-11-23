# CS252 Lab 07 — WanderLingo: Multilingual Travel Companion Website
## Project Report & Technical Explanation

- **Course:** CS252 — Programming Systems (Week 7)
- **Assignment:** Lab 07 — Google Translate API / Firebase API (Exercise 01)
- **Student:** Nguyễn Quang Hiếu (`25125043` / `nqhieu-gd`)
- **Selected API Track:** Google Translate API via Python `py-googletrans` (`googletrans==4.0.2`) — *Firebase API intentionally omitted in accordance with "integrates at least one of the two APIs introduced in the tutorial"*
- **Source Code Location:** `W7/WanderLingo/` (`backend/` + `frontend/` + `start.ps1`)
- **Setup & Running Guide:** [SetupGuide.md](./SetupGuide.md)
- **AI Usage Declaration:** [README.md](./README.md)

---

## 1. Executive Summary & Website Overview

**WanderLingo** is a full-stack **Multilingual Travel Companion** web application built for international travelers, hotel front-desk teams, and tour operators. Designed directly around the professor's tutorial (*"Using py-googletrans for Translation in Python: A Travel Application Tutorial"*, `2025 CT - API Translate.docx.pdf`), WanderLingo turns every Python snippet and travel scenario in the tutorial into an interactive, resilient, bilingual (`EN`/`VI`) web platform with Light and Dark themes.

Rather than offering a bare single-box text translator, WanderLingo organizes travel translation into **four purpose-built workspaces**:
1. **Live Travel Translator & Phrasebook** — Instant text translation across all **245 languages** in `googletrans.LANGUAGES` (with the tutorial's 8 core travel languages pinned at the top), standalone language detection with confidence scores, phonetic pronunciation/romanization display, Web Speech audio playback, categorized travel phrasebook chips, and local session translation history.
2. **Destination Guide Translator (Tutorial Section 6, Example 3)** — Field-by-field translation of structured Vietnam travel destination dictionaries (preloaded with the tutorial's exact **Hanoi** record plus **Ho Chi Minh City**, **Da Nang & Hoi An**, **Hue**, **Da Lat**, **Phu Quoc**, **Vung Tau**, and **Quy Nhon**, alongside a **Custom JSON Editor**) that translates string fields while preserving non-string numeric metadata (`avg_daily_budget_usd`, `visitor_rating`, `unesco_heritage_sites`) untouched.
3. **Hotel Review Bulk Translation System (Tutorial Section 6, Example 1 & Section 4 Bulk Translation)** — Batch processor preloaded with the tutorial's **3 Vietnamese hotel reviews verbatim** plus international reviews in English, Japanese, French, Spanish, and Korean (and custom multi-line review input). Automatically detects each review's source language, **skips translation if the review is already in the target language**, isolates per-item errors, and computes a live language-distribution summary.
4. **Travel Inquiry Language Processor & Two-Way Concierge Desk (Tutorial Section 6, Example 2)** — Processes incoming international traveler inquiries (preloaded with the tutorial's 4 Vietnamese, English, Spanish, and Japanese inquiries verbatim plus custom submissions), flags `needs_translation: true | false`, translates inquiries into the staff's working language, and adds a **Two-Way Concierge Reply Composer** that reverse-translates staff replies back into the traveler's detected language.

---

## 2. System Architecture & Request Lifecycle

Because `py-googletrans` is a **Python library** (not a client-side JavaScript SDK), a browser application must communicate with a Python backend service. WanderLingo uses an asynchronous **FastAPI (Python 3.12)** backend paired with a **React 19 + TypeScript + Vite + Tailwind CSS v4** single-page application (SPA).

```text
+-----------------------------------------------------------------------------------+
|                        WanderLingo React + TypeScript SPA                         |
|  - 4 Workspaces: Live Translator | Destination Guides | Hotel Reviews | Inquiries |
|  - Bilingual UI (EN / VI) | Light & Dark Themes | Service URL Preset Selector     |
+-----------------------------------------+-----------------------------------------+
                                          |
                              HTTP JSON REST (/api/*)
                                          v
+-----------------------------------------------------------------------------------+
|                        FastAPI Backend (127.0.0.1:8000)                           |
|  1. Pydantic v2 Schema Validation & Input Sanitization (<= 5000 chars, <= 25 items)|
|  2. SlidingWindowRateLimiter (60 req/min per IP -> HTTP 429 + Retry-After header) |
|  3. TTLLRUCache (Bounded 500-entry LRU, 30-min TTL -> 0ms repeat lookups)         |
|  4. TranslationEngine (Language alias normalization, Semaphore(3), Retry/Failover)|
|  5. GoogleTrans4Adapter (googletrans==4.0.2 async httpx + dict-chrome-ex client)  |
+-----------------------------------------+-----------------------------------------+
                                          |
                   HTTPS (translate.google.com / translate.googleapis.com /
                          translate.google.co.kr / translate.google.co.jp)
                                          v
+-----------------------------------------------------------------------------------+
|                        Google Translate Ajax API Endpoints                        |
+-----------------------------------------------------------------------------------+
```

### Dual Execution Modes
- **Single-Command Demo / Production Mode (`W7/WanderLingo/start.ps1`):** Compiles the React frontend into `frontend/dist/` and mounts it directly inside FastAPI (`app/main.py`), serving both the web UI and all `/api/*` endpoints from a single server at `http://127.0.0.1:8000` (with interactive OpenAPI documentation at `http://127.0.0.1:8000/docs`).
- **Two-Terminal Hot-Reload Development Mode:** FastAPI runs on `http://127.0.0.1:8000` while Vite runs on `http://localhost:5173` and proxies `/api/*` requests to port `8000` via `vite.config.ts`.

---

## 3. Traceability to the Professor's Tutorial (`2025 CT - API Translate.docx.pdf`)

| Tutorial Section | Tutorial Concept / Code Pattern | WanderLingo Implementation |
| :--- | :--- | :--- |
| **Section 2: Setup & Languages** | `from googletrans import LANGUAGES` & `travel_languages` dictionary (`en`, `vi`, `fr`, `es`, `zh`, `ja`, `ko`, `th`) | `backend/app/config.py` (`PINNED_TRAVEL_LANGUAGE_CODES`, `LANGUAGE_CODE_ALIASES`), `GET /api/languages`, and `frontend/src/components/LanguageCombobox.tsx` |
| **Section 3 & 4: Core Features** | `Translator()`, `translate(text, src, dest)` returning `.text`, `.src`, `.dest`, `.origin`, `.pronunciation`; `detect(text)` returning `.lang`, `.confidence` | `backend/app/services/adapter.py` (`GoogleTrans4Adapter`), `POST /api/translate`, `POST /api/detect`, and `LiveTranslatorPanel.tsx` |
| **Section 4: Bulk Translation** | `translator.translate(texts, dest='vi')` | `POST /api/translate/bulk` & `POST /api/travel/reviews` using `asyncio.Semaphore(3)` concurrency control |
| **Section 5: Custom Service URLs & Direct Endpoints** | `service_urls=['translate.google.com', 'translate.google.co.kr', 'translate.google.co.jp']` and `service_urls=['translate.googleapis.com']` | Centralized `SERVICE_URL_PRESETS` (`default`, `direct`, `redundant`) selectable live from the UI header (`TopBar.tsx`) with automatic retry failover |
| **Section 6 — Example 1** | `translate_hotel_reviews(reviews, target_language='en')` — detect source language, skip if `detection.lang == target_language`, catch per-item exceptions | `TranslationEngine.translate_hotel_reviews` (`translator_service.py`), `POST /api/travel/reviews`, and `HotelReviewsPanel.tsx` |
| **Section 6 — Example 2** | `process_travel_inquiry(inquiry_text, target_language='en')` — detect language, map code to `LANGUAGES`, set `needs_translation` boolean | `TranslationEngine.process_travel_inquiry` + `translate_inquiry_reply`, `POST /api/travel/inquiry`, and `InquiryDeskPanel.tsx` |
| **Section 6 — Example 3** | `translate_destination_info(destination_data, target_language)` — translate string values (`isinstance(value, str) and value.strip()`), preserve other fields | `TranslationEngine.translate_destination_info`, `POST /api/travel/destination`, and `DestinationGuidePanel.tsx` |
| **Section 7: Next Steps** | Error handling, retry logic, rate limiting for large-scale usage, travel-specific datasets | `TTLLRUCache` (`cache.py`), `SlidingWindowRateLimiter` (`rate_limiter.py`), retry/failover (`_execute_with_retry`), and curated datasets (`travel_samples.py`) |

---

## 4. How `py-googletrans` Is Integrated & Hardened for Python 3.12

During **Phase 0** live verification (`backend/scripts/smoke_googletrans.py`), four real-world technical subtleties in `py-googletrans` were identified and solved cleanly in the backend service layer:

### 4.1 Python 3.12 Compatibility (`googletrans==4.0.2` vs. legacy `3.1.0a0`)
- The 2020 pre-release `googletrans==3.1.0a0` pins `httpx==0.13.3` and legacy `httpcore`, which fails on modern Python 3.12 environments.
- WanderLingo runs `googletrans==4.0.2` inside an isolated virtual environment (`W7/WanderLingo/backend/.venv`), leveraging its native `async`/`await` API (`async with Translator(...) as translator:`) inside FastAPI async endpoints without blocking the event loop.

### 4.2 Eliminating Silent `DUMMY_DATA` Fallbacks & Legacy TKK `403` Errors (`adapter.py`)
- In `googletrans==4.0.2`, `DEFAULT_RAISE_EXCEPTION` is `False`. When an upstream request fails with HTTP `403` or `429`, the library silently returns `DUMMY_DATA` (echoing the untranslated English string with `src='en'` and `confidence=1`).
- Additionally, `Translator.__init__` defaults to `client_type='webapp'` (which attempts to scrape a removed `tkk` token from `translate.google.com`, resulting in HTTP `403`) or `client_type='gtx'` (frequently throttled with HTTP `429` on shared networks).
- `GoogleTrans4Adapter` explicitly configures `translator.raise_exception = True`, `translator.client_type = "dict-chrome-ex"`, and preserves `translator.service_urls = list(service_urls)`. Live verification confirmed that all three tutorial presets (`default`, `direct`, `redundant`) return accurate translations, language detections, and phonetic romanizations.

### 4.3 Filtering Echoed Origin Strings in `.pronunciation` (`normalize_pronunciation`)
- When translating into a Latin-alphabet language that has no separate phonetic romanization row (such as Vietnamese, Spanish, or French), `googletrans` initializes `pron = origin` (the untranslated source text).
- `normalize_pronunciation(raw_pron, translated_text, origin_text)` returns `None` whenever `raw_pron` is empty or identical to either `origin_text` or `translated_text`, ensuring the UI only renders the Pronunciation box for genuine phonetic transliterations (e.g., Japanese Romaji `"Dōmo arigatōgozaimasu."` or Chinese Pinyin `"Huānyíng lái dào wǒmen de jiǔdiàn"`).

### 4.4 Language Alias & Polymorphic Confidence Normalization (`translator_service.py`)
- Maps common aliases such as `'zh'` -> `'zh-cn'`, `'zh_TW'` -> `'zh-tw'`, and full language names (`'vietnamese'` -> `'vi'`) while validating against `googletrans.LANGUAGES` (returning HTTP `422` for invalid codes).
- Safely normalizes `detection.confidence` whether `googletrans` returns a `float`, `int`, `list`, or `None`.

---

## 5. REST API Endpoint Reference

| Method & Path | Description | Key Request Fields | Key Response Fields |
| :--- | :--- | :--- | :--- |
| `GET /api/health` | Backend health, `googletrans` version, active presets & cache stats | — | `status`, `googletrans_version`, `active_presets`, `cache_hits`, `cache_size` |
| `GET /api/languages` | Full `googletrans.LANGUAGES` (245) + 8 pinned travel languages | — | `total_count`, `travel_languages`, `all_languages`, `aliases` |
| `POST /api/cache/clear` | Clears in-memory TTL LRU translation cache | — | `{ "status": "cleared" }` |
| `POST /api/detect` | Detects source language & confidence score | `text`, `service_preset` | `lang`, `lang_name`, `confidence`, `cached`, `latency_ms` |
| `POST /api/translate` | Single text translation with auto-detect & pronunciation | `text`, `src`, `dest`, `service_preset` | `origin`, `text`, `src`, `src_name`, `dest`, `dest_name`, `pronunciation`, `skipped`, `cached`, `latency_ms` |
| `POST /api/translate/bulk` | Batch translation with `Semaphore(3)` & same-lang skip | `texts[]`, `src`, `dest`, `skip_same_language`, `service_preset` | `items[]`, `summary` (`translated_count`, `skipped_count`, `language_breakdown`) |
| `GET /api/travel/samples` | Curated tutorial datasets for Workspaces 1–4 | — | `destinations`, `reviews`, `inquiries`, `phrasebook` |
| `POST /api/travel/reviews` | Tutorial Example 1: Hotel Review Bulk Translator | `reviews[]`, `target_language`, `service_preset` | `results[]` (`original`, `translated`, `source_lang_name`, `confidence`, `skipped`), `summary` |
| `POST /api/travel/inquiry` | Tutorial Example 2: Travel Inquiry Processor | `inquiry_text`, `target_language`, `service_preset` | `detected_language`, `confidence`, `translated_text`, `needs_translation` |
| `POST /api/travel/inquiry/reply` | Two-way concierge reply reverse translator | `reply_text`, `staff_language`, `guest_language`, `service_preset` | `staff_text`, `translated_reply`, `dest_name`, `pronunciation` |
| `POST /api/travel/destination` | Tutorial Example 3: Destination Dict Translator | `destination_data`, `target_language`, `service_preset` | `original_data`, `translated_data`, `translated_fields`, `preserved_fields` |

---

## 6. Verification & Automated Test Results

- **Phase 0 Live Smoke Verification (`backend/scripts/smoke_googletrans.py`):** Verified live against Google Translate endpoints across `default`, `direct`, and `redundant` `service_urls` presets for single translation (`EN -> VI`), non-Latin pronunciation (`EN -> JA`, `EN -> ZH-CN`, `EN -> ZH-TW`), language detection (`ES`), and bulk translation.
- **Backend Automated Test Suite (`pytest -v`):** **15 / 15 passed** (`tests/test_translator_service.py`, `tests/test_rate_limiter.py`, `tests/test_api_routes.py`), covering language alias normalization, confidence/pronunciation normalization, TTL LRU caching, retry/failover on transient errors, skip-if-same-language in hotel reviews, `needs_translation` in travel inquiries, non-string preservation in destination guides, HTTP `422` validation, and HTTP `429` rate limiting with `Retry-After`.
- **Frontend Verification (`tsc --noEmit`, `vitest run`, `vite build`):** **3 / 3 passed** (`src/__tests__/i18nParity.test.ts` verifying 100% key parity between `en.ts` and `vi.ts`, and `src/__tests__/apiClient.test.ts`), zero TypeScript errors, and clean production bundle generation in `frontend/dist/`.
