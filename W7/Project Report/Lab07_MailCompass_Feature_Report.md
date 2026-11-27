# CS252 Lab 07 — Individual Group Project Feature Contribution Report

- **Project Name:** MailCompass V2 (Local-First Desktop Email Triage & Actionable Task Assistant)
- **Student / Contributor:** Nguyễn Quang Hiếu (`nqhieu-gd` / `25125043` / `nqh517@gmail.com`)
- **Course:** CS252 - Programming Systems (Week 7 / Lab 07)
- **Repository:** `https://github.com/kietanhnguyen2007/CS252`
- **Submission Track:** Lab 07 Alternative Option (Page 2) — Individual Product Feature Contributions to the Group Project
- **Pull Requests Covering These Features:** **PR `#68`** & **PR `#71`** (`feat/w4-07-qhieu` → `dev`, Issue `#64`) — see [Git Commit Log.md](./Git%20Commit%20Log.md)
- **Accompanying Deliverables:** [README.md](./README.md) (AI Usage Declaration), [Git Commit Log.md](./Git%20Commit%20Log.md), [Script.md](./Script.md) (Video Demo Script), and [Source_Code/](./Source_Code) (23 source, stylesheet, and test files for the 5 demonstrated features)

---

## 1. Executive Summary & Ownership Overview

Building upon my Lab 06 contributions (Batch `.eml` Import Queue, Task Deadline Confirmation/Audit History/Email Linking, and Multi-Account Decision Preview), this report documents the **five MailCompass V2 product features** that I implemented and demonstrated for **Lab 07**:

1. **Binary Attachment Blocker Policy Card (`FD-01`)**
2. **Clean Email Print Stylesheet (`GM-07`)**
3. **IME-Safe Gmail Keyboard Shortcuts, Lazy `?` Help Dialog & Settings Switch (`GM-05`)**
4. **AI Task Title Clarity Review Badge & Auto-Focus Confirmation (`FD-05`)**
5. **Multi-Horizon Reminder Presets & Per-Stage Notifications (`FD-09`)**

Because MailCompass V2 is developed collaboratively by a 6-member team under strict **Write-Owner Boundaries** (`Frozen Contract v22.0`), each of these five product features spans both frontend and backend/adjacent modules. All five are **partial** contributions where I own the frontend components, UX/accessibility logic, central workspace wiring, stylesheets, and automated frontend tests, while teammates own the corresponding Rust/SQLite backend logic or Inbox triggers.

### Summary Ownership Matrix

| # | Feature (Spec ID) | Ownership Type | My Specific Responsibility (`nqhieu-gd` / `#64`) | Related Teammate Scope |
| :-: | :--- | :-: | :--- | :--- |
| **1** | **Binary Attachment Blocker Policy Card (`FD-01`)** | **Partial** | Read-only policy status card, skipped-binary counter, accessible `?` help popover, zero-download UI enforcement & tests (`SettingsView.tsx`, `settings.css`) | `#62` Trân (Gmail sync binary blocking); `#59` Thảo Anh (IPC/DTOs); `#63` Khoa (Inbox reader chips) |
| **2** | **Clean Email Print Stylesheet (`GM-07`)** | **Partial (Primary Layout Owner)** | Complete `@page` & `@media print` stylesheet, cascade-safe `[hidden]`/`[data-no-print]` hiding, multi-page thread/scroll unlocking & W4-06 chrome hiding (`desktop.css`) | `#63` Khoa (`window.print()` trigger button in Inbox reader) |
| **3** | **IME-Safe Gmail Keyboard Shortcuts & Lazy `?` Help Dialog (`GM-05`)** | **Partial (~85–90% Owner)** | Complete shortcut hook with Vietnamese IME/editable/modal guards (`useGmailShortcuts.ts`), lazy `?` dialog (`KeyboardShortcutsDialog.tsx`), persisted Settings toggle (`SettingsView.tsx`), central workspace wiring & overlay guard (`MailCompass.tsx`), and full test suite | `#63` Khoa (`InboxKeyboardHandlers` imperative callbacks inside `Inbox.tsx`) |
| **4** | **AI Task Title Clarity Review Badge & Auto-Focus Confirm (`FD-05`)** | **Partial** | High-contrast (`7.55:1`) `"Cần đặt lại tên rõ hơn"` badge, `aria-describedby` alert, auto-focus + text pre-selection in `CandidateConfirmDialog`, post-edit badge clearing & tests (`MailAnalysisPanel.tsx`, `mail-analysis.css`) | `#61` Khải (backend clarity classifier); `#59` Thảo Anh (`TitleClarityState` DTO) |
| **5** | **Multi-Horizon Reminder Presets & Per-Stage Notifications (`FD-09`)** | **Partial (Complete Frontend Owner)** | Pure `ReminderLeadPresetChips` component, pure preset normalizer/stage badge/§6 error helpers (`presentation.ts`), account defaults (`SettingsView.tsx`), per-task Branch A/B & account-default restore (`DeadlineDialog.tsx`), central preset wiring (`MailCompass.tsx`), and 3-tone WCAG stage badges + per-`event_key` UI (`NotificationBell.tsx`, `NotificationsView.tsx`) | `#59` Thảo Anh (Rust `FD-09` backend & `v2_task_set_reminder_presets` IPC); `#60` Ánh (Schema v22 SQLite persistence) |

