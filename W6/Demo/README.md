# Lab CS252 - AI Usage Report

**Course**: CS252 - Programming Systems  
**Student**: Nguyen Quang Hieu - 25125043  
**Week**: Week 6
**Topic**: OpenStreetMap API-OpenWeather API

---

## AI Usage Declaration

**Declaration B: I did use AI for this homework.**

### Division of Work & Collaboration
In accordance with the CS252 Lab 06 submission guidelines, I declare the following use of AI tools during the development and documentation of my contributions to **MailCompass**:

1. **Tools Used:** AI coding assistants (GitHub Copilot / LLM assistant in IDE) were used as productivity aids during Weeks 1–3 and for structuring documentation.
2. **How AI Was Used:**
   - **Boilerplate & Test Scaffolding:** Assisted in scaffolding repetitive TypeScript DTO interfaces (`types.ts`), unit test cases in Vitest (`DecisionPreviewPage.test.tsx`, `TaskDeadlineAndLink.test.tsx`, `InboxBatchImport.test.tsx`), and Playwright E2E test assertions (`w3-api.spec.ts`).
   - **Algorithm Verification:** Cross-checked edge-case boundary conditions for RFC3339 UTC timezone offset conversion (`resolveDeadlineInput`) and Jaccard token similarity tokenization (`/[\p{L}\p{M}\p{N}_]+/gu`) against the team's interface specification (`w2-interfaces-v2`).
   - **Documentation & Report Formatting:** Assisted in organizing commit logs, summarizing architectural trade-offs, and formatting this Lab 06 report and demo script.
3. **Human Verification & Ownership:** All business logic, contract compliance, state management (`AbortController` lifecycles, optimistic concurrency version checks, non-destructive draft merging), UI integration, and automated test executions (`tsc --noEmit`, `vitest`, and `playwright test`) were personally reviewed, debugged, and verified by **Nguyễn Quang Hiếu (`nqhieu-gd`)**.