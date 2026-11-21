import type { ApiTransport } from "../platform/transport";
import { HttpError } from "../platform/transport";
import type { AccountScope, JsonValue } from "./types";
import type { GmailSyncApi } from "./gmailSync";

export type { ApiClient, RequestOptions } from "./types";
import type { ApiClient, RequestOptions } from "./types";

export type ApiMethodName = keyof ApiClient | keyof GmailSyncApi;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, JsonValue>;
  readonly requestId: string | null;
  readonly request_id: string | null;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, JsonValue> = {},
    requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.request_id = requestId;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isGone(): boolean {
    return this.status === 404 || this.status === 410;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError") ||
    (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "AbortError")
  );
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof HttpError) {
    const data = err.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "object" &&
      (data as { error: unknown }).error !== null
    ) {
      const envelope = data as {
        error: { code?: unknown; message?: unknown; details?: unknown };
        request_id?: unknown;
      };
      const code = typeof envelope.error.code === "string" ? envelope.error.code : "http_error";
      const message = typeof envelope.error.message === "string" ? envelope.error.message : `HTTP ${err.status}`;
      const details =
        typeof envelope.error.details === "object" && envelope.error.details !== null && !Array.isArray(envelope.error.details)
          ? (envelope.error.details as Record<string, JsonValue>)
          : {};
      const requestId = typeof envelope.request_id === "string" ? envelope.request_id : null;
      return new ApiError(err.status, code, message, details, requestId);
    }
    return new ApiError(err.status, "http_error", `Backend trả lỗi HTTP ${err.status}.`, {}, null);
  }
  return new ApiError(0, "network_error", "Không thể kết nối đến máy chủ.", {}, null);
}

// ---- scope + cache keys ------------------------------------------------------

export function scopeKey(scope: AccountScope): string {
  return `${scope.workspace_id}/${scope.account_id}`;
}

/** Every cache/request key MUST start with the scope so accounts never mix. */
export function queryKey(scope: AccountScope, ...parts: Array<string | number | null | undefined>): string {
  return [scopeKey(scope), ...parts.map((p) => (p == null ? "" : String(p)))].join("|");
}

// ---- HTTP adapter ------------------------------------------------------------

const base = (s: AccountScope) =>
  `/api/v1/workspaces/${encodeURIComponent(s.workspace_id)}/accounts/${encodeURIComponent(s.account_id)}`;
const ws = (id: string) => `/api/v1/workspaces/${encodeURIComponent(id)}`;
const seg = encodeURIComponent;
const assistant = (s: AccountScope) => `${base(s)}/work-assistant`;
const assistantTask = (s: AccountScope, id: string) => `${assistant(s)}/tasks/${seg(id)}`;

export const ROUTES = {
  health: () => `/health`,
  accounts: (workspaceId: string) => `${ws(workspaceId)}/accounts`,
  sync: (s: AccountScope) => `${base(s)}/sync`,
  syncState: (s: AccountScope) => `${base(s)}/sync-state`,
  syncConsent: (s: AccountScope) => `${base(s)}/sync-consent`,
  disconnect: (s: AccountScope) => `${base(s)}/disconnect`,
  importEml: (s: AccountScope) => `${base(s)}/imports`,
  job: (s: AccountScope, id: string) => `${base(s)}/jobs/${seg(id)}`,
  cancelJob: (s: AccountScope, id: string) => `${base(s)}/jobs/${seg(id)}/cancel`,
  messages: (s: AccountScope) => `${base(s)}/messages`,
  searchMessages: (s: AccountScope) => `${base(s)}/search`,
  message: (s: AccountScope, id: string) => `${base(s)}/messages/${seg(id)}`,
  startAnalysis: (s: AccountScope, messageId: string) => `${base(s)}/messages/${seg(messageId)}/analyses`,
  latestAnalysis: (s: AccountScope, messageId: string) => `${base(s)}/messages/${seg(messageId)}/analyses/latest`,
  // Domain router: everything, including the idempotency key, travels in the JSON body.
  confirm: (s: AccountScope) => `${base(s)}/tasks/from-candidate`,
  tasks: (s: AccountScope) => `${base(s)}/tasks`,
  task: (s: AccountScope, id: string) => `${base(s)}/tasks/${seg(id)}`,
  evidence: (s: AccountScope, id: string) => `${base(s)}/evidence/${seg(id)}`,
  // W02 routes
  confirmDeadline: (s: AccountScope, id: string) => `${base(s)}/tasks/${seg(id)}/deadline`,
  deadlineHistory: (s: AccountScope, id: string) => `${base(s)}/tasks/${seg(id)}/deadline-history`,
  linkTaskMessage: (s: AccountScope, id: string) => `${base(s)}/tasks/${seg(id)}/messages/link`,
  unlinkTaskMessage: (s: AccountScope, id: string) => `${base(s)}/tasks/${seg(id)}/messages/unlink`,
  startOAuth: (s: AccountScope) => `${base(s)}/oauth/start`,
  oauthAttempt: (s: AccountScope, id: string) => `${base(s)}/oauth/attempts/${seg(id)}`,
  cancelOAuth: (s: AccountScope, id: string) => `${base(s)}/oauth/attempts/${seg(id)}/cancel`,
  deleteLocal: (s: AccountScope) => `${base(s)}/delete-local`,
  decisionPreview: (workspaceId: string) => `${ws(workspaceId)}/decision-preview`,
  commitments: (s: AccountScope) => `${assistant(s)}/commitments`,
  commitment: (s: AccountScope, id: string) => `${assistant(s)}/commitments/${seg(id)}`,
  taskChanges: (s: AccountScope, id: string) => `${assistantTask(s, id)}/changes`,
  reviewTaskChange: (s: AccountScope, id: string) => `${assistantTask(s, id)}/changes/review`,
  workBrief: (s: AccountScope, id: string) => `${assistantTask(s, id)}/brief`,
  workBriefSection: (s: AccountScope, id: string, section: string) =>
    `${assistantTask(s, id)}/brief/sections/${seg(section)}`,
  capacity: (s: AccountScope) => `${assistant(s)}/capacity`,
} as const;