---

## 2. Feature 1: Binary Attachment Blocker Policy Card (`FD-01`)

### 2.1. What It Does
Inside **Cài đặt (`SettingsView.tsx`)**, the `FD-01` Attachment Policy card surfaces MailCompass's binary attachment protection clearly for the active account:
- Displays the active policy state (**`Chặn đồng bộ tệp đính kèm: Đang bật`** or **`Chỉ lưu siêu dữ liệu`**) alongside a status badge (`Đang bật` / `Chỉ siêu dữ liệu`).
- Reports the exact count of binary attachments skipped during synchronization (**`"Đã bỏ qua N tệp đính kèm nhị phân khi đồng bộ."`**).
- Provides a compact `?` help trigger (`@base-ui/react/popover`, `aria-label="Giải thích chặn đồng bộ tệp đính kèm"`) that opens **`Vì sao chặn tệp đính kèm nhị phân?`**, explaining that binary files are never auto-downloaded while metadata filters (`has:attachment` and `filename:`) continue working normally.
- Strictly exposes **zero** binary download or file-execution buttons.

### 2.2. Why It Is Needed in MailCompass
University students receive large slide decks, PDFs, ZIP bundles, and occasional untrusted attachments across multiple courses. Automatically downloading every binary during email sync wastes disk space and bandwidth and increases malware risk. However, silently blocking downloads without explanation confuses users into thinking sync is broken. Surfacing the active protection state, blocked count, and searchable metadata guidance builds trust while keeping the desktop client safe by default.

### 2.3. My Part in Implementing This Feature (**Partial**)
- **What I took responsibility for (`apps/desktop/src/v2/SettingsView.tsx`, `settings.css`, `SettingsView.test.tsx`):**
  - Designed and implemented the `attachmentPolicyPresentation()` mapper and the read-only `FD-01` Settings card (`data-testid="mc-settings-attachment-policy-card"`), including the `?` `@base-ui/react/popover` disclosure and WCAG 2.2 AA / Windows `forced-colors` styling.
  - Normalized component props to consume official `Frozen Contract v22.0` (`api.ts`) fields (`ProfileAccount.attachment_sync_policy`, `ProfileAccount.blocked_attachment_count`).
  - Added automated component tests in `SettingsView.test.tsx` asserting both policy modes, skipped counts, popover content, and the absence of any binary download actions.
- **What teammates handled:**
  - **Nguyễn Lê Trân (`#62`, PR `#70`):** Backend Gmail `format=full` sync blocking binary downloads, persisting metadata-only attachment snapshots, and tracking `blocked_attachment_count`.
  - **Ngô Thảo Anh (`#59`, PR `#65`):** `AttachmentSyncPolicy` DTOs and `v2_account_set_attachment_policy` IPC command contract.
  - **Trần Minh Khoa (`#63`, PR `#69`):** Inert attachment metadata chips (`AttachmentMetaChips.tsx`) inside the Inbox mail reader.

---

## 3. Feature 2: Clean Email Print Stylesheet (`GM-07`)

