import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ApiClient } from "../../api/client";
import { isApiError } from "../../api/client";
import type {
  AccountScope,
  ConfirmDeadlineRequest,
  DeadlineHistoryEntryView,
  Importance,
  MessageView,
  TaskPatch,
  TaskMessageMutationRequest,
  TaskState,
  TaskView,
} from "../../api/types";
import { ErrorBox, Loading, errorMessage, isAccountFenced } from "../../components/StatusViews";
import { t } from "../../strings";
import { useStoredState, useUiSession } from "../../uiSession";
import { scopeKey } from "../../api/client";
import { newIdempotencyKey } from "../../lib/poll";
import { Button } from "../../components/upstream/circle/button";
import { Input } from "../../components/upstream/circle/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/upstream/circle/dialog";
import { ArrowUpRight, CalendarDays, History, Mail, Plus } from "lucide-react";
import { useScopedResource } from "../../api/useScopedResource";
import { formatLocalDate } from "../workflowDate";

function TaskField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="workflow-field"><label htmlFor={id}>{label}</label>{children}</div>;
}

function LinkedEmail({ client, scope, messageId, onOpen, onRemove, busy }: {
  client: ApiClient; scope: AccountScope; messageId: string; onOpen?: () => void; onRemove: () => void; busy: boolean;
}) {
  const message = useScopedResource(scope, ["message", messageId], signal => client.getMessage(scope, messageId, { signal }));
  const subject = message.data?.subject || (message.loading ? "Đang tải email…" : message.error ? "Email nguồn không còn mở được" : "Email không có tiêu đề");
  return (
    <li className="workflow-email" data-message-id={messageId}>
      <span><strong>{subject}</strong>{message.data?.sender && <small>{message.data.sender}</small>}</span>
      <div className="workflow-button-row">
        {onOpen && !message.error && <Button type="button" variant="outline" size="xs" aria-label={`Mở email: ${subject}`} onClick={onOpen}>Mở email <ArrowUpRight size={14} /></Button>}
        <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={onRemove}>{t.tasks.unlinkMessage}</Button>
      </div>
    </li>
  );
}

const STATES: TaskState[] = ["not_started", "in_progress", "waiting", "done", "cancelled"];
const IMPORTANCES: Importance[] = ["low", "normal", "high"];

interface Props {
  client: ApiClient;
  scope: AccountScope;
  task: TaskView;
  onSaved?: (task: TaskView) => void;
  onOpenMessage?: (messageId: string) => void;
  onOpenEvidence?: (evidenceId: string) => void;
}

interface Draft {
  state: TaskState;
  owner: string;
  estimate: string;
  importance: Importance;
}

const toDraft = (task: TaskView): Draft => ({
  state: task.state,
  owner: task.owner ?? "",
  estimate: task.estimated_minutes === null ? "" : String(task.estimated_minutes),
  importance: task.importance,
});

type Result =
  | { kind: "idle" }
  | { kind: "saved" }
  | { kind: "conflict" }
  | { kind: "error"; error: unknown }
  | { kind: "uncertain"; error: unknown };

type RelatedIntent =
  | { kind: "deadline"; request: ConfirmDeadlineRequest }
  | { kind: "link" | "unlink"; request: TaskMessageMutationRequest };

type RelatedFeedback = { kind: "success" | "conflict" | "error"; message: string };

function newDeadlineDraft(deadline: string | null) {
  const offset = formatOffset(-(deadline ? new Date(deadline) : new Date()).getTimezoneOffset());
  const input = toDatetimeInput(deadline, offset);
  return { open: false, input, offset, initialInput: input, initialOffset: offset, reason: "", evidenceId: null as string | null };
}

/** Validation, missing task and cleanup fences explain themselves; anything else is retryable. */
function saveFailureText(error: unknown): string {
  if (isApiError(error) && (isAccountFenced(error) || error.status === 404)) {
    return isAccountFenced(error) ? errorMessage(error) : t.tasks.taskUnavailable;
  }
  if (isApiError(error) && (error.status === 400 || error.status === 422)) return errorMessage(error);
  if (error instanceof Error && !isApiError(error)) return error.message;
  return "Chưa lưu được công việc. Hãy thử lại.";
}

