import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { desktopApi, type DesktopApi, type NotificationItem } from "./api";
import { NotificationBell } from "./NotificationBell";
import { NotificationsView } from "./NotificationsView";

function fixture() {
  const initial: NotificationItem = {
    id: "task_deadline:report:2030-01-03",
    title: "Nộp báo cáo",
    kind: "task_deadline",
    task_id: "task-report",
    message_id: "mail-report",
    due_at: new Date(Date.now() + 3_600_000).toISOString(),
    version: 0,
    read_at: null,
    snoozed_until: null,
  };
  return initial;
}

function nativeFixture() {
  let item = fixture();
  let before = item;
  const notificationList = vi.fn<DesktopApi["notificationList"]>(async ({ filter }) => {
    const snoozed = item.snoozed_until != null && Date.parse(item.snoozed_until) > Date.now();
    const matches = filter === "snoozed" ? snoozed : filter !== "unread" || (item.read_at == null && !snoozed);
    return { items: matches ? [item] : [], next_cursor: null };
  });
  const notificationAct = vi.fn<DesktopApi["notificationAct"]>(async (input) => {
    before = item;
    const read = input.action.kind === "read" ? new Date().toISOString()
      : input.action.kind === "unread" ? null : item.read_at;
    const snooze = input.action.kind === "snooze" ? input.action.until
      : input.action.kind === "unsnooze" ? null : item.snoozed_until;
    item = { ...item, read_at: read, snoozed_until: snooze, version: item.version + 1 };
    return { item, undo: {
      event_id: item.id, expected_version: item.version, action_request_key: input.request_key,
    } };
  });
  const notificationUndo = vi.fn<DesktopApi["notificationUndo"]>(async () => {
    item = { ...before, version: item.version + 1 };
    return item;
  });
  return { ...desktopApi, notificationList, notificationAct, notificationUndo };
}

function sourceCallbacks() {
  return { onCountChange: vi.fn(), onOpenTask: vi.fn(), onOpenMail: vi.fn() };
}

it("retains the mutation key when the outcome is uncertain and undoes the confirmed read", async () => {
  const user = userEvent.setup();
  const api = nativeFixture();
  const props = sourceCallbacks();
  api.notificationAct.mockRejectedValueOnce(new Error("response lost"));
  render(<NotificationsView api={api} {...props} />);

  await user.click(screen.getByRole("button", { name: "Chưa đọc" }));
  const mark = await screen.findByRole("button", { name: "Đánh dấu đã đọc: Nộp báo cáo" });
  await user.click(screen.getByRole("button", { name: "Mở công việc: Nộp báo cáo" }));
  await user.click(screen.getByRole("button", { name: "Mở email nguồn: Nộp báo cáo" }));
  expect(props.onOpenTask).toHaveBeenCalledWith("task-report");
  expect(props.onOpenMail).toHaveBeenCalledWith("mail-report");
  await user.click(mark);
  expect(await screen.findByRole("alert")).toHaveTextContent("Chưa biết thay đổi đã được lưu hay chưa");
  expect(mark).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "Kiểm tra lại thao tác" }));
  expect(await screen.findByText("Không có thông báo chưa đọc.")).toBeVisible();
  expect(api.notificationAct.mock.calls[1]?.[0]).toEqual(api.notificationAct.mock.calls[0]?.[0]);
  expect(props.onCountChange).toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Hoàn tác" }));
  expect(await screen.findByText("Nộp báo cáo")).toBeVisible();
  expect(api.notificationUndo).toHaveBeenCalledWith(expect.objectContaining({
    event_id: fixture().id,
    expected_version: 1,
    action_request_key: api.notificationAct.mock.calls[0]?.[0].request_key,
  }));
  expect(screen.queryByRole("button", { name: "Hoàn tác" })).not.toBeInTheDocument();
});