### 3.1. What It Does
When a user prints an email or exports it to PDF (`Ctrl+P` or the mail reader Print button), the `@page` and `@media print` stylesheet in `apps/desktop/src/v2/desktop.css`:
- Sets standard A4/Letter page margins (`@page { margin: 14mm; }`) with pure black-on-white paper contrast (`background: #fff !important; color: #000 !important`).
- Unlocks nested flex and `react-resizable-panels` scroll containers (`display: block !important; height: auto !important; max-height: none !important; overflow: visible !important; width: 100% !important`) so multi-page single emails and multi-message threads (`.mc-mail-document`, `.mc-thread-reader`) flow across pages without viewport cutoff.
- Prevents awkward page breaks inside email subjects and `From/To/Cc/Date` metadata blocks (`break-inside: avoid`, `break-after: avoid`, `orphans: 3`, `widows: 3`).
- Places all hide rules (`[hidden]`, `[data-no-print]`, sidebar, folder rail, category tabs, search/batch toolbars, resize handles, analysis panels, dialogs, popovers, and toasts) **last in CSS cascade order** so hidden elements can never leak into printed output.

### 3.2. Why It Is Needed in MailCompass
Students and knowledge workers regularly print or save official course syllabi, exam announcements, or administrative instructions as PDFs for offline submission or archiving. Without a dedicated `@media print` stylesheet, printing a split-pane desktop webview clips long emails at a single screen height and wastes paper on navigation sidebars, search boxes, and toast notifications.

### 3.3. My Part in Implementing This Feature (**Partial — Primary Layout Owner**)
- **What I took responsibility for (`apps/desktop/src/v2/desktop.css`):**
  - Authored 100% of the `@page` and `@media print` CSS architecture in `desktop.css` while preserving 100% of screen styles byte-for-byte.
  - Caught and fixed a CSS cascade specificity ordering bug during randomized DOM cascade fuzzing (`245c532`, 200/200 randomized trees passing), ensuring `[hidden]` and `[data-no-print]` always override content `display: block !important` rules.
  - Extended `@media print` after Wave 2 integration (`9707e33`) to cleanly hide all newly added W4-06 Inbox chrome (`[data-panel-id="mail-folders"]`, `.mc-category-tabs`, `.mc-inbox-view-bar`, `.mc-quote-toggle`, `.mc-popover-positioner`, `.mc-toast-viewport`).
- **What teammates handled:**
  - **Trần Minh Khoa (`#63`, PR `#69`):** Added the Print trigger button (`window.print()`) in the mail reader toolbar (`Inbox.tsx`).

---

## 4. Feature 3: IME-Safe Gmail Keyboard Shortcuts, Lazy `?` Help Dialog & Settings Switch (`GM-05`)

### 4.1. What It Does
Implements familiar Gmail-style keyboard navigation and local triage in MailCompass V2:
- **13 Supported Shortcuts:** `j` / `k` (next/previous email, allowing key repeat), `Enter` / `o` (open email), `u` (back to list), `/` (focus search), `x` (toggle selection), `s` (star/unstar), `e` (local archive), `#` (trash), `Shift+I` / `Shift+U` (mark read/unread), `Esc` (clear/dismiss), and `?` (open help dialog).
- **Vietnamese IME & Context Safety (`O(1)` Guard Chain):** Automatically suppresses all shortcuts during Vietnamese Telex/VNI IME composition (`event.isComposing`, `event.key === "Process"`, `event.keyCode === 229`), when OS/browser modifiers (`Ctrl`/`Meta`/`Alt`) are held, when focus is inside `<input>`, `<textarea>`, `<select>`, `[contenteditable]`, or ARIA `textbox`/`searchbox`/`combobox`, when pressing `Enter` on interactive buttons/links (WCAG compliance), or whenever any dialog/alertdialog/menu/popover overlay is open (`hasVisibleOpenModal()`).
- **Lazy-Loaded Help Modal:** Pressing `?` dynamically loads `KeyboardShortcutsDialog.tsx` (`React.lazy` chunk: `1.27 kB` gzip JS + `0.59 kB` gzip CSS, adding zero startup cost), grouping shortcuts under **`Điều hướng & Tìm kiếm`** and **`Thao tác cục bộ`** with a clear IME safety note.
- **User Preference Switch:** A `@base-ui/react/switch` card (**`Phím tắt kiểu Gmail`**) in `SettingsView.tsx` persists enable/disable state to `localStorage` (`mc.v2.gmail_shortcuts_enabled`).

