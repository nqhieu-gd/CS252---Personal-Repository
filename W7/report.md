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

**WanderLingo** is a full-stack **Multilingual Travel Companion** web application built for international travelers visiting Vietnam, hotel front-desk teams, and tour operators. Designed directly around the professor's tutorial (*"Using py-googletrans for Translation in Python: A Travel Application Tutorial"*, [2025 CT - API Translate.md](./2025%20CT%20-%20API%20Translate.md)), WanderLingo turns every Python snippet and travel scenario in the tutorial into an interactive, resilient, bilingual (`EN`/`VI`) web platform with Light and Dark themes.

Rather than offering a bare single-box text translator, WanderLingo organizes travel translation into **four purpose-built workspaces**:
1. **Live Travel Translator & Phrasebook** — Instant text translation across all **245 languages** in `googletrans.LANGUAGES` (with the tutorial's 8 core travel languages pinned at the top), **Spelling & Grammar Fixing Recommendations ("Did you mean: ...")** powered by Google Translate's `possible-mistakes` metadata, **Alternative Natural Phrasings** & **Part-of-Speech Dictionary Nuances**, **Round-Trip Back-Translation Verification**, a fullscreen **Show-to-Local Conversation Card Dialog**, **Multi-Language Travel Broadcast** (up to 5 languages simultaneously), Web Speech audio playback, categorized travel phrasebook chips, and saved favorites / session history with `.txt` phrase-sheet export.
2. **Destination Guide Translator (Tutorial Section 6, Example 3)** — Field-by-field translation of structured Vietnam travel destination dictionaries (preloaded with the tutorial's exact **Hanoi** record plus **Ho Chi Minh City**, **Da Nang & Hoi An**, **Hue**, **Da Lat**, **Phu Quoc**, **Vung Tau**, and **Quy Nhon**, alongside a **Custom JSON Editor**) that translates string fields while preserving non-string numeric planning fields (`estimated_daily_budget_usd`, `recommended_stay_days`) untouched.
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
- **Single-Command Demo / Production Mode (`W7/WanderLingo/start.ps1`):** Compiles the React frontend into `frontend/dist/` (when missing or when `-Rebuild` is passed), mounts it directly inside FastAPI (`app/main.py`), serves both the web UI and all `/api/*` endpoints from a single server at `http://127.0.0.1:8000` (with interactive OpenAPI documentation at `http://127.0.0.1:8000/docs`), and polls `/api/health` in a background job to **automatically open `http://127.0.0.1:8000` in the user's default web browser** once ready (suppressible via `-NoBrowser`).
- **Two-Terminal Hot-Reload Development Mode:** FastAPI runs on `http://127.0.0.1:8000` while Vite runs on `http://localhost:5173` (`server.open: true` auto-opens the browser) and proxies `/api/*` requests to port `8000` via `vite.config.ts`.

---

## 3. Traceability to the Professor's Tutorial (`2025 CT - API Translate.md`)

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

### 4.3 Filtering Echoed Origin Strings & Multi-Sentence Romanization in `.pronunciation` (`extract_pronunciation`)
- When translating into a Latin-alphabet language that has no separate phonetic romanization row (such as Vietnamese, Spanish, or French), `googletrans` initializes `pron = origin` (the untranslated source text).
- Additionally, on multi-sentence or multi-line inputs, `googletrans/client.py` reads `data[0][1][-2]` (which is the second sentence row, yielding `[[]]` instead of a string), while the actual combined phonetic romanization row resides at `data[0][-1][2]` (`result.extra_data["translation"][-1][2]`).
- `extract_pronunciation(result, translated_text, origin_text)` recovers multi-sentence romanization from `extra_data` when `result.pronunciation` is not a string, and `normalize_pronunciation` returns `None` whenever `raw_pron` is empty or identical to either `origin_text` or `translated_text`.

### 4.4 Language Alias, Polymorphic `detection.lang`, & Confidence Normalization (`translator_service.py`, `adapter.py`)
- Maps common aliases such as `'zh'` -> `'zh-cn'`, `'zh_TW'` -> `'zh-tw'`, and full language names (`'vietnamese'` -> `'vi'`) while validating against `googletrans.LANGUAGES` (returning HTTP `422` for invalid codes).
- Safely unwraps `detection.lang` via `normalize_detected_lang()` when `googletrans` returns a `list[str]` on mixed-language paragraphs or an empty string `""` on emoji/numeric-only inputs.
- Safely normalizes `detection.confidence` whether `googletrans` returns a `float`, `int`, `list`, or `None`.

---

## 5. REST API Endpoint Reference

| Method & Path | Description | Key Request Fields | Key Response Fields |
| :--- | :--- | :--- | :--- |
| `GET /api/health` | Backend health, `googletrans` version, active presets & cache stats | — | `status`, `googletrans_version`, `active_presets`, `cache_hits`, `cache_size` |
| `GET /api/languages` | Full `googletrans.LANGUAGES` (245) + 8 pinned travel languages | — | `total_count`, `travel_languages`, `all_languages`, `aliases` |
| `POST /api/cache/clear` | Clears in-memory TTL LRU translation cache | — | `{ "status": "cleared" }` |
| `POST /api/detect` | Detects source language & confidence score | `text`, `service_preset` | `lang`, `lang_name`, `confidence`, `cached`, `latency_ms` |
| `POST /api/translate` | Single text translation with auto-detect, pronunciation, typo suggestion (`did_you_mean`), alternatives & dictionary | `text`, `src`, `dest`, `service_preset` | `origin`, `text`, `src`, `dest`, `pronunciation`, `did_you_mean`, `alternatives`, `dictionary`, `definitions`, `skipped`, `cached`, `latency_ms` |
| `POST /api/translate/multi` | Simultaneous multi-language travel broadcast (up to 6 target languages) | `text`, `src`, `targets[]`, `service_preset` | `origin`, `src`, `did_you_mean`, `results[]` (`dest`, `dest_name`, `text`, `pronunciation`), `latency_ms` |
| `POST /api/translate/bulk` | Batch translation with `Semaphore(3)` & same-lang skip | `texts[]`, `src`, `dest`, `skip_same_language`, `service_preset` | `items[]`, `summary` (`translated_count`, `skipped_count`, `language_breakdown`) |
| `GET /api/travel/samples` | Curated tutorial datasets for Workspaces 1–4 | — | `destinations`, `reviews`, `inquiries`, `phrasebook` |
| `POST /api/travel/reviews` | Tutorial Example 1: Hotel Review Bulk Translator | `reviews[]`, `target_language`, `service_preset` | `results[]` (`original`, `translated`, `source_lang_name`, `confidence`, `skipped`), `summary` |
| `POST /api/travel/inquiry` | Tutorial Example 2: Travel Inquiry Processor | `inquiry_text`, `target_language`, `service_preset` | `detected_language`, `confidence`, `translated_text`, `needs_translation` |
| `POST /api/travel/inquiry/reply` | Two-way concierge reply reverse translator | `reply_text`, `staff_language`, `guest_language`, `service_preset` | `staff_text`, `translated_reply`, `dest_name`, `pronunciation` |
| `POST /api/travel/destination` | Tutorial Example 3: Destination Dict Translator | `destination_data`, `target_language`, `service_preset` | `original_data`, `translated_data`, `translated_fields`, `preserved_fields` |

---

## 6. Complete Function & Module Catalog

### 6.1 Backend Python Functions & Classes (`W7/WanderLingo/backend/`)

| Module | Function / Method | Responsibility |
| :--- | :--- | :--- |
| `app/services/adapter.py` | `normalize_confidence(raw_conf)` | Safely normalizes `Detected.confidence` across `float`, `int`, `list`, or `None` into `[0.0, 1.0]` rounded to 4 decimals |
| `app/services/adapter.py` | `normalize_detected_lang(raw_lang)` | Unwraps polymorphic `Detected.lang` when `googletrans` returns a `list[str]` (mixed-language text) or empty `""` (emoji/numbers) |
| `app/services/adapter.py` | `normalize_pronunciation(raw_pron, translated_text, origin_text)` | Filters out empty strings and echoed `origin`/`translated` fallbacks so only genuine phonetic romanization is returned |
| `app/services/adapter.py` | `extract_pronunciation(result, translated_text, origin_text)` | Extracts single-sentence `.pronunciation` or recovers multi-sentence romanization from `result.extra_data["translation"][-1][2]` when `.pronunciation` is `[[]]` |
| `app/services/adapter.py` | `extract_did_you_mean(result, origin_text)` & `fallback_typo_suggestion(origin_text)` | Extracts spelling/grammar correction (`"Did you mean: ..."`) and corrected tokens from `extra_data["possible-mistakes"]` with travel-typo fallback |
| `app/services/adapter.py` | `extract_alternatives(result, primary_translation)` & `extract_dictionary_and_definitions(result)` | Parses alternative natural phrasings (`possible-translations`), part-of-speech terms (`all-translations`), and definitions (`definitions`) |
| `app/services/adapter.py` | `_configure_translator(translator, service_urls)` | Sets `raise_exception=True`, `client_type="dict-chrome-ex"`, and preserves `service_urls` to prevent silent `DUMMY_DATA` and TKK `403` errors |
| `app/services/adapter.py` | `GoogleTrans4Adapter.translate_text(text, src, dest, service_urls)` | Executes async `translator.translate()` via `googletrans==4.0.2` and returns normalized `RawTranslatedResult` |
| `app/services/adapter.py` | `GoogleTrans4Adapter.detect_text(text, service_urls)` | Executes async `translator.detect()` via `googletrans==4.0.2` and returns normalized `RawDetectedResult` |
| `app/services/adapter.py` | `get_googletrans_version()` / `get_raw_languages()` | Reads installed `googletrans` package version (`4.0.2`) and `googletrans.LANGUAGES` dictionary (245 languages) |
| `app/services/translator_service.py` | `TranslationEngine.normalize_language_code(code, allow_auto)` | Normalizes case/underscores, resolves aliases (`zh` -> `zh-cn`, `zh_TW` -> `zh-tw`) and full language names, or raises `InvalidLanguageCodeError` (`HTTP 422`) |
| `app/services/translator_service.py` | `TranslationEngine.get_language_name(code)` | Resolves an ISO code to its human-readable title-cased language name from `googletrans.LANGUAGES` |
| `app/services/translator_service.py` | `TranslationEngine.get_service_presets_info()` | Returns metadata and domain lists for the 3 tutorial `service_urls` presets (`default`, `direct`, `redundant`) |
| `app/services/translator_service.py` | `TranslationEngine.get_languages_catalog()` | Builds the `LanguagesResponse` payload containing the 8 pinned travel languages, all 245 languages, and alias mappings |
| `app/services/translator_service.py` | `TranslationEngine._resolve_candidate_url_lists(service_preset)` | Generates ordered primary and fallback `service_urls` lists for automatic retry failover |
| `app/services/translator_service.py` | `TranslationEngine._execute_with_retry(service_preset, operation_fn)` | Retries failed upstream calls with backoff delays (`0.35s`, `0.9s`) across candidate `service_urls`, raising `UpstreamTranslationError` (`HTTP 502`) on exhaustion |
| `app/services/translator_service.py` | `TranslationEngine.detect(text, service_preset)` | Checks TTL LRU cache or runs live language detection with latency tracking (`DetectResponse`) |
| `app/services/translator_service.py` | `TranslationEngine.translate(text, src, dest, service_preset)` | Short-circuits identical `src == dest`, checks TTL LRU cache, or runs live translation (`TranslateResponse`) |
| `app/services/translator_service.py` | `TranslationEngine.translate_multi_target(text, src, targets, service_preset)` | Translates one phrase simultaneously into up to 6 target languages via `asyncio.Semaphore(3)` while surfacing typo suggestions |
| `app/services/translator_service.py` | `TranslationEngine.translate_bulk(texts, src, dest, skip_same_language, service_preset)` | Batch-translates lists using `asyncio.Semaphore(3)`, optional same-language auto-skip, per-item error isolation, and `_build_bulk_summary()` |
| `app/services/translator_service.py` | `TranslationEngine.translate_hotel_reviews(reviews, target_language, service_preset)` | **Tutorial Example 1:** Detects each review's language, skips reviews already in `target_language`, translates the rest, and computes language distribution |
| `app/services/translator_service.py` | `TranslationEngine.process_travel_inquiry(inquiry_text, target_language, service_preset)` | **Tutorial Example 2:** Detects inquiry language, determines `needs_translation: bool`, and translates when needed |
| `app/services/translator_service.py` | `TranslationEngine.translate_inquiry_reply(reply_text, staff_language, guest_language, service_preset)` | **Two-Way Extension:** Reverse-translates staff concierge replies back into the traveler's detected language with pronunciation |
| `app/services/translator_service.py` | `TranslationEngine.translate_destination_info(destination_data, target_language, service_preset)` | **Tutorial Example 3:** Translates non-empty string values (`isinstance(value, str) and value.strip()`) while preserving numeric/non-string metadata untouched |
| `app/services/cache.py` | `TTLLRUCache.get(key)` / `set(key, value)` / `clear()` / `stats()` | Thread-safe bounded LRU cache (`max_entries=500`, `ttl_seconds=1800`) tracking hits, misses, and active size |
| `app/services/rate_limiter.py` | `SlidingWindowRateLimiter.check(client_key)` / `reset()` | Per-IP sliding-window rate limiter (`60 req / 60s`) computing remaining quota and `retry_after_seconds` |
| `app/dependencies.py` | `enforce_rate_limit(request, response)` | FastAPI dependency attaching `X-RateLimit-Remaining` and raising `HTTP 429` with `Retry-After` header when exceeded |
| `app/main.py` | `create_app()` | Configures FastAPI app, CORS, `422`/`502` exception handlers, API routers, and static `frontend/dist` SPA mounting |
| `scripts/smoke_googletrans.py` | `configure_translator()` / `run_smoke_tests()` | Phase 0 live verification script testing `LANGUAGES`, single/bulk translation, Chinese variants, pronunciation, detection, and all 3 `service_urls` presets |

### 6.2 Frontend TypeScript Functions, Hooks & Components (`W7/WanderLingo/frontend/src/`)

| File | Function / Component | Responsibility |
| :--- | :--- | :--- |
| `services/apiClient.ts` | `requestJson<T>(url, options, signal)` & `apiClient.*` | Typed `fetch` wrapper with `AbortSignal` support and structured FastAPI error parsing (`ApiClientError`) across all 11 backend endpoints |
| `i18n/I18nContext.tsx` | `I18nProvider` & `useI18n()` (`t`, `locale`, `setLocale`) | Bilingual `EN`/`VI` localization context persisted in `localStorage` (`wanderlingo_locale`) with compile-time key parity (`en.ts`, `vi.ts`) |
| `context/ThemeContext.tsx` | `ThemeProvider` & `useTheme()` (`theme`, `toggleTheme`) | Light/Dark theme manager synced with `document.documentElement.dataset.theme` and `localStorage` (`wanderlingo_theme`) |
| `hooks/useTranslationHistory.ts` | `useTranslationHistory()` (`history`, `favorites`, `toggleFavorite`, `isFavorite`, `clearHistory`, `clearFavorites`) | Manages both recent translations and starred favorite phrases in `localStorage` |
| `components/ModalDialog.tsx` | `ModalDialog` | Accessible `role="dialog"` sculpted modal with backdrop blur scrim, `Escape` close, Tab focus trap, and focus restoration |
| `components/MultiCompareModal.tsx` | `MultiCompareModal` (`runBroadcast`, `toggleTarget`, `handleCopyAll`) | Simultaneous multi-language travel broadcast modal (`POST /api/translate/multi`) with typo suggestions and one-click Copy All |
| `components/TopBar.tsx` | `TopBar` | Renders travel brand header, pill-track workspace switcher, sculpted Engine & Endpoint Settings dialog, `EN`/`VI` pill, and Bright/Dim theme pill |
| `components/LanguageCombobox.tsx` | `LanguageCombobox` (`selectCode`, `filteredTravel`, `filteredAll`) | Searchable dropdown pinning the 8 popular travel languages above all 245 `googletrans.LANGUAGES` (plus optional `Auto-Detect`) |
| `components/LiveTranslatorPanel.tsx` | `LiveTranslatorPanel` (`runTranslate`, `runDetectOnly`, `runVerifyBackTranslation`, `handleSwapLanguages`, `handleExportPhraseSheet`, `handleCopy`, `handleSpeak`) | **Workspace 1:** Unified split-deck translator with `Did you mean` typo fixing, alternative phrasings, dictionary breakdown, round-trip back-translation, Show-to-Local flashcard dialog, phrasebook, favorites, and `.txt` export |
| `components/DestinationGuidePanel.tsx` | `DestinationGuidePanel` (`handleTranslateGuide`, `handleDownloadJson`, `formatFieldValue`, `formatFieldLabel`) | **Workspace 2:** Curated 8 Vietnam destination guides + Custom JSON editor + `.json` export with `Translated Text` vs. `Preserved Number` badges |
| `components/HotelReviewsPanel.tsx` | `HotelReviewsPanel` (`handleTranslateAll`, `handleAppendCustomReviews`, `handleResetSamples`) | **Workspace 3:** Bulk hotel review translator with same-language skip badges, confidence scores, custom multi-line review input, and language breakdown KPI bar |
| `components/InquiryDeskPanel.tsx` | `InquiryDeskPanel` (`processOneInquiry`, `processAllInquiries`, `handleAddAndProcessCustomInquiry`, `handleTranslateReply`, `handleCopyReply`) | **Workspace 4:** Traveler inquiry intake with `needs_translation` detection, custom inquiry submission, and two-way concierge reply reverse translation |
| `components/StatusBanner.tsx` & `Footer.tsx` | `StatusBanner` & `Footer` | Accessible `role="alert"` error notification banner and attribution footer |
| `App.tsx` | `App` (`refreshHealth`, `handleClearCache`) | Root coordinator loading `/api/health`, `/api/languages`, and `/api/travel/samples` on startup with `AbortController` cleanup |

### 6.3 PowerShell Launcher (`W7/WanderLingo/start.ps1`)
- Automated environment bootstrap (creates `backend/.venv` and installs `requirements.txt` if missing), builds `frontend/dist` (when missing or `-Rebuild` is passed), launches a background `/api/health` readiness poller that opens `http://127.0.0.1:8000` in the default web browser (`Start-Process`), and runs `uvicorn app.main:app`.

---

## 7. Verification & Automated Test Results

- **Phase 0 Live Smoke Verification (`backend/scripts/smoke_googletrans.py`):** Verified live against Google Translate endpoints across `default`, `direct`, and `redundant` `service_urls` presets for single translation (`EN -> VI`), non-Latin pronunciation (`EN -> JA`, `EN -> ZH-CN`, `EN -> ZH-TW`), language detection (`ES`), and bulk translation.
- **Backend Automated Test Suite (`pytest -v`):** **18 / 18 passed** (`tests/test_translator_service.py`, `tests/test_rate_limiter.py`, `tests/test_api_routes.py`), covering language alias normalization, polymorphic `detection.lang` and confidence normalization, single and multi-sentence pronunciation extraction, `did_you_mean` spelling/grammar correction, alternative phrasings and dictionary extraction, multi-target broadcast translation, TTL LRU caching, retry/failover on transient errors, skip-if-same-language in hotel reviews, `needs_translation` in travel inquiries, non-string preservation in destination guides, HTTP `422` validation, and HTTP `429` rate limiting with `Retry-After`.
- **Live Chaos & Fuzz Testing:** Verified against unpredictable inputs including emoji-only strings, numeric/punctuation strings, 4-language mixed sentences, multi-line Japanese/Vietnamese paragraphs with `\n`, HTML/script tags, and `0`/`false`/`null`/array JSON fields.
- **Frontend Verification (`tsc --noEmit`, `vitest run`, `vite build`):** **3 / 3 passed** (`src/__tests__/i18nParity.test.ts` verifying 100% key parity between `en.ts` and `vi.ts`, and `src/__tests__/apiClient.test.ts`), zero TypeScript errors, and clean production bundle generation in `frontend/dist/`.
