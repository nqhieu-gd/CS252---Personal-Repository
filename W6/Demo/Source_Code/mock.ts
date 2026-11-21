import { ApiError, type ApiClient, type ApiMethodName, type RequestOptions } from "./client";
import { evaluateDecisions } from "../lib/decisionPreviewMock";
import type { GmailSyncApi, GmailSyncView } from "./gmailSync";
import type { CapacityExclusion, CapacityResult, ChangeSuggestion, CommitmentView, WorkBriefSections } from "./workAssistant";
import type {
  AccountDeletionView,
  AccountScope,
  AccountView,
  AnalysisProposalView,
  ConfirmCandidateRequest,
  ConfirmDeadlineRequest,
  CursorParams,
  DeadlineHistoryEntryView,
  DecisionItem,
  DecisionPreviewRequest,
  DeletionPhase,
  DeletionStatus,
  ErrorDetail,
  EvidenceView,
  JobKind,
  JobView,
  ListMessagesParams,
  ListTasksParams,
  MessageView,
  OAuthAttemptStatus,
  OAuthAttemptView,
  Page,
  SearchMessagesParams,
  TaskCandidateView,
  TaskMessageMutationRequest,
  TaskView,
  UpdateTaskRequest,
} from "./types";

/**
 * Mock adapter. Implements the SAME ApiClient interface as the HTTP adapter and
 * uses the SAME DTOs from ./types — it never invents a backend schema of its own.
 */

export interface MockAccountSeed {
  id: string;
  display_name: string;
  kind?: AccountView["kind"];
  messages?: Array<Partial<MessageView> & { id: string; subject: string; body_text: string }>;
  tasks?: Array<Partial<TaskView> & { id: string; title: string }>;
  changes?: Record<string, ChangeSuggestion[]>;
}

export interface MockOptions {
  workspaceId?: string;
  accounts?: MockAccountSeed[];
  /** getJob calls that return "running" before the job turns terminal. */
  jobPolls?: number;
  /** Simulated latency per call. */
  delayMs?: number;
}

export interface MockControls {
  /** Calls to `method` wait until the returned release() is called. */
  hold(method: ApiMethodName): () => void;
  /** Make every request fail as if the backend were down (until restored). */
  setBackendDown(down: boolean): void;
  /** The next importEml job will fail. */
  failNextImport(message?: string): void;
  /** The next syncAccount job will fail. */
  failNextSync(message?: string): void;
  /** Bump a message's revision so existing evidence no longer matches it. */
  bumpMessageRevision(accountId: string, messageId: string): void;
  /** Bump a task's version behind the UI's back, so the next PATCH is a 409. */
  bumpTaskVersion(accountId: string, taskId: string): void;
  /** Remove a message so evidence/getMessage for it become unavailable (404). */
  removeMessage(accountId: string, messageId: string): void;
  /** Set outcome for an OAuth attempt. */
  setOAuthOutcome(accountId: string, attemptId: string, status: OAuthAttemptStatus, error?: ErrorDetail | null): void;
  /** Set outcome for account deletion. */
  setDeletionOutcome(accountId: string, status: DeletionStatus, phase?: DeletionPhase): void;
  /** Set mock clock for Decision Preview. */
  setDecisionClock(now: Date | null): void;
  /** Replace fields of a real Gmail account's sync snapshot (e.g. bump data_version). */
  bumpSyncDataVersion(accountId: string): void;
  setGmailSyncState(accountId: string, patch: Partial<GmailSyncView>): void;
  /** When false, startAnalysis answers 503 provider_not_configured before any job exists. */
  setAnalysisConfigured(configured: boolean): void;
  /** The next analysis job fails with this provider error code. */
  failNextAnalysis(code: string, message?: string): void;
  /** How many times each method has been called (for polling assertions). */
  calls: Record<string, number>;
}

export type MockApiClient = ApiClient & GmailSyncApi & { controls: MockControls };

interface AccountData {
  view: AccountView;
  messages: MessageView[];
  tasks: Map<string, TaskView>;
  analyses: Map<string, AnalysisProposalView[]>;
  evidence: Map<string, EvidenceView>;
  jobs: Map<string, { job: JobView; remaining: number; failWith?: string; failCode?: string; complete?: () => JobView["result"] }>;
  jobBodies: Map<string, string>;
  rawMessages: Map<string, string>;
  jobByKey: Map<string, string>;
  /** idempotency key -> what it was first used for, so a replay is detected like the real router does. */
  taskByKey: Map<string, { signature: string; taskId: string }>;
  deadlineHistory: Map<string, DeadlineHistoryEntryView[]>;
  deadlineByKey: Map<string, { signature: string; task: TaskView }>;
  messageMutationByKey: Map<string, { signature: string; task: TaskView }>;
  commitments: Map<string, CommitmentView>;
  workKeys: Map<string, { signature: string; id: string }>;
  workChanges: Map<string, ChangeSuggestion[]>;
  oauthAttempts: Map<string, OAuthAttemptView>;
  oauthByKey: Map<string, string>;
  deletionState: AccountDeletionView | null;
  deletionByKey: Map<string, AccountDeletionView>;
  sync: GmailSyncView;
}

const TICK = () => Promise.resolve();

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function codePointIndexOf(haystack: string, needle: string): number {
  const idx = haystack.indexOf(needle);
  return idx < 0 ? -1 : Array.from(haystack.slice(0, idx)).length;
}