### 4.2. Why It Is Needed in MailCompass
High-volume email triage is dramatically faster with single-key shortcuts (`j`/`k`/`e`/`s`/`/`). However, in a Vietnamese desktop application, naive global `keydown` handlers conflict catastrophically with Vietnamese Telex typing (where `s`, `f`, `r`, `x`, `j` are tone keys) and can trigger accidental archiving/deletion when typing inside search boxes or popovers. Guarding IME composition and open overlays makes power-user speed safe for Vietnamese users.

### 4.3. My Part in Implementing This Feature (**Partial — ~85–90% Owner**)
- **What I took responsibility for (`useGmailShortcuts.ts`, `KeyboardShortcutsDialog.tsx`, `keyboard-shortcuts.css`, `SettingsView.tsx`, `MailCompass.tsx`, `useGmailShortcuts.test.tsx`, `MailCompass.test.tsx`):**
  - Designed and implemented the entire shortcut resolver, IME/editable/dialog safety guards, Latest-Ref event listener hook, and safe `localStorage` helpers in `useGmailShortcuts.ts` (verified with 750 randomized fuzz trials across Vietnamese characters, `contenteditable` nesting, and modifier combinations).
  - Built the lazy-loadable `KeyboardShortcutsDialog.tsx` and `keyboard-shortcuts.css` (`@base-ui/react/dialog`, WCAG contrast, forced-colors, 200% zoom).
  - Implemented the persisted **`Phím tắt kiểu Gmail`** switch card in `SettingsView.tsx`.
  - Wired all 12 Inbox shortcut commands, lazy `?` modal mounting, `hasVisibleOpenModal()` child-overlay detection (`fcfcdfd` — protecting popovers like `MailSnoozePopover` and `NotificationBell`), and source-switch modal dismissal centrally in `MailCompass.tsx`.
  - Wrote unit, lazy-dialog, visible/hidden overlay guard, and full `<MailCompass />` integration tests (`useGmailShortcuts.test.tsx`, `SettingsView.test.tsx`, `MailCompass.test.tsx`).
- **What teammates handled:**
  - **Trần Minh Khoa (`#63`, PR `#69`):** Exposed the `InboxKeyboardHandlers` imperative callbacks inside `Inbox.tsx` (row focus movement, open, select, star, archive, trash, mark read/unread, focus search) invoked by my central `MailCompass.tsx` wiring.

---

## 5. Feature 4: AI Task Title Clarity Review Badge & Auto-Focus Confirmation (`FD-05`)

### 5.1. What It Does
Inside **`Đề xuất công việc từ thư`** (`MailAnalysisPanel.tsx`), whenever an AI-extracted task candidate carries `title_clarity_state === "needs_user_review"`:
- The candidate card displays an accessible amber warning badge (**`Cần đặt lại tên rõ hơn`**) with an `AlertTriangle` icon and **`7.55:1`** foreground/background contrast (`#75440f` on `#fdf6ec`, exceeding WCAG 2.2 AA and AAA), while clear `validated` candidates remain visually uncluttered.
- Clicking **`Xem & lưu công việc`** opens `CandidateConfirmDialog`, which:
  1. Displays a 1-line inline alert (`role="note"`, `id="mc-cand-title-clarity-hint"`): **`"Cần đặt lại tên rõ hơn · Hãy sửa tên công việc rõ hành động trước khi lưu."`**, linked programmatically to the title input via `aria-describedby`.
  2. Automatically focuses (`initialFocus={titleInput}`) and selects the existing vague title (`requestAnimationFrame` `.select()`, guarded so it never steals focus) so the user can immediately type an actionable title in one step.
- Upon clicking **`Lưu công việc`**, if the title was revised, local state updates to `title_clarity_state: "user_edited"`, removes the warning badge, and marks the candidate **`Đã lưu thành công việc`**.