export function parseEstimate(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

function formatOffset(minutes: number): string {
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function offsetMinutes(offset: string): number | null {
  const parts = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!parts) return null;
  const hours = Number(parts[2]), minutes = Number(parts[3]);
  if (hours > 23 || minutes > 59) return null;
  return (parts[1] === "-" ? -1 : 1) * (hours * 60 + minutes);
}

function toDatetimeInput(isoStr: string | null, offset: string): string {
  if (!isoStr) return "";
  const minutes = offsetMinutes(offset);
  if (minutes === null) return "";
  const d = new Date(new Date(isoStr).getTime() + minutes * 60000);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function resolveDeadlineInput(input: string, offset: string, current: string | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input) || offsetMinutes(offset) === null) return null;
  const date = new Date(`${input}:00${offset}`);
  if (Number.isNaN(date.getTime()) || toDatetimeInput(date.toISOString(), offset) !== input) return null;
  // The form uses minute precision. Keep any confirmed seconds when the date was not edited.
  if (current && input === toDatetimeInput(current, offset)) return new Date(current).toISOString();
  return date.toISOString();
}

export function TaskEditor({ client, scope, task, onSaved, onOpenMessage, onOpenEvidence }: Props) {
  const session = useUiSession();
  const [{ base, draft }, setForm] = useStoredState(
    `task:${scopeKey(scope)}:${task.id}`,
    () => ({ base: task, draft: toDraft(task) }),
    (v) => JSON.stringify(v.draft) !== JSON.stringify(toDraft(v.base)),
  );
  const setDraft = (next: Draft | ((previous: Draft) => Draft)) =>
    setForm((v) => ({ ...v, draft: typeof next === "function" ? next(v.draft) : next }));

  const controller = useRef<AbortController | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  const pickerRequest = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      historyRequest.current?.abort();
      pickerRequest.current?.abort();
    };
  }, []);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // W02 Deadline state
  const [deadlineDraft, setDeadlineDraft] = useStoredState(
    `deadline-draft:${scopeKey(scope)}:${task.id}`,
    () => newDeadlineDraft(base.deadline_effective),
    (value) => Boolean(value.reason || value.evidenceId || value.input !== value.initialInput || value.offset !== value.initialOffset),
  );
  const [relatedIntent, setRelatedIntent] = useStoredState<RelatedIntent | null>(
    `task-related-intent:${scopeKey(scope)}:${task.id}`, null, (intent) => intent !== null,
  );
  const [relatedBusy, setRelatedBusy] = useState(false);
  const [deadlineFeedback, setDeadlineFeedback] = useState<RelatedFeedback | null>(null);

  // W02 Deadline History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [historyItems, setHistoryItems] = useState<DeadlineHistoryEntryView[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);

  // W02 Link / Unlink message state
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [pickerStatus, setPickerStatus] = useState<"loading" | "ready" | "error">("ready");
  const [availableMessages, setAvailableMessages] = useState<MessageView[]>([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [pickerCursor, setPickerCursor] = useState<string | null>(null);
  const [linkingFeedback, setLinkingFeedback] = useState<RelatedFeedback | null>(null);

  const scopedMessageQuery = messageSearch.trim();
  useEffect(() => {
    if (!linkPickerOpen) return;
    void loadLinkMessages(scopedMessageQuery);
    return () => pickerRequest.current?.abort();
  }, [client, scope.workspace_id, scope.account_id, linkPickerOpen, scopedMessageQuery]);

  useEffect(() => {
    if (result.kind !== "idle" || estimateError) feedbackRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [result, estimateError]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setResult((r) => (r.kind === "conflict" ? r : { kind: "idle" }));
    setHint(null);
    if (key === "estimate") setEstimateError(null);
  };

  async function save() {
    const estimate = parseEstimate(draft.estimate);
    if (estimate === undefined) {
      setEstimateError(t.tasks.estimateInvalid);
      return;
    }
    const patch: TaskPatch = {};
    if (draft.state !== base.state) patch.state = draft.state;
    const owner = draft.owner.trim() === "" ? null : draft.owner.trim();
    if (owner !== base.owner) patch.owner = owner;
    if (estimate !== base.estimated_minutes) patch.estimated_minutes = estimate;
    if (draft.importance !== base.importance) patch.importance = draft.importance;
    if (Object.keys(patch).length === 0) {
      setHint(t.tasks.noChanges);
      return;
    }
    if (busy || session.memory.pending) return;
    if (owner !== null && Array.from(owner).length > 200) {
      setResult({ kind: "error", error: new Error("Người phụ trách tối đa 200 ký tự.") });
      return;
    }
    setBusy(true);
    const release = session.beginMutation();
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (result.kind === "uncertain") {
        const current = await client.getTask(scope, base.id, { signal: abort.signal });
        if (current.version !== base.version) {
          if (alive.current) setResult({ kind: "conflict" });
          return;
        }
      }
      const saved = await client.updateTask(scope, base.id, { expected_version: base.version, patch }, { signal: abort.signal });
      if (!alive.current || abort.signal.aborted) return;
      setForm({ base: saved, draft: toDraft(saved) });
      setResult({ kind: "saved" });
      onSaved?.(saved);
    } catch (error) {
      if (alive.current && !abort.signal.aborted) {
        setResult(
          isApiError(error) && error.code === "version_conflict"
            ? { kind: "conflict" }
            : isApiError(error) && error.status === 0
            ? { kind: "uncertain", error }
            : { kind: "error", error },
        );
      }
    } finally {
      release();
      if (alive.current) setBusy(false);
    }
  }

  async function reloadLatest() {
    if (!await session.confirmDiscard("Tải bản mới sẽ bỏ các chỉnh sửa chưa lưu của công việc này.")) return;
    if (!alive.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const fresh = await client.getTask(scope, base.id, { signal: abort.signal });
      if (!alive.current) return;
      setForm({ base: fresh, draft: toDraft(fresh) });
      setDeadlineDraft(newDeadlineDraft(fresh.deadline_effective));
      setRelatedIntent(null);
      setResult({ kind: "idle" });
      setDeadlineFeedback(null);
      setLinkingFeedback(null);
      onSaved?.(fresh);
    } catch (error) {
      if (alive.current && !abort.signal.aborted) setResult({ kind: "error", error });
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  // W02 Deadline Actions
  function acceptRelatedChange(updated: TaskView) {
    setForm(current => {
      const previous = toDraft(current.base);
      const next = toDraft(updated);
      const pending = current.draft;
      return {
        base: updated,
        draft: {
          state: pending.state === previous.state ? next.state : pending.state,
          owner: pending.owner === previous.owner ? next.owner : pending.owner,
          estimate: pending.estimate === previous.estimate ? next.estimate : pending.estimate,
          importance: pending.importance === previous.importance ? next.importance : pending.importance,
        },
      };
    });
    onSaved?.(updated);
  }

  function handleConfirmDeadline(clear = false) {
    if (relatedIntent || session.memory.pending) return;
    const trimmedReason = deadlineDraft.reason.trim();
    if (!trimmedReason || Array.from(trimmedReason).length > 500) {
      setDeadlineFeedback({ kind: "error", message: t.tasks.reasonRequired });
      return;
    }

    if (!clear && !deadlineIso) {
      setDeadlineFeedback({ kind: "error", message: "Hãy chọn ngày và giờ hợp lệ cho hạn chót." });
      return;
    }
    const evidenceId = clear ? null : deadlineDraft.evidenceId;
    void submitRelated({ kind: "deadline", request: {
      deadline: clear ? null : deadlineIso,
      source_kind: evidenceId ? "evidence" : "manual",
      reason: trimmedReason,
      evidence_id: evidenceId,
      expected_version: base.version,
      idempotency_key: newIdempotencyKey(),
    } });
  }

  async function submitRelated(intent: RelatedIntent) {
    if (session.memory.pending) return;
    const setFeedback = intent.kind === "deadline" ? setDeadlineFeedback : setLinkingFeedback;
    setFeedback(null);
    setRelatedIntent(intent);
    setRelatedBusy(true);
    const release = session.beginMutation();
    const abort = new AbortController();
    controller.current = abort;
    const options = { signal: abort.signal };
    try {
      const updated = intent.kind === "deadline"
        ? await client.confirmTaskDeadline(scope, base.id, intent.request, options)
        : intent.kind === "link"
          ? await client.linkTaskMessage(scope, base.id, intent.request, options)
          : await client.unlinkTaskMessage(scope, base.id, intent.request, options);
      if (!alive.current || abort.signal.aborted) return;
      acceptRelatedChange(updated);
      setRelatedIntent(null);
      if (intent.kind === "deadline") {
        const message = intent.request.deadline === null ? t.tasks.deadlineCleared : t.tasks.deadlineConfirmed;
        setDeadlineFeedback({ kind: "success", message });
        setDeadlineDraft(newDeadlineDraft(updated.deadline_effective));
      }
      if (intent.kind === "link") setLinkPickerOpen(false);
    } catch (error) {
      if (!alive.current || abort.signal.aborted) return;
      if (!isApiError(error) || error.status === 0 || error.status >= 500) return;
      setRelatedIntent(null);
      if (isAccountFenced(error)) {
        setFeedback({ kind: "error", message: errorMessage(error) });
        return;
      }
      if (error.code === "version_conflict" || error.code === "idempotency_conflict") {
        const message = error.code === "version_conflict" ? t.tasks.conflict
          : "Yêu cầu đã được sử dụng với nội dung khác. Hãy tải bản mới trước khi sửa tiếp.";
        setFeedback({ kind: "conflict", message });
        return;
      }
      const specific: Record<string, string> = {
        origin_link_required: t.tasks.originLinkRequired,
        source_link_in_use: t.tasks.sourceLinkInUse,
        invalid_revision: "Nội dung email đã thay đổi. Hãy đọc lại nguồn rồi chọn đoạn trích.",
        source_not_linked: "Hãy liên kết email nguồn với công việc trước khi dùng đoạn trích này.",
        invalid_deadline_source: "Ngày giờ hoặc đoạn trích không phù hợp với hạn chót này.",
      };
      const fallback = error.status === 404
        ? intent.kind === "deadline" ? t.tasks.taskUnavailable : errorMessage(error)
        : error.status === 400 || error.status === 422
          ? errorMessage(error)
          : "Chưa thực hiện được thao tác. Hãy kiểm tra lại dữ liệu.";
      setFeedback({ kind: "error", message: specific[error.code] ?? fallback });
    } finally {
      release();
      if (alive.current) setRelatedBusy(false);
    }
  }

  function openHistory() {
    setHistoryOpen(true);
    void loadHistory();
  }

  async function loadHistory(cursor?: string) {
    historyRequest.current?.abort();
    const abort = new AbortController();
    historyRequest.current = abort;
    setHistoryLoading(true);
    setHistoryError(null);
    if (!cursor) {
      setHistoryItems([]);
      setHistoryCursor(null);
    }
    try {
      const page = await client.listDeadlineHistory(scope, base.id, { limit: 50, cursor }, { signal: abort.signal });
      if (abort.signal.aborted) return;
      setHistoryItems(current => cursor
        ? [...current, ...page.items.filter(item => !current.some(previous => previous.id === item.id))]
        : page.items);
      setHistoryCursor(page.next_cursor);
    } catch (error) {
      if (!abort.signal.aborted) setHistoryError(error);
    } finally {
      if (!abort.signal.aborted) setHistoryLoading(false);
    }
  }

  function changeLink(kind: "link" | "unlink", messageId: string) {
    if (relatedIntent || session.memory.pending) return;
    void submitRelated({ kind, request: {
      message_id: messageId,
      expected_version: base.version,
      idempotency_key: newIdempotencyKey(),
    } });
  }

  function openLinkPicker() {
    setAvailableMessages([]);
    setPickerCursor(null);
    setMessageSearch("");
    setLinkingFeedback(null);
    setLinkPickerOpen(true);
  }

  async function loadLinkMessages(query: string, cursor?: string) {
    pickerRequest.current?.abort();
    const abort = new AbortController();
    pickerRequest.current = abort;
    setPickerStatus("loading");
    if (!cursor) {
      setAvailableMessages([]);
      setPickerCursor(null);
    }
    try {
      const params = { limit: 30, cursor };
      const options = { signal: abort.signal };
      const page = query ? await client.searchMessages(scope, { ...params, q: query }, options)
        : await client.listMessages(scope, params, options);
      if (abort.signal.aborted) return;
      setAvailableMessages(current => cursor
        ? [...current, ...page.items.filter(item => !current.some(previous => previous.id === item.id))]
        : page.items);
      setPickerCursor(page.next_cursor);
      setPickerStatus("ready");
    } catch {
      if (!abort.signal.aborted) setPickerStatus("error");
    }
  }

  const id = `task-${base.id}`;
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(base));
  const matchedMessages = availableMessages.filter(message => !base.message_ids.includes(message.id));
  const deadlineIso = resolveDeadlineInput(deadlineDraft.input, deadlineDraft.offset, base.deadline_effective);
  const blocked = busy || relatedBusy || relatedIntent !== null;
  const retryRelated = relatedIntent && <div role="alert" className="workflow-notice">
    <p>Chưa xác nhận được kết quả. Có thể thử lại yêu cầu vừa gửi hoặc tải bản mới.</p>
    <div className="workflow-button-row">
      <Button type="button" size="sm" disabled={busy || relatedBusy} onClick={() => void submitRelated(relatedIntent)}>Thử lại yêu cầu</Button>
      <Button type="button" variant="outline" size="sm" disabled={busy || relatedBusy} onClick={() => void reloadLatest()}>{t.tasks.conflictReload}</Button>
    </div>
  </div>;

  return (
    <form className="workflow-task" aria-label={base.title} onSubmit={event => {
      event.preventDefault();
      if (!blocked) void save();
    }}>
      <header className="workflow-task-heading">
        <span className="workflow-pill">{t.tasks.states[base.state]}</span>
        <h3>{base.title}</h3>
        <p>{base.owner ? `Phụ trách · ${base.owner}` : "Chưa có người phụ trách"}</p>
      </header>

      <section className="workflow-deadline" aria-label="Hạn chót">
        <div className="workflow-deadline-bar">
          <span className="workflow-icon workflow-icon-small"><CalendarDays size={20} aria-hidden="true" /></span>
          <div className="workflow-deadline-value">
            <span>Hạn chót</span>
            <strong>{base.deadline_effective ? formatLocalDate(base.deadline_effective) : "chưa xác định"}</strong>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void openHistory()}>
            <History size={15} aria-hidden="true" /> {t.tasks.historyTitle}
          </Button>
          <Button type="button" size="sm" disabled={blocked} aria-expanded={deadlineDraft.open} onClick={() => {
            setDeadlineDraft(current => ({ ...current, open: !current.open }));
            setDeadlineFeedback(null);
          }}>{deadlineDraft.open ? "Đóng phần đổi hạn" : base.deadline_effective ? "Đổi hạn chót" : "Đặt hạn chót"}</Button>
        </div>
        {deadlineDraft.open && (
          <div className="workflow-deadline-form" onKeyDown={event => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
          }}>
            <div className="workflow-fields">
              <TaskField label="Ngày và giờ đến hạn" id={`${id}-date`}>
                <Input id={`${id}-date`} type="datetime-local" value={deadlineDraft.input} disabled={blocked}
                  onChange={e => setDeadlineDraft(current => ({ ...current, input: e.target.value }))} />
              </TaskField>
              <TaskField label={t.tasks.reason} id={`${id}-reason`}>
                <Input id={`${id}-reason`} placeholder={t.tasks.reasonPlaceholder} value={deadlineDraft.reason}
                  disabled={blocked} onChange={e => setDeadlineDraft(current => ({ ...current, reason: e.target.value }))} />
              </TaskField>
              <TaskField label="Múi giờ (UTC)" id={`${id}-offset`}>
                <Input id={`${id}-offset`} value={deadlineDraft.offset} disabled={blocked} placeholder="+07:00"
                  onChange={e => setDeadlineDraft(current => ({ ...current, offset: e.target.value }))} />
              </TaskField>
            </div>
            {base.evidence_ids.length > 0 && <details className="workflow-deadline-source">
              <summary>Gắn đoạn trích email cho hạn chót</summary>
              <TaskField label="Đoạn trích liên quan" id={`${id}-excerpt`}>
                <select id={`${id}-excerpt`} disabled={blocked} value={deadlineDraft.evidenceId ?? ""}
                  onChange={e => setDeadlineDraft(current => ({ ...current, evidenceId: e.target.value || null }))}>
                  <option value="">Chỉ lưu ngày giờ đã chọn</option>
                  {base.evidence_ids.map((evId, index) => <option key={evId} value={evId}>Đoạn trích {index + 1}</option>)}
                </select>
              </TaskField>
            </details>}
            {deadlineIso && <p className="workflow-muted">Giờ quốc tế (UTC) <time dateTime={deadlineIso}>
              {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(deadlineIso))}
            </time></p>}
            <div className="workflow-button-row">
              <Button type="button" size="sm" disabled={blocked || !deadlineIso || !deadlineDraft.reason.trim()}
                onClick={() => handleConfirmDeadline()}>{relatedBusy && relatedIntent?.kind === "deadline" ? t.tasks.confirmingDeadline : t.tasks.confirmDeadline}</Button>
              {base.deadline_effective && <Button type="button" size="sm" variant="outline" disabled={blocked || !deadlineDraft.reason.trim()}
                onClick={() => void handleConfirmDeadline(true)}>{t.tasks.deadlineClear}</Button>}
            </div>
          </div>
        )}
        {deadlineFeedback && <div role={deadlineFeedback.kind === "success" ? "status" : "alert"} className="workflow-notice">
          <p>{deadlineFeedback.message}</p>
          {deadlineFeedback.kind === "conflict" && <Button type="button" variant="outline" size="sm" onClick={() => void reloadLatest()}>{t.tasks.conflictReload}</Button>}
        </div>}
      </section>
      {!linkPickerOpen && retryRelated}

      <div className="workflow-task-columns">
        <section className="workflow-panel">
          <div className="workflow-panel-heading"><h4>Tiến độ và phân công</h4></div>
          <div className="workflow-fields">
            <TaskField label={t.tasks.state} id={`${id}-state`}>
              <select id={`${id}-state`} value={draft.state} disabled={blocked} onChange={e => update("state", e.target.value as TaskState)}>
                {STATES.map(state => <option key={state} value={state}>{t.tasks.states[state]}</option>)}
              </select>
            </TaskField>
            <TaskField label={t.tasks.owner} id={`${id}-owner`}>
              <Input id={`${id}-owner`} value={draft.owner} disabled={blocked} placeholder="Chưa phân công" onChange={e => update("owner", e.target.value)} />
            </TaskField>
            <TaskField label={t.tasks.importance} id={`${id}-importance`}>
              <select id={`${id}-importance`} value={draft.importance} disabled={blocked} onChange={e => update("importance", e.target.value as Importance)}>
                {IMPORTANCES.map(level => <option key={level} value={level}>{t.tasks.importances[level]}</option>)}
              </select>
            </TaskField>
            <TaskField label={t.tasks.estimate} id={`${id}-estimate`}>
              <Input id={`${id}-estimate`} inputMode="numeric" value={draft.estimate} disabled={blocked}
                aria-invalid={!!estimateError} aria-describedby={estimateError ? `${id}-estimate-err` : undefined}
                placeholder="Chưa nhập" onChange={e => update("estimate", e.target.value)} />
            </TaskField>
          </div>
          <div ref={feedbackRef} className="workflow-task-feedback">
            {estimateError && <p id={`${id}-estimate-err`} role="alert" className="workflow-notice">{estimateError}</p>}
            {hint && <p role="status">{hint}</p>}
            {result.kind === "saved" && <p role="status">{t.tasks.saved}</p>}
            {result.kind === "conflict" && <div role="alert" className="workflow-notice">
              <p>{t.tasks.conflict}</p>
              <Button type="button" size="sm" variant="outline" disabled={blocked} onClick={() => void reloadLatest()}>{t.tasks.conflictReload}</Button>
            </div>}
            {result.kind === "uncertain" && <p role="alert" className="workflow-notice">Chưa xác nhận được việc lưu. Hãy bấm lưu để thử lại.</p>}
            {result.kind === "error" && <p role="alert" className="workflow-notice">{saveFailureText(result.error)}</p>}
          </div>
        </section>

        <section className="workflow-panel">
          <div className="workflow-panel-heading"><h4><Mail size={17} aria-hidden="true" /> Email liên quan</h4></div>
          {base.message_ids.length === 0 && <p className="workflow-empty">Chưa có email liên quan.</p>}
          <ul className="workflow-list">
            {base.message_ids.map(messageId => <LinkedEmail key={messageId} client={client} scope={scope} messageId={messageId}
              busy={blocked} onRemove={() => changeLink("unlink", messageId)}
              onOpen={onOpenMessage ? () => onOpenMessage(messageId) : undefined} />)}
          </ul>
          {onOpenEvidence && base.evidence_ids.map((evidenceId, index) =>
            <Button key={evidenceId} type="button" variant="ghost" size="sm" onClick={() => onOpenEvidence(evidenceId)}>
              {base.evidence_ids.length > 1 ? `Đọc đoạn trích ${index + 1}` : "Đọc đoạn trích email"}
            </Button>)}
          <div className="workflow-button-row">
            <Button type="button" size="sm" variant="outline" disabled={blocked} onClick={() => void openLinkPicker()}>
              <Plus size={15} aria-hidden="true" /> Thêm email liên quan
            </Button>
          </div>
          {linkingFeedback && <div role="alert" className="workflow-notice">
            <p>{linkingFeedback.message}</p>
            {linkingFeedback.kind === "conflict" && <Button type="button" variant="outline" size="sm" onClick={() => void reloadLatest()}>{t.tasks.conflictReload}</Button>}
          </div>}
        </section>
      </div>

      <footer className="workflow-button-row workflow-save">
        {dirty && <span className="workflow-muted workflow-unsaved">Có thay đổi chưa lưu</span>}
        {dirty && <Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={() => {
          setForm({ base, draft: toDraft(base) });
          setResult({ kind: "idle" });
          setEstimateError(null);
        }}>Bỏ chỉnh sửa</Button>}
        <Button type="submit" size="sm" disabled={blocked}>{busy ? t.tasks.saving : "Lưu thay đổi"}</Button>
      </footer>

      <Dialog open={historyOpen} onOpenChange={open => {
        setHistoryOpen(open);
        if (!open) historyRequest.current?.abort();
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogTitle>{t.tasks.historyTitle}</DialogTitle>
          <DialogDescription>Xem các lần đổi hạn và lý do đã ghi.</DialogDescription>
          {historyLoading && <Loading />}
          {historyError != null && <ErrorBox title={t.tasks.historyFailed} error={historyError} onRetry={() => void loadHistory(historyCursor ?? undefined)} />}
          {!historyLoading && historyError == null && historyItems.length === 0 ? <p className="workflow-empty">{t.tasks.historyEmpty}</p> :
              <ul className="workflow-history">
                {historyItems.map(entry => <li key={entry.id}>
                  <time dateTime={entry.created_at}>{formatLocalDate(entry.created_at)}</time>
                  <strong>{entry.new_deadline ? `Hạn mới · ${formatLocalDate(entry.new_deadline)}` : "Đã bỏ hạn chót"}</strong>
                  <span>{entry.previous_deadline ? `Hạn trước · ${formatLocalDate(entry.previous_deadline)}` : t.tasks.historyNoPrevious}</span>
                  <p>{entry.reason}</p>
                  <small>{entry.source_kind === "evidence" ? "Xác nhận từ đoạn trích email" : "Người dùng xác nhận"} · Phiên bản {entry.task_version}</small>
                </li>)}
              </ul>}
          {historyCursor && <Button type="button" size="sm" variant="outline" disabled={historyLoading}
            onClick={() => void loadHistory(historyCursor)}>Xem lịch sử trước</Button>}
        </DialogContent>
      </Dialog>

      <Dialog open={linkPickerOpen} onOpenChange={open => {
        setLinkPickerOpen(open);
        if (!open) pickerRequest.current?.abort();
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogTitle>Thêm email liên quan</DialogTitle>
          <DialogDescription>Chọn một thư trong hộp thư của công việc này.</DialogDescription>
          <Input aria-label="Tìm email" type="search" placeholder={t.tasks.searchMessagePlaceholder} value={messageSearch} onChange={e => setMessageSearch(e.target.value)} />
          {pickerStatus === "loading" && <Loading />}
          {pickerStatus === "error" &&
            <ErrorBox error={new Error("Chưa tải được danh sách email.")} onRetry={() => void loadLinkMessages(scopedMessageQuery, pickerCursor ?? undefined)} />}
          {matchedMessages.length ? <ul className="workflow-list">
              {matchedMessages.map(message => <li key={message.id} className="workflow-email">
                <span><strong>{message.subject || "Email không có tiêu đề"}</strong><small>{message.sender}</small></span>
                <Button type="button" variant="outline" size="sm" disabled={blocked} onClick={() => changeLink("link", message.id)}>Thêm</Button>
              </li>)}
            </ul> : pickerStatus === "ready" && <p className="workflow-empty">{t.tasks.noMessagesToLink}</p>}
          {pickerCursor && <Button type="button" size="sm" variant="outline" disabled={pickerStatus === "loading" || blocked}
            onClick={() => void loadLinkMessages(scopedMessageQuery, pickerCursor)}>Xem thêm email</Button>}
          {linkingFeedback && <div role="alert" className="workflow-notice">
            <p>{linkingFeedback.message}</p>
            {linkingFeedback.kind === "conflict" && <Button type="button" size="sm" variant="outline"
              onClick={() => void reloadLatest()}>{t.tasks.conflictReload}</Button>}
          </div>}
          {retryRelated}
        </DialogContent>
      </Dialog>
    </form>
  );
}
