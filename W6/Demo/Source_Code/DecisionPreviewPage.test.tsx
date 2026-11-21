import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DecisionPreviewPage } from "../../src/features/decisions/DecisionPreviewPage";
import { createMockClient } from "../../src/api/mock";
import { ApiError } from "../../src/api/client";
import type { AccountView } from "../../src/api/types";

describe("DecisionPreviewPage UI Component", () => {
  const workspaceId = "ws-test";
  const accounts: AccountView[] = [
    { id: "acc-1", workspace_id: workspaceId, kind: "eml", display_name: "Tài khoản EML", status: "connected" },
    { id: "acc-2", workspace_id: workspaceId, kind: "gmail", display_name: "Tài khoản Gmail", status: "connected" },
  ];

  it("enforces account selection between 1 and 8 accounts", async () => {
    const client = createMockClient({ workspaceId, accounts: [{ id: "acc-1", display_name: "Acc 1" }] });
    render(
      <DecisionPreviewPage
        client={client}
        workspaceId={workspaceId}
        accounts={accounts}
        initialAccountId="acc-1"
        onOpenTask={vi.fn()}
      />,
    );

    const previewBtn = screen.getByRole("button", { name: "Xem gợi ý" });
    expect(previewBtn).toBeEnabled();

    // Deselect the only account
    const checkbox = screen.getByRole("checkbox", { name: /Tài khoản EML/i });
    await userEvent.click(checkbox);

    // Now 0 accounts selected -> button disabled and error shown
    expect(previewBtn).toBeDisabled();
    expect(screen.getByText("Vui lòng chọn ít nhất một nguồn email.")).toBeInTheDocument();
  });

  it("runs preview and renders ranking, attention queue, and duplicate groups", async () => {
    const client = createMockClient({
      workspaceId,
      delayMs: 0,
      accounts: [
        {
          id: "acc-1",
          display_name: "Tài khoản EML",
          kind: "eml",
          messages: [
            { id: "m1", subject: "Báo cáo tiến độ", body_text: "Nộp báo cáo trước thứ 6" },
            { id: "m2", subject: "Báo cáo tiến độ dự án", body_text: "Nộp báo cáo dự án" },
          ],
          tasks: [
            { id: "t1", title: "Nộp báo cáo", deadline_effective: "2026-11-10T10:00:00Z", message_ids: ["m1"] },
            { id: "t2", title: "Nộp báo cáo tiến độ", deadline_effective: "2026-11-10T12:00:00Z", message_ids: ["m2"] },
          ],
        },
      ],
    });

    const spy = vi.spyOn(client, "previewDecisions");
    const onOpenTask = vi.fn();

    render(
      <DecisionPreviewPage
        client={client}
        workspaceId={workspaceId}
        accounts={accounts}
        initialAccountId="acc-1"
        onOpenTask={onOpenTask}
      />,
    );

    const previewBtn = screen.getByRole("button", { name: "Xem gợi ý" });
    await userEvent.click(previewBtn);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0][0]).toBe(workspaceId);
    expect(spy.mock.calls[0][1].account_ids).toEqual(["acc-1"]);
    expect(spy.mock.calls[0][1].policy).toEqual({
      deadline_weight: 0.5,
      relevance_weight: 0.3,
      impact_weight: 0.2,
      priority_threshold: 0.6,
      notification_budget: 5,
      reminder_frequency: 1,
      duplicate_threshold: 0.85,
      time_window: 72,
      source_trust_weight: 0.25,
      source_trust: { eml: 1, gmail_fake: 1, gmail: 1 },
    });

    expect(await screen.findByText("Có thể cùng một việc")).toBeInTheDocument();
    expect(screen.getByText("Cần chú ý trước")).toBeInTheDocument();
    expect(screen.queryByText("Điểm hạn")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Các công việc khác"));
    const taskLink = screen.getByText("Nộp báo cáo", { exact: true });
    await userEvent.click(taskLink);
    expect(onOpenTask).toHaveBeenCalledWith(
      { workspace_id: workspaceId, account_id: "acc-1" },
      "t1",
    );
  });

  it("shows stale warning notice when parameters change after preview", async () => {
    const client = createMockClient({
      workspaceId,
      accounts: [
        {
          id: "acc-1",
          display_name: "Tài khoản EML",
          tasks: [{ id: "t1", title: "Task 1" }],
        },
      ],
    });

    render(
      <DecisionPreviewPage
        client={client}
        workspaceId={workspaceId}
        accounts={accounts}
        initialAccountId="acc-1"
        onOpenTask={vi.fn()}
      />,
    );

    // Initial preview
    await userEvent.click(screen.getByRole("button", { name: "Xem gợi ý" }));
    await screen.findByText("Có thể cùng một việc");
    expect(screen.queryByText(/Bạn đã đổi lựa chọn/)).not.toBeInTheDocument();

    // Modify a parameter (e.g. focus terms)
    const focusInput = screen.getByLabelText(/Chủ đề đang quan tâm/);
    await userEvent.type(focusInput, "deadline");

    // Stale banner should appear
    expect(screen.getByText(/Bạn đã đổi lựa chọn/)).toBeInTheDocument();
  });

  it("clears results when their account is fenced", async () => {
    const client = createMockClient({
      workspaceId,
      accounts: [{ id: "acc-1", display_name: "Tài khoản EML", tasks: [{ id: "t1", title: "Bản lưu cũ" }] }],
    });
    const preview = vi.spyOn(client, "previewDecisions");
    render(<DecisionPreviewPage client={client} workspaceId={workspaceId} accounts={accounts}
      initialAccountId="acc-1" onOpenTask={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Xem gợi ý" });
    await userEvent.click(button);
    await screen.findByText("Có thể cùng một việc");
    await userEvent.click(screen.getByText("Các công việc khác"));
    expect(screen.getByText("Bản lưu cũ")).toBeVisible();

    preview.mockRejectedValueOnce(new ApiError(409, "account_data_deleted", "deleted"));
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText("Bản lưu cũ")).not.toBeInTheDocument();
    expect(screen.queryByText("Có thể cùng một việc")).not.toBeInTheDocument();
  });

  it("keeps invalid input for correction and skips the request", async () => {
    const client = createMockClient({ workspaceId, accounts: [{ id: "acc-1", display_name: "Tài khoản EML" }] });
    const preview = vi.spyOn(client, "previewDecisions");
    render(<DecisionPreviewPage client={client} workspaceId={workspaceId} accounts={accounts}
      initialAccountId="acc-1" onOpenTask={vi.fn()} />);

    const focus = screen.getByLabelText(/Chủ đề đang quan tâm/);
    const invalid = "báo ".repeat(21);
    await userEvent.click(focus);
    await userEvent.paste(invalid);
    await userEvent.click(screen.getByRole("button", { name: "Xem gợi ý" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chủ đề quá dài");
    expect(focus).toHaveValue(invalid);
    expect(preview).not.toHaveBeenCalled();
  });
});