### 5.2. Why It Is Needed in MailCompass
Real emails often contain pronoun-heavy or vague instructions (*"Xử lý việc này trước tối mai"* or *"Gửi lại giúp thầy"*). If an AI extractor turns those phrases into tasks verbatim, the user's task dashboard quickly fills with meaningless entries; if the system silently discards them, critical deadlines are missed. `FD-05` preserves human-in-the-loop accountability by visually flagging unclear titles and streamlining instant renaming before persistence.

### 5.3. My Part in Implementing This Feature (**Partial**)
- **What I took responsibility for (`MailAnalysisPanel.tsx`, `mail-analysis.css`, `MailAnalysisPanel.test.tsx`):**
  - Implemented `candidateNeedsTitleReview()`, `CANDIDATE_NEEDS_REVIEW_LABEL`, badge rendering, `CandidateConfirmDialog` inline clarity alert, `aria-describedby` wiring, focus-safe auto-focus + `.select()`, and post-confirmation `"user_edited"` state transitions.
  - Styled `.mc-candidate-clarity-badge` and `.mc-candidate-clarity-alert` with `7.55:1` WCAG AAA contrast and `@media (forced-colors: active)` borders in `mail-analysis.css`.
  - Normalized `TitleClarityState` imports directly to official `api.ts` and wrote unit/component + race-condition tests in `MailAnalysisPanel.test.tsx`.
- **What teammates handled:**
  - **Trần Như Khải (`#61`, PR `#67`):** Backend AI extraction clarity validator producing `title_clarity_state` (`validated` vs `needs_user_review`).
  - **Ngô Thảo Anh (`#59`, PR `#65`):** Frozen `TitleClarityState` and `WorkCandidateView.title_clarity_state` DTOs in `api.ts` and `types.rs`.

---

## 6. Feature 5: Multi-Horizon Reminder Presets & Per-Stage Notifications (`FD-09`)

### 6.1. What It Does
Upgrades MailCompass from single-point deadline alerts to configurable **multi-horizon reminders** across four screens:
1. **Pure Controlled Preset Chips (`ReminderLeadPresetChips.tsx` + `presentation.ts`):**
   - Renders an accessible `role="group"` (`aria-label="Mốc nhắc trước hạn"`) with 3 standard toggle chips (**`1 tuần`** `168h`, **`2 ngày`** `48h`, **`1 ngày`** `24h`) plus Lucide `Check` icons (WCAG 1.4.1 non-color indicator).
   - `normalizeReminderPresets()` mirrors backend Rule 7: filters integer hours `1..=720`, deduplicates, sorts strictly descending, caps at `6` presets, and preserves any custom database presets (e.g., `72h` → `"3 ngày"`) as removable secondary chips without silently discarding them.
2. **Account Default Presets (`SettingsView.tsx`):**
   - Under **`Mốc nhắc hạn mặc định`**, users configure default horizons for new tasks on the active source (`task_id: null`) with synchronous derived state, optimistic UI (`pendingPresets`), single-flight protection, and automatic rollback/reload on `version_conflict`.
3. **Per-Task Preset Overrides & Branch B Save (`DeadlineDialog.tsx`):**
   - **Branch B (Preset-Only Save):** If a task already has a confirmed deadline and the user only toggles reminder presets (leaving date/time unchanged and **`Lý do` empty**), clicking **`Lưu hạn chót`** calls `api.setReminderPresets` directly (**`"Đã lưu mốc nhắc trước hạn."`**) without forcing a fake deadline-change audit reason.
   - **Branch A (Deadline + Preset Save):** When the deadline itself changes, attaches `reminder_lead_hours` to `setTaskDeadline` only if presets were modified.
   - Displays a one-click **`Dùng mặc định tài khoản`** button whenever task presets differ from the active account's defaults.
4. **Per-Stage Notification Previews & Center (`NotificationBell.tsx`, `NotificationsView.tsx`):**
   - Renders 3 WCAG-compliant stage badges via `reminderStageLabel()` + `NotificationStageBadge`:
     - **`Quá hạn`** (`overdue` tone, `6.64:1` contrast, `AlertCircle` icon)
     - **`Còn 1 ngày`** (`urgent` tone, `7.55:1` contrast, `AlertTriangle` icon)
     - **`Còn 2 ngày` / `Còn 1 tuần`** (`soon` tone, `9.03:1` contrast, `CalendarClock` icon)
   - Operates independently per `event_key` so marking or snoozing one reminder stage (e.g., `Còn 2 ngày`) never affects another stage (`Còn 1 ngày`) of the same task, with safe **`Hoàn tác`** undo and frozen §6 error handling (`invalid_reminder_presets`, `invalid_snooze_time`, `undo_expired`).

