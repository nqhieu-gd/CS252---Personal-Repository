import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskEditor } from "../../src/features/tasks/TaskEditor";
import { createMockClient } from "../../src/api/mock";
import { UiMemory, UiSessionProvider } from "../../src/uiSession";
import type { AccountScope, TaskView } from "../../src/api/types";
import { ApiError } from "../../src/api/client";

describe("TaskEditor W02 Deadline and Linking features", () => {
  const scope: AccountScope = { workspace_id: "ws-mock", account_id: "a" };
  const baseTask: TaskView = {
    id: "task-1",
    workspace_id: "ws-mock",
    account_id: "a",
    version: 1,
    state: "not_started",
    title: "Project Report",
    owner: null,
    deadline_effective: "2026-11-15T12:00:00Z",
    estimated_minutes: null,
    importance: "normal",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    confirmed_from_candidate_id: null,
    message_ids: ["msg-1"],
    evidence_ids: [],
  };

  function clientWithTask(task = baseTask) {
    return createMockClient({ workspaceId: "ws-mock", accounts: [{
      id: "a", display_name: "Account A", tasks: [{ ...task }],
      messages: [{ id: "msg-1", subject: "Kickoff", body_text: "Body" },
        { id: "msg-2", subject: "Older report", body_text: "Report" }],
    }] });
  }

  it("updates deadline with reason and displays UTC preview", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      accounts: [
        {
          id: "a",
          display_name: "Account A",
          tasks: [{ ...baseTask }],
          messages: [{ id: "msg-1", subject: "Kickoff", body_text: "Body" }],
        },
      ],
    });

    const spy = vi.spyOn(client, "confirmTaskDeadline");
    const onSaved = vi.fn();

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <TaskEditor client={client} scope={scope} task={baseTask} onSaved={onSaved} />
      </UiSessionProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Đổi hạn chót" }));
    expect(screen.getByLabelText("Ngày và giờ đến hạn")).toBeVisible();

    // Type new reason
    const reasonInput = screen.getByPlaceholderText("Nhập lý do xác nhận hạn chót (1–500 ký tự)");
    await userEvent.type(reasonInput, "Phê duyệt kế hoạch mới");

    // Click confirm deadline
    const confirmBtn = screen.getByRole("button", { name: "Xác nhận hạn chót" });
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0][1]).toBe("task-1");
    expect(spy.mock.calls[0][2].reason).toBe("Phê duyệt kế hoạch mới");
    expect(await screen.findByText("Đã cập nhật hạn chót.")).toBeInTheDocument();
  });

  it("clears deadline and shows cleared status", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      accounts: [
        {
          id: "a",
          display_name: "Account A",
          tasks: [{ ...baseTask }],
          messages: [{ id: "msg-1", subject: "Kickoff", body_text: "Body" }],
        },
      ],
    });

    const spy = vi.spyOn(client, "confirmTaskDeadline");

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <TaskEditor client={client} scope={scope} task={baseTask} />
      </UiSessionProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Đổi hạn chót" }));
    const reasonInput = screen.getByPlaceholderText("Nhập lý do xác nhận hạn chót (1–500 ký tự)");
    await userEvent.type(reasonInput, "Hủy mốc hạn");

    const clearBtn = screen.getByRole("button", { name: "Xóa hạn chót" });
    await userEvent.click(clearBtn);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0][2].deadline).toBeNull();
    expect(await screen.findByText("Đã xóa hạn chót.")).toBeInTheDocument();
  });

  it("opens deadline history modal and lists previous changes", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      accounts: [
        {
          id: "a",
          display_name: "Account A",
          tasks: [{ ...baseTask }],
          messages: [{ id: "msg-1", subject: "Kickoff", body_text: "Body" }],
        },
      ],
    });

    // Populate a deadline entry first
    await client.confirmTaskDeadline(scope, "task-1", {
      deadline: "2026-11-20T10:00:00Z",
      source_kind: "manual",
      reason: "Gia hạn thêm 5 ngày",
      evidence_id: null,
      expected_version: 1,
      idempotency_key: "key-seed-dl",
    });

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <TaskEditor client={client} scope={scope} task={baseTask} />
      </UiSessionProvider>,
    );

    const historyBtn = screen.getByRole("button", { name: /Lịch sử thay đổi hạn chót/ });
    await userEvent.click(historyBtn);

    expect(await screen.findByText("Gia hạn thêm 5 ngày")).toBeInTheDocument();
  });

  it("handles email unlink error when origin link is required", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      accounts: [
        {
          id: "a",
          display_name: "Account A",
          tasks: [{ ...baseTask }],
          messages: [{ id: "msg-1", subject: "Kickoff", body_text: "- [ ] Task 1" }],
        },
      ],
    });

    vi.spyOn(client, "unlinkTaskMessage").mockRejectedValue(
      new (await import("../../src/api/client")).ApiError(
        409,
        "origin_link_required",
        "Không thể gỡ liên kết email nguồn gốc của công việc.",
      ),
    );

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <TaskEditor client={client} scope={scope} task={baseTask} />
      </UiSessionProvider>,
    );

    // Unlink button next to msg-1
    const unlinkBtn = screen.getByRole("button", { name: "Gỡ liên kết" });
    await userEvent.click(unlinkBtn);

    // 409 origin_link_required displayed in error alert
    expect(await screen.findByText("Không thể gỡ liên kết email nguồn gốc của công việc.")).toBeInTheDocument();
  });

  it("uses the selected UTC offset and preserves confirmed seconds when unchanged", async () => {
    const precise = { ...baseTask, deadline_effective: "2026-11-15T12:00:37.123Z" };
    const client = clientWithTask(precise);
    const save = vi.spyOn(client, "confirmTaskDeadline");
    render(<UiSessionProvider memory={new UiMemory()}><TaskEditor client={client} scope={scope} task={precise} /></UiSessionProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Đổi hạn chót" }));
    const reason = screen.getByPlaceholderText("Nhập lý do xác nhận hạn chót (1–500 ký tự)");
    await userEvent.type(reason, "Giữ đúng thời điểm nguồn");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận hạn chót" }));
    await screen.findByText("Đã cập nhật hạn chót.");
    expect(save.mock.calls[0][2].deadline).toBe(precise.deadline_effective);

    await userEvent.click(screen.getByRole("button", { name: "Đổi hạn chót" }));
    const date = screen.getByLabelText("Ngày và giờ đến hạn");
    fireEvent.change(date, { target: { value: "2026-11-20T17:00" } });
    const offset = screen.getByLabelText("Múi giờ (UTC)");
    await userEvent.clear(offset);
    await userEvent.type(offset, "+07:00");
    expect(screen.getByText(/Giờ quốc tế \(UTC\)/).querySelector("time"))
      .toHaveAttribute("dateTime", "2026-11-20T10:00:00.000Z");
    await userEvent.type(screen.getByPlaceholderText("Nhập lý do xác nhận hạn chót (1–500 ký tự)"), "Xác nhận theo UTC+7");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận hạn chót" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][2].deadline).toBe("2026-11-20T10:00:00.000Z");
  });

  it("replays the same deadline snapshot after an ambiguous response and remount", async () => {
    const client = clientWithTask();
    const original = client.confirmTaskDeadline;
    const save = vi.spyOn(client, "confirmTaskDeadline");
    save.mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new ApiError(0, "network_error", "response lost");
    });
    const memory = new UiMemory();
    const renderEditor = () => render(<UiSessionProvider memory={memory}><TaskEditor client={client} scope={scope} task={baseTask} /></UiSessionProvider>);
    const first = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Đổi hạn chót" }));
    fireEvent.change(screen.getByLabelText("Ngày và giờ đến hạn"), { target: { value: "2026-11-20T17:00" } });
    await userEvent.type(screen.getByPlaceholderText("Nhập lý do xác nhận hạn chót (1–500 ký tự)"), "Giữ lý do đã gửi");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận hạn chót" }));
    await screen.findByRole("button", { name: "Thử lại yêu cầu" });
    first.unmount();
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại yêu cầu" }));
    await screen.findByText("Đã cập nhật hạn chót.");
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][2]).toEqual(save.mock.calls[0][2]);
    expect((await client.listDeadlineHistory(scope, baseTask.id, { limit: 50 })).items).toHaveLength(1);
  });

  it("loads older deadline history and displays its source and version", async () => {
    const client = clientWithTask();
    const entry = {
      id: "history-2", task_id: baseTask.id, previous_deadline: null,
      new_deadline: baseTask.deadline_effective, source_kind: "manual" as const,
      evidence_id: null, reason: "Lần xác nhận gần nhất", actor: "local_user" as const,
      created_at: "2026-11-01T00:00:00Z", task_version: 3,
    };
    const history = vi.spyOn(client, "listDeadlineHistory")
      .mockResolvedValueOnce({ items: [entry], next_cursor: "older" })
      .mockResolvedValueOnce({ items: [{ ...entry, id: "history-1", reason: "Lần xác nhận trước", task_version: 2 }], next_cursor: null });
    render(<UiSessionProvider memory={new UiMemory()}><TaskEditor client={client} scope={scope} task={baseTask} /></UiSessionProvider>);
    await userEvent.click(screen.getByRole("button", { name: /Lịch sử thay đổi hạn chót/ }));
    await screen.findByText("Lần xác nhận gần nhất");
    await userEvent.click(screen.getByRole("button", { name: "Xem lịch sử trước" }));
    await screen.findByText("Lần xác nhận trước");
    expect(screen.getByText("Lần xác nhận gần nhất")).toBeInTheDocument();
    expect(screen.getByText("Người dùng xác nhận · Phiên bản 2")).toBeInTheDocument();
    expect(history.mock.calls[1][2]).toEqual({ limit: 50, cursor: "older" });
  });

  it("paginates the scoped email picker and sends search to the server", async () => {
    const client = clientWithTask();
    const source = await client.getMessage(scope, "msg-1");
    const older = await client.getMessage(scope, "msg-2");
    const list = vi.spyOn(client, "listMessages")
      .mockResolvedValueOnce({ items: [source], next_cursor: "older" })
      .mockResolvedValueOnce({ items: [older], next_cursor: null });
    const search = vi.spyOn(client, "searchMessages").mockResolvedValue({ items: [older], next_cursor: null });
    render(<UiSessionProvider memory={new UiMemory()}><TaskEditor client={client} scope={scope} task={baseTask} /></UiSessionProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Thêm email liên quan" }));
    await userEvent.click(await screen.findByRole("button", { name: "Xem thêm email" }));
    await screen.findByText("Older report");
    expect(list.mock.calls[1][1]).toEqual({ limit: 30, cursor: "older" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Tìm email" }), "report");
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(scope, { limit: 30, cursor: undefined, q: "report" }, { signal: expect.any(AbortSignal) }));
  });
});
