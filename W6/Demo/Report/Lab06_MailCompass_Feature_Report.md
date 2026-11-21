# CS252 Lab 06 — Individual Group Project Feature Contribution Report

- **Project Name:** MailCompass (Local-First Desktop Email Triage & Actionable Task Assistant)
- **Contributor:** Nguyễn Quang Hiếu (`nqhieu-gd` / `nqh517@gmail.com`)
- **Repository:** `https://github.com/kietanhnguyen2007/CS252`
- **Submission Track:** Lab 06 Alternative Option (Page 2) — Individual Product Feature Contributions to the Group Project
- **Contributed Features Covered in This Report:**
  1. **Feature 1:** Multi-Account Decision Preview (*"Việc nên làm trước"*) — Priority Ranking, Attention Budget Queue & Cross-Source Duplicate Grouping (`PR #39`, `PR #50`)
  2. **Feature 2:** Task Deadline Confirmation, Live UTC Conversion, Audit History Dialog, `[from, to)` Date-Range Filtering & Conflict-Safe Source Email Linking — plus the companion **Batch `.eml` Drag-and-Drop Sequential Import Queue** (`PR #11`, `PR #39`, `PR #50`)

---

## 1. Executive Summary & Project Context

**MailCompass** is a local-first desktop productivity application designed for university students and knowledge workers who receive high volumes of academic, project, and administrative emails across multiple accounts (local `.eml` archives and connected Gmail accounts). Rather than automatically mutating a user's schedule from unverified LLM outputs, MailCompass enforces a **human-in-the-loop, evidence-backed workflow**:
1. Users import `.eml` files (individually or in batches via drag-and-drop) or synchronize Gmail accounts.
2. Users inspect AI-extracted task candidates alongside Unicode code-point–verified evidence quotes before confirming tasks.
3. Users explicitly confirm task deadlines with timezone awareness and audit reasons, link or unlink supporting emails under strict referential integrity, and simulate cross-account prioritization using a deterministic **Decision Preview** engine.