function qs(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface HttpClientDeps {
  transport: ApiTransport;
}

export function createHttpClient({ transport }: HttpClientDeps): ApiClient & GmailSyncApi {
  async function request<T>(
    path: string,
    method: string,
    opts: RequestOptions | undefined,
    extra: {
      body?: BodyInit;
      json?: unknown;
      idempotencyKey?: string;
      nullOn404?: boolean;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (extra.idempotencyKey) {
      headers["Idempotency-Key"] = extra.idempotencyKey;
    }
    let body = extra.body;
    if (extra.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(extra.json);
    }
    try {
      return await transport.request<T>(path, {
        method,
        headers,
        body,
        signal: opts?.signal,
      });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw err;
      }
      const apiErr = toApiError(err);
      if (extra.nullOn404 && apiErr.status === 404) {
        return null as T;
      }
      throw apiErr;
    }
  }

  const get = <T>(path: string, opts?: RequestOptions) => request<T>(path, "GET", opts);

  return {
    productRequest: <T>(scope: AccountScope, path: string, method = "GET", body?: unknown, signal?: AbortSignal) => {
      if (!path.startsWith("/") || path.startsWith("//") || path.split(/[/?]/).includes("..")) {
        return Promise.reject(new ApiError(422, "invalid_input", "Đường dẫn chức năng không hợp lệ."));
      }
      return request<T>(base(scope) + "/productivity" + path, method, { signal }, { json: body });
    },
    getHealth: (o) => get(ROUTES.health(), o),
    listAccounts: (w, o) => get(ROUTES.accounts(w), o),
    createAccount: (w, input, o) => request(ROUTES.accounts(w), "POST", o, { json: input }),
    syncAccount: (s, key, o) => request(ROUTES.sync(s), "POST", o, { idempotencyKey: key }),
    getGmailSyncState: (s, o) => get(ROUTES.syncState(s), o),
    disconnectAccount: (s, o) => request(ROUTES.disconnect(s), "POST", o),
    confirmGmailSync: (s, o) => request(ROUTES.syncConsent(s), "POST", o),

    importEml: (s, file, key, o) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return request(ROUTES.importEml(s), "POST", o, { body: form, idempotencyKey: key });
    },
    getJob: (s, id, o) => get(ROUTES.job(s, id), o),
    cancelJob: (s, id, o) => request(ROUTES.cancelJob(s, id), "POST", o),

    listMessages: (s, p, o) => get(`${ROUTES.messages(s)}${qs({ cursor: p.cursor, limit: p.limit })}`, o),
    searchMessages: (s, p, o) =>
      get(
        `${ROUTES.searchMessages(s)}${qs({
          q: p.q,
          sender: p.sender,
          mailbox: p.mailbox,
          from: p.from,
          to: p.to,
          cursor: p.cursor,
          limit: p.limit,
        })}`,
        o,
      ),
    getMessage: (s, id, o) => get(ROUTES.message(s, id), o),

    startAnalysis: (s, messageId, key, o) =>
      request(ROUTES.startAnalysis(s, messageId), "POST", o, { idempotencyKey: key }),
    getLatestAnalysis: (s, messageId, o) =>
      request(ROUTES.latestAnalysis(s, messageId), "GET", o, { nullOn404: true }),
    confirmCandidate: (s, input, o) =>
      request(ROUTES.confirm(s), "POST", o, {
        json: {
          candidate_id: input.candidate_id,
          overrides: input.overrides ?? {},
          idempotency_key: input.idempotency_key,
        },
      }),

    listTasks: (s, p, o) =>
      get(
        `${ROUTES.tasks(s)}${qs({
          state: p.state,
          state_group: p.state_group,
          owner: p.owner,
          importance: p.importance,
          search_query: p.search_query,
          deadline_from: p.deadline_from,
          deadline_to: p.deadline_to,
          cursor: p.cursor,
          limit: p.limit,
        })}`,
        o,
      ),
    getTask: (s, id, o) => get(ROUTES.task(s, id), o),
    getTaskOverview: (w, accountId, filters, o) => get(
      `/api/v1/workspaces/${encodeURIComponent(w)}/task-overview${qs({
        account_id:accountId, owner:filters.owner, importance:filters.importance,
        search_query:filters.search_query, deadline_from:filters.deadline_from,
        deadline_to:filters.deadline_to,
      })}`, o,
    ),
    createManualTask: (s, input, o) => request(ROUTES.tasks(s), "POST", o, { json: input }),
    updateTask: (s, id, input, o) => request(ROUTES.task(s, id), "PATCH", o, { json: input }),

    getEvidence: (s, id, o) => get(ROUTES.evidence(s, id), o),

    // W02 methods
    confirmTaskDeadline: (s, id, input, o) =>
      request(ROUTES.confirmDeadline(s, id), "POST", o, { json: input }),

    listDeadlineHistory: (s, id, p, o) =>
      get(`${ROUTES.deadlineHistory(s, id)}${qs({ cursor: p.cursor, limit: p.limit })}`, o),

    linkTaskMessage: (s, id, input, o) =>
      request(ROUTES.linkTaskMessage(s, id), "POST", o, { json: input }),

    unlinkTaskMessage: (s, id, input, o) =>
      request(ROUTES.unlinkTaskMessage(s, id), "POST", o, { json: input }),

    startGmailOAuth: (s, key, o) =>
      request(ROUTES.startOAuth(s), "POST", o, { json: {}, idempotencyKey: key }),

    getGmailOAuthAttempt: (s, id, o) =>
      get(ROUTES.oauthAttempt(s, id), o),

    cancelGmailOAuth: (s, id, o) =>
      request(ROUTES.cancelOAuth(s, id), "POST", o, { json: {} }),

    deleteLocalAccountData: (s, key, o) =>
      request(ROUTES.deleteLocal(s), "POST", o, { json: { idempotency_key: key } }),

    getAccountDeletion: (s, o) =>
      get(ROUTES.deleteLocal(s), o),

    previewDecisions: (workspaceId, input, o) =>
      request(ROUTES.decisionPreview(workspaceId), "POST", o, { json: input }),
    listCommitments: (s, taskId, o) => get(`${ROUTES.commitments(s)}${qs({ task_id: taskId })}`, o),
    createCommitment: (s, input, o) => request(ROUTES.commitments(s), "POST", o, { json: input }),
    updateCommitment: (s, id, input, o) => request(ROUTES.commitment(s, id), "PATCH", o, { json: input }),
    listTaskChanges: (s, id, o) => get(ROUTES.taskChanges(s, id), o),
    reviewTaskChange: (s, id, input, o) => request(ROUTES.reviewTaskChange(s, id), "POST", o, { json: input }),
    getWorkBrief: (s, id, o) => get(ROUTES.workBrief(s, id), o),
    getWorkBriefSection: (s, id, section, p, o) =>
      get(`${ROUTES.workBriefSection(s, id, section)}${qs({ cursor: p.cursor, limit: p.limit })}`, o),
    previewCapacity: (s, input, o) => request(ROUTES.capacity(s), "POST", o, { json: input }),
  };
}
