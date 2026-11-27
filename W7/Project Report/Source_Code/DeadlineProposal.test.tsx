import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { DesktopApi, SetReminderPresetsInput, Task } from "./api";
import { DeadlineDialog } from "./DeadlineDialog";

const task: Task = {
  id: "task-1", title: "Gửi dự án", state: "not_started", owner: null, importance: "normal",
  estimated_minutes: null, message_id: null, deadline_effective: "2026-11-20T07:30:00Z",
  deadline_authored: "2026-11-20T14:30:00+07:00", version: 3,
  created_at: "2026-11-18T01:30:00Z", updated_at: "2026-11-18T02:30:00Z",
};

function local(instant: string) {
  const date = new Date(instant);
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    offset: `${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`,
  };
}

it("prefills the email deadline and replaces the current one only when saved", async () => {
  const setTaskDeadline = vi.fn<DesktopApi["setTaskDeadline"]>(async ({ change }) => ({
    task: { ...task, version: 4, deadline_authored: change.kind === "clear" ? null : change.instant },
    history_id: "history-1",
  }));
  const api = {
    setTaskDeadline,
    taskDeadlineHistory: vi.fn(async () => ({ items: [], next_cursor: null })),
  } as unknown as DesktopApi;
  const onSaved = vi.fn();
  const proposal = { suggestionId: "a".repeat(64), instant: "2026-11-22T07:30:00Z", reason: "Theo email: “Đổi hạn sang thứ Bảy”" };
  render(<DeadlineDialog api={api} task={task} proposal={proposal} onClose={vi.fn()} onSaved={onSaved} />);
  const expected = local(proposal.instant);

  expect(screen.getByRole("note")).toHaveTextContent("Hạn hiện tại chỉ thay đổi khi bạn bấm Lưu hạn chót");
  expect(screen.getByText(/Hạn chót hiện tại/).parentElement).toHaveTextContent("20/11/2026 14:30 (UTC+07:00)");
  expect(screen.getByLabelText("Ngày")).toHaveValue(expected.date);
  expect(screen.getByLabelText("Giờ")).toHaveValue(expected.time);
  expect(screen.getByLabelText("Độ lệch UTC")).toHaveValue(expected.offset);
  expect(screen.getByLabelText("Lý do")).toHaveValue(proposal.reason);
  expect(setTaskDeadline).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Lưu hạn chót" }));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const saved = setTaskDeadline.mock.calls[0][0];
  expect(saved).toMatchObject({ task_id: task.id, expected_version: 3 });
  expect(saved.change).toEqual({
    kind: "set_from_proposal",
    instant: `${expected.date}T${expected.time}${expected.offset}`,
    reason: proposal.reason,
    suggestion_id: proposal.suggestionId,
  });
  expect(new Date(saved.change.kind === "clear" ? "" : saved.change.instant).toISOString()).toBe("2026-11-22T07:30:00.000Z");
});

it("blocks a stale proposal and asks the work brief to refresh", async () => {
  const setTaskDeadline = vi.fn<DesktopApi["setTaskDeadline"]>()
    .mockRejectedValue({ code: "deadline_proposal_stale" });
  const api = {
    setTaskDeadline,
    taskDeadlineHistory: vi.fn(async () => ({ items: [], next_cursor: null })),
  } as unknown as DesktopApi;
  const onSaved = vi.fn();
  const onProposalStale = vi.fn();
  render(<DeadlineDialog api={api} task={task}
    proposal={{ suggestionId: "a".repeat(64), instant: "2026-11-22T07:30:00Z", reason: "Theo email" }}
    onClose={vi.fn()} onSaved={onSaved} onProposalStale={onProposalStale} />);

  fireEvent.click(screen.getByRole("button", { name: "Lưu hạn chót" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Hạn trong thư đã thay đổi");
  expect(screen.getByRole("button", { name: "Lưu hạn chót" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Xóa hạn chót" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Đóng" })).toBeEnabled();
  expect(onProposalStale).toHaveBeenCalledOnce();
  expect(onSaved).not.toHaveBeenCalled();
});

it("saves preset-only changes via setReminderPresets without requiring a deadline reason and supports empty [] and account defaults", async () => {
  const setTaskDeadline = vi.fn<DesktopApi["setTaskDeadline"]>();
  const setReminderPresets = vi.fn(async (input: SetReminderPresetsInput) => ({
    task_id: input.task_id ?? null,
    lead_hours: input.lead_hours,
    version: (input.expected_version ?? 3) + 1,
  }));
  const api = {
    setTaskDeadline,
    setReminderPresets,
    taskDeadlineHistory: vi.fn(async () => ({ items: [], next_cursor: null })),
  } as unknown as DesktopApi;
  const onSaved = vi.fn();

  render(
    <DeadlineDialog
      api={api}
      task={task}
      accountReminderPresets={[168, 48, 24]}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );

  const group = screen.getByRole("group", { name: "Mốc nhắc trước hạn" });
  const weekChip = within(group).getByRole("button", { name: "1 tuần" });
  const twoDaysChip = within(group).getByRole("button", { name: "2 ngày" });
  const oneDayChip = within(group).getByRole("button", { name: "1 ngày" });
  expect(weekChip).toHaveAttribute("aria-pressed", "true");
  expect(twoDaysChip).toHaveAttribute("aria-pressed", "true");
  expect(oneDayChip).toHaveAttribute("aria-pressed", "true");

  // Toggle "2 ngày" off -> [168, 24], save without entering reason (Branch B)
  fireEvent.click(twoDaysChip);
  expect(twoDaysChip).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Dùng mặc định tài khoản" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Lưu hạn chót" }));
  await waitFor(() => expect(setReminderPresets).toHaveBeenCalledTimes(1));
  expect(setReminderPresets).toHaveBeenCalledWith(expect.objectContaining({
    task_id: task.id,
    lead_hours: [168, 24],
    expected_version: 3,
  }));
  expect(setTaskDeadline).not.toHaveBeenCalled();
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
    id: task.id,
    reminder_lead_hours: [168, 24],
    version: 4,
  }));
  expect(await screen.findByText("Đã lưu mốc nhắc trước hạn.")).toBeVisible();

  // Clear remaining chips -> [] (overdue-only reminder)
  fireEvent.click(weekChip);
  fireEvent.click(oneDayChip);
  expect(screen.getByText("Chỉ nhắc khi quá hạn.")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Lưu hạn chót" }));
  await waitFor(() => expect(setReminderPresets).toHaveBeenCalledTimes(2));
  expect(setReminderPresets).toHaveBeenNthCalledWith(2, expect.objectContaining({
    task_id: task.id,
    lead_hours: [],
    expected_version: 4,
  }));

  // Restore account default [168, 48, 24]
  fireEvent.click(screen.getByRole("button", { name: "Dùng mặc định tài khoản" }));
  expect(weekChip).toHaveAttribute("aria-pressed", "true");
  expect(twoDaysChip).toHaveAttribute("aria-pressed", "true");
  expect(oneDayChip).toHaveAttribute("aria-pressed", "true");
});

