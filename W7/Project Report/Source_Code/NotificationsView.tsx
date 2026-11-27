import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, CalendarClock, Check, Clock3, Mail, RefreshCw, Undo2 } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type FormEvent, type RefObject } from "react";
import type {
  DesktopApi, NotificationAct, NotificationAction, NotificationFilter, NotificationItem, NotificationUndo,
  NotificationUndoDescriptor,
} from "./api";
import queueArt from "./assets/queue-light.svg?url";
import {
  isNotificationOverdue, notificationStageBadge, NotificationStageBadge,
} from "./NotificationBell";
import { formatDate, mutationErrorCode, week4ErrorText } from "./presentation";
import { usePagedList } from "./usePagedList";
import "./notifications.css";

type Command = { kind: "act"; input: NotificationAct } | { kind: "undo"; input: NotificationUndo };

const filters: { value: NotificationFilter; label: string; empty: string }[] = [
  { value: "all", label: "Tất cả", empty: "Chưa có thông báo nhắc việc." },
  { value: "unread", label: "Chưa đọc", empty: "Không có thông báo chưa đọc." },
  { value: "snoozed", label: "Đã hoãn", empty: "Hiện không có thông báo đang hoãn." },
];

const labels: Record<NotificationItem["kind"], string> = {
  task_deadline: "Hạn công việc",
  commitment_follow_up: "Cần hỏi lại",
  commitment_promise: "Hạn cam kết",
};

const actionFeedback: Record<NotificationAction["kind"], string> = {
  read: "Đã đánh dấu đã đọc.",
  unread: "Đã đánh dấu chưa đọc.",
  snooze: "Đã hoãn nhắc việc.",
  unsnooze: "Đã bỏ hoãn nhắc việc.",
};

const shortTime = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const groupDate = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" });
const emptyPage = { items: [], next_cursor: null };

function dayLabel(iso: string, now: Date) {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return Number.isFinite(date.getTime()) ? groupDate.format(date) : "Chưa rõ ngày";
}

// Adapted from Chronicle NotificationsInbox's adjacent day grouping. The native order is authoritative.
function groupItems(items: NotificationItem[], now: Date) {
  const days: { label: string; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.due_at, now);
    const last = days.at(-1);
    if (last?.label === label) last.items.push(item);
    else days.push({ label, items: [item] });
  }
  return days;
}

