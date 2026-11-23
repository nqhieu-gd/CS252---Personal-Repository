# Lab CS252 - AI Usage Report

**Course**: CS252 - Programming Systems  
**Student**: Nguyen Quang Hieu - 25125043  
**Week**: Week 7  
**Topic**: Google Translate API-Firebase API

---

## AI Usage Declaration

**Declaration B: I did use AI for this homework.**

### Division of Work & Collaboration
In accordance with the CS252 Lab 07 submission guidelines, I declare the following use of AI tools during the development and documentation of **WanderLingo** (Multilingual Travel Companion integrating `py-googletrans`):

1. **Tools Used:** AI coding assistants in IDE were used as productivity aids for planning, scaffolding boilerplate, and formatting documentation.
2. **How AI Was Used:**
   - **Requirements Analysis & Planning:** Assisted in structuring [Development_Plan.md](./Development_Plan.md) to map every section and travel example of [2025 CT - API Translate.md](./2025%20CT%20-%20API%20Translate.md) into a 4-workspace FastAPI + React TypeScript web application focused on Vietnam travel destinations.
   - **Boilerplate & UI Scaffolding:** Assisted in scaffolding Pydantic v2 request/response DTOs (`schemas.py`), FastAPI routers (`system.py`, `translate.py`, `travel.py`), React TypeScript components (`LiveTranslatorPanel.tsx`, `DestinationGuidePanel.tsx`, `HotelReviewsPanel.tsx`, `InquiryDeskPanel.tsx`), and bilingual `EN`/`VI` dictionary files (`en.ts`, `vi.ts`).
   - **Test Suite & Documentation Formatting:** Assisted in drafting unit and API contract test cases for `pytest` (`test_translator_service.py`, `test_rate_limiter.py`, `test_api_routes.py`) and `vitest` (`i18nParity.test.ts`, `apiClient.test.ts`), as well as organizing [report.md](./report.md) and [SetupGuide.md](./SetupGuide.md).
3. **Human Verification & Ownership:** All architectural decisions (choosing the Google Translate track, curating the 8 Vietnam destination guides, FastAPI + React TypeScript stack, isolated `W7` virtual environment, and localhost-first execution), live Phase 0 and chaos-test debugging of `googletrans==4.0.2` (`raise_exception=True`, `dict-chrome-ex` client configuration, multi-sentence pronunciation extraction, pronunciation echo filtering, polymorphic detected-language normalization, and Chinese language code alias normalization), and execution of all automated test suites (`smoke_googletrans.py`, `pytest`, `tsc --noEmit`, `vitest`, and `vite build`) were personally reviewed, debugged, and verified by **Nguyễn Quang Hiếu (`nqhieu-gd`)**.