### 6.2. Why It Is Needed in MailCompass
Complex assignments and project milestones cannot be finished in a few hours; a single reminder on the due date is often too late. Multi-horizon reminders give students graduated runway (`1 week` → `2 days` → `1 day` → `Overdue`), allow task-specific tuning without corrupting deadline audit trails, and isolate each notification stage so acknowledging an early reminder never silences the final urgent alert.

### 6.3. My Part in Implementing This Feature (**Partial — Complete Frontend Owner**)
- **What I took responsibility for (`ReminderLeadPresetChips.tsx`, `presentation.ts`, `SettingsView.tsx`, `DeadlineDialog.tsx`, `MailCompass.tsx`, `NotificationBell.tsx`, `NotificationsView.tsx`, `notifications.css`, `desktop.css`, + 6 test files):**
  - Built `ReminderLeadPresetChips.tsx`, `toggleReminderPreset()`, and WCAG `.mc-reminder-presets` styles (`desktop.css`).
  - Built `normalizeReminderPresets()`, `reminderStageLabel()`, `DEFAULT_REMINDER_PRESETS`, and `WEEK4_ERROR_MESSAGES` / `week4ErrorText()` in `presentation.ts`.
  - Implemented account-level preset configuration with optimistic overlay & conflict rollback in `SettingsView.tsx`.
  - Implemented Branch A/B save branching and **`Dùng mặc định tài khoản`** restore in `DeadlineDialog.tsx`, and wired live `accountReminderPresets` from `sources` in `MailCompass.tsx`.
  - Implemented `NotificationStageBadge`, compact bell popover badges (`NotificationBell.tsx`), full-list stage badges & §6 error handling (`NotificationsView.tsx`, `notifications.css`) while preserving `NotificationsView` lazy code-splitting.
  - Wrote unit and integration tests across `presentation.test.ts`, `ReminderLeadPresetChips.test.tsx`, `DeadlineProposal.test.tsx`, `NotificationsView.test.tsx`, `SettingsView.test.tsx`, and `MailCompass.test.tsx`.
- **What teammates handled:**
  - **Ngô Thảo Anh (`#59`, PRs `#65`, `#66`):** Rust backend multi-horizon reminder derivation (`DerivedReminderStage`), per-`event_key` notification state/undo, Rule 7 validation, and `v2_task_set_reminder_presets` IPC command.
  - **Đinh Nguyễn Hồng Ánh (`#60`, PR `#72`):** Schema v22 SQLite persistence and migration for `reminder_lead_hours` on accounts and tasks.

---

## 7. Automated Verification Evidence

All five demonstrated features are verified by strict TypeScript compilation and automated Vitest unit/component test suites:

| Verification Check | Command | Verified Result |
| :--- | :--- | :--- |
| TypeScript Strict Typecheck & V2 Production Build | `npm.cmd --prefix apps/desktop run build:v2` | **PASS** (`0` TS errors; `2,068` modules transformed; `KeyboardShortcutsDialog` lazy-split at `1.27 kB` gzip) |
| Feature Vitest Test Suites (`7` files covering `FD-01`, `GM-05`, `FD-05`, `FD-09`) | `npm.cmd --prefix apps/desktop run test -- src/v2/useGmailShortcuts.test.tsx src/v2/MailAnalysisPanel.test.tsx src/v2/ReminderLeadPresetChips.test.tsx src/v2/DeadlineProposal.test.tsx src/v2/NotificationsView.test.tsx src/v2/SettingsView.test.tsx src/v2/presentation.test.ts` | **PASS** — **`7/7` test files (`60/60` tests passed)** |
| Central Workspace Integration Suite (`MailCompass.test.tsx`) | `npm.cmd --prefix apps/desktop run test -- src/v2/MailCompass.test.tsx` | **PASS** — **`31/31` tests passed** (verifying `GM-05` shortcuts/overlay guards, `FD-09` account preset wiring, and zero regressions) |
