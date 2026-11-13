// =========================================================================================
// Course: CS252 - Programming Systems / Software Engineering
// Student: Nguyen Quang Hieu - 25125043
// Assignment: Lab 04 - From Spec to Code: Phased Vibe-coding with AI
// Selected Feature: Feature 2 - Task Deadline Confirmation, Live UTC Preview & Audit History
// Source Component: apps/desktop/src/features/tasks/TaskEditor.tsx (React / TypeScript)
// Repository: kietanhnguyen2007/CS252 (branch: feat/w2-UI, Pull Request #30)
// =========================================================================================

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
  TaskState,
  TaskView,
} from "../../api/types";
import { ErrorBox, Loading, Unknown } from "../../components/StatusViews";
import { t } from "../../strings";
import { useStoredState, useUiSession } from "../../uiSession";
import { scopeKey } from "../../api/client";
import { newIdempotencyKey } from "../../lib/poll";
import { Button } from "../../components/upstream/circle/button";
import { Input } from "../../components/upstream/circle/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/upstream/circle/dialog";
import { History, Link2, Plus, Trash2, Unlink } from "lucide-react";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="text-xs font-medium text-muted-foreground mb-3">{title}</h4>
      {children}
    </div>
  );
}

function PropertyRow({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="circle-property-row flex items-center gap-4 min-h-10">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground w-36 shrink-0">
        {label}
      </label>
      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">{children}</div>
    </div>
  );
}

const STATES: TaskState[] = ["not_started", "in_progress", "waiting", "done", "cancelled"];
const IMPORTANCES: Importance[] = ["low", "normal", "high"];