function localDateInput(date: Date) {
  const parts = [date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    .map((part) => String(part).padStart(2, "0"));
  return `${date.getFullYear()}-${parts[0]}-${parts[1]}T${parts[2]}:${parts[3]}`;
}

function actionError(error: unknown) {
  switch (mutationErrorCode(error)) {
    case "notification_not_found": return "Thông báo này đã thay đổi hoặc không còn liên quan.";
    case "version_conflict": return "Thông báo đã thay đổi. Danh sách sẽ được cập nhật.";
    case "invalid_snooze": return "Giờ nhắc lại chưa hợp lệ. Hãy chọn một thời điểm khác sau hiện tại.";
    case "invalid_snooze_time":
    case "undo_expired": return week4ErrorText(error);
    case "notification_undo_unavailable": return "Thao tác này không còn có thể hoàn tác.";
    case "request_conflict":
    case "request_key_conflict":
    case "idempotency_conflict": return "Không thể xác nhận thay đổi này. Danh sách sẽ được cập nhật.";
    default: return null;
  }
}

interface RowProps {
  item: NotificationItem;
  now: Date;
  disabled: boolean;
  onAction: (action: NotificationAction) => void;
  onSnooze: () => void;
  onOpenTask: (id: string) => void;
  onOpenMail: (id: string) => void;
}

function NotificationRow({
  item, now, disabled, onAction, onSnooze, onOpenTask, onOpenMail,
}: RowProps) {
  const read = !!item.read_at;
  const snoozed = !!item.snoozed_until && Date.parse(item.snoozed_until) > now.getTime();
  const due = new Date(item.due_at);
  const stage = notificationStageBadge(item, now);
  const commitmentOverdue = item.kind !== "task_deadline" && isNotificationOverdue(item, now);
  const Icon = item.kind === "commitment_follow_up" ? Clock3 : CalendarClock;
  const id = encodeURIComponent(item.id);
  const readLabel = read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc";

  return (
    // Chronicle NotificationsInbox: icon tile, title/unread marker, and time aligned on the trailing edge.
    <li className="mc-notification-row" data-unread={!read} data-event-id={item.id}>
      <span className="mc-notification-tile" aria-hidden="true"><Icon size={19} /></span>
      <div className="mc-notification-detail">
        <h3>{item.title}
          {!read && <span className="mc-notification-unread-dot" role="img" aria-label="Chưa đọc" />}
        </h3>
        <p className="mc-notification-meta">
          <span>{labels[item.kind]}</span>
          {stage && <NotificationStageBadge stage={stage} />}
          {commitmentOverdue && <span className="mc-notification-overdue">Đã qua mốc</span>}
          {snoozed && <span className="mc-notification-snoozed">
            <Clock3 size={14} aria-hidden="true" /> Nhắc lại lúc <time dateTime={item.snoozed_until!}>{formatDate(item.snoozed_until, true)}</time>
          </span>}
        </p>
        <div className="mc-notification-links">
          <button type="button" id={`mc-notification-task-${id}`} className="mc-text-button"
            aria-label={`Mở công việc: ${item.title}`} onClick={() => onOpenTask(item.task_id)}>
            Mở công việc <ArrowUpRight size={15} aria-hidden="true" />
          </button>
          {item.message_id && <button type="button" id={`mc-notification-mail-${id}`} className="mc-text-button"
            aria-label={`Mở email nguồn: ${item.title}`} onClick={() => { if (item.message_id) onOpenMail(item.message_id); }}>
            <Mail size={15} aria-hidden="true" /> Mở email nguồn
          </button>}
        </div>
      </div>
      <div className="mc-notification-actions">
        {Number.isFinite(due.getTime()) && <time dateTime={item.due_at}>{shortTime.format(due)}</time>}
        <div className="mc-notification-action-group">
          <button type="button" className="mc-text-button" aria-label={`${readLabel}: ${item.title}`}
            disabled={disabled} onClick={() => onAction({ kind: read ? "unread" : "read" })}>
            <Check size={15} aria-hidden="true" /> {readLabel}
          </button>
          <button type="button" className="mc-text-button" aria-label={`${snoozed ? "Bỏ hoãn" : "Hoãn nhắc"}: ${item.title}`}
            disabled={disabled} onClick={snoozed ? () => onAction({ kind: "unsnooze" }) : onSnooze}>
            <Clock3 size={15} aria-hidden="true" /> {snoozed ? "Bỏ hoãn" : "Hoãn nhắc"}
          </button>
        </div>
      </div>
    </li>
  );
}

function SnoozeDialog({ item, busy, error, trigger, onClose, onSave }: {
  item: NotificationItem;
  busy: boolean;
  error: string;
  trigger: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSave: (until: string) => void;
}) {
  const [until, setUntil] = useState(() => localDateInput(new Date(Date.now() + 3600000)));
  const [validation, setValidation] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function custom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date(until);
    if (!until || !Number.isFinite(date.getTime()) || localDateInput(date) !== until || date.getTime() <= Date.now()) {
      setValidation("Chọn ngày và giờ sau hiện tại.");
      input.current?.focus();
      return;
    }
    setValidation("");
    onSave(date.toISOString());
  }

  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="mc-dialog-backdrop" />
      <Dialog.Popup className="mc-dialog mc-notification-snooze" initialFocus={input} finalFocus={() => trigger.current}>
        <Dialog.Title className="mc-dialog-title">Hoãn nhắc việc</Dialog.Title>
        <Dialog.Description>{item.title}</Dialog.Description>
        <form onSubmit={custom} className="mc-notification-snooze-form" noValidate>
          <button type="button" className="mc-button mc-secondary" disabled={busy}
            onClick={() => onSave(new Date(Date.now() + 3600000).toISOString())}>Sau 1 giờ</button>
          <label className="mc-field">Hoặc chọn ngày giờ
            <input type="datetime-local" ref={input} value={until} disabled={busy}
              onChange={(event) => { setUntil(event.target.value); setValidation(""); }} />
          </label>
          {(validation || error) && <p role="alert" className="mc-form-error">{validation || error}</p>}
          <div className="mc-dialog-footer">
            <button type="button" className="mc-button mc-quiet" disabled={busy} onClick={onClose}>Đóng</button>
            <button type="submit" className="mc-button mc-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu giờ nhắc"}</button>
          </div>
        </form>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function NotificationsView({ api, active = true, revision = 0, onCountChange, onOpenTask, onOpenMail }: {
  api: DesktopApi;
  active?: boolean;
  revision?: number;
  onCountChange: () => void;
  onOpenTask: (id: string) => void;
  onOpenMail: (id: string) => void;
}) {
  const list = usePagedList<NotificationItem, { filter: NotificationFilter }>((query) => api.notificationList(query),
    { filter: "all" }, emptyPage);
  const [snooze, setSnooze] = useState<NotificationItem | null>(null);
  const [snoozeError, setSnoozeError] = useState("");
  const [undo, setUndo] = useState<NotificationUndoDescriptor | null>(null);
  const [retry, setRetry] = useState<Command | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const activeFilter = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const snoozeTrigger = useRef<HTMLElement | null>(null);
  const focusTarget = useRef<"undo" | "filter" | "retry" | null>(null);
  const refresh = useEffectEvent(() => { void list.refresh(); });

  useEffect(() => { if (active) refresh(); }, [active, revision]);
  useEffect(() => {
    if (!active || pending || !focusTarget.current) return;
    const target = focusTarget.current;
    focusTarget.current = null;
    const frame = requestAnimationFrame(() => {
      const current = document.activeElement;
      if (current !== document.body && current instanceof HTMLElement && !current.matches(":disabled")) return;
      const element = target === "undo" ? undoButton.current ?? activeFilter.current
        : target === "retry" ? retryButton.current : activeFilter.current;
      element?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, pending]);

  function select(filter: NotificationFilter) {
    if (list.filters.filter !== filter) void list.apply({ filter });
  }

  function openSnooze(item: NotificationItem) {
    snoozeTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSnoozeError("");
    setSnooze(item);
  }

  function closeSnooze() {
    if (locked.current) return;
    setSnooze(null);
    setSnoozeError("");
  }

  async function execute(command: Command) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setFeedback("");
    setError("");
    setSnoozeError("");
    try {
      if (command.kind === "act") {
        const result = await api.notificationAct(command.input);
        if (result.undo) setUndo(result.undo);
        setFeedback(actionFeedback[command.input.action.kind]);
        setSnooze(null);
        focusTarget.current = result.undo ? "undo" : "filter";
      } else {
        await api.notificationUndo(command.input);
        setUndo(null);
        setFeedback("Đã hoàn tác thay đổi thông báo.");
        focusTarget.current = "filter";
      }
      setRetry(null);
      await list.refresh();
      onCountChange();
    } catch (failure) {
      const code = mutationErrorCode(failure);
      const message = actionError(failure);
      if (message) {
        setRetry(null);
        if ((code === "invalid_snooze" || code === "invalid_snooze_time") && snooze) {
          setSnoozeError(message);
        } else {
          if (command.kind === "undo") setUndo(null);
          setSnooze(null);
          setError(message);
          focusTarget.current = "filter";
          await list.refresh();
          onCountChange();
        }
      } else {
        setSnooze(null);
        setRetry(command);
        setError("Chưa biết thay đổi đã được lưu hay chưa. Kiểm tra lại thao tác để xác nhận.");
        focusTarget.current = "retry";
      }
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  function act(item: NotificationItem, action: NotificationAction) {
    void execute({ kind: "act", input: {
      event_id: item.id,
      expected_version: item.version,
      request_key: crypto.randomUUID(),
      action,
    } });
  }

  const now = new Date();
  const groups = groupItems(list.items, now);

  return <section className="mc-notifications-view" aria-label="Trung tâm thông báo">
    <div className="mc-notification-toolbar">
      <div className="mc-notification-filters" role="group" aria-label="Lọc thông báo">
        {filters.map(({ value, label }) => <button type="button" key={value} className="mc-text-button"
          ref={list.filters.filter === value ? activeFilter : undefined}
          aria-pressed={list.filters.filter === value} onClick={() => select(value)}>{label}</button>)}
      </div>
      <button type="button" className="mc-text-button" onClick={() => { void list.refresh(); onCountChange(); }}>
        <RefreshCw size={15} aria-hidden="true" /> Làm mới
      </button>
    </div>
    {(feedback || undo) && <div className="mc-notification-notice">
      <p role="status">{feedback && <><Check size={16} aria-hidden="true" /> {feedback}</>}</p>
      {undo && <button type="button" ref={undoButton} className="mc-text-button" disabled={pending || !!retry}
        onClick={() => void execute({ kind: "undo", input: { ...undo, request_key: crypto.randomUUID() } })}>
        <Undo2 size={17} aria-hidden="true" /> Hoàn tác
      </button>}
    </div>}
    {error && <div className="mc-notification-error">
      <p className="mc-form-error" role="alert">{error}</p>
      {retry && <button type="button" ref={retryButton} className="mc-text-button" disabled={pending}
        onClick={() => void execute(retry)}>Kiểm tra lại thao tác</button>}
    </div>}
    {list.error === "first" && <div className="mc-notification-error">
      <p className="mc-form-error" role="alert">Chưa tải được thông báo.</p>
      <button type="button" className="mc-text-button" onClick={() => void list.refresh()}>Thử tải lại</button>
    </div>}
    {groups.length === 0 && (list.loading ? (
      <p className="mc-notification-empty mc-muted" role="status">Đang tải thông báo…</p>
    ) : !list.error && (
      <div className="mc-notification-empty">
        <img src={queueArt} alt="" width="96" height="96" />
        <p>{filters.find(({ value }) => value === list.filters.filter)?.empty}</p>
      </div>
    ))}
    {groups.map(({ label, items }, index) => (
      <div className="mc-notification-day" key={`${label}-${index}`}>
        <h2>{label}<span aria-hidden="true" /></h2>
        <ul>
          {items.map((item) => <NotificationRow key={item.id} item={item} now={now} disabled={pending || !!retry}
            onAction={(action) => act(item, action)} onSnooze={() => openSnooze(item)}
            onOpenTask={onOpenTask} onOpenMail={onOpenMail} />)}
        </ul>
      </div>
    ))}
    {list.error === "more" && <p role="alert" className="mc-form-error">Chưa tải thêm được thông báo.</p>}
    {list.next_cursor && <button type="button" className="mc-button mc-secondary mc-notification-more"
      disabled={!!list.loading} onClick={() => void list.more()}>{list.loading === "more" ? "Đang tải…" : "Xem thêm thông báo"}</button>}
    {active && snooze && <SnoozeDialog item={snooze} busy={pending} error={snoozeError} trigger={snoozeTrigger} onClose={closeSnooze}
      onSave={(until) => act(snooze, { kind: "snooze", until })} />}
  </section>;
}