it("attaches reminder_lead_hours when saving a deadline change together and hides presets in clearMode", async () => {
  const setTaskDeadline = vi.fn<DesktopApi["setTaskDeadline"]>(async (input) => ({
    task: {
      ...task,
      version: input.expected_version + 1,
      deadline_authored: input.change.kind === "clear" ? null : input.change.instant,
      deadline_effective: input.change.kind === "clear" ? null : "2026-11-25T07:30:00Z",
    },
    history_id: "history-2",
  }));
  const api = {
    setTaskDeadline,
    taskDeadlineHistory: vi.fn(async () => ({ items: [], next_cursor: null })),
  } as unknown as DesktopApi;

  render(<DeadlineDialog api={api} task={task} onClose={vi.fn()} onSaved={vi.fn()} />);

  const group = screen.getByRole("group", { name: "Mốc nhắc trước hạn" });
  fireEvent.click(within(group).getByRole("button", { name: "1 tuần" }));
  fireEvent.change(screen.getByLabelText("Ngày"), { target: { value: "2026-11-25" } });
  fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Gia hạn cùng mốc nhắc mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu hạn chót" }));

  await waitFor(() => expect(setTaskDeadline).toHaveBeenCalledTimes(1));
  expect(setTaskDeadline).toHaveBeenCalledWith(expect.objectContaining({
    task_id: task.id,
    expected_version: 3,
    reminder_lead_hours: [48, 24],
  }));

  // Switching to clearMode hides preset chips and omits reminder_lead_hours
  fireEvent.click(screen.getByRole("button", { name: "Xóa hạn chót" }));
  expect(screen.queryByRole("group", { name: "Mốc nhắc trước hạn" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Hủy hạn" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa hạn chót" }));

  await waitFor(() => expect(setTaskDeadline).toHaveBeenCalledTimes(2));
  expect("reminder_lead_hours" in setTaskDeadline.mock.calls[1][0]).toBe(false);
});

it("surfaces §6 invalid_reminder_presets error and reuses request_key on retry", async () => {
  const customTask: Task = { ...task, reminder_lead_hours: [72, 24] };
  const setReminderPresets = vi.fn()
    .mockRejectedValueOnce({ code: "invalid_reminder_presets" })
    .mockResolvedValueOnce({ task_id: task.id, lead_hours: [24], version: 4 });
  const api = {
    setTaskDeadline: vi.fn(),
    setReminderPresets,
    taskDeadlineHistory: vi.fn(async () => ({ items: [], next_cursor: null })),
  } as unknown as DesktopApi;

  render(<DeadlineDialog api={api} task={customTask} onClose={vi.fn()} onSaved={vi.fn()} />);

  const group = screen.getByRole("group", { name: "Mốc nhắc trước hạn" });
  fireEvent.click(within(group).getByRole("button", { name: "Bỏ mốc nhắc 3 ngày" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu hạn chót" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Chọn mốc nhắc từ 1 giờ đến 30 ngày.");
  fireEvent.click(screen.getByRole("button", { name: "Lưu hạn chót" }));

  await waitFor(() => expect(setReminderPresets).toHaveBeenCalledTimes(2));
  expect(setReminderPresets.mock.calls[1][0].request_key).toBe(setReminderPresets.mock.calls[0][0].request_key);
});
