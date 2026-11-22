# CS252 Lab 07 — Git Commit History (`W7/WanderLingo`)

- **Course:** CS252 — Programming Systems (Week 7)
- **Student:** Nguyễn Quang Hiếu (`25125043` / `nqhieu-gd` / `nqh517@gmail.com`)
- **Project:** WanderLingo — Multilingual Travel Companion Website (`py-googletrans` Integration)

---

## 1. Atomic Commit Summary Table

| Phase | Commit Hash | Date (UTC+7) | Commit Message | Files Changed |
| :--- | :--- | :--- | :--- | :--- |
| **Pre-Lab** | `15acf74` | 2026-11-21 21:36:54 | `Updated Assigment Week 6 and 7` | Added `W7/Lab07-Google Translate API-Firebase API.pdf` and `W7/2025 CT - API Translate.docx.pdf` |
| **Phase 0** | `ae9117f` | 2026-11-22 00:15:00 | `chore(w7): setup WanderLingo workspace, gitignore, and verify googletrans 4.0.2` | `4 files (+524)`: `W7/Development_Plan.md`, `W7/WanderLingo/.gitignore`, `backend/requirements.txt`, `backend/scripts/smoke_googletrans.py` |
| **Phase 1** | `17855c0` | 2026-11-22 09:43:59 | `feat(w7): implement FastAPI backend wrapping py-googletrans with cache, retry, and rate limiting` | `14 files (+2,033)`: `app/config.py`, `app/schemas.py`, `app/data/travel_samples.py`, `app/services/{adapter,cache,rate_limiter,translator_service}.py`, `app/routers/{system,translate,travel}.py`, `app/main.py` |
| **Phase 2** | `9d9bb3c` | 2026-11-22 09:45:16 | `test(w7): add backend unit and FastAPI contract test suite` | `4 files (+431)`: `tests/{conftest,test_translator_service,test_rate_limiter,test_api_routes}.py` (`15 passed`) |
| **Phase 3** | `9c43cf4` | 2026-11-22 09:58:13 | `feat(w7): scaffold React TypeScript frontend with Light/Dark theme, EN/VI i18n, and language combobox` | `21 files (+4,485)`: Vite + React 19 + TS + Tailwind v4 setup, `en.ts`/`vi.ts`, `I18nContext`, `ThemeContext`, `apiClient.ts`, `TopBar`, `LanguageCombobox`, `vitest` tests (`3 passed`) |
| **Phase 4** | `71804ca` | 2026-11-22 09:58:13 | `feat(w7): build 4 interactive travel translation workspaces and single-command launcher` | `7 files (+1,690)`: `LiveTranslatorPanel.tsx`, `DestinationGuidePanel.tsx`, `HotelReviewsPanel.tsx`, `InquiryDeskPanel.tsx`, `App.tsx`, `main.tsx`, `start.ps1` |
| **Phase 5** | `docs(w7)` | 2026-11-23 | `docs(w7): add Lab07 report.md, AI declaration in README.md, SetupGuide.md, and Git_Commit_History.md` | `4 files`: `W7/report.md`, `W7/README.md`, `W7/SetupGuide.md`, `W7/Git_Commit_History.md` |

---

## 2. Detailed `git log --stat` Output

