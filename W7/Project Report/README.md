# Lab CS252 - AI Usage Report

**Course**: CS252 - Programming Systems  
**Student**: Nguyen Quang Hieu - 25125043  
**Week**: Week 7  
**Topic**: Google Translate API-Firebase API *(Alternative Track: Group Project Individual Contributions — MailCompass Week 4 / V2)*

---

## AI Usage Declaration

**Declaration B: I did use AI for this homework.**

### Division of Work & Collaboration
In accordance with the CS252 Lab 07 submission guidelines, I declare the following use of AI tools during the development, testing, verification, and documentation of my Week 4 (MailCompass V2) contributions to **MailCompass** (110 non-merge commits across PRs `#68`, `#71`, `#72`, and `#73`):

1. **Tools Used:** AI coding assistants (LLM coding assistants integrated in IDE / CLI) were used as productivity, verification, and documentation aids during Project Week 4 and Lab 07 preparation.
2. **How AI Was Used:**
   - **Frontend UI, Accessibility & Wiring Assistance:** Assisted in implementing and refactoring V2 React/TypeScript components and CSS stylesheets within my write-owner scope (`useGmailShortcuts.ts`, `KeyboardShortcutsDialog.tsx`, `ReminderLeadPresetChips.tsx`, `AiProviderSelectorBar.tsx`, `AssistantView.tsx`, `MailAnalysisPanel.tsx`, `MailRuleManager.tsx`, `DeadlineDialog.tsx`, `NotificationBell.tsx`, `NotificationsView.tsx`, `SettingsView.tsx`, `MailCompass.tsx`, `presentation.ts`, `@media print` rules, and WCAG 2.2 AA / `forced-colors` hardening), normalizing DTO imports to `Frozen Contract v22.0` (`api.ts`), and resolving cross-file CSS selector collisions.
   - **Automated Testing, Auditing & CI Tooling:** Assisted in scaffolding Vitest unit/integration suites (`fd03CopyAudit.test.tsx`, `useGmailShortcuts.test.tsx`, `presentation.test.ts`, `ReminderLeadPresetChips.test.tsx`, `MailAnalysisPanel.test.tsx`, `MailRuleManager.test.tsx`, `AssistantView.test.tsx`, `DeadlineProposal.test.tsx`, `NotificationsView.test.tsx`, `SettingsView.test.tsx`, `MailCompass.test.tsx`), automated `FD-03` copy-reduction / WCAG contrast / CSS-collision guards, randomized fuzz checks, the zero-dependency `PKG-02` bundle budget script (`scripts/check-v2-bundle-budget.mjs`), and `.github/workflows/v2-ci.yml`.
   - **Rust `v2-core` Stabilization & Property Testing (PR `#72`):** Assisted in diagnosing and drafting targeted Rust fixes and `FD-08`/`FD-10` integration and `proptest` coverage on `feat/w4-03` (Gmail search operator parsing, reference-code extraction order & hex-color exclusion, RFC-5322 To/Cc participant parsing, Unicode folding in mail rules, mailbox actions/undo, and paging SQL).
   - **Release Documentation, Attribution & Report Formatting:** Assisted in verifying upstream 40-char commit pins and bundled Apache-2.0/MIT notices (`THIRD_PARTY_NOTICES.md`, `vite.v2.config.ts`), drafting the Week 10 `J1`–`J5` demo script and `Gate A`–`Gate E` release sign-off report (`docs/week4/`), exporting `Git Commit Log.md`, and formatting this Lab 07 AI usage report.
3. **Human Verification & Ownership:** All architectural decisions, write-owner boundary discipline, contract compliance (`Frozen Contract v22.0`), security/privacy invariants (IME-safe shortcuts, binary attachment blocking `FD-01`, mandatory SHA-256 cloud AI preview `FD-06`, honest gating of the 9 remaining `v2.rs` IPC stubs), code reviews, and automated verification runs (`tsc --noEmit`, Vitest `338/338`, `build:v2`, `PKG-02` bundle gate, and `v2-ci.yml` Rust `148/148` + `48/48` tests) were personally directed, reviewed, debugged, and verified by **Nguyễn Quang Hiếu (`nqhieu-gd`)**.
