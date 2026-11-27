import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  DeadlineChange, DeadlineHistoryPage, DesktopApi, SetTaskDeadlineInput, Task,
} from "./api";
import {
  DEFAULT_REMINDER_PRESETS, formatDate, mutationErrorCode, normalizeReminderPresets, week4ErrorText,
} from "./presentation";
import { ReminderLeadPresetChips } from "./ReminderLeadPresetChips";
import { authoredDeadline, deadlineDraft, deadlineText, proposedDeadlineDraft, setDeadlineDate } from "./taskDeadline";

/** A deadline read from an email. It only replaces the task deadline after the user saves. */
export interface DeadlineProposal {
  suggestionId: string;
  instant: string;
  reason: string;
}

export interface DeadlineDialogProps {
  api: DesktopApi;
  task: Task;
  proposal?: DeadlineProposal;
  accountReminderPresets?: readonly number[];
  onClose: () => void;
  onSaved: (task: Task) => void;
  onProposalStale?: () => void;
}

export function reminderPresetsEqual(first: readonly number[], second: readonly number[]): boolean {
  const a = normalizeReminderPresets(first);
  const b = normalizeReminderPresets(second);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function resolveAccountReminderPresets(accountPresets?: readonly number[]): number[] {
  return Array.isArray(accountPresets)
    ? normalizeReminderPresets(accountPresets)
    : [...DEFAULT_REMINDER_PRESETS];
}

export function initialDeadlineReminderPresets(
  task: Pick<Task, "reminder_lead_hours">,
  accountPresets?: readonly number[],
): number[] {
  if (Array.isArray(task.reminder_lead_hours)) {
    return normalizeReminderPresets(task.reminder_lead_hours);
  }
  return resolveAccountReminderPresets(accountPresets);
}

export function DeadlineDialog({
  api, task, proposal, accountReminderPresets, onClose, onSaved, onProposalStale,
}: DeadlineDialogProps) {
  const accountDefaults = useMemo(
    () => resolveAccountReminderPresets(accountReminderPresets),
    [accountReminderPresets],
  );
  const [base, setBase] = useState<Task>(task);
  const [activeProposal, setActiveProposal] = useState(proposal);
  const [draft, setDraft] = useState(() =>
    (proposal && proposedDeadlineDraft(proposal.instant, proposal.reason)) ?? deadlineDraft(task));
  const [leadHours, setLeadHours] = useState<number[]>(() =>
    initialDeadlineReminderPresets(task, accountReminderPresets));
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [staleProposal, setStaleProposal] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clearMode, setClearMode] = useState(false);
  const submitting = useRef(false);
  const request = useRef<{ value: string; key: string } | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);

  const normalizedLeads = useMemo(() => normalizeReminderPresets(leadHours), [leadHours]);
  const persistedLeads = useMemo(
    () => initialDeadlineReminderPresets(base, accountDefaults),
    [base, accountDefaults],
  );
  const presetsChanged = !reminderPresetsEqual(normalizedLeads, persistedLeads);
  const differsFromAccountDefault = !reminderPresetsEqual(normalizedLeads, accountDefaults);
  const entered = authoredDeadline(draft);
  const unchanged = Boolean(entered && entered === authoredDeadline(deadlineDraft(base)));
  const isPresetOnlySave = Boolean(
    !clearMode
    && unchanged
    && !activeProposal
    && base.deadline_effective
    && presetsChanged
    && api.setReminderPresets,
  );

  function handleSaveError(failure: unknown) {
    const code = mutationErrorCode(failure);
    if (
      code === "version_conflict"
      || code === "task_version_conflict"
      || code === "request_conflict"
      || code === "task_not_found"
    ) {
      setConflict(true);
      setError("Công việc đã thay đổi. Hãy tải bản mới để kiểm tra trước khi lưu.");
    } else if (code === "deadline_proposal_stale") {
      setStaleProposal(true);
      setError("Hạn trong thư đã thay đổi hoặc không còn phù hợp. Hãy đóng cửa sổ và xem lại hồ sơ công việc.");
      onProposalStale?.();
    } else if (code === "invalid_reminder_presets") {
      setError(week4ErrorText(failure));
    } else if (code === "invalid_deadline") {
      setError("Ngày, giờ, độ lệch UTC hoặc lý do chưa hợp lệ.");
    } else {
      setError("Chưa lưu được hạn chót. Nội dung đã nhập vẫn còn. Hãy thử lại.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || conflict || staleProposal) return;
    setNotice("");
    setError("");

    // Branch B: only reminder presets changed on an existing deadline -> save without requiring a deadline reason.
    if (isPresetOnlySave && api.setReminderPresets) {
      const value = JSON.stringify({ kind: "presets", lead_hours: normalizedLeads, version: base.version });
      if (request.current?.value !== value) request.current = { value, key: crypto.randomUUID() };
      submitting.current = true;
      setPending(true);
      try {
        const result = await api.setReminderPresets({
          task_id: base.id,
          lead_hours: normalizedLeads,
          expected_version: base.version,
          request_key: request.current.key,
        });
        const nextLeads = normalizeReminderPresets(result.lead_hours);
        const updated: Task = {
          ...base,
          reminder_lead_hours: nextLeads,
          version: result.version,
        };
        setBase(updated);
        setLeadHours(nextLeads);
        onSaved(updated);
        setNotice("Đã lưu mốc nhắc trước hạn.");
      } catch (failure) {
        handleSaveError(failure);
      } finally {
        submitting.current = false;
        setPending(false);
      }
      return;
    }

    // Branch A: deadline set / modified / cleared / proposal (optionally attaching changed reminder presets).
    const reason = draft.reason.trim();
    if (reason.length === 0 || Array.from(reason).length > 500) {
      setError("Nhập lý do từ 1 đến 500 ký tự.");
      reasonInput.current?.focus();
      return;
    }
    const instant = clearMode ? null : unchanged ? base.deadline_authored ?? entered : entered;
    if (!clearMode && !instant) {
      setError("Nhập ngày, giờ hợp lệ và độ lệch UTC theo dạng +07:00 hoặc -05:00.");
      return;
    }
    let change: DeadlineChange = { kind: "clear", reason };
    if (instant) {
      change = activeProposal
        ? { kind: "set_from_proposal", instant, reason, suggestion_id: activeProposal.suggestionId }
        : { kind: "set", instant, reason };
    }
    const includeLeadHours = !clearMode && presetsChanged;
    const value = JSON.stringify({
      kind: "deadline",
      change,
      reminder_lead_hours: includeLeadHours ? normalizedLeads : null,
      version: base.version,
    });
    if (request.current?.value !== value) request.current = { value, key: crypto.randomUUID() };
    submitting.current = true;
    setPending(true);
    try {
      const payload: SetTaskDeadlineInput = {
        task_id: base.id,
        expected_version: base.version,
        request_key: request.current.key,
        change,
        ...(includeLeadHours ? { reminder_lead_hours: normalizedLeads } : {}),
      };
      const result = await api.setTaskDeadline(payload);
      const returned = result.task;
      const nextTask: Task = {
        ...returned,
        ...(includeLeadHours && returned.reminder_lead_hours === undefined
          ? { reminder_lead_hours: normalizedLeads }
          : {}),
      };
      setBase(nextTask);
      onSaved(nextTask);
      setActiveProposal(undefined);
      setDraft(deadlineDraft(nextTask));
      setLeadHours(initialDeadlineReminderPresets(nextTask, accountDefaults));
      setClearMode(false);
      setNotice(
        result.history_id
          ? instant ? "Đã lưu hạn chót." : "Đã xóa hạn chót."
          : includeLeadHours ? "Đã lưu mốc nhắc trước hạn." : "Hạn chót không đổi.",
      );
    } catch (failure) {
      handleSaveError(failure);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function reload() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      const latest = await api.getTask(base.id);
      if (latest.version < base.version) {
        setError("Chưa tìm thấy phiên bản mới của công việc. Nội dung đã nhập vẫn còn.");
        return;
      }
      const hadLocalPresetEdit = presetsChanged;
      setBase(latest);
      if (!hadLocalPresetEdit) {
        setLeadHours(initialDeadlineReminderPresets(latest, accountDefaults));
      }
      onSaved(latest);
      setConflict(false);
      setError("");
      setNotice("Đã tải hạn chót hiện tại. Các ô bạn đã nhập vẫn còn để đối chiếu.");
      if (!latest.deadline_effective) setClearMode(false);
    } catch {
      setError("Chưa tải được công việc. Nội dung đã nhập vẫn còn.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  function changeClearMode(clear: boolean) {
    setClearMode(clear);
    setError("");
    setNotice("");
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !submitting.current) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="mc-dialog-backdrop" data-slot="dialog-overlay" />
        <Dialog.Popup className="mc-dialog" data-slot="dialog-content" initialFocus={dateInput}>
          <div className="mc-dialog-header" data-slot="dialog-header">
            <div>
              <Dialog.Title className="mc-dialog-title">Hạn chót</Dialog.Title>
              <Dialog.Description>{base.title}</Dialog.Description>
            </div>
            <Dialog.Close type="button" className="mc-icon-button" aria-label="Đóng" disabled={pending}>
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <p className="mc-source-note"><strong>Hạn chót hiện tại</strong> {deadlineText(base.deadline_effective, base.deadline_authored)}</p>
          {activeProposal && (
            <p className="mc-deadline-proposal" role="note">
              <strong>Hạn trong thư</strong> {formatDate(activeProposal.instant, true) ?? activeProposal.instant}.{" "}
              Các ô dưới đây đã điền sẵn theo email. Hạn hiện tại chỉ thay đổi khi bạn bấm Lưu hạn chót.
            </p>
          )}
          <form className="mc-task-form" onSubmit={save}>
            {!clearMode ? (
              <>
                <div className="mc-field-grid">
                  <div className="mc-field">
                    <label htmlFor="v2-deadline-date">Ngày</label>
                    <input ref={dateInput} id="v2-deadline-date" type="date" aria-required="true" value={draft.date} disabled={pending || staleProposal}
                      onChange={(event) => setDraft(setDeadlineDate(draft, { date: event.target.value }))} />
                  </div>
                  <div className="mc-field">
                    <label htmlFor="v2-deadline-time">Giờ</label>
                    <input id="v2-deadline-time" type="time" aria-required="true" step="1" value={draft.time} disabled={pending || staleProposal}
                      onChange={(event) => setDraft(setDeadlineDate(draft, { time: event.target.value }))} />
                  </div>
                  <div className="mc-field mc-deadline-offset">
                    <label htmlFor="v2-deadline-offset">Độ lệch UTC</label>
                    <input id="v2-deadline-offset" inputMode="text" aria-required="true" placeholder="+07:00" maxLength={6} value={draft.offset} disabled={pending || staleProposal}
                      aria-describedby="v2-deadline-zone"
                      onChange={(event) => setDraft({ ...draft, offset: event.target.value, offsetEdited: true })} />
                    <small id="v2-deadline-zone">Múi giờ trên máy: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Có thể nhập độ lệch khác nếu cần.</small>
                  </div>
                </div>
                <div className="mc-field">
                  <div className="mc-deadline-presets-header">
                    <span className="mc-field-label">Mốc nhắc trước hạn</span>
                    {differsFromAccountDefault && (
                      <button
                        type="button"
                        className="mc-text-button"
                        disabled={pending || staleProposal}
                        onClick={() => setLeadHours(accountDefaults)}
                      >
                        Dùng mặc định tài khoản
                      </button>
                    )}
                  </div>
                  <ReminderLeadPresetChips
                    value={normalizedLeads}
                    onChange={setLeadHours}
                    disabled={pending || staleProposal}
                    idPrefix="v2-deadline-preset"
                  />
                </div>
              </>
            ) : <p>Xác nhận xóa hạn chót hiện tại bằng cách nhập lý do.</p>}
            <div className="mc-field">
              <label htmlFor="v2-deadline-reason">Lý do</label>
              <textarea ref={reasonInput} id="v2-deadline-reason" rows={2} aria-required={!isPresetOnlySave} value={draft.reason} disabled={pending || staleProposal}
                onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
            </div>
            {error && <p role="alert" className="mc-form-error">{error}</p>}
            {notice && <p role="status" className="mc-muted">{notice}</p>}
            {conflict && <button type="button" className="mc-text-button" disabled={pending} onClick={() => void reload()}>Tải bản mới</button>}
            <div className="mc-dialog-footer mc-deadline-footer">
              {base.deadline_effective && (
                <button type="button" className="mc-text-button" disabled={pending || staleProposal}
                  onClick={() => changeClearMode(!clearMode)}>
                  {clearMode ? "Quay lại đặt hạn chót" : "Xóa hạn chót"}
                </button>
              )}
              <button type="submit" className="mc-button mc-primary" disabled={pending || conflict || staleProposal}>
                {pending ? "Đang lưu…" : clearMode ? "Xác nhận xóa hạn chót" : "Lưu hạn chót"}
              </button>
            </div>
          </form>
          <DeadlineHistory key={base.id + ":" + base.version} api={api} taskId={base.id} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeadlineHistory({ api, taskId }: { api: DesktopApi; taskId: string }) {
  const [page, setPage] = useState<DeadlineHistoryPage>({ items: [], next_cursor: null });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    api.taskDeadlineHistory({ task_id: taskId, limit: 10, ...(cursor ? { cursor } : {}) }).then(
      (result) => {
        if (!current) return;
        setPage((previous) => ({ items: cursor ? [...previous.items, ...result.items] : result.items, next_cursor: result.next_cursor }));
        setPending(false);
      },
      () => {
        if (!current) return;
        setError(true);
        setPending(false);
      },
    );
    return () => { current = false; };
  }, [api, taskId, cursor, attempt]);

  function retry() {
    setPending(true);
    setError(false);
    setAttempt(attempt + 1);
  }

  return (
    <section className="mc-deadline-history" aria-labelledby="v2-deadline-history-title">
      <h3 id="v2-deadline-history-title">Lịch sử hạn chót</h3>
      {pending && <p className="mc-muted" role="status">Đang tải lịch sử…</p>}
      {error && <p role="alert" className="mc-form-error">Chưa tải được lịch sử. <button type="button" className="mc-text-button" onClick={retry}>Thử lại</button></p>}
      {!pending && !error && page.items.length === 0 && <p className="mc-muted">Chưa có lần thay đổi nào.</p>}
      {page.items.length > 0 && <ol>
        {page.items.map((entry) => (
          <li key={entry.id}>
            <time dateTime={entry.created_at}>{formatDate(entry.created_at, true)}</time>
            <p>Từ {deadlineText(entry.previous_deadline, entry.previous_authored)} → {deadlineText(entry.new_deadline, entry.new_authored)}</p>
            <p>{entry.reason}</p>
          </li>
        ))}
      </ol>}
      {page.next_cursor && !pending && !error && (
        <button type="button" className="mc-text-button" onClick={() => {
          setPending(true);
          setCursor(page.next_cursor ?? undefined);
        }}>Xem thêm lịch sử</button>
      )}
    </section>
  );
}