```text
commit 71804cadeaeb13255c630c2be2fa689c704fc342
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Sun Nov 22 09:58:13 2026 +0700

    feat(w7): build 4 interactive travel translation workspaces and single-command launcher

 W7/WanderLingo/frontend/src/App.tsx                | 156 +++++++
 .../src/components/DestinationGuidePanel.tsx       | 291 +++++++++++++
 .../frontend/src/components/HotelReviewsPanel.tsx  | 310 ++++++++++++++
 .../frontend/src/components/InquiryDeskPanel.tsx   | 404 ++++++++++++++++++
 .../src/components/LiveTranslatorPanel.tsx         | 470 +++++++++++++++++++++
 W7/WanderLingo/frontend/src/main.tsx               |  16 +
 W7/WanderLingo/start.ps1                           |  43 ++
 7 files changed, 1690 insertions(+)

commit 9c43cf49016f9ffd724694c6aae223b9e515adbe
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Sun Nov 22 09:58:13 2026 +0700

    feat(w7): scaffold React TypeScript frontend with Light/Dark theme, EN/VI i18n, and language combobox

 W7/WanderLingo/frontend/index.html                 |   27 +
 W7/WanderLingo/frontend/package-lock.json          | 3054 ++++++++++++++++++++
 W7/WanderLingo/frontend/package.json               |   27 +
 .../frontend/src/__tests__/apiClient.test.ts       |   22 +
 .../frontend/src/__tests__/i18nParity.test.ts      |   17 +
 W7/WanderLingo/frontend/src/components/Footer.tsx  |   11 +
 .../frontend/src/components/LanguageCombobox.tsx   |  168 ++
 .../frontend/src/components/StatusBanner.tsx       |   32 +
 W7/WanderLingo/frontend/src/components/TopBar.tsx  |  214 ++
 W7/WanderLingo/frontend/src/config/apiConfig.ts    |   23 +
 .../frontend/src/context/ThemeContext.tsx          |   48 +
 .../frontend/src/hooks/useTranslationHistory.ts    |   52 +
 W7/WanderLingo/frontend/src/i18n/I18nContext.tsx   |   53 +
 W7/WanderLingo/frontend/src/i18n/en.ts             |   98 +
 W7/WanderLingo/frontend/src/i18n/vi.ts             |   97 +
 W7/WanderLingo/frontend/src/index.css              |   54 +
 W7/WanderLingo/frontend/src/services/apiClient.ts  |  241 ++
 W7/WanderLingo/frontend/src/types/translate.ts     |  210 ++
 W7/WanderLingo/frontend/src/vite-env.d.ts          |    1 +
 W7/WanderLingo/frontend/tsconfig.json              |   20 +
 W7/WanderLingo/frontend/vite.config.ts             |   16 +
 21 files changed, 4485 insertions(+)

commit 9d9bb3c2c3726f19f1d6be373bd53cc220941a39
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Sun Nov 22 09:45:16 2026 +0700

    test(w7): add backend unit and FastAPI contract test suite

 W7/WanderLingo/backend/tests/conftest.py           | 132 +++++++++++++++++
 W7/WanderLingo/backend/tests/test_api_routes.py    | 111 ++++++++++++++
 W7/WanderLingo/backend/tests/test_rate_limiter.py  |  25 ++++
 .../backend/tests/test_translator_service.py       | 163 +++++++++++++++++++++
 4 files changed, 431 insertions(+)

commit 17855c0623cb0846f759f528f2a56bf370014325
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Sun Nov 22 09:43:59 2026 +0700

    feat(w7): implement FastAPI backend wrapping py-googletrans with cache, retry, and rate limiting

 W7/WanderLingo/backend/app/__init__.py             |   1 +
 W7/WanderLingo/backend/app/config.py               |  79 +++
 W7/WanderLingo/backend/app/data/travel_samples.py  | 263 ++++++++
 W7/WanderLingo/backend/app/dependencies.py         |  46 ++
 W7/WanderLingo/backend/app/main.py                 |  88 +++
 W7/WanderLingo/backend/app/routers/__init__.py     |   1 +
 W7/WanderLingo/backend/app/routers/system.py       |  47 ++
 W7/WanderLingo/backend/app/routers/translate.py    |  59 ++
 W7/WanderLingo/backend/app/routers/travel.py       | 101 +++
 W7/WanderLingo/backend/app/schemas.py              | 332 ++++++++++
 W7/WanderLingo/backend/app/services/adapter.py     | 163 +++++
 W7/WanderLingo/backend/app/services/cache.py       |  81 +++
 .../backend/app/services/rate_limiter.py           |  61 ++
 .../backend/app/services/translator_service.py     | 711 +++++++++++++++++++++
 14 files changed, 2033 insertions(+)

commit ae9117f00b4bddfc10ede6b895f8e75b63dbedbd
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Sun Nov 22 00:15:00 2026 +0700

    chore(w7): setup WanderLingo workspace, gitignore, and verify googletrans 4.0.2

 W7/Development_Plan.md                             | 414 +++++++++++++++++++++
 W7/WanderLingo/.gitignore                          |  24 ++
 W7/WanderLingo/backend/requirements.txt            |   6 +
 .../backend/scripts/smoke_googletrans.py           |  80 ++++
 4 files changed, 524 insertions(+)
```