Across Weeks 1–3 (**99 total Git commits / 92 non-merge commits** merged via **PR #11**, **PR #39**, and **PR #50**), I designed and implemented the desktop frontend architecture, typed HTTP `ApiClient`, 1:1 offline mock adapter, and end-to-end Playwright acceptance suite. This report provides an in-depth technical analysis of my two primary product feature contributions.

---

## 2. Feature 1: Multi-Account Decision Preview (*"Việc nên làm trước"*)

### 2.1. Why This Feature Is Needed (Problem Statement)

University students routinely juggle multiple email sources simultaneously—for example, an official institutional account (`@apcs.fitus.edu.vn`), a personal Gmail account, and offline `.eml` course announcements. This creates three concrete problems:
1. **Priority Overload Across Siloed Accounts:** Viewing tasks inside one account at a time hides urgent deadlines in another account. Users need a unified way to rank active tasks across 1 to 8 accounts simultaneously.
2. **Cross-Source Duplicate Announcements:** The same assignment or meeting is often sent to both a student's university inbox and a personal/group mailing list. Without cross-source deduplication, the user gets alerted twice for the exact same deliverable.
3. **Notification Fatigue & Fear of Destructive Auto-Triage:** Users want to explore *"What should I focus on right now if I only have room for 3 tasks, or if I focus on keyword 'báo cáo'?"* without risking unintended edits to stored tasks, accidental merging of distinct tasks, or firing real OS notifications during experimentation.

**Multi-Account Decision Preview (*"Việc nên làm trước"*)** solves all three problems by providing an interactive, **strictly read-only simulation sandbox** powered by an explainable, rule-based mathematical engine.

---

### 2.2. How It Works (Architecture, Algorithms & UI Workflow)

The feature is implemented across:
- **UI Component:** `apps/desktop/src/features/decisions/DecisionPreviewPage.tsx` (355 lines)
- **Pure Decision Engine (Client/Mock Parity):** `apps/desktop/src/lib/decisionPreviewMock.ts` (461 lines)
- **HTTP API Client & Types:** `apps/desktop/src/api/client.ts` (`previewDecisions`), `apps/desktop/src/api/types.ts`
- **App Shell & Routing:** `apps/desktop/src/components/upstream/circle/AppSidebar.tsx`, `apps/desktop/src/App.tsx`
- **Test Suites:** `apps/desktop/tests/platform/DecisionPreviewPage.test.tsx`, `apps/desktop/src/lib/decisionPreviewMock.test.ts`, `apps/desktop/tests/w3-api.spec.ts`

```
+-----------------------------------------------------------------------------------+
|                   Multi-Account Decision Preview ("Việc nên làm trước")           |
+-----------------------------------------------------------------------------------+
|  1. User Inputs                                                                   |
|     - Selected Accounts (1..8 accounts within workspace)                          |
|     - Focus Terms (<= 20 terms, <= 50 chars/term, Unicode-tokenized)              |
|     - 9 Policy Parameters + 3 Source Trust Weights (eml, gmail_fake, gmail)       |
|     - Simulated Notification Receipts (last_notified timestamps)                  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  2. Validation & Request Fingerprinting                                           |
|     - validateDecisionPolicy(policy) & focusTermTokens(focusTerms)                |
|     - Computes JSON fingerprint; displays "Kết quả cũ" (Stale) badge on edit      |
|     - Cancels in-flight requests via AbortController + generationRef counter      |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  3. Three-Stage Deterministic Decision Pipeline (w2-decision-v1)                  |
|     Stage A: Priority Scoring -> deadline_score, relevance_score, impact_score    |
|     Stage B: Cross-Source Duplicate Grouping -> Jaccard >= duplicate_threshold    |
|     Stage C: Attention Budget Selection -> selected, below_threshold,             |
|              cooldown, over_budget                                                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  4. Explainable 3-Section UI Rendering                                            |
|     - Section 1: "Cần chú ý trước" (Selected Attention Queue within budget)       |
|     - Section 2: "Các công việc khác" (Remaining tasks + explicit reason badge)   |
|     - Section 3: "Có thể cùng một việc" (Duplicate groups + Representative badge) |
+-----------------------------------------------------------------------------------+
```

#### Stage A: Active Filtering & Multi-Factor Priority Scoring (`rankItems`)
Only tasks in active lifecycle states (`not_started`, `in_progress`, `waiting`) are evaluated (`ACTIVE_STATES`). For each active task, three normalized component scores in $[0, 1]$ are computed:

1. **Deadline Urgency Score (`deadlineScore`):**
   - If a task has no confirmed deadline (`deadline === null`), $S_{\text{deadline}} = 0.0$.
   - Otherwise, let $h = \frac{t_{\text{deadline}} - t_{\text{now}}}{3600 \times 1000}$ be the hours remaining:
     $$S_{\text{deadline}} = \frac{1}{1 + \max(h, 0) / 24}$$
   - Tasks due right now or overdue ($h \le 0$) achieve the maximum score $1.0$; a task due in 24 hours scores $0.5$; a task due in 72 hours scores $0.25$.

2. **Focus-Term Relevance Score (`relevanceScore`):**
   - Text is tokenized using Unicode property escapes `/[\p{L}\p{M}\p{N}_]+/gu` (preserving Vietnamese diacritics).
   - If the user enters no focus terms ($|F| = 0$), every task receives a neutral score $S_{\text{relevance}} = 0.5$.
   - Otherwise, given title token set $T$ and focus token set $F$:
     $$S_{\text{relevance}} = \frac{|T \cap F|}{|F|}$$

3. **Impact Score (`impactScore`):**
   - Maps task importance directly: `low` $\rightarrow 0.25$, `normal` $\rightarrow 0.50$, `high` $\rightarrow 1.00$.

4. **Combined Priority Score (`priority_score`):**
   - Given user weights $(w_d, w_r, w_i)$ where $w_d + w_r + w_i > 0$:
     $$S_{\text{priority}} = \frac{w_d \cdot S_{\text{deadline}} + w_r \cdot S_{\text{relevance}} + w_i \cdot S_{\text{impact}}}{w_d + w_r + w_i}$$
   - Ties are broken deterministically by `(account_id, task_id)` lexicographical order (`compareRef`).

#### Stage B: Cross-Source Duplicate Grouping & Representative Selection (`groupDuplicates`)
To prevent false-positive duplicate grouping, two tasks `left` and `right` are considered duplicate candidates (`duplicateSimilarity`) **if and only if all 5 conditions hold**:
1. **Cross-Source / Cross-Account Guard:** They do **not** come from the same account and same source type (`!(left.ref.account_id === right.ref.account_id && left.source_type === right.source_type)`).
2. **Temporal Proximity Guard:** Their source email timestamps fall within `policy.time_window` hours ($0 \dots 720$ hours):
   $$\frac{|t_{\text{left}} - t_{\text{right}}|}{3600 \times 1000} \le \text{time\_window}$$
3. **Owner Match Guard:** Normalized (trimmed, lowercased) task owners are identical (or both `null`).
4. **Effective Deadline Match Guard:** Confirmed deadlines match to the millisecond (or are both `null`).
5. **Title Jaccard Similarity Threshold:** Token Jaccard similarity meets or exceeds `policy.duplicate_threshold` ($0 < \theta \le 1$):
   $$J(T_{\text{left}}, T_{\text{right}}) = \frac{|T_{\text{left}} \cap T_{\text{right}}|}{|T_{\text{left}} \cup T_{\text{right}}|} \ge \text{duplicate\_threshold}$$

Using complete-linkage greedy clustering, a candidate joins an existing group only if it satisfies `duplicateSimilarity` with **every** current member of that group. Within each group, a single **Representative Task** is chosen by maximizing the blended score:
$$S_{\text{rep}} = (1 - w_{\text{trust}}) \cdot S_{\text{priority}} + w_{\text{trust}} \cdot \text{source\_trust}[\text{source\_type}]$$

#### Stage C: Attention Budget & Cooldown Selection (`selectAttention`)
Duplicate groups are sorted by their group priority score (the maximum `priority_score` among members). Given `reminder_frequency` $f \in [0, 24]$ reminders/day, the minimum cooldown interval is $\Delta t = \frac{24}{f}$ hours (or $\infty$ if $f = 0$). Each group's representative is classified into one of four mutually exclusive buckets:
1. **`below_threshold` (*"Chưa đủ mức ưu tiên"*):** Group `priority_score < policy.priority_threshold`.
2. **`cooldown` (*"Vừa được nhắc gần đây"*):** Any member of the group has a simulated notification receipt in `last_notified` within the cooldown window $\Delta t$.
3. **`selected` (*"Cần chú ý trước"*):** Passed threshold and cooldown, and `selected.length < policy.notification_budget`.
4. **`over_budget` (*"Ngoài số nhóm hiển thị"*):** Passed threshold and cooldown, but the attention budget (`0..50`) is already full.

Every non-selected task in the UI displays its exact exclusion reason (`grouped`, `below_threshold`, `cooldown`, or `over_budget`) so the user never wonders why a task was held back.

---

### 2.3. Related Design Choices & Architectural Trade-offs

| Design Decision | Chosen Approach | Alternative Considered | Rationale |
| :--- | :--- | :--- | :--- |
| **Execution Mode** | **Strictly Read-Only Simulation** (`POST /decision-preview` mutates zero database rows and sends zero OS notifications) | Auto-applying priority tags or auto-merging duplicate tasks in SQLite | Prevents accidental data loss when users experiment with sliders; verified via before/after `GET /tasks` snapshot assertions in E2E tests (`271efc8`). |
| **Scoring & Deduplication Engine** | **Deterministic Rule-Based Formula** with explicit weights & Jaccard token similarity | Calling an LLM on every slider change | Rule-based evaluation runs in `< 5 ms`, works offline, is 100% deterministic, costs zero API tokens, and avoids mislabeling heuristic scores as "AI probability". |
| **Stale Result Indication** | **JSON Request Fingerprinting** (`evaluatedFingerprint !== currentFingerprint`) with a *"Kết quả cũ"* badge | Auto-submitting an HTTP request on every keystroke or number input change | Gives the user control over when the list re-orders (preventing jarring UI jumps while typing focus terms) while clearly warning that current results reflect previous inputs. |
| **Concurrency Control** | **`AbortController` + Monotonic `generationRef`** on `runPreview()` | Ignoring overlapping requests | Guarantees that if a user clicks *"Xem gợi ý"* twice rapidly, an older slow response can never overwrite a newer result. |
| **1:1 Frontend Mock Engine** | Pure TypeScript port (`decisionPreviewMock.ts`) identical to backend contract `w2-decision-v1` | Returning static hardcoded mock JSON | Enables rich interactive testing in `?mode=mock&demo-controls=1` and fast Vitest unit tests without spinning up Python/FastAPI. |

---

### 2.4. Pros and Cons of Feature 1

#### Pros
- **Full Explainability:** Every task either appears in the top attention list or shows a human-readable explanation (*"Chưa đủ mức ưu tiên"*, *"Vừa được nhắc gần đây"*, *"Ngoài số nhóm hiển thị"*, or *"Nằm trong nhóm có thể trùng"*).
- **Safe Multi-Account Triage:** Evaluates up to 8 accounts and up to 500 active tasks simultaneously with zero risk of cross-account data corruption or task mutation.
- **Unicode & Vietnamese-Aware Tokenization:** Uses `/[\p{L}\p{M}\p{N}_]+/gu` regex so Vietnamese accented words (e.g., `báo`, `cáo`, `thuyết`, `trình`) tokenize accurately.
- **High Testability:** Pure functions in `decisionPreviewMock.ts` take an explicit `now: Date` parameter and perform zero I/O, enabling deterministic unit and E2E verification.

#### Cons & Limitations
- **Lexical (Bag-of-Words) Similarity Only:** Because title deduplication uses token Jaccard similarity rather than semantic embeddings, two tasks with completely different wording (e.g., *"Nộp bài tập lớn"* vs. *"Gửi đồ án cuối kỳ"*) will not be grouped as duplicates even if they refer to the same deliverable.
- **Strict Metadata Equality for Duplicate Grouping:** Requiring exact matches on normalized `owner` and `deadline` avoids false merges, but means that if one email had its deadline confirmed and the duplicate email did not yet have its deadline confirmed, they will not group until both share the same deadline state.
- **Scale Bound (1–8 Accounts / 500 Tasks):** Complete-linkage pairwise comparison is $O(N^2)$ in active tasks, which is instantaneous for $\le 500$ tasks (enforced via `decision_input_too_large` error handling) but not designed for tens of thousands of historical tasks.

---

## 3. Feature 2: Task Deadline Management, Audit History, Filtering, Source Email Linking & Companion Batch `.eml` Import Queue

### 3.1. Why This Feature Is Needed (Problem Statement)

When turning emails into actionable tasks, three critical reliability gaps arise in typical email-to-task tools:
1. **Ambiguous or Unverified AI Deadlines & Timezone Drift:** Emails frequently contain relative or conditional time expressions (*"trước 5h chiều thứ Sáu nếu nhóm đã chốt số liệu"*). Automatically promoting an LLM's guessed timestamp into an active deadline causes false alarms. Furthermore, students working across local time (`UTC+07:00`) and international submission portals (`UTC`) need to see the exact UTC conversion before saving, and need an **immutable audit history** explaining *when*, *why*, and *by what source* (manual vs. email evidence excerpt) a deadline was changed or cleared.
2. **Multi-Email Task Threads & Referential Integrity:** A single task rarely lives in just one email—a professor may send an initial assignment email, a clarification email, and a deadline-extension email. Users need to **link supplemental emails** to an existing task, filter the task dashboard by a `[from, to)` deadline window, and **unlink irrelevant emails**—while being blocked (HTTP `409`) from accidentally unlinking the task's founding origin email (`origin_link_required`) or an email currently backing an active evidence quote or deadline (`source_link_in_use`).
3. **Bulk `.eml` Ingestion Bottleneck:** Before tasks and deadlines can be managed from local email archives, importing `.eml` files one by one is slow and tedious. Users need a **Batch `.eml` Selection & Drag-and-Drop Sequential Import Queue** that validates file sizes (`<= 10 MiB`), skips invalid files gracefully, and imports valid files sequentially with per-file idempotency keys.

---

### 3.2. How It Works (Architecture & Technical Workflow)

The feature set is implemented across:
- **Task Editor & Dialogs (Deadline Confirm, UTC Preview, Audit History, Email Link/Unlink):** `apps/desktop/src/features/tasks/TaskEditor.tsx` (673 lines)
- **Task Dashboard & `[from, to)` UTC Date-Range Filter:** `apps/desktop/src/features/tasks/TaskDashboard.tsx` (452 lines)
- **Companion Batch `.eml` Drag-and-Drop Import Queue:** `apps/desktop/src/features/inbox/InboxPage.tsx` (604 lines)
- **HTTP Client & Mock Parity:** `apps/desktop/src/api/client.ts`, `apps/desktop/src/api/mock.ts`, `apps/desktop/src/strings.ts`
- **Test Suites:** `apps/desktop/tests/platform/TaskDeadlineAndLink.test.tsx`, `apps/desktop/tests/platform/InboxBatchImport.test.tsx`, `apps/desktop/tests/w3-api.spec.ts`

```
+-----------------------------------------------------------------------------------+
|       End-to-End Email -> Task -> Deadline & Source Linking Lifecycle             |
+-----------------------------------------------------------------------------------+
|  [A] Companion Batch .eml Import Queue (InboxPage.tsx)                            |
|      File Picker / Drag-and-Drop -> Filter (.eml, 0 < size <= 10 MiB)             |
|      -> Sequential Queue (1 UUID idempotency key/file) -> Poll Job to terminal    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  [B] Task Deadline Confirmation & Live UTC Preview (TaskEditor.tsx)               |
|      - Input: datetime-local + explicit UTC offset (e.g. +07:00) + Reason (1..500)|
|      - Optional: Bind to specific Email Evidence Excerpt (source_kind="evidence") |
|      - Live Preview: resolveDeadlineInput() -> RFC3339 UTC timestamp preview      |
|      - Optimistic Concurrency: POST /tasks/{id}/deadline with expected_version    |
+-----------------------------------------+-----------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
+----------------------------------------+   +--------------------------------------+
| [C] Deadline Audit History Modal       |   | [D] Source Email Link / Unlink       |
| - GET /tasks/{id}/deadline-history     |   | - Searchable in-account email picker |
| - Shows previous -> new deadline,      |   | - POST /messages/link & /unlink      |
|   actor/source_kind, reason & version  |   | - Catches 409 origin_link_required   |
| - Cursor pagination & Escape close     |   |   & source_link_in_use safely        |
+----------------------------------------+   +--------------------------------------+
```

#### Part A: Human-in-the-Loop Deadline Confirmation & Live UTC Conversion (`TaskEditor.tsx`)
1. **Explicit Local-to-UTC Resolution (`resolveDeadlineInput`):**
   - When opening the deadline sub-form, `newDeadlineDraft` initializes `offset` from the system timezone (e.g., `+07:00`) and formats the existing effective deadline into `YYYY-MM-DDTHH:mm`.
   - As the user edits the `datetime-local` input or the UTC offset (`±HH:MM`, validated by `offsetMinutes`), `resolveDeadlineInput` constructs `new Date("${input}:00${offset}")`, verifies round-trip calendar validity (rejecting impossible dates), and preserves existing seconds precision if the minute value was unchanged.
   - A live preview element (`Giờ quốc tế (UTC)`) immediately displays the converted UTC timestamp using `Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" })`.
2. **Dual Source Modes (`manual` vs. `evidence`) & Mandatory Audit Reason:**
   - Users must enter a non-empty reason between `1` and `500` Unicode code points (`Array.from(trimmedReason).length <= 500`).
   - If the task has extracted email evidence (`base.evidence_ids.length > 0`), the user can optionally attach an evidence excerpt (`source_kind: "evidence"`, `evidence_id: evId`); otherwise it submits `source_kind: "manual"`, `evidence_id: null`.
   - Clicking *"Xóa hạn chót"* (`handleConfirmDeadline(true)`) submits `deadline: null` with `source_kind: "manual"` and the required reason, recording the removal in the audit log.
3. **Non-Destructive Draft Merging (`acceptRelatedChange`):**
   - Confirming a deadline or linking an email increments `task.version` on the backend and returns an updated `TaskView`.
   - Rather than wiping out unsaved edits the user may have typed in the main task form (such as an unsaved `owner` or `estimate` change), `acceptRelatedChange(updated)` updates `base` to the new server version while **preserving any dirty fields in `draft`**.

#### Part B: Paginated Deadline History Audit Modal (`TaskEditor.tsx`)
- Clicking *"Lịch sử thay đổi hạn chót"* opens a Radix `Dialog` and calls `client.listDeadlineHistory(scope, base.id, { limit: 50, cursor })`.
- Each `DeadlineHistoryEntryView` renders:
  - The mutation timestamp (`created_at`),
  - The new deadline (`Hạn mới · ...`) or cleared badge (`Đã bỏ hạn chót`),
  - The previous deadline (`Hạn trước · ...` or `Trước đó chưa có hạn`),
  - The user's recorded `reason`,
  - The provenance badge (`Xác nhận từ đoạn trích email` vs. `Người dùng xác nhận`) and `Phiên bản {task_version}`.
- Supports deduplicated cursor pagination (*"Xem lịch sử trước"*) and aborts any in-flight HTTP request when closed (`onOpenChange`).

#### Part C: `[from, to)` UTC Deadline Date-Range Filtering (`TaskDashboard.tsx`)
- On the Task Dashboard, two date inputs (*"Hạn từ"* / `deadlineFrom` and *"Hạn đến"* / `deadlineTo`) filter tasks by `deadline_effective`.
- To ensure tasks due at any time on the end date are included regardless of timezone offset, `toFromIso(dateStr)` serializes the local start of day (`T00:00:00`) to UTC ISO-8601, while `toToIso(dateStr)` advances the date by `+1 day` (`d.setDate(d.getDate() + 1)`) to produce an **exclusive upper bound `[deadline_from, deadline_to)`**.
- Changing either bound calls `resetPages()`, clearing cached pagination cursors in session memory so stale pages never mix with the new filter.

#### Part D: In-Account Source Email Linking & Conflict-Safe Unlinking (`TaskEditor.tsx`)
- **Linking (`openLinkPicker` & `loadLinkMessages`):** Opens a modal dialog scoped strictly to the active `(workspace_id, account_id)`. Users can search emails (`client.searchMessages`) or browse (`client.listMessages`), with already-linked `base.message_ids` filtered out (`matchedMessages`). Clicking *"Thêm"* dispatches `POST /tasks/{id}/messages/link` with `expected_version` and a fresh `idempotency_key`.
- **Conflict-Safe Unlinking (`changeLink("unlink", messageId)`):** Dispatches `POST /tasks/{id}/messages/unlink`. If the backend returns HTTP `409 Conflict`, `submitRelated` translates domain error codes into actionable Vietnamese alerts:
  - `origin_link_required` $\rightarrow$ *"Không thể gỡ liên kết email nguồn gốc của công việc."*
  - `source_link_in_use` $\rightarrow$ *"Email đang được sử dụng làm bằng chứng hoặc nguồn hạn chót."*
  - `version_conflict` $\rightarrow$ Displays a conflict banner with a *"Tải lại bản mới"* (`reloadLatest`) recovery action.

#### Part E: Companion Batch `.eml` Drag-and-Drop Sequential Import Queue (`InboxPage.tsx`)
- Users can either select multiple `.eml` files via `<input type="file" multiple accept=".eml,message/rfc822" />` or drag and drop files directly onto the Inbox workspace (`onDragOver`, `onDragLeave`, `onDrop` with visual class `inbox-drop-active`).
- `onPickFiles` validates every file against `/\.eml$/i.test(f.name) && f.size > 0 && f.size <= MAX_EML_BYTES` ($10\text{ MiB}$). If some files in a batch are invalid, valid files still proceed while a warning banner reports `Đã bỏ qua {invalidCount} file không hợp lệ`.
- `runImportQueue` processes the queue **sequentially**, persisting `ImportQueueState` in `session.memory` (so re-renders preserve progress), assigning a unique UUID idempotency key per file, polling each background `import_eml` job via `pollJob`, updating progress (`Đang nhập email (current/total)…`), and preventing re-entry loops via an `importAbort.current` guard (`f9ae1ff`).

---

### 3.3. Related Design Choices & Architectural Trade-offs

| Design Decision | Chosen Approach | Alternative Considered | Rationale |
| :--- | :--- | :--- | :--- |
| **Deadline Mutation Endpoint** | **Dedicated `POST /tasks/{id}/deadline` endpoint** separate from `PATCH /tasks/{id}` | Allowing direct deadline edits inside generic `TaskPatch` | Enforces mandatory audit `reason`, `source_kind` (`manual` vs. `evidence`), and `DeadlineHistoryEntry` creation on every single deadline change. |
| **Draft State During Related Mutations** | **Selective Field Merge (`acceptRelatedChange`)** | Resetting the entire `TaskEditor` form when a deadline or email link completes | If a user edits `owner` or `estimate` and then confirms a deadline before clicking *"Lưu thay đổi"*, their unsaved field edits are preserved while `base.version` advances cleanly. |
| **Date-Range Filter Semantics** | **Half-Open Interval `[from, to)`** where `to` is local midnight of `date + 1 day` converted to UTC | Inclusive `[from, to]` using `23:59:59` or raw `YYYY-MM-DD` strings | Half-open intervals `[from, to)` avoid sub-second boundary gaps (`23:59:59.999`) and respect the user's local timezone boundary when querying UTC timestamps in SQLite. |
| **Unlink Protection** | **Backend-Enforced HTTP 409 + Explicit UI Error Translation** | Hiding the *"Gỡ liên kết"* button heuristically on the frontend | The backend is the source of truth for whether an email is the task's origin or referenced by an active evidence/deadline record; handling `409` explicitly guarantees consistency even under concurrent edits. |
| **Batch `.eml` Import Execution** | **Sequential FIFO Queue with Per-File Idempotency Keys** | Firing `Promise.all()` for 50 `.eml` files in parallel | Prevents local SQLite write contention and UI freezes, allows accurate `(current/total)` progress feedback, and lets the user cancel remaining queued files cleanly. |

---

### 3.4. Pros and Cons of Feature 2

#### Pros
- **Auditability & Trust:** Every deadline confirmation or removal has an explicit human reason, timezone offset, UTC preview, and versioned audit trail.
- **Strong Referential Integrity:** Tasks maintain bidirectional traceability to their founding and supplemental emails; users cannot accidentally orphan a task or break an evidence citation.
- **Resilient Concurrency & Network Handling:** Every mutation uses `expected_version` (optimistic locking) and `idempotency_key`. Uncertain network failures (`status === 0`) keep the `relatedIntent` stored so the user can safely click *"Thử lại yêu cầu"* without creating duplicate entries.
- **Smooth Bulk Onboarding:** Drag-and-drop batch `.eml` import handles mixed valid/invalid file drops gracefully without aborting the entire batch.

#### Cons & Limitations
- **Higher Friction for Simple Deadline Edits:** Requiring a non-empty `reason` (`1..500` chars) every time a deadline is set, changed, or cleared adds an extra typing step compared to a single-click date picker, trading speed for auditability.
- **Stop-on-First-Server-Error in Batch Import Queue:** While client-side validation skips invalid/oversized files upfront, if the backend returns an unexpected job failure mid-queue during `runImportQueue`, the queue halts and reports `<filename>: <error>` rather than continuing past a broken backend state.

---

## 4. Copied Source Code & Git Commit History Reference

All relevant source files have been copied into `Presentation/Source_Code/` alongside this report:

| Copied File in `Presentation/Source_Code/` | Repository Path | Role in Contributed Features |
| :--- | :--- | :--- |
| `DecisionPreviewPage.tsx` | `apps/desktop/src/features/decisions/DecisionPreviewPage.tsx` | Multi-Account Decision Preview UI (1–8 accounts, 9 policy parameters, 3 result sections, stale notice) |
| `decisionPreviewMock.ts` | `apps/desktop/src/lib/decisionPreviewMock.ts` | Pure decision engine (`rankItems`, `groupDuplicates`, `selectAttention`, `evaluateDecisions`) |
| `TaskEditor.tsx` | `apps/desktop/src/features/tasks/TaskEditor.tsx` | Task deadline confirmation, UTC preview, Deadline History modal, and Email Link/Unlink with 409 handling |
| `TaskDashboard.tsx` | `apps/desktop/src/features/tasks/TaskDashboard.tsx` | Task list workspace & `[from, to)` UTC deadline date-range filter |
| `InboxPage.tsx` | `apps/desktop/src/features/inbox/InboxPage.tsx` | Batch `.eml` file picker & drag-and-drop sequential import queue |
| `client.ts` | `apps/desktop/src/api/client.ts` | Typed HTTP `ApiClient` (`previewDecisions`, `confirmTaskDeadline`, `listDeadlineHistory`, `linkTaskMessage`, `unlinkTaskMessage`, `importEml`) |
| `mock.ts` | `apps/desktop/src/api/mock.ts` | 1:1 in-memory mock adapter for offline testing and demo mode |
| `strings.ts` | `apps/desktop/src/strings.ts` | Centralized Vietnamese UI copy for Inbox, Tasks, Deadlines, and Decision Preview |
| `DecisionPreviewPage.test.tsx` | `apps/desktop/tests/platform/DecisionPreviewPage.test.tsx` | Component tests for 1–8 account constraints, stale notice, and 3-section rendering |
| `decisionPreviewMock.test.ts` | `apps/desktop/src/lib/decisionPreviewMock.test.ts` | Unit tests for priority scoring, duplicate grouping, and attention budget selection |
| `TaskDeadlineAndLink.test.tsx` | `apps/desktop/tests/platform/TaskDeadlineAndLink.test.tsx` | Component tests for UTC preview, deadline clearing, history modal, and 409 unlinking |
| `InboxBatchImport.test.tsx` | `apps/desktop/tests/platform/InboxBatchImport.test.tsx` | Unit tests for batch `.eml` selection, invalid file skipping, and sequential import queue |
| `w3-api.spec.ts` | `apps/desktop/tests/w3-api.spec.ts` | End-to-end Playwright acceptance tests against real FastAPI + SQLite |

For the full chronological Git commit log and `git show --stat` diff records, see [`Git_Commit_History.md`](./Git_Commit_History.md) in this directory.

---

## 5. Demo Video URL

https://youtu.be/l7ZGmcKYuRQ