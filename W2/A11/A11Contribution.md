# Assignment 11: Git - Group Contribution for this week

**Student**: Nguyen Quang Hieu - 25125043

---

## Changes made
Week-1 desktop UI built against a mock API contract. One typed `ApiClient`, with HTTP and mock adapters sharing the same DTOs, so the real backend can replace the mock without changing components.

- **App/navigation + client:** account picker and Inbox/Dashboard/Settings. Request and cache keys carry the account scope, and switching accounts cancels in-flight requests. Token goes in a header only; base URL comes from runtime config. (`App.tsx`, `api/client.ts`, `api/mock.ts`, `styles.css`)
- **Inbox:** `.eml` import with progress and polling (stops at a terminal status, on unmount and on account switch), list/detail, loading/empty/error/retry, bodies shown as inert text. (`InboxPage.tsx`)
- **Dashboard + editor:** server-side filter/sort/search/paging; edit state, owner, estimate and importance with `expected_version`; 409 keeps the draft and never auto-resends; unknown values shown as "chưa xác định". (`TaskDashboard.tsx`, `TaskEditor.tsx`)
- **Review + evidence:** candidates are proposals, and a task is created only after an explicit confirm of the selected candidates; Unicode-correct quote highlighting; "source unavailable" handling; email <-> task navigation. (`ReviewCandidates.tsx`, `EvidencePanel.tsx`)
- **Accounts:** create (EML / labelled fake Gmail), sync with polling, disconnect; real Gmail shown but disabled. (`AccountsPage.tsx`)
- **Supporting files:** `StatusViews.tsx`, `useScopedResource.ts`, `poll.ts`, `codepoints.ts`, `strings.ts`, `playwright.config.ts`.
- **E2E:** `tests/offline-smoke.spec.ts`.