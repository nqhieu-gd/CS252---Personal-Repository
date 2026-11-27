import { Popover } from "@base-ui/react/popover";
import {
  AlertCircle, AlertTriangle, ArrowRight, Bell, BellOff, CalendarClock, Clock3,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DesktopApi, NotificationItem } from "./api";
import { formatDate, reminderStageLabel, type ReminderStageBadge } from "./presentation";
import "./notifications.css";

export function isNotificationOverdue(
  item: Pick<NotificationItem, "kind" | "due_at" | "is_overdue">,
  now: Date,
): boolean {
  const dueMs = Date.parse(item.due_at);
  const pastDue = Number.isFinite(dueMs) && dueMs < now.getTime();
  if (item.kind === "task_deadline") {
    return typeof item.is_overdue === "boolean" ? item.is_overdue : pastDue;
  }
  return item.is_overdue === true || pastDue;
}

export function notificationStageBadge(
  item: Pick<NotificationItem, "kind" | "due_at" | "lead_hours" | "is_overdue">,
  now: Date,
): ReminderStageBadge | null {
  if (item.kind !== "task_deadline") return null;
  return reminderStageLabel(item.lead_hours, isNotificationOverdue(item, now));
}

export function NotificationStageBadge({
  stage,
  compact = false,
}: {
  stage: ReminderStageBadge;
  compact?: boolean;
}) {
  const Icon = stage.tone === "overdue"
    ? AlertCircle
    : stage.tone === "urgent"
      ? AlertTriangle
      : CalendarClock;
  return (
    <span
      className={`mc-notification-stage mc-notification-stage-${stage.tone}${compact ? " mc-notification-stage-compact" : ""}`}
      data-stage-tone={stage.tone}
    >
      <Icon size={compact ? 12 : 13} aria-hidden="true" />
      <span>{stage.label}</span>
    </span>
  );
}

interface BellProps {
  api: DesktopApi;
  revision?: number;
  unreadCount: number | null;
  unreadError?: boolean;
  notificationOpen: boolean;
  onOpen: () => void;
}

type Preview = { items: NotificationItem[]; error: boolean } | null;

export function NotificationBell({
  api, revision = 0, unreadCount, unreadError, notificationOpen, onOpen,
}: BellProps) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<Preview>(null);
  const [retry, setRetry] = useState(0);
  const handingOff = useRef(false);
  const hasUnread = unreadCount != null && unreadCount > 0;
  const bellLabel = hasUnread ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo";
  const now = new Date();

  useEffect(() => {
    if (!expanded) return;
    let current = true;
    void api.notificationList({ filter: "unread", limit: 4 }).then(
      (page) => { if (current) setPreview({ items: page.items, error: false }); },
      () => { if (current) setPreview({ items: [], error: true }); },
    );
    return () => { current = false; };
  }, [api, expanded, retry, revision]);

  function changeOpen(open: boolean) {
    if (open) {
      handingOff.current = false;
      setPreview(null);
    }
    setExpanded(open);
  }

  return (
    // Chronicle NotificationBellBody: badge and heading, bounded item viewport, then full-list handoff.
    <Popover.Root open={expanded} onOpenChange={changeOpen}>
      <Popover.Trigger type="button" className="mc-icon-button mc-notification-bell" aria-label={bellLabel}
        aria-current={notificationOpen ? "page" : undefined} title={bellLabel}>
        <Bell size={18} aria-hidden="true" />
        {hasUnread && <span className="mc-notification-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12}
          className="mc-notification-positioner">
          <Popover.Popup className="mc-notification-popover" finalFocus={() => !handingOff.current}>
            <div className="mc-notification-popover-heading">
              <Popover.Title>Thông báo chưa đọc</Popover.Title>
              {hasUnread && <span className="mc-notification-popover-count">{unreadCount}</span>}
            </div>
            {unreadError && !preview?.error && <p className="mc-notification-preview-state">Chưa cập nhật được số lượng.</p>}
            {!preview && <p role="status" className="mc-notification-preview-state">Đang tải thông báo…</p>}
            {preview?.error && <div className="mc-notification-preview-state">
              <p role="alert">Chưa tải được bản xem nhanh.</p>
              <button type="button" className="mc-text-button" onClick={() => {
                setPreview(null);
                setRetry((value) => value + 1);
              }}>Thử lại</button>
            </div>}
            {preview && !preview.error && preview.items.length === 0 && (
              <p className="mc-notification-preview-state mc-notification-preview-empty">
                <BellOff size={18} aria-hidden="true" /> Không có thông báo chưa đọc.
              </p>
            )}
            {!!preview?.items.length && <ul className="mc-notification-preview">
              {preview.items.map((item) => {
                const stage = notificationStageBadge(item, now);
                const TileIcon = item.kind === "commitment_follow_up" ? Clock3 : CalendarClock;
                return (
                  <li key={item.id} className="mc-notification-preview-row" data-event-id={item.id}>
                    <span className="mc-notification-tile" aria-hidden="true"><TileIcon size={16} /></span>
                    <div className="mc-notification-preview-content">
                      <p>{item.title}<span className="mc-notification-unread-dot" aria-hidden="true" /></p>
                      <div className="mc-notification-preview-meta">
                        {stage && <NotificationStageBadge stage={stage} compact />}
                        <time dateTime={item.due_at}>{formatDate(item.due_at, true)}</time>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>}
            <div className="mc-notification-popover-footer">
              <Popover.Close type="button" className="mc-text-button" onClick={() => {
                handingOff.current = true;
                onOpen();
              }}>
                Xem tất cả thông báo <ArrowRight size={17} aria-hidden="true" />
              </Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