it("validates a custom snooze and shows the native snoozed state across a remount", async () => {
  const user = userEvent.setup();
  const api = nativeFixture();
  const props = sourceCallbacks();
  const first = render(<NotificationsView api={api} {...props} />);
  await user.click(await screen.findByRole("button", { name: "Hoãn nhắc: Nộp báo cáo" }));
  const dialog = within(screen.getByRole("dialog", { name: "Hoãn nhắc việc" }));
  fireEvent.change(dialog.getByLabelText("Hoặc chọn ngày giờ"), { target: { value: "2000-01-01T00:00" } });
  await user.click(dialog.getByRole("button", { name: "Lưu giờ nhắc" }));
  expect(dialog.getByRole("alert")).toHaveTextContent("Chọn ngày và giờ sau hiện tại.");
  expect(api.notificationAct).not.toHaveBeenCalled();

  await user.click(dialog.getByRole("button", { name: "Sau 1 giờ" }));
  expect(await screen.findByText("Đã hoãn nhắc việc.")).toBeVisible();
  expect(api.notificationAct).toHaveBeenCalledWith(expect.objectContaining({
    expected_version: 0,
    action: { kind: "snooze", until: expect.stringMatching(/Z$/) },
  }));
  first.unmount();

  render(<NotificationsView api={api} {...props} />);
  await user.click(screen.getByRole("button", { name: "Đã hoãn" }));
  expect(await screen.findByText(/Nhắc lại lúc/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Bỏ hoãn: Nộp báo cáo" }));
  expect(await screen.findByText("Hiện không có thông báo đang hoãn.")).toBeVisible();
  expect(api.notificationAct).toHaveBeenLastCalledWith(expect.objectContaining({
    expected_version: 1, action: { kind: "unsnooze" },
  }));
});

it("uses a bounded unread preview, restores focus on Escape, and hands off focus to the full list", async () => {
  const user = userEvent.setup();
  const api = nativeFixture();
  render(<>
    <h1 id="all-notifications" tabIndex={-1}>Danh sách đầy đủ</h1>
    <NotificationBell api={api} unreadCount={104} notificationOpen={false}
      onOpen={() => document.getElementById("all-notifications")?.focus()} />
  </>);
  const bell = screen.getByRole("button", { name: "Thông báo (104 chưa đọc)" });
  expect(within(bell).getByText("99+")).toBeVisible();
  await user.click(bell);
  expect(await screen.findByText("Nộp báo cáo")).toBeVisible();
  expect(api.notificationList).toHaveBeenCalledWith({ filter: "unread", limit: 4 });
  await user.keyboard("{Escape}");
  await waitFor(() => expect(bell).toHaveFocus());

  await user.click(bell);
  await user.click(screen.getByRole("button", { name: "Xem tất cả thông báo" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Danh sách đầy đủ" })).toHaveFocus());
});

it("renders 4 independent FD-09 stages for the same task and scopes read, snooze, and undo to the exact event_key", async () => {
  const user = userEvent.setup();
  const dueIso = "2030-01-10T10:00:00Z";
  let items: NotificationItem[] = [
    {
      id: `task_deadline:t1:${dueIso}:lead_168h`,
      title: "Nộp đồ án CS252",
      kind: "task_deadline",
      task_id: "t1",
      message_id: null,
      due_at: dueIso,
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: 168,
      is_overdue: false,
    },
    {
      id: `task_deadline:t1:${dueIso}:lead_48h`,
      title: "Nộp đồ án CS252",
      kind: "task_deadline",
      task_id: "t1",
      message_id: null,
      due_at: dueIso,
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: 48,
      is_overdue: false,
    },
    {
      id: `task_deadline:t1:${dueIso}:lead_24h`,
      title: "Nộp đồ án CS252",
      kind: "task_deadline",
      task_id: "t1",
      message_id: null,
      due_at: dueIso,
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: 24,
      is_overdue: false,
    },
    {
      id: `task_deadline:t1:${dueIso}:overdue`,
      title: "Nộp đồ án CS252",
      kind: "task_deadline",
      task_id: "t1",
      message_id: null,
      due_at: dueIso,
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: null,
      is_overdue: true,
    },
  ];
  const history = new Map<string, NotificationItem>();

  const notificationList = vi.fn<DesktopApi["notificationList"]>(async () => ({
    items: [...items],
    next_cursor: null,
  }));
  const notificationAct = vi.fn<DesktopApi["notificationAct"]>(async (input) => {
    const idx = items.findIndex((entry) => entry.id === input.event_id);
    const prev = items[idx];
    history.set(input.event_id, prev);
    const updated: NotificationItem = {
      ...prev,
      read_at: input.action.kind === "read" ? new Date().toISOString()
        : input.action.kind === "unread" ? null : prev.read_at,
      snoozed_until: input.action.kind === "snooze" ? input.action.until
        : input.action.kind === "unsnooze" ? null : prev.snoozed_until,
      version: prev.version + 1,
    };
    items = items.map((entry, i) => (i === idx ? updated : entry));
    return {
      item: updated,
      undo: { event_id: updated.id, expected_version: updated.version, action_request_key: input.request_key },
    };
  });
  const notificationUndo = vi.fn<DesktopApi["notificationUndo"]>(async (input) => {
    const prev = history.get(input.event_id)!;
    const restored: NotificationItem = { ...prev, version: input.expected_version + 1 };
    items = items.map((entry) => (entry.id === input.event_id ? restored : entry));
    return restored;
  });

  const api = { ...desktopApi, notificationList, notificationAct, notificationUndo };
  const { container } = render(<NotificationsView api={api} {...sourceCallbacks()} />);

  expect(await screen.findByText("Còn 1 tuần")).toBeVisible();
  expect(screen.getByText("Còn 2 ngày")).toBeVisible();
  expect(screen.getByText("Còn 1 ngày")).toBeVisible();
  expect(screen.getByText("Quá hạn")).toBeVisible();

  const weekRow = container.querySelector(`[data-event-id="task_deadline:t1:${dueIso}:lead_168h"]`) as HTMLElement;
  const twoDaysRow = container.querySelector(`[data-event-id="task_deadline:t1:${dueIso}:lead_48h"]`) as HTMLElement;
  const oneDayRow = container.querySelector(`[data-event-id="task_deadline:t1:${dueIso}:lead_24h"]`) as HTMLElement;
  const overdueRow = container.querySelector(`[data-event-id="task_deadline:t1:${dueIso}:overdue"]`) as HTMLElement;

  expect(within(weekRow).getByText("Còn 1 tuần").closest("[data-stage-tone]")).toHaveAttribute("data-stage-tone", "soon");
  expect(within(oneDayRow).getByText("Còn 1 ngày").closest("[data-stage-tone]")).toHaveAttribute("data-stage-tone", "urgent");
  expect(within(overdueRow).getByText("Quá hạn").closest("[data-stage-tone]")).toHaveAttribute("data-stage-tone", "overdue");

  // Mark only lead_168h read -> other 3 stages remain unread
  await user.click(within(weekRow).getByRole("button", { name: "Đánh dấu đã đọc: Nộp đồ án CS252" }));
  await waitFor(() => expect(notificationAct).toHaveBeenCalledWith(expect.objectContaining({
    event_id: `task_deadline:t1:${dueIso}:lead_168h`,
    action: { kind: "read" },
  })));
  expect(weekRow).toHaveAttribute("data-unread", "false");
  expect(twoDaysRow).toHaveAttribute("data-unread", "true");
  expect(oneDayRow).toHaveAttribute("data-unread", "true");
  expect(overdueRow).toHaveAttribute("data-unread", "true");

  // Undo lead_168h -> exact event_key restored
  await user.click(screen.getByRole("button", { name: "Hoàn tác" }));
  await waitFor(() => expect(notificationUndo).toHaveBeenCalledWith(expect.objectContaining({
    event_id: `task_deadline:t1:${dueIso}:lead_168h`,
  })));
  expect(weekRow).toHaveAttribute("data-unread", "true");

  // Snooze only lead_48h -> other stages stay unsnoozed
  await user.click(within(twoDaysRow).getByRole("button", { name: "Hoãn nhắc: Nộp đồ án CS252" }));
  const dialog = within(screen.getByRole("dialog", { name: "Hoãn nhắc việc" }));
  await user.click(dialog.getByRole("button", { name: "Sau 1 giờ" }));
  await waitFor(() => expect(notificationAct).toHaveBeenLastCalledWith(expect.objectContaining({
    event_id: `task_deadline:t1:${dueIso}:lead_48h`,
    action: { kind: "snooze", until: expect.stringMatching(/Z$/) },
  })));
  expect(within(twoDaysRow).getByText(/Nhắc lại lúc/)).toBeVisible();
  expect(within(weekRow).queryByText(/Nhắc lại lúc/)).not.toBeInTheDocument();
  expect(within(oneDayRow).queryByText(/Nhắc lại lúc/)).not.toBeInTheDocument();
  expect(within(overdueRow).queryByText(/Nhắc lại lúc/)).not.toBeInTheDocument();
});

it("shows compact stage badges in NotificationBell popover while leaving commitment items untouched", async () => {
  const user = userEvent.setup();
  const dueIso = "2030-01-10T10:00:00Z";
  const previewItems: NotificationItem[] = [
    {
      id: `task_deadline:t1:${dueIso}:lead_168h`,
      title: "Chốt bản báo cáo",
      kind: "task_deadline",
      task_id: "t1",
      message_id: null,
      due_at: dueIso,
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: 168,
      is_overdue: false,
    },
    {
      id: `task_deadline:t1:${dueIso}:lead_24h`,
      title: "Gửi slide thuyết trình",
      kind: "task_deadline",
      task_id: "t2",
      message_id: null,
      due_at: dueIso,
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: 24,
      is_overdue: false,
    },
    {
      id: `task_deadline:t1:${dueIso}:overdue`,
      title: "Nộp biên bản họp",
      kind: "task_deadline",
      task_id: "t3",
      message_id: null,
      due_at: "2020-01-01T10:00:00Z",
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: null,
      is_overdue: true,
    },
    {
      id: "commitment_promise:c1",
      title: "Gửi lại hợp đồng cho đối tác",
      kind: "commitment_promise",
      task_id: "t4",
      message_id: null,
      due_at: dueIso,
      version: 0,
      read_at: null,
      snoozed_until: null,
      lead_hours: null,
      is_overdue: false,
    },
  ];
  const api = {
    ...desktopApi,
    notificationList: vi.fn<DesktopApi["notificationList"]>(async () => ({ items: previewItems, next_cursor: null })),
  };

  render(<NotificationBell api={api} unreadCount={4} notificationOpen={false} onOpen={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Thông báo (4 chưa đọc)" }));

  expect(await screen.findByText("Còn 1 tuần")).toBeVisible();
  expect(screen.getByText("Còn 1 ngày")).toBeVisible();
  expect(screen.getByText("Quá hạn")).toBeVisible();
  const commitRow = screen.getByText("Gửi lại hợp đồng cho đối tác").closest("li")!;
  expect(commitRow.querySelector(".mc-notification-stage")).toBeNull();
});