interface Props {
  client: ApiClient;
  scope: AccountScope;
  task: TaskView;
  onSaved?: (task: TaskView) => void;
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

export function parseEstimate(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

function toLocalDatetimeInput(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskEditor({ client, scope, task, onSaved }: Props) {
  const session = useUiSession();
  const [{ base, draft }, setForm] = useStoredState(
    `task:${scopeKey(scope)}:${task.id}`,
    () => ({ base: task, draft: toDraft(task) }),
    (v) => JSON.stringify(v.draft) !== JSON.stringify(toDraft(v.base)),
  );
  const setDraft = (next: Draft | ((previous: Draft) => Draft)) =>
    setForm((v) => ({ ...v, draft: typeof next === "function" ? next(v.draft) : next }));

  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // W02 Deadline state
  const [deadlineMode, setDeadlineMode] = useState<"manual" | "evidence">("manual");
  const [deadlineInput, setDeadlineInput] = useState(() => toLocalDatetimeInput(base.deadline_effective));
  const [deadlineReason, setDeadlineReason] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(base.evidence_ids[0] ?? null);
  const [deadlineBusy, setDeadlineBusy] = useState(false);
  const [deadlineFeedback, setDeadlineFeedback] = useState<{ kind: "success" | "conflict" | "error"; message: string } | null>(null);

  // W02 Deadline History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<DeadlineHistoryEntryView[]>([]);

  // W02 Link / Unlink message state
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [availableMessages, setAvailableMessages] = useState<MessageView[]>([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [linkingBusy, setLinkingBusy] = useState(false);
  const [linkingFeedback, setLinkingFeedback] = useState<{ kind: "conflict" | "error"; message: string } | null>(null);

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
          isApiError(error) && error.isConflict
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
      setDeadlineInput(toLocalDatetimeInput(fresh.deadline_effective));
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
  async function handleConfirmDeadline(clear = false) {
    if (deadlineBusy || session.memory.pending) return;
    const trimmedReason = deadlineReason.trim();
    if (!trimmedReason || Array.from(trimmedReason).length > 500) {
      setDeadlineFeedback({ kind: "error", message: t.tasks.reasonRequired });
      return;
    }

    let deadlineIso: string | null = null;
    if (!clear) {
      if (deadlineMode === "manual") {
        if (!deadlineInput) {
          setDeadlineFeedback({ kind: "error", message: t.tasks.invalidDate });
          return;
        }
        const d = new Date(deadlineInput);
        if (isNaN(d.getTime())) {
          setDeadlineFeedback({ kind: "error", message: t.tasks.invalidDate });
          return;
        }
        deadlineIso = d.toISOString();
      } else {
        if (!selectedEvidenceId) {
          setDeadlineFeedback({ kind: "error", message: "Vui lòng chọn bằng chứng." });
          return;
        }
        deadlineIso = deadlineInput ? new Date(deadlineInput).toISOString() : new Date().toISOString();
      }
    }

    const payload: ConfirmDeadlineRequest = {
      deadline: deadlineIso,
      source_kind: clear ? "manual" : deadlineMode,
      reason: trimmedReason,
      evidence_id: clear || deadlineMode === "manual" ? null : selectedEvidenceId,
      expected_version: base.version,
      idempotency_key: newIdempotencyKey(),
    };

    setDeadlineBusy(true);
    const release = session.beginMutation();
    try {
      const updated = await client.confirmTaskDeadline(scope, base.id, payload);
      setForm({ base: updated, draft: toDraft(updated) });
      setDeadlineFeedback({ kind: "success", message: clear ? t.tasks.deadlineCleared : t.tasks.deadlineConfirmed });
      setDeadlineReason("");
      onSaved?.(updated);
    } catch (err) {
      if (isApiError(err) && err.isConflict) {
        setDeadlineFeedback({ kind: "conflict", message: t.tasks.conflict });
      } else {
        setDeadlineFeedback({ kind: "error", message: err instanceof Error ? err.message : "Xác nhận hạn chót thất bại" });
      }
    } finally {
      release();
      setDeadlineBusy(false);
    }
  }

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const page = await client.listDeadlineHistory(scope, base.id, { limit: 50 });
      setHistoryItems(page.items);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // W02 Link / Unlink Actions
  async function handleUnlinkMessage(messageId: string) {
    if (linkingBusy || session.memory.pending) return;
    setLinkingBusy(true);
    const release = session.beginMutation();
    try {
      const updated = await client.unlinkTaskMessage(scope, base.id, {
        message_id: messageId,
        expected_version: base.version,
        idempotency_key: newIdempotencyKey(),
      });
      setForm({ base: updated, draft: toDraft(updated) });
      setLinkingFeedback(null);
      onSaved?.(updated);
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "origin_link_required") {
          setLinkingFeedback({ kind: "error", message: t.tasks.originLinkRequired });
        } else if (err.code === "source_link_in_use") {
          setLinkingFeedback({ kind: "error", message: t.tasks.sourceLinkInUse });
        } else if (err.isConflict) {
          setLinkingFeedback({ kind: "conflict", message: t.tasks.conflict });
        } else {
          setLinkingFeedback({ kind: "error", message: err.message });
        }
      } else {
        setLinkingFeedback({ kind: "error", message: "Gỡ liên kết thất bại" });
      }
    } finally {
      release();
      setLinkingBusy(false);
    }
  }

  async function openLinkPicker() {
    setLinkPickerOpen(true);
    try {
      const page = await client.listMessages(scope, { limit: 30 });
      setAvailableMessages(page.items.filter((m) => !base.message_ids.includes(m.id)));
    } catch {
      setAvailableMessages([]);
    }
  }

  async function handleLinkMessage(messageId: string) {
    if (linkingBusy || session.memory.pending) return;
    setLinkingBusy(true);
    const release = session.beginMutation();
    try {
      const updated = await client.linkTaskMessage(scope, base.id, {
        message_id: messageId,
        expected_version: base.version,
        idempotency_key: newIdempotencyKey(),
      });
      setForm({ base: updated, draft: toDraft(updated) });
      setLinkPickerOpen(false);
      setLinkingFeedback(null);
      onSaved?.(updated);
    } catch (err) {
      if (isApiError(err) && err.isConflict) {
        setLinkingFeedback({ kind: "conflict", message: t.tasks.conflict });
      } else {
        setLinkingFeedback({ kind: "error", message: err instanceof Error ? err.message : "Liên kết email thất bại" });
      }
    } finally {
      release();
      setLinkingBusy(false);
    }
  }

  const id = `task-${base.id}`;
  const utcPreview = deadlineInput ? new Date(deadlineInput).toUTCString() : null;

  return (
    <form
      className="task-editor circle-task-editor"
      aria-label={base.title}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className="task-editor-header circle-task-editor-heading">
        <p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground mb-2">Công việc đã xác nhận</p>
        <h3 className="text-xl font-semibold tracking-tight leading-snug">{base.title}</h3>
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>
            {t.tasks.deadline}: <Unknown value={base.deadline_effective} />
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => void openHistory()}
            className="h-6 text-[11px] gap-1 px-2"
          >
            <History className="size-3" />
            {t.tasks.historyTitle}
          </Button>
        </div>
      </header>

      <div className="task-editor-fields circle-task-editor-fields">
        {/* Core Attributes */}
        <Section title="Thuộc tính">
          <PropertyRow label={t.tasks.state} htmlFor={`${id}-state`}>
            <select
              id={`${id}-state`}
              value={draft.state}
              disabled={busy}
              onChange={(event) => update("state", event.target.value as TaskState)}
            >
              {STATES.map((state) => (
                <option key={state} value={state}>
                  {t.tasks.states[state]}
                </option>
              ))}
            </select>
          </PropertyRow>
          <PropertyRow label={t.tasks.owner} htmlFor={`${id}-owner`}>
            <Input
              id={`${id}-owner`}
              type="text"
              value={draft.owner}
              disabled={busy}
              placeholder={t.common.unknown}
              className="h-8 text-xs"
              onChange={(event) => update("owner", event.target.value)}
            />
          </PropertyRow>
          <PropertyRow label={t.tasks.estimate} htmlFor={`${id}-estimate`}>
            <Input
              id={`${id}-estimate`}
              type="text"
              inputMode="numeric"
              value={draft.estimate}
              disabled={busy}
              placeholder={t.tasks.estimateUnset}
              aria-invalid={estimateError ? true : undefined}
              aria-describedby={estimateError ? `${id}-estimate-err` : undefined}
              className="h-8 text-xs"
              onChange={(event) => update("estimate", event.target.value)}
            />
          </PropertyRow>
          <PropertyRow label={t.tasks.importance} htmlFor={`${id}-importance`}>
            <select
              id={`${id}-importance`}
              value={draft.importance}
              disabled={busy}
              onChange={(event) => update("importance", event.target.value as Importance)}
            >
              {IMPORTANCES.map((importance) => (
                <option key={importance} value={importance}>
                  {t.tasks.importances[importance]}
                </option>
              ))}
            </select>
          </PropertyRow>
        </Section>

        {/* W02 Deadline Confirmation Section */}
        <Section title="Quản lý hạn chót">
          <PropertyRow label="Nguồn hạn chót" htmlFor={`${id}-deadline-mode`}>
            <select
              id={`${id}-deadline-mode`}
              value={deadlineMode}
              disabled={deadlineBusy}
              onChange={(e) => setDeadlineMode(e.target.value as "manual" | "evidence")}
            >
              <option value="manual">{t.tasks.modeManual}</option>
              {base.evidence_ids.length > 0 && <option value="evidence">{t.tasks.modeEvidence}</option>}
            </select>
          </PropertyRow>

          {deadlineMode === "manual" ? (
            <PropertyRow label={t.tasks.deadline} htmlFor={`${id}-deadline-input`}>
              <div className="flex flex-col gap-1 w-full">
                <Input
                  id={`${id}-deadline-input`}
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={deadlineInput}
                  disabled={deadlineBusy}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                />
                {utcPreview && (
                  <span className="text-[10px] text-muted-foreground">
                    {t.tasks.utcPreview}: {utcPreview}
                  </span>
                )}
              </div>
            </PropertyRow>
          ) : (
            <PropertyRow label="Bằng chứng" htmlFor={`${id}-deadline-evidence`}>
              <select
                id={`${id}-deadline-evidence`}
                value={selectedEvidenceId ?? ""}
                disabled={deadlineBusy}
                onChange={(e) => setSelectedEvidenceId(e.target.value)}
              >
                {base.evidence_ids.map((evId, idx) => (
                  <option key={evId} value={evId}>
                    Bằng chứng #{idx + 1} ({evId})
                  </option>
                ))}
              </select>
            </PropertyRow>
          )}

          <PropertyRow label={t.tasks.reason} htmlFor={`${id}-deadline-reason`}>
            <Input
              id={`${id}-deadline-reason`}
              type="text"
              className="h-8 text-xs"
              placeholder={t.tasks.reasonPlaceholder}
              value={deadlineReason}
              disabled={deadlineBusy}
              onChange={(e) => setDeadlineReason(e.target.value)}
            />
          </PropertyRow>

          <div className="flex gap-2 justify-end mt-2">
            {base.deadline_effective && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={deadlineBusy}
                onClick={() => void handleConfirmDeadline(true)}
              >
                <Trash2 className="size-3 mr-1" />
                {t.tasks.deadlineClear}
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="xs"
              disabled={deadlineBusy || !deadlineReason.trim()}
              onClick={() => void handleConfirmDeadline(false)}
            >
              {deadlineBusy ? t.tasks.confirmingDeadline : t.tasks.confirmDeadline}
            </Button>
          </div>

          {deadlineFeedback && (
            <div className="mt-2 text-xs">
              {deadlineFeedback.kind === "success" && (
                <p role="status" className="status status-success text-emerald-600">
                  {deadlineFeedback.message}
                </p>
              )}
              {deadlineFeedback.kind === "conflict" && (
                <div role="alert" className="status status-error">
                  <p>{deadlineFeedback.message}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void reloadLatest()}>
                    {t.tasks.conflictReload}
                  </Button>
                </div>
              )}
              {deadlineFeedback.kind === "error" && <p className="status status-error">{deadlineFeedback.message}</p>}
            </div>
          )}
        </Section>

        {/* W02 Email Linking Section */}
        <Section title="Email liên kết">
          <div className="space-y-2">
            {base.message_ids.map((msgId) => (
              <div key={msgId} className="flex items-center justify-between p-2 rounded bg-muted/40 text-xs">
                <span className="font-mono text-[11px] truncate">{msgId}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 text-muted-foreground hover:text-destructive"
                  disabled={linkingBusy}
                  onClick={() => void handleUnlinkMessage(msgId)}
                  title={t.tasks.unlinkMessage}
                >
                  <Unlink className="size-3.5 mr-1" />
                  {t.tasks.unlinkMessage}
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="xs"
              className="w-full text-xs gap-1"
              disabled={linkingBusy}
              onClick={() => void openLinkPicker()}
            >
              <Plus className="size-3.5" />
              {t.tasks.linkMessage}
            </Button>

            {linkingFeedback && (
              <div className="mt-2 text-xs">
                {linkingFeedback.kind === "conflict" ? (
                  <div role="alert" className="status status-error">
                    <p>{linkingFeedback.message}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void reloadLatest()}>
                      {t.tasks.conflictReload}
                    </Button>
                  </div>
                ) : (
                  <p className="status status-error">{linkingFeedback.message}</p>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Feedback Section */}
        <div ref={feedbackRef} className="task-feedback mt-3">
          {estimateError ? (
            <p id={`${id}-estimate-err`} role="alert" className="status status-error">
              {estimateError}
            </p>
          ) : null}
          {hint ? <p role="status">{hint}</p> : null}
          {result.kind === "saved" ? <p role="status">{t.tasks.saved}</p> : null}
          {result.kind === "conflict" ? (
            <div role="alert" className="status status-error">
              <p>{t.tasks.conflict}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void reloadLatest()} disabled={busy}>
                {t.tasks.conflictReload}
              </Button>
            </div>
          ) : null}
          {result.kind === "uncertain" ? (
            <ErrorBox error={result.error} title="Chưa xác định được kết quả lưu. Lưu lại sẽ kiểm tra phiên bản trước." />
          ) : null}
          {result.kind === "error" ? <ErrorBox error={result.error} title={t.tasks.saveFailed} /> : null}
        </div>
      </div>

      <footer className="form-actions circle-task-actions">
        <span className="text-[11px] text-muted-foreground mr-auto">Thay đổi chỉ có hiệu lực khi lưu.</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setForm({ base, draft: toDraft(base) });
            setResult({ kind: "idle" });
          }}
        >
          Bỏ chỉnh sửa
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t.tasks.saving : "Lưu thay đổi"}
        </Button>
      </footer>

      {/* Deadline History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogTitle className="text-sm font-semibold">{t.tasks.historyTitle}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mb-3">
            Toàn bộ các lần thay đổi hạn chót và lý do xác nhận của công việc.
          </DialogDescription>
          {historyLoading ? (
            <Loading />
          ) : historyItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.tasks.historyEmpty}</p>
          ) : (
            <div className="space-y-3">
              {historyItems.map((entry) => (
                <div key={entry.id} className="border-b pb-2 text-xs">
                  <div className="flex justify-between text-muted-foreground text-[10px]">
                    <span>{new Date(entry.created_at).toLocaleString()}</span>
                    <span>v{entry.task_version}</span>
                  </div>
                  <div className="font-medium mt-1">
                    {entry.previous_deadline ? new Date(entry.previous_deadline).toLocaleDateString() : "Không"} →{" "}
                    {entry.new_deadline ? new Date(entry.new_deadline).toLocaleDateString() : "Xóa"}
                  </div>
                  <p className="text-muted-foreground mt-0.5">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Message Link Picker Dialog */}
      <Dialog open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogTitle className="text-sm font-semibold">{t.tasks.linkMessage}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mb-3">
            Chọn email trong cùng tài khoản để liên kết với công việc này.
          </DialogDescription>
          <Input
            type="search"
            placeholder={t.tasks.searchMessagePlaceholder}
            className="h-8 text-xs mb-3"
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
          />
          {availableMessages
            .filter((m) => !messageSearch || m.subject.toLowerCase().includes(messageSearch.toLowerCase()))
            .map((msg) => (
              <div key={msg.id} className="flex items-center justify-between p-2 rounded hover:bg-muted text-xs">
                <div className="truncate mr-2">
                  <p className="font-medium truncate">{msg.subject || "(Không có tiêu đề)"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{msg.sender}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={linkingBusy}
                  onClick={() => void handleLinkMessage(msg.id)}
                >
                  <Link2 className="size-3 mr-1" />
                  Liên kết
                </Button>
              </div>
            ))}
          {availableMessages.length === 0 && (
            <p className="text-xs text-muted-foreground">{t.tasks.noMessagesToLink}</p>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}

// =========================================================================================
// Supporting Types & Interfaces (from apps/desktop/src/api/types.ts)
// =========================================================================================
/*
export interface ConfirmDeadlineRequest {
  deadline: ISODateTime | null;
  source_kind: 'manual' | 'evidence';
  evidence_id: string | null;
  reason: string;
  expected_version: number;
  idempotency_key: string;
}

export interface DeadlineHistoryEntryView {
  id: string;
  task_id: string;
  previous_deadline: ISODateTime | null;
  new_deadline: ISODateTime | null;
  source_kind: 'manual' | 'evidence';
  evidence_id: string | null;
  reason: string;
  actor: 'local_user';
  created_at: ISODateTime;
  task_version: number;
}
*/