function parseEml(text: string): { subject: string; from: string; to: string[]; sent_at: string; body: string } | null {
  const [head, ...rest] = text.split(/\r?\n\r?\n/);
  const header = (name: string) => new RegExp(`^${name}:\\s*(.+)$`, "im").exec(head)?.[1]?.trim();
  const subject = header("Subject");
  const from = header("From");
  if (!subject || !from) return null;
  const date = header("Date");
  return {
    subject,
    from,
    to: (header("To") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    sent_at: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date(0).toISOString(),
    body: rest.join("\n\n").replace(/\r\n/g, "\n"),
  };
}

export function createMockClient(options: MockOptions = {}): MockApiClient {
  const workspaceId = options.workspaceId ?? "ws-mock";
  const jobPolls = options.jobPolls ?? 2;
  const delayMs = options.delayMs ?? 0;
  const accounts = new Map<string, AccountData>();
  const calls: Record<string, number> = {};
  const holds = new Map<string, Promise<void>>();
  let backendDown = false;
  let failNextImportMessage: string | null = null;
  let failNextSyncMessage: string | null = null;
  let decisionClock: Date | null = null;
  let analysisConfigured = true;
  let failNextAnalysisWith: { code: string; message: string } | null = null;
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  function addAccount(seed: { id: string; display_name: string; kind?: AccountView["kind"] }): AccountData {
    const data: AccountData = {
      view: { id: seed.id, workspace_id: workspaceId, kind: seed.kind ?? "eml", display_name: seed.display_name, status: "connected" },
      messages: [],
      tasks: new Map(),
      analyses: new Map(),
      evidence: new Map(),
      jobs: new Map(),
      jobBodies: new Map(),
      rawMessages: new Map(),
      jobByKey: new Map(),
      taskByKey: new Map(),
      deadlineHistory: new Map(),
      deadlineByKey: new Map(),
      messageMutationByKey: new Map(),
      commitments: new Map(),
      workKeys: new Map(),
      workChanges: new Map(),
      oauthAttempts: new Map(),
      oauthByKey: new Map(),
      deletionState: null,
      deletionByKey: new Map(),
      sync: {
        mode: "push_history", status: "idle", last_success_at: null, watch_expires_at: null,
        needs_full_sync: false, has_more: false, data_version: 0, error: null,
      },
    };
    accounts.set(seed.id, data);
    return data;
  }

  function messageView(a: AccountData, m: Partial<MessageView> & { id: string; subject: string; body_text: string }): MessageView {
    return {
      workspace_id: workspaceId,
      account_id: a.view.id,
      provider_message_id: null,
      message_id_header: null,
      thread_id: null,
      sender: "sender@example.com",
      recipients: [],
      cc: [],
      sent_at: null,
      sent_at_raw: null,
      received_at: "2026-10-28T00:00:00Z",
      created_at: "2026-10-28T00:00:00Z",
      body_revision: 1,
      body_sha256: "0".repeat(64),
      raw_sha256: "0".repeat(64),
      parser_version: "mock-v1",
      mailbox: "INBOX",
      is_read: false,
      linked_task_ids: [],
      quoted_ranges: [],
      warnings: [],
      ...m,
    };
  }

  function taskView(a: AccountData, t: Partial<TaskView> & { id: string; title: string }): TaskView {
    return {
      workspace_id: workspaceId,
      account_id: a.view.id,
      version: 1,
      state: "not_started",
      owner: null,
      deadline_effective: null,
      estimated_minutes: null,
      importance: "normal",
      created_at: "2026-10-28T00:00:00Z",
      updated_at: "2026-10-28T00:00:00Z",
      confirmed_from_candidate_id: null,
      message_ids: [],
      evidence_ids: [],
      ...t,
    };
  }

  const validateValues = (patch: Record<string, unknown>) => {
    if ("owner" in patch && patch.owner !== null && (typeof patch.owner !== "string" || !patch.owner.trim() || Array.from(patch.owner).length > 200)) {
      throw new ApiError(422, "invalid_input", "Người phụ trách không hợp lệ.");
    }
    if ("estimated_minutes" in patch && patch.estimated_minutes !== null && (!Number.isSafeInteger(patch.estimated_minutes) || Number(patch.estimated_minutes) < 1)) {
      throw new ApiError(422, "invalid_input", "Thời lượng không hợp lệ.");
    }
    if ("importance" in patch && !["low", "normal", "high"].includes(String(patch.importance))) {
      throw new ApiError(422, "invalid_input", "Mức ưu tiên không hợp lệ.");
    }
    if ("state" in patch && !["not_started", "in_progress", "waiting", "done", "cancelled"].includes(String(patch.state))) {
      throw new ApiError(422, "invalid_input", "Trạng thái không hợp lệ.");
    }
    if ("title" in patch && (typeof patch.title !== "string" || !patch.title.trim() || Array.from(patch.title.trim()).length > 500)) {
      throw new ApiError(422, "invalid_input", "Tiêu đề không hợp lệ.");
    }
  };

  for (const seed of options.accounts ?? []) {
    const data = addAccount(seed);
    for (const m of seed.messages ?? []) data.messages.push(messageView(data, m));
    for (const task of seed.tasks ?? []) data.tasks.set(task.id, taskView(data, task));
    for (const [taskId, items] of Object.entries(seed.changes ?? {})) data.workChanges.set(taskId, structuredClone(items));
  }

  async function run<T>(method: ApiMethodName, opts: RequestOptions | undefined, fn: () => T | Promise<T>): Promise<T> {
    calls[method] = (calls[method] ?? 0) + 1;
    const signal = opts?.signal;
    if (signal?.aborted) throw abortError();
    await (delayMs > 0 ? new Promise<void>((r) => setTimeout(r, delayMs)) : TICK());
    const gate = holds.get(method);
    if (gate) {
      await new Promise<void>((resolve, reject) => {
        signal?.addEventListener("abort", () => reject(abortError()), { once: true });
        gate.then(resolve);
      });
    }
    if (signal?.aborted) throw abortError();
    if (backendDown) throw new ApiError(503, "backend_unavailable", "Backend chưa sẵn sàng");
    return fn();
  }

  const acct = (scope: AccountScope): AccountData => {
    const a = accounts.get(scope.account_id);
    if (!a || scope.workspace_id !== workspaceId) throw new ApiError(404, "account_not_found", "Không tìm thấy tài khoản");
    return a;
  };

  const workAccount = (scope: AccountScope): AccountData => {
    const a = acct(scope);
    if (a.deletionState?.status === "succeeded") throw new ApiError(409, "account_data_deleted", "Dữ liệu cục bộ của tài khoản đã bị xóa.");
    if (a.deletionState?.status === "running") throw new ApiError(409, "account_cleanup_pending", "Dữ liệu đang được xóa.");
    return a;
  };

  const workTask = (a: AccountData, id: string): TaskView => {
    const item = a.tasks.get(id);
    if (!item) throw new ApiError(404, "not_found", "Không tìm thấy công việc.");
    return item;
  };

  function commitmentView(item: CommitmentView): CommitmentView {
    const now = (decisionClock ?? new Date()).toISOString();
    return {
      ...item,
      needs_follow_up: item.status === "open" && !item.followed_up_at && item.follow_up_at != null && item.follow_up_at <= now,
      is_overdue: item.status === "open" && item.promised_at != null && item.promised_at < now,
    };
  }

  function workReplay(a: AccountData, key: string, signature: string): string | undefined {
    const hit = a.workKeys.get(key);
    if (hit && hit.signature !== signature) throw new ApiError(409, "idempotency_conflict", "Khóa đã được sử dụng cho nội dung khác.");
    return hit?.id;
  }

  function newJob(a: AccountData, kind: JobKind, key: string, failWith?: string, body: unknown = {}): JobView {
    if (a.view.status === "disconnected") throw new ApiError(409, "account_disconnected", "Tài khoản đã ngắt kết nối.");
    const namespace = kind + ":" + key;
    const sig = JSON.stringify(body), existing = a.jobByKey.get(namespace);
    if (existing) {
      if (a.jobBodies.get(namespace) !== sig) throw new ApiError(409, "idempotency_conflict", "Khóa đã được sử dụng cho nội dung khác.");
      return structuredClone(a.jobs.get(existing)!.job);
    }
    const job: JobView = { id: nextId("job"), workspace_id: workspaceId, account_id: a.view.id, kind, status: "queued", progress: { completed: 0, total: null }, result: null, error: null };
    a.jobs.set(job.id, { job, remaining: jobPolls, failWith });
    a.jobByKey.set(namespace, job.id);
    a.jobBodies.set(namespace, sig);
    return structuredClone(job);
  }

  function analyze(a: AccountData, message: MessageView): AnalysisProposalView {
    const candidates: TaskCandidateView[] = [];
    const analysisId = nextId("analysis");
    let lineOffset = 0;
    for (const line of message.body_text.split("\n")) {
      const currentOffset = lineOffset;
      lineOffset += Array.from(line).length + 1;
      if (message.quoted_ranges.some(([start, end]) => currentOffset >= start && currentOffset < end)) continue;
      const m = /^(?:[-*]|\d+\.)\s+(.+)$/.exec(line.trim());
      if (!m) continue;
      const action = m[1];
      const start = currentOffset + codePointIndexOf(line, action);
      const evId = nextId("ev");
      a.evidence.set(evId, {
        id: evId,
        message_id: message.id,
        body_revision: message.body_revision,
        quote: action,
        start,
        end: start + Array.from(action).length,
        accessible: true,
        source_status: "available",
      });
      candidates.push({
        id: nextId("cand"),
        workspace_id: workspaceId,
        account_id: a.view.id,
        message_id: message.id,
        body_revision: message.body_revision,
        action,
        proposed_owner: null,
        proposed_deadline: null,
        proposed_estimated_minutes: null,
        proposed_importance: "normal",
        time_mentions: [{
          raw_text: "25/10",
          kind: "deadline",
          normalized_iso: null,
          timezone: null,
          confidence: 0.9,
          start,
          end: start + Array.from(action).length,
        }],
        conditions: [],
        evidence_ids: [evId],
        needs_confirmation: true,
        confirmed_task_id: null,
        created_at: new Date().toISOString(),
      });
    }
    return {
      id: analysisId,
      workspace_id: workspaceId,
      account_id: a.view.id,
      analyzer_version: "mock-v1",
      created_at: "2026-10-28T00:00:00Z",
      evidence: candidates.flatMap((c) => c.evidence_ids.map((e) => a.evidence.get(e)!)),
      time_mentions: candidates.flatMap((c) => c.time_mentions),
      unknown: [...(candidates.some((c) => c.proposed_owner === null) ? ["owner"] : []), ...(candidates.length ? ["deadline"] : [])],
      warnings: [],
      message_id: message.id,
      body_revision: message.body_revision,
      intent: candidates.length > 0 ? "task" : "notice",
      summary: message.subject,
      candidates,
    };
  }

  const page = <T,>(items: T[], cursor: string | null | undefined, limit: number, scope: AccountScope, resource: string): Page<T> => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(422, "invalid_input", "Giới hạn trang không hợp lệ.");
    let offset = 0;
    if (cursor) {
      try {
        const data = JSON.parse(decodeURIComponent(cursor));
        if (data.scope !== `${scope.workspace_id}/${scope.account_id}` || data.resource !== resource || !Number.isInteger(data.offset) || data.offset < 0) throw new Error();
        offset = data.offset;
      } catch {
        throw new ApiError(422, "invalid_cursor", "Cursor không hợp lệ.");
      }
    }
    return {
      items: structuredClone(items.slice(offset, offset + limit)),
      next_cursor: offset + limit < items.length ? encodeURIComponent(JSON.stringify({ scope: `${scope.workspace_id}/${scope.account_id}`, resource, offset: offset + limit })) : null,
    };
  };

  function briefSections(a: AccountData, task: TaskView): { [K in keyof WorkBriefSections]: WorkBriefSections[K][] } {
    const messages = new Map(a.messages.map((m) => [m.id, m]));
    return {
      commitments: [...a.commitments.values()].reverse().filter((item) => item.task_id === task.id).map(commitmentView),
      deadline_history: a.deadlineHistory.get(task.id) ?? [],
      sources: [...new Set(task.message_ids)].map((message_id) => {
        const m = messages.get(message_id);
        return { message_id, subject: m?.subject ?? "", received_at: m?.received_at ?? null, available: !!m };
      }).sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? "") || b.message_id.localeCompare(a.message_id)),
    };
  }

  function briefPage<K extends keyof WorkBriefSections>(
    a: AccountData, task: TaskView, scope: AccountScope, section: K, cursor?: string | null, limit?: number,
  ) {
    const items = briefSections(a, task)[section];
    const defaults = { commitments: 20, deadline_history: 10, sources: 20 };
    return { ...page<WorkBriefSections[K]>(items, cursor, limit ?? defaults[section], scope,
      `work-brief:${task.id}:${section}`), total: items.length };
  }

  const client: ApiClient & GmailSyncApi = {
    getHealth: (o) => run("getHealth", o, () => ({ status: "ready", api_version: "v1", workspace_id: workspaceId })),
    listAccounts: (_w, o) => run("listAccounts", o, () => [...accounts.values()].map((a) => ({ ...a.view }))),
    createAccount: (_w, input, o) =>
      run("createAccount", o, () => {
        const status = input.kind === "gmail" ? "disconnected" : "connected";
        const created = addAccount({ id: nextId("acc"), display_name: input.display_name, kind: input.kind });
        created.view.status = status;
        if (input.kind === "gmail") created.view.gmail_sync_confirmed = false;
        return { ...created.view };
      }),
    syncAccount: (s, key, o) =>
      run("syncAccount", o, () => {
        const a = acct(s);
        if (a.view.kind !== "gmail_fake" && a.view.kind !== "gmail") {
          throw new ApiError(409, "unsupported_account_kind", "Chỉ Gmail hỗ trợ đồng bộ.");
        }
        if (a.view.status === "disconnected") {
          throw new ApiError(409, "account_disconnected", "Tài khoản đã ngắt kết nối.");
        }
        if (a.view.gmail_sync_confirmed === false) {
          throw new ApiError(409, "gmail_sync_consent_required", "Hãy xác nhận phạm vi đồng bộ.");
        }
        const forced = failNextSyncMessage;
        failNextSyncMessage = null;
        const known = a.jobByKey.has(`sync_account:sync:${key}`);
        const job = newJob(a, "sync_account", `sync:${key}`, forced ?? undefined);
        if (!known && a.view.kind === "gmail" && !forced) {
          a.sync = { ...a.sync, status: "syncing", error: null };
          a.jobs.get(job.id)!.complete = () => {
            a.sync = { ...a.sync, status: "idle", data_version: a.sync.data_version + 1, last_success_at: new Date().toISOString() };
            return { imported: 0, skipped: 0, checkpoint: null };
          };
        }
        return job;
      }),
    confirmGmailSync: (s, o) =>
      run("confirmGmailSync", o, () => {
        const a = acct(s);
        if (a.view.kind !== "gmail" || a.view.status !== "connected") {
          throw new ApiError(409, "account_disconnected", "Hãy kết nối Gmail trước.");
        }
        a.view.gmail_sync_confirmed = true;
        return { ...a.view };
      }),
    disconnectAccount: (s, o) =>
      run("disconnectAccount", o, () => {
        const a = acct(s);
        a.view = { ...a.view, status: "disconnected" };
        if (a.view.kind === "gmail") a.view.gmail_sync_confirmed = false;
        a.sync = { ...a.sync, status: "disconnected" };
        for (const entry of a.jobs.values()) {
          if (entry.job.status === "queued" || entry.job.status === "running") {
            entry.job = { ...entry.job, status: "cancelled", result: null, error: null };
          }
        }
        return { ...a.view };
      }),

    importEml: (s, file, key, o) =>
      run("importEml", o, async () => {
        const a = acct(s);
        const existing = a.jobByKey.get(`import_eml:import:${key}`);
        if (existing) {
          const text = await readFileText(file);
          return newJob(a, "import_eml", `import:${key}`, undefined, { text, filename: file.name });
        }
        const text = await readFileText(file);
        const forced = failNextImportMessage;
        failNextImportMessage = null;
        const parsed = forced ? null : parseEml(text);
        const job = newJob(a, "import_eml", `import:${key}`, forced ?? (parsed ? undefined : "File .eml không hợp lệ"), { text, filename: file.name });
        if (parsed) {
          a.jobs.get(job.id)!.complete = () => {
            const old = a.rawMessages.get(text);
            if (old) return { message_id: old };
            const id = nextId("msg");
            a.messages.unshift(messageView(a, { id, subject: parsed.subject, sender: parsed.from, recipients: parsed.to, sent_at: parsed.sent_at, body_text: parsed.body }));
            a.rawMessages.set(text, id);
            return { message_id: id };
          };
        }
        return job;
      }),
    getJob: (s, id, o) =>
      run("getJob", o, () => {
        const entry = acct(s).jobs.get(id);
        if (!entry) throw new ApiError(404, "job_not_found", "Không tìm thấy job");
        if (entry.job.status !== "queued" && entry.job.status !== "running") return structuredClone(entry.job);
        if (entry.remaining-- > 0) {
          entry.job = { ...entry.job, status: "running", result: null, error: null, progress: { completed: 0, total: null } };
        } else if (entry.failWith) {
          entry.job = { ...entry.job, status: "failed", result: null, error: { code: entry.failCode ?? "provider_failed", message: entry.failWith, details: {} } };
        } else {
          entry.job = { ...entry.job, status: "succeeded", error: null, result: entry.complete?.() ?? { imported: 0, skipped: 0, checkpoint: null }, progress: { completed: 1, total: 1 } } as JobView;
        }
        return { ...entry.job };
      }),
    cancelJob: (s, id, o) =>
      run("cancelJob", o, () => {
        const entry = acct(s).jobs.get(id);
        if (!entry) throw new ApiError(404, "job_not_found", "Không tìm thấy job");
        if (entry.job.status === "queued" || entry.job.status === "running") {
          entry.job = { ...entry.job, status: "cancelled", result: null, error: null };
        }
        return { ...entry.job };
      }),

    listMessages: (s, p: ListMessagesParams = {}, o) => run("listMessages", o, () => page(acct(s).messages, p.cursor, p.limit ?? 50, s, "messages")),
    searchMessages: (s, p: SearchMessagesParams, o) =>
      run("searchMessages", o, () => {
        let items = acct(s).messages;
        if (p.q) {
          const lower = p.q.toLowerCase();
          items = items.filter((m) => `${m.subject} ${m.body_text}`.toLowerCase().includes(lower));
        }
        if (p.sender) {
          items = items.filter((m) => m.sender.trim().toLowerCase() === p.sender!.trim().toLowerCase());
        }
        return page(items, p.cursor, p.limit ?? 50, s, "search:" + JSON.stringify({ q: p.q, sender: p.sender, mailbox: p.mailbox, from: p.from, to: p.to }));
      }),
    getMessage: (s, id, o) =>
      run("getMessage", o, () => {
        const m = acct(s).messages.find((x) => x.id === id);
        if (!m) throw new ApiError(404, "message_not_found", "Email không còn tồn tại");
        return { ...m };
      }),

    startAnalysis: (s, messageId, key, o) =>
      run("startAnalysis", o, () => {
        const a = acct(s);
        const message = a.messages.find((m) => m.id === messageId);
        if (!message) throw new ApiError(404, "message_not_found", "Email không còn tồn tại");
        if (!analysisConfigured) {
          throw new ApiError(503, "provider_not_configured", "Chưa cấu hình dịch vụ phân tích.");
        }
        const had = a.jobByKey.has(`analyze_message:analysis:${key}`);
        const job = newJob(a, "analyze_message", `analysis:${key}`, undefined, { messageId, revision: message.body_revision });
        if (!had && failNextAnalysisWith) {
          const entry = a.jobs.get(job.id)!;
          entry.failWith = failNextAnalysisWith.message;
          entry.failCode = failNextAnalysisWith.code;
          failNextAnalysisWith = null;
        } else if (!had) {
          a.jobs.get(job.id)!.complete = () => {
            const proposal = analyze(a, message);
            a.analyses.set(messageId, [...(a.analyses.get(messageId) ?? []), proposal]);
            return structuredClone(proposal);
          };
        }
        return job;
      }),
    getLatestAnalysis: (s, messageId, o) =>
      run("getLatestAnalysis", o, () => {
        const list = acct(s).analyses.get(messageId);
        const current = acct(s).messages.find((m) => m.id === messageId);
        if (!current) throw new ApiError(404, "not_found", "Email không còn tồn tại.");
        return list?.length && list[list.length - 1].body_revision === current.body_revision ? structuredClone(list[list.length - 1]) : null;
      }),
    getTaskOverview: async (w, accountId, filters, o) => {
      const scope = {workspace_id:w, account_id:accountId};
      const rows: TaskView[] = [];
      let cursor: string | null | undefined;
      do {
        const page = await client.listTasks(scope, {...filters, state:undefined, state_group:"active", limit:100, cursor}, o);
        rows.push(...page.items);
        cursor = page.next_cursor;
        if (rows.length > 500) throw new ApiError(422, "decision_input_too_large", "Hãy thu hẹp bộ lọc.");
      } while (cursor);
      const a = acct(scope);
      const items: DecisionItem[] = rows.map(task => {
        const linked = a.messages.filter(m => task.message_ids.includes(m.id));
        linked.sort((x,y) => y.received_at.localeCompare(x.received_at) || x.id.localeCompare(y.id));
        return {
          ref:{account_id:accountId,task_id:task.id}, title:task.title, state:task.state,
          owner:task.owner, importance:task.importance, deadline:task.deadline_effective,
          event_at:linked[0]?.received_at ?? task.created_at, source_type:a.view.kind,
        };
      });
      return evaluateDecisions(items, {
        policy:{deadline_weight:.5,relevance_weight:.3,impact_weight:.2,priority_threshold:.6,
          notification_budget:5,reminder_frequency:1,duplicate_threshold:.85,time_window:72,
          source_trust_weight:.25,source_trust:{eml:1,gmail:1,gmail_fake:1}},
        context:{focus_terms:[],last_notified:[]}, now:decisionClock ?? new Date(),
      });
    },
    createManualTask: (s, input, o) => run("createManualTask", o, () => {
      const a = acct(s);
      const signature = JSON.stringify(input);
      const old = a.taskByKey.get(input.idempotency_key);
      if (old) {
        if (old.signature !== signature) throw new ApiError(409, "idempotency_conflict", "Yêu cầu đã thay đổi.");
        return { ...a.tasks.get(old.taskId)! };
      }
      if (!input.title.trim()) throw new ApiError(422, "invalid_input", "Hãy nhập tên công việc.");
      const task = taskView(a, {
        id: nextId("task"), title: input.title.trim(), state: "not_started", owner: input.owner ?? null,
        importance: input.importance ?? "normal", version: 1, deadline_effective: null,
        estimated_minutes: null, message_ids: input.message_id ? [input.message_id] : [], evidence_ids: [],
        confirmed_from_candidate_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      a.tasks.set(task.id, task);
      a.taskByKey.set(input.idempotency_key, { signature, taskId: task.id });
      return { ...task };
    }),
    confirmCandidate: (s, input: ConfirmCandidateRequest, o) =>
      run("confirmCandidate", o, () => {
        const a = acct(s);
        const signature = JSON.stringify([input.candidate_id, input.overrides ?? {}]);
        const seen = a.taskByKey.get(input.idempotency_key);
        if (seen) {
          if (seen.signature !== signature) {
            throw new ApiError(409, "idempotency_conflict", "Khóa idempotency đã được dùng cho một yêu cầu khác");
          }
          return { ...a.tasks.get(seen.taskId)! };
        }
        let proposal: AnalysisProposalView | undefined;
        let cand: TaskCandidateView | undefined;
        for (const p of [...a.analyses.values()].flat()) {
          const hit = p.candidates.find((c) => c.id === input.candidate_id);
          if (hit) {
            proposal = p;
            cand = hit;
          }
        }
        if (!proposal || !cand) throw new ApiError(404, "candidate_not_found", "Không tìm thấy đề xuất");
        validateValues({ ...input.overrides });
        if (cand.confirmed_task_id) {
          if (Object.keys(input.overrides ?? {}).length) throw new ApiError(409, "candidate_already_confirmed", "Đề xuất đã được xác nhận.");
          return { ...a.tasks.get(cand.confirmed_task_id)! };
        }
        const source = a.messages.find((m) => m.id === proposal!.message_id);
        if (!source || source.body_revision !== cand.body_revision) throw new ApiError(409, "invalid_revision", "Nguồn đã thay đổi.");
        const task: TaskView = taskView(a, {
          id: nextId("task"),
          version: 1,
          title: input.overrides?.title?.trim() ?? cand.action,
          state: "not_started",
          owner: input.overrides && "owner" in input.overrides ? (input.overrides.owner ?? null) : cand.proposed_owner,
          deadline_effective: null,
          importance: input.overrides?.importance ?? cand.proposed_importance ?? "normal",
          estimated_minutes: input.overrides && "estimated_minutes" in input.overrides ? input.overrides.estimated_minutes : cand.proposed_estimated_minutes,
          message_ids: [proposal.message_id],
          evidence_ids: [...cand.evidence_ids],
          confirmed_from_candidate_id: cand.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        a.tasks.set(task.id, task);
        a.taskByKey.set(input.idempotency_key, { signature, taskId: task.id });
        cand.confirmed_task_id = task.id;
        const msg = a.messages.find((m) => m.id === proposal.message_id);
        if (msg) msg.linked_task_ids = [...msg.linked_task_ids, task.id];
        return { ...task };
      }),

    listTasks: (s, f: ListTasksParams = {}, o) =>
      run("listTasks", o, () => {
        let items = [...acct(s).tasks.values()];
        if (f.state_group) items = items.filter(t => (t.state === "done" || t.state === "cancelled") === (f.state_group === "terminal"));
        if (f.state) items = items.filter((t) => t.state === f.state);
        if (f.importance) items = items.filter((t) => t.importance === f.importance);
        if (f.owner !== undefined) {
          const ownerQuery = f.owner.trim();
          if (ownerQuery === "unassigned") {
            items = items.filter((t) => t.owner === null);
          } else {
            items = items.filter((t) => t.owner === ownerQuery);
          }
        }
        const queryText = f.search_query ?? (f as any).q;
        if (queryText) {
          const lower = queryText.toLowerCase();
          items = items.filter((t) => t.title.toLowerCase().includes(lower));
        }
        if (f.deadline_from) {
          const fromTime = new Date(f.deadline_from).getTime();
          items = items.filter((t) => t.deadline_effective && new Date(t.deadline_effective).getTime() >= fromTime);
        }
        if (f.deadline_to) {
          const toTime = new Date(f.deadline_to).getTime();
          items = items.filter((t) => t.deadline_effective && new Date(t.deadline_effective).getTime() < toTime);
        }
        items.sort((x, y) => (y.created_at ?? "").localeCompare(x.created_at ?? "") || y.id.localeCompare(x.id));
        return page(
          items.map((t) => ({ ...t })),
          f.cursor,
          f.limit ?? 20,
          s,
          "tasks:" + JSON.stringify({ state: f.state, owner: f.owner, importance: f.importance, search_query: f.search_query, from: f.deadline_from, to: f.deadline_to }),
        );
      }),
    getTask: (s, id, o) =>
      run("getTask", o, () => {
        const t = acct(s).tasks.get(id);
        if (!t) throw new ApiError(404, "task_not_found", "Không tìm thấy task");
        return { ...t };
      }),
    updateTask: (s, id, input: UpdateTaskRequest, o) =>
      run("updateTask", o, () => {
        const t = acct(s).tasks.get(id);
        if (!t) throw new ApiError(404, "task_not_found", "Không tìm thấy task");
        if (input.expected_version !== t.version) {
          throw new ApiError(409, "version_conflict", "Task đã được thay đổi ở nơi khác");
        }
        const { estimated_minutes } = input.patch;
        if (estimated_minutes !== undefined && estimated_minutes !== null && (!Number.isInteger(estimated_minutes) || estimated_minutes <= 0)) {
          throw new ApiError(422, "validation_error", "Thời lượng phải là số phút nguyên dương");
        }
        validateValues({ ...input.patch });
        if (Object.entries(input.patch).some(([key, value]) => t[key as keyof TaskView] !== value)) {
          Object.assign(t, input.patch, { version: t.version + 1, updated_at: new Date().toISOString() });
        }
        return { ...t };
      }),

    getEvidence: (s, id, o) =>
      run("getEvidence", o, () => {
        const a = acct(s);
        const ev = a.evidence.get(id);
        if (!ev) throw new ApiError(404, "evidence_not_found", "Không tìm thấy bằng chứng");
        const message = a.messages.find((m) => m.id === ev.message_id);
        const accessible = !!message && message.body_revision === ev.body_revision && Array.from(message.body_text).slice(ev.start, ev.end).join("") === ev.quote;
        return { ...ev, accessible, source_status: accessible ? ev.source_status : "body_unavailable" };
      }),

    // W02 methods
    confirmTaskDeadline: (s, id, input: ConfirmDeadlineRequest, o) =>
      run("confirmTaskDeadline", o, () => {
        const a = acct(s);
        const t = a.tasks.get(id);
        if (!t) throw new ApiError(404, "task_not_found", "Không tìm thấy task");

        const signature = JSON.stringify([input.deadline, input.source_kind, input.evidence_id, input.reason, input.expected_version]);
        const seen = a.deadlineByKey.get(input.idempotency_key);
        if (seen) {
          if (seen.signature !== signature) {
            throw new ApiError(409, "idempotency_conflict", "Khóa idempotency đã được dùng cho một yêu cầu khác");
          }
          return { ...seen.task };
        }

        if (input.expected_version !== t.version) {
          throw new ApiError(409, "version_conflict", "Task đã được thay đổi ở nơi khác");
        }

        const trimmedReason = input.reason.trim();
        if (!trimmedReason || Array.from(trimmedReason).length > 500) {
          throw new ApiError(422, "invalid_input", "Lý do phải có từ 1 đến 500 ký tự.");
        }

        if (input.source_kind === "manual") {
          if (input.evidence_id !== null && input.evidence_id !== undefined) {
            throw new ApiError(422, "invalid_input", "evidence_id phải là null đối với source_kind manual.");
          }
        } else if (input.source_kind === "evidence") {
          if (input.evidence_id === null || input.deadline === null) {
            throw new ApiError(422, "invalid_input", "evidence_id và deadline không được null đối với source_kind evidence.");
          }
          if (!t.evidence_ids.includes(input.evidence_id)) {
            throw new ApiError(409, "source_not_linked", "Bằng chứng chưa thuộc công việc này.");
          }
          const ev = a.evidence.get(input.evidence_id);
          if (!ev || ev.source_status === "body_unavailable" || !ev.accessible) {
            throw new ApiError(409, "invalid_revision", "Nguồn bằng chứng không còn hợp lệ.");
          }
        } else {
          throw new ApiError(422, "invalid_input", "source_kind không hợp lệ.");
        }

        // No-op check (same instant UTC, same source_kind, same evidence_id)
        const prevTime = t.deadline_effective ? new Date(t.deadline_effective).getTime() : null;
        const nextTime = input.deadline ? new Date(input.deadline).getTime() : null;
        const lastHistory = (a.deadlineHistory.get(id) ?? [])[0];
        const sameSourceKind = lastHistory ? lastHistory.source_kind === input.source_kind : input.source_kind === "manual";
        const sameEvidence = lastHistory ? lastHistory.evidence_id === input.evidence_id : input.evidence_id === null;

        if (prevTime === nextTime && sameSourceKind && sameEvidence) {
          a.deadlineByKey.set(input.idempotency_key, { signature, task: { ...t } });
          return { ...t };
        }

        const newVersion = t.version + 1;
        const prevDeadline = t.deadline_effective;
        t.deadline_effective = input.deadline;
        t.version = newVersion;
        t.updated_at = new Date().toISOString();

        const historyEntry: DeadlineHistoryEntryView = {
          id: nextId("dlh"),
          task_id: t.id,
          previous_deadline: prevDeadline,
          new_deadline: input.deadline,
          source_kind: input.source_kind,
          evidence_id: input.evidence_id,
          reason: trimmedReason,
          actor: "local_user",
          created_at: new Date().toISOString(),
          task_version: newVersion,
        };

        const historyList = a.deadlineHistory.get(t.id) ?? [];
        historyList.unshift(historyEntry);
        a.deadlineHistory.set(t.id, historyList);

        a.deadlineByKey.set(input.idempotency_key, { signature, task: { ...t } });
        return { ...t };
      }),

    listDeadlineHistory: (s, id, p: CursorParams = {}, o) =>
      run("listDeadlineHistory", o, () => {
        const a = acct(s);
        const t = a.tasks.get(id);
        if (!t) throw new ApiError(404, "task_not_found", "Không tìm thấy task");
        const list = a.deadlineHistory.get(id) ?? [];
        return page(list, p.cursor, p.limit ?? 20, s, `deadline-history:${id}`);
      }),

    linkTaskMessage: (s, id, input: TaskMessageMutationRequest, o) =>
      run("linkTaskMessage", o, () => {
        const a = acct(s);
        const t = a.tasks.get(id);
        if (!t) throw new ApiError(404, "task_not_found", "Không tìm thấy task");
        const msg = a.messages.find((m) => m.id === input.message_id);
        if (!msg) throw new ApiError(404, "message_not_found", "Không tìm thấy email");

        const signature = JSON.stringify([input.message_id, input.expected_version]);
        const seen = a.messageMutationByKey.get(input.idempotency_key);
        if (seen) {
          if (seen.signature !== signature) {
            throw new ApiError(409, "idempotency_conflict", "Khóa idempotency đã được dùng cho một yêu cầu khác");
          }
          return { ...seen.task };
        }

        if (input.expected_version !== t.version) {
          throw new ApiError(409, "version_conflict", "Task đã được thay đổi ở nơi khác");
        }

        if (t.message_ids.includes(input.message_id)) {
          a.messageMutationByKey.set(input.idempotency_key, { signature, task: { ...t } });
          return { ...t };
        }

        t.message_ids = [...t.message_ids, input.message_id];
        t.version += 1;
        t.updated_at = new Date().toISOString();
        if (!msg.linked_task_ids.includes(t.id)) {
          msg.linked_task_ids = [...msg.linked_task_ids, t.id];
        }

        a.messageMutationByKey.set(input.idempotency_key, { signature, task: { ...t } });
        return { ...t };
      }),

    unlinkTaskMessage: (s, id, input: TaskMessageMutationRequest, o) =>
      run("unlinkTaskMessage", o, () => {
        const a = acct(s);
        const t = a.tasks.get(id);
        if (!t) throw new ApiError(404, "task_not_found", "Không tìm thấy task");

        const signature = JSON.stringify([input.message_id, input.expected_version]);
        const seen = a.messageMutationByKey.get(input.idempotency_key);
        if (seen) {
          if (seen.signature !== signature) {
            throw new ApiError(409, "idempotency_conflict", "Khóa idempotency đã được dùng cho một yêu cầu khác");
          }
          return { ...seen.task };
        }

        if (input.expected_version !== t.version) {
          throw new ApiError(409, "version_conflict", "Task đã được thay đổi ở nơi khác");
        }

        // Check origin message
        if (t.confirmed_from_candidate_id) {
          for (const p of [...a.analyses.values()].flat()) {
            const hit = p.candidates.find((c) => c.id === t.confirmed_from_candidate_id);
            if (hit && p.message_id === input.message_id) {
              throw new ApiError(409, "origin_link_required", "Không thể gỡ liên kết email nguồn gốc của công việc.");
            }
          }
        }

        // Check active evidence
        for (const evId of t.evidence_ids) {
          const ev = a.evidence.get(evId);
          if (ev && ev.message_id === input.message_id) {
            throw new ApiError(409, "source_link_in_use", "Email đang được sử dụng làm bằng chứng hoặc nguồn hạn chót.");
          }
        }

        if (!t.message_ids.includes(input.message_id)) {
          a.messageMutationByKey.set(input.idempotency_key, { signature, task: { ...t } });
          return { ...t };
        }

        t.message_ids = t.message_ids.filter((m) => m !== input.message_id);
        t.version += 1;
        t.updated_at = new Date().toISOString();

        const msg = a.messages.find((m) => m.id === input.message_id);
        if (msg) {
          msg.linked_task_ids = msg.linked_task_ids.filter((tid) => tid !== t.id);
        }

        a.messageMutationByKey.set(input.idempotency_key, { signature, task: { ...t } });
        return { ...t };
      }),

    startGmailOAuth: (s, key, o) =>
      run("startGmailOAuth", o, () => {
        const a = acct(s);
        if (a.view.kind !== "gmail") {
          throw new ApiError(409, "unsupported_account_kind", "Chỉ tài khoản Gmail hỗ trợ OAuth.");
        }
        if (a.view.status === "connected") {
          throw new ApiError(409, "already_connected", "Tài khoản đã được kết nối.");
        }
        const existingAttemptId = a.oauthByKey.get(key);
        if (existingAttemptId) {
          const existing = a.oauthAttempts.get(existingAttemptId);
          if (existing) return { ...existing };
        }
        for (const attempt of a.oauthAttempts.values()) {
          if (attempt.status === "pending" && new Date(attempt.expires_at).getTime() > Date.now()) {
            throw new ApiError(409, "oauth_in_progress", "Một phiên đăng nhập OAuth đang được tiến hành.");
          }
        }
        const attemptId = nextId("oauth");
        const attempt: OAuthAttemptView = {
          id: attemptId,
          status: "pending",
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          error: null,
        };
        a.oauthAttempts.set(attemptId, attempt);
        a.oauthByKey.set(key, attemptId);
        return { ...attempt };
      }),

    getGmailOAuthAttempt: (s, id, o) =>
      run("getGmailOAuthAttempt", o, () => {
        const a = acct(s);
        const attempt = a.oauthAttempts.get(id);
        if (!attempt) {
          throw new ApiError(404, "oauth_attempt_missing", "Phiên đăng nhập không tồn tại hoặc đã bị hủy.");
        }
        if (attempt.status === "pending" && new Date(attempt.expires_at).getTime() < Date.now()) {
          attempt.status = "expired";
        }
        return { ...attempt };
      }),

    cancelGmailOAuth: (s, id, o) =>
      run("cancelGmailOAuth", o, () => {
        const a = acct(s);
        const attempt = a.oauthAttempts.get(id);
        if (!attempt) {
          throw new ApiError(404, "oauth_attempt_missing", "Phiên đăng nhập không tồn tại hoặc đã bị hủy.");
        }
        if (attempt.status === "pending") {
          attempt.status = "cancelled";
        }
        return { ...attempt };
      }),

    deleteLocalAccountData: (s, key, o) =>
      run("deleteLocalAccountData", o, () => {
        const a = acct(s);
        const prev = a.deletionByKey.get(key);
        if (prev) {
          return { ...prev };
        }
        if (a.view.status === "connected") {
          throw new ApiError(409, "account_connected", "Cần ngắt kết nối tài khoản trước khi xóa dữ liệu cục bộ.");
        }
        for (const entry of a.jobs.values()) {
          if (entry.job.status === "queued" || entry.job.status === "running") {
            throw new ApiError(409, "account_busy", "Tài khoản đang có tác vụ xử lý.");
          }
        }
        if (a.deletionState?.status === "succeeded") {
          throw new ApiError(409, "account_data_deleted", "Dữ liệu cục bộ của tài khoản đã bị xóa.");
        }
        const msgCount = a.messages.length;
        const taskCount = a.tasks.size;
        const candCount = [...a.analyses.values()].flatMap((p) => p.flatMap((x) => x.candidates)).length;
        const evCount = a.evidence.size;
        const analysisCount = [...a.analyses.values()].reduce((acc, curr) => acc + curr.length, 0);

        a.messages = [];
        a.tasks.clear();
        a.analyses.clear();
        a.evidence.clear();
        a.deadlineHistory.clear();
        a.deadlineByKey.clear();
        a.messageMutationByKey.clear();
        a.commitments.clear();
        a.workKeys.clear();
        a.workChanges.clear();
        a.oauthAttempts.clear();
        a.oauthByKey.clear();

        a.deletionState = {
          operation_id: nextId("del"),
          status: "succeeded",
          phase: "completed",
          db_counts: {
            messages: msgCount,
            tasks: taskCount,
            candidates: candCount,
            evidence: evCount,
            analyses: analysisCount,
            audit: 0,
            jobs: 0,
            checkpoints: 0,
            idempotency: 0,
          },
          file_counts: {
            raw_files: 0,
            staged_files: 0,
          },
          error: null,
        };

        a.deletionByKey.set(key, { ...a.deletionState });
        return { ...a.deletionState };
      }),

    getAccountDeletion: (s, o) =>
      run("getAccountDeletion", o, () => {
        const a = acct(s);
        return a.deletionState ? { ...a.deletionState } : null;
      }),

    listCommitments: (s, taskId, o) =>
      run("listCommitments", o, () => {
        const a = workAccount(s);
        if (taskId) workTask(a, taskId);
        const items = [...a.commitments.values()].reverse().filter((item) => !taskId || item.task_id === taskId).map(commitmentView);
        return { items: items.slice(0, 50), truncated: items.length > 50 };
      }),

    createCommitment: (s, { idempotency_key, ...input }, o) =>
      run("createCommitment", o, () => {
        const a = workAccount(s);
        const key = `commitment-create:${idempotency_key}`;
        const signature = JSON.stringify(input);
        const replay = workReplay(a, key, signature);
        if (replay) return commitmentView(a.commitments.get(replay)!);
        const task = workTask(a, input.task_id);
        if (input.message_id && !task.message_ids.includes(input.message_id)) {
          throw new ApiError(409, "source_not_linked", "Chưa liên kết email với công việc.");
        }
        if (!input.party_label.trim() || !input.statement.trim()) throw new ApiError(422, "invalid_input", "Cam kết thiếu người liên quan hoặc nội dung.");
        const id = nextId("commitment");
        const item = {
          ...input,
          id,
          message_id: input.message_id ?? null,
          promised_at: input.promised_at ?? null,
          follow_up_at: input.follow_up_at ?? null,
          status: "open" as const,
          version: 1,
          needs_follow_up: false,
          is_overdue: false,
          followed_up_at: null,
        };
        a.commitments.set(id, item);
        a.workKeys.set(key, { signature, id });
        return commitmentView(item);
      }),

    updateCommitment: (s, id, { idempotency_key, ...input }, o) =>
      run("updateCommitment", o, () => {
        const a = workAccount(s);
        const key = `commitment-update:${id}:${idempotency_key}`;
        const signature = JSON.stringify(input);
        const replay = workReplay(a, key, signature);
        const previous = a.commitments.get(id);
        if (!previous) throw new ApiError(404, "not_found", "Không tìm thấy cam kết.");
        if (replay) return commitmentView(previous);
        if (previous.version !== input.expected_version) throw new ApiError(409, "version_conflict", "Cam kết đã thay đổi.");
        const next = { ...previous, version: previous.version + 1 };
        if (input.action === "reopen") next.status = "open";
        else {
          if (previous.status !== "open") throw new ApiError(409, "invalid_input", "Hãy mở lại cam kết trước.");
          if (input.action === "fulfill") next.status = "fulfilled";
          else if (input.action === "cancel") next.status = "cancelled";
          else if (input.action === "mark_followed_up") next.followed_up_at = previous.followed_up_at ?? (decisionClock ?? new Date()).toISOString();
          else if (input.action === "edit" && "fields" in input) {
            Object.assign(next, input.fields);
            if (next.follow_up_at !== previous.follow_up_at) next.followed_up_at = null;
          }
        }
        a.commitments.set(id, next);
        a.workKeys.set(key, { signature, id });
        return commitmentView(next);
      }),

    listTaskChanges: (s, id, o) =>
      run("listTaskChanges", o, () => {
        const a = workAccount(s);
        workTask(a, id);
        return { items: structuredClone(a.workChanges.get(id) ?? []), truncated: false };
      }),

    reviewTaskChange: (s, id, { idempotency_key, expected_task_version, ...review }, o) =>
      run("reviewTaskChange", o, () => {
        const a = workAccount(s);
        const task = workTask(a, id);
        const key = `work-change:${id}:${idempotency_key}`;
        const signature = JSON.stringify({ ...review, expected_task_version });
        if (workReplay(a, key, signature)) return review;
        if (task.version !== expected_task_version) throw new ApiError(409, "version_conflict", "Công việc đã thay đổi.");
        const changes = a.workChanges.get(id) ?? [];
        if (!changes.some((change) => change.id === review.suggestion_id)) throw new ApiError(409, "stale_suggestion", "Gợi ý đã thay đổi.");
        a.workChanges.set(id, changes.filter((change) => change.id !== review.suggestion_id));
        a.workKeys.set(key, { signature, id: review.suggestion_id });
        return review;
      }),

    getWorkBrief: (s, id, o) =>
      run("getWorkBrief", o, () => {
        const a = workAccount(s);
        const task = workTask(a, id);
        const { items: commitments, ...commitmentPage } = briefPage(a, task, s, "commitments");
        const { items: deadline_history, ...historyPage } = briefPage(a, task, s, "deadline_history");
        const { items: sources, ...sourcePage } = briefPage(a, task, s, "sources");
        return structuredClone({
          task,
          commitments,
          changes: a.workChanges.get(id) ?? [],
          deadline_history,
          sources,
          section_pages: { commitments: commitmentPage, deadline_history: historyPage, sources: sourcePage },
          changes_truncated: false,
          truncated: Boolean(commitmentPage.next_cursor || historyPage.next_cursor || sourcePage.next_cursor),
        });
      }),

    getWorkBriefSection: (s, id, section, p, o) =>
      run("getWorkBriefSection", o, () => {
        const a = workAccount(s);
        return briefPage(a, workTask(a, id), s, section, p.cursor, p.limit);
      }),

    previewCapacity: (s, input, o) =>
      run("previewCapacity", o, () => {
        const a = workAccount(s);
        const asOf = Date.parse(input.as_of);
        const windows = input.windows.map((window) => ({ start: Date.parse(window.start), end: Date.parse(window.end) }))
          .sort((left, right) => left.start - right.start);
        if (!windows.length || !Number.isFinite(asOf) || windows.some((window, index) =>
          !Number.isFinite(window.start) || !Number.isFinite(window.end) ||
          window.start < asOf || window.end <= window.start || window.end - asOf > 14 * 86_400_000 ||
          (index > 0 && window.start < windows[index - 1].end))) {
          throw new ApiError(422, "invalid_input", "Các khoảng rảnh phải hợp lệ, trong 14 ngày và không chồng nhau.");
        }
        const available_minutes = windows.reduce((sum, window) => sum + Math.floor((window.end - window.start) / 60_000), 0);
        const overrides = new Map(input.overrides?.map((override) => [override.task_id, override]));
        const excluded: CapacityResult["excluded"] = [];
        const candidates = input.task_ids.flatMap((id) => {
          const task = workTask(a, id);
          const override = overrides.get(id);
          const deadline = override?.deadline ?? task.deadline_effective;
          const estimate = override?.estimated_minutes ?? task.estimated_minutes;
          let reason: CapacityExclusion | null = null;
          if (task.state === "waiting" || task.state === "done" || task.state === "cancelled") reason = task.state;
          else if (deadline && Date.parse(deadline) <= asOf) reason = "deadline_passed";
          else if (!deadline && !estimate) reason = "missing_estimate_and_deadline";
          else if (!deadline) reason = "missing_deadline";
          else if (!estimate) reason = "missing_estimate";
          if (reason) {
            excluded.push({ task_id: id, reason });
            return [];
          }
          return [{ task_id: id, task_version: task.version, deadline: deadline!, estimated_minutes: estimate! }];
        }).sort((l, r) => Date.parse(l.deadline) - Date.parse(r.deadline) || l.task_id.localeCompare(r.task_id));
        const horizon_end = new Date(windows[windows.length - 1].end).toISOString();
        const allocations = candidates.map((candidate) => {
          let remaining = candidate.estimated_minutes;
          const deadline = Date.parse(candidate.deadline);
          const blocks = windows.flatMap((window) => {
            const minutes = Math.min(remaining, Math.floor((Math.min(window.end, deadline) - window.start) / 60_000));
            if (minutes <= 0) return [];
            const start = new Date(window.start).toISOString();
            window.start += minutes * 60_000;
            remaining -= minutes;
            return [{ start, end: new Date(window.start).toISOString(), minutes }];
          });
          return { ...candidate, blocks, allocated_minutes: candidate.estimated_minutes - remaining, unallocated_minutes: remaining };
        });
        return {
          as_of: input.as_of,
          horizon_end,
          available_minutes,
          allocated_minutes: allocations.reduce((sum, item) => sum + item.allocated_minutes, 0),
          allocations,
          excluded,
        };
      }),

    previewDecisions: (wsId, input: DecisionPreviewRequest, o) =>
      run("previewDecisions", o, () => {
        if (wsId !== workspaceId) {
          throw new ApiError(404, "not_found", "Không tìm thấy workspace");
        }
        if (!Array.isArray(input.account_ids) || input.account_ids.length < 1 || input.account_ids.length > 8) {
          throw new ApiError(422, "invalid_input", "Vui lòng chọn từ 1 đến 8 tài khoản.");
        }

        const items: DecisionItem[] = [];
        for (const accId of input.account_ids) {
          const acc = accounts.get(accId);
          if (!acc) {
            throw new ApiError(404, "not_found", `Không tìm thấy tài khoản: ${accId}`);
          }
          if (acc.deletionState?.status === "succeeded") {
            throw new ApiError(409, "account_data_deleted", "Tài khoản đã bị xóa dữ liệu cục bộ.");
          }

          for (const task of acc.tasks.values()) {
            let eventAt = task.created_at;
            let sourceType = acc.view.kind;
            const linked = acc.messages.filter((m) => task.message_ids.includes(m.id));
            if (linked.length > 0) {
              linked.sort((x, y) => (y.received_at ?? "").localeCompare(x.received_at ?? "") || x.id.localeCompare(y.id));
              eventAt = linked[0].received_at ?? task.created_at;
            }

            items.push({
              ref: { account_id: accId, task_id: task.id },
              title: task.title,
              state: task.state,
              owner: task.owner,
              importance: task.importance,
              deadline: task.deadline_effective,
              event_at: eventAt,
              source_type: sourceType,
            });
          }
        }

        if (items.length > 500) {
          throw new ApiError(422, "decision_input_too_large", "Số lượng công việc vượt quá 500.");
        }

        try {
          return evaluateDecisions(items, {
            policy: input.policy,
            context: input.context,
            now: decisionClock ?? new Date(),
          });
        } catch (err: unknown) {
          throw new ApiError(422, "invalid_input", err instanceof Error ? err.message : "Tham số không hợp lệ.");
        }
      }),

    getGmailSyncState: (s, o) =>
      run("getGmailSyncState", o, () => {
        const a = acct(s);
        if (a.view.kind !== "gmail") throw new ApiError(422, "sync_not_supported", "Chỉ Gmail thật có trạng thái đồng bộ.");
        if (a.deletionState?.status === "succeeded") {
          throw new ApiError(409, "account_data_deleted", "Dữ liệu cục bộ của tài khoản đã bị xóa.");
        }
        const status = a.view.status === "disconnected" ? "disconnected" : a.sync.status;
        return structuredClone({
          ...a.sync,
          status,
          consent_required: a.view.kind === "gmail" && status !== "disconnected"
            && a.view.gmail_sync_confirmed === false,
        });
      }),
  };

  const controls: MockControls = {
    hold(method) {
      let release!: () => void;
      holds.set(method, new Promise<void>((r) => (release = r)));
      return () => {
        holds.delete(method);
        release();
      };
    },
    setBackendDown(down) {
      backendDown = down;
    },
    failNextImport(message = "Không đọc được email này") {
      failNextImportMessage = message;
    },
    failNextSync(message = "Đồng bộ giả lập thất bại") {
      failNextSyncMessage = message;
    },
    bumpMessageRevision(accountId, messageId) {
      const m = accounts.get(accountId)?.messages.find((x) => x.id === messageId);
      if (m) m.body_revision += 1;
    },
    bumpTaskVersion(accountId, taskId) {
      const t = accounts.get(accountId)?.tasks.get(taskId);
      if (t) t.version += 1;
    },
    removeMessage(accountId, messageId) {
      const a = accounts.get(accountId);
      if (a) a.messages = a.messages.filter((m) => m.id !== messageId);
    },
    setOAuthOutcome(accountId, attemptId, status, error = null) {
      const a = accounts.get(accountId);
      const attempt = a?.oauthAttempts.get(attemptId);
      if (attempt) {
        attempt.status = status;
        attempt.error = error;
        if (status === "connected") {
          a!.view.status = "connected";
          a!.sync = { ...a!.sync, status: "idle", error: null };
        }
      }
    },
    setDeletionOutcome(accountId, status, phase = "completed") {
      const a = accounts.get(accountId);
      if (a && a.deletionState) {
        a.deletionState.status = status;
        a.deletionState.phase = phase;
      }
    },
    setDecisionClock(now) {
      decisionClock = now;
    },
    bumpSyncDataVersion(accountId) {
      const a = accounts.get(accountId);
      if (a) a.sync = { ...a.sync, data_version: a.sync.data_version + 1, last_success_at: new Date().toISOString() };
    },
    setGmailSyncState(accountId, patch) {
      const a = accounts.get(accountId);
      if (a) a.sync = { ...a.sync, ...patch };
    },
    setAnalysisConfigured(configured) {
      analysisConfigured = configured;
    },
    failNextAnalysis(code, message = "Dịch vụ phân tích chưa trả lời.") {
      failNextAnalysisWith = { code, message };
    },
    calls,
  };

  return Object.assign(client, { controls });
}
