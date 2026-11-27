import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountCleanupReceipt, CreateTaskInput, DesktopApi, GmailSyncEvent, GmailSyncStatus, MailDetail, MailLabel, MailRule, ProfileAccount, RecurrenceView, Task } from "./api";
import { MailCompass } from "./MailCompass";
import { taskFilter } from "./TaskWorklist";
import { GMAIL_SHORTCUTS_STORAGE_KEY } from "./useGmailShortcuts";

const mail: MailDetail = {
  id: "mail-one",
  subject: "Báo cáo dự án",
  sender: "Lan",
  sent_at: "2026-11-19T08:00:00Z",
  received_at: "2026-11-19T08:00:10Z",
  preview: "Vui lòng chuẩn bị báo cáo.",
  has_attachments: false,
  recipients: ["team@example.com"],
  cc: [],
  body_text: 'Lưu nguyên văn: <img src="https://example.test/tracker.png">',
  body_revision: 1,
  body_sha256: "body-hash",
  parser_version: "fixture",
  filename: "report.eml",
  quoted_ranges: [],
  attachment_metadata: [],
  warnings: [],
};

function savedTask(input: CreateTaskInput): Task {
  return {
    id: "task-one", title: input.title, message_id: input.message_id, state: input.state,
    owner: input.owner, importance: input.importance, estimated_minutes: input.estimated_minutes,
    deadline_effective: null, deadline_authored: null,
    version: 1, created_at: "2026-11-19T09:00:00Z", updated_at: "2026-11-19T09:00:00Z",
  };
}

function fixtureApi(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const created: Task[] = [];
  const listMail = overrides.listMail ?? (async () => []);
  const listTasks = overrides.listTasks ?? (async () => []);
  return {
    bootstrap: vi.fn(async () => ({
      workspace_id: "test-workspace", account_id: "test-source",
      workspace_name: "Workspace", account_name: "Local", schema_version: 2,
    })),
    listSources: vi.fn(async () => ({ accounts: [], active_account_id: "", gmail_sign_in_available: false, gmail_sync_available: false, cleanups: [] })),
    createLocalSource: vi.fn(async () => { throw new Error("Unexpected local source creation"); }),
    accountCleanupStatus: vi.fn(async () => null),
    deleteLocalAccount: vi.fn(async () => { throw new Error("Unexpected local account deletion"); }),
    startGmailConnection: vi.fn(async () => { throw new Error("Unexpected sign-in"); }),
    gmailConnectionStatus: vi.fn(async () => { throw new Error("Unexpected sign-in poll"); }),
    cancelGmailConnection: vi.fn(async () => { throw new Error("Unexpected cancellation"); }),
    setGmailSyncConsent: vi.fn(async () => { throw new Error("Unexpected consent"); }),
    disconnectGmail: vi.fn(async () => { throw new Error("Unexpected disconnect"); }),
    gmailSyncStatus: vi.fn(async (account_id) => ({
      account_id, generation: 1, data_version: 0, state: "idle" as const, phase: null, last_synced_at: null,
      retry_at: null, discovered: 0, imported: 0, removed: 0, skipped: 0, has_more: false,
      error_code: null, sync_available: false,
    })),
    requestGmailSync: vi.fn(async () => { throw new Error("Unexpected sync request"); }),
    listMail,
    listTasks,
    listMailLabels: vi.fn(async () => []),
    listMailRules: vi.fn(async () => []),
    createMailRule: vi.fn(async () => { throw new Error("Unexpected rule creation"); }),
    updateMailRule: vi.fn(async () => { throw new Error("Unexpected rule update"); }),
    deleteMailRule: vi.fn(async () => { throw new Error("Unexpected rule deletion"); }),
    applyMailRule: vi.fn(async () => { throw new Error("Unexpected rule apply"); }),
    setMailRead: vi.fn(async () => { throw new Error("Unexpected read change"); }),
    decisionPreview: vi.fn(async () => { throw new Error("Unexpected decision preview"); }),
    calendarAgenda: vi.fn(async () => { throw new Error("Unexpected calendar request"); }),
    notificationList: vi.fn(async () => ({ items: [], next_cursor: null })),
    notificationCount: vi.fn(async () => ({ unread_count: 0, as_of: mail.received_at })),
    notificationAct: vi.fn(async () => { throw new Error("Unexpected notification update"); }),
    notificationUndo: vi.fn(async () => { throw new Error("Unexpected notification Undo"); }),
    getCalendarBlock: vi.fn(async () => { throw new Error("Unexpected calendar request"); }),
    createCalendarBlock: vi.fn(async () => { throw new Error("Unexpected calendar request"); }),
    updateCalendarBlock: vi.fn(async () => { throw new Error("Unexpected calendar request"); }),
    deleteCalendarBlock: vi.fn(async () => { throw new Error("Unexpected calendar request"); }),
    restoreCalendarBlock: vi.fn(async () => { throw new Error("Unexpected calendar request"); }),
    capacityPreview: vi.fn(async () => { throw new Error("Unexpected scheduling request"); }),
    listRecurrences: vi.fn(async () => { throw new Error("Unexpected scheduling request"); }),
    createRecurrence: vi.fn(async () => { throw new Error("Unexpected scheduling request"); }),
    updateRecurrence: vi.fn(async () => { throw new Error("Unexpected scheduling request"); }),
    deleteRecurrence: vi.fn(async () => { throw new Error("Unexpected scheduling request"); }),
    materializeRecurrence: vi.fn(async () => { throw new Error("Unexpected scheduling request"); }),
    recurrenceOccurrences: vi.fn(async () => { throw new Error("Unexpected scheduling request"); }),
    getWorkBrief: vi.fn(async () => { throw new Error("Unexpected work brief"); }),
    getWorkBriefSection: vi.fn(async () => { throw new Error("Unexpected brief section"); }),
    reviewWorkChange: vi.fn(async () => { throw new Error("Unexpected change review"); }),
    listCommitments: vi.fn(async () => ({ items: [], next_cursor: null })),
    createCommitment: vi.fn(async () => { throw new Error("Unexpected commitment creation"); }),
    updateCommitment: vi.fn(async () => { throw new Error("Unexpected commitment update"); }),
    listProjects: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    createProject: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    updateProject: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    deleteProject: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    projectBoard: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    projectTaskChoices: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    createProjectTask: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    setProjectMembership: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    moveProjectTask: vi.fn(async () => { throw new Error("Unexpected project request"); }),
    createMailLabel: vi.fn(async () => { throw new Error("Unexpected label creation"); }),
    updateMailLabel: vi.fn(async () => { throw new Error("Unexpected label edit"); }),
    deleteMailLabel: vi.fn(async () => { throw new Error("Unexpected label deletion"); }),
    assignMailLabel: vi.fn(async () => { throw new Error("Unexpected label assignment"); }),
    queryMail: vi.fn(async () => ({ items: await listMail(), next_cursor: null })),
    queryTasks: vi.fn(async ({ state_group, limit }) => ({
      items: [...created, ...await listTasks()]
        .filter((task) => !state_group || taskFilter(task.state) === state_group)
        .slice(0, limit),
      next_cursor: null,
    })),
    importPick: vi.fn(async () => []),
    importDrop: vi.fn(async () => { throw new Error("Unexpected drop import"); }),
    assistantList: vi.fn(async () => ({ items: [], total: 0, next_offset: null })),
    assistantCreate: vi.fn(async () => { throw new Error("Unexpected conversation"); }),
    assistantGet: vi.fn(async () => { throw new Error("Unexpected conversation"); }),
    assistantDelete: vi.fn(async () => { throw new Error("Unexpected conversation deletion"); }),
    assistantAsk: vi.fn(async () => { throw new Error("Unexpected question"); }),
    assistantStatus: vi.fn(async () => ({
      local_available: true,
      cloud_available: false,
      provider_label: null,
      provider_class: null,
      blocked_reason: "provider_not_configured",
      disclosure: "Gemini chưa được cấu hình.",
      max_sources: 8,
      max_turns: 100,
      preview_ttl_seconds: 600,
    })),
    assistantPrepareCloud: vi.fn(async () => { throw new Error("Unexpected cloud preview"); }),
    assistantCancelCloud: vi.fn(async () => false),
    assistantSendCloud: vi.fn(async () => { throw new Error("Unexpected cloud send"); }),
    analysisStatus: vi.fn(async () => ({
      eligible: false,
      blocked_reason: "provider_not_configured",
      provider_label: null,
      extractor_version: null,
      disclosure: "",
    })),
    analysisRequest: vi.fn(async () => { throw new Error("Unexpected analysis request"); }),
    analysisLatest: vi.fn(async () => null),
    analysisJobGet: vi.fn(async () => { throw new Error("Unexpected analysis job get"); }),
    analysisJobLatest: vi.fn(async () => null),
    analysisJobCancel: vi.fn(async () => { throw new Error("Unexpected analysis cancel"); }),
    confirmCandidate: vi.fn(async () => { throw new Error("Unexpected candidate confirm"); }),
    getMail: vi.fn(async () => mail),
    createTask: vi.fn(async (input) => {
      const task = savedTask(input);
      created.unshift(task);
      return task;
    }),
    updateTaskState: vi.fn(async (input) => ({
      ...localTask("Việc đang theo dõi", input.state), id: input.task_id, version: input.expected_version + 1,
    })),
    getTask: vi.fn(async () => { throw new Error("No task fixture configured"); }),
    updateTaskFields: vi.fn(async () => { throw new Error("Unexpected task edit"); }),
    setTaskDeadline: vi.fn(async () => { throw new Error("Unexpected deadline edit"); }),
    taskDeadlineHistory: vi.fn(async () => ({ items: [], next_cursor: null })),
    linkTaskMail: vi.fn(async () => { throw new Error("Unexpected task mail link"); }),
    unlinkTaskMail: vi.fn(async () => { throw new Error("Unexpected task mail unlink"); }),
    taskEvidence: vi.fn(async () => null),
    ...overrides,
  };
}

function localTask(title: string, state: Task["state"] = "not_started"): Task {
  return savedTask({ title, state, request_key: "fixture", message_id: null, owner: null, importance: "normal", estimated_minutes: null });
}

describe("MailCompass V2 desktop slice", () => {
  it("explains the batch limit and accepts a smaller import on retry", async () => {
    const importPick = vi.fn<DesktopApi["importPick"]>()
      .mockRejectedValueOnce({ code: "too_many_files", message: "native detail" })
      .mockResolvedValueOnce([{ filename: mail.filename, status: "imported", message_id: mail.id, error: null }]);
    render(<MailCompass api={fixtureApi({ importPick })} />);

    const importButton = await screen.findByRole("button", { name: "Nhập tệp email (.eml)" });
    fireEvent.click(importButton);
    expect(await screen.findByRole("alert")).toHaveTextContent(/100 tệp.*chia/i);
    expect(screen.queryByText("native detail")).not.toBeInTheDocument();
    fireEvent.click(importButton);
    expect(await screen.findByText("1 tệp đã nhập")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("imports dropped files one at a time and reports each outcome", async () => {
    const order: string[] = [];
    const importDrop = vi.fn<DesktopApi["importDrop"]>(async ({ filename, bytes }) => {
      order.push(filename);
      expect(bytes).toBeInstanceOf(Uint8Array);
      if (filename === "notes.txt") {
        return { filename, status: "rejected", message_id: null, error: { code: "unsupported_file", message: "native" } };
      }
      return { filename, status: filename === "copy.eml" ? "duplicate" : "imported", message_id: mail.id, error: null };
    });
    render(<MailCompass api={fixtureApi({ importDrop })} />);
    await screen.findByRole("button", { name: "Nhập tệp email (.eml)" });
    const welcome = screen.getByRole("main");
    const files = [
      new File(["Subject: A\n\nBody"], "report.eml"),
      new File(["Subject: A\n\nBody"], "copy.eml"),
      new File(["plain text"], "notes.txt"),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.eml"),
    ];

    fireEvent.dragEnter(welcome, { dataTransfer: { types: ["Files"], files } });
    expect(screen.getByText("Thả tệp .eml để nhập")).toBeInTheDocument();
    fireEvent.drop(welcome, { dataTransfer: { types: ["Files"], files } });

    expect(await screen.findByText("1 tệp đã nhập · 1 tệp đã có · 2 tệp chưa nhập được")).toBeInTheDocument();
    expect(order).toEqual(["report.eml", "copy.eml", "notes.txt"]);
    expect(screen.getByText("Hãy chọn tệp có đuôi .eml.")).toBeInTheDocument();
    expect(screen.getByText("Tệp vượt quá 10 MiB.")).toBeInTheDocument();
    expect(screen.queryByText("Thả tệp .eml để nhập")).not.toBeInTheDocument();
  });

  it("rejects a drop of more than 100 files before reading any of them", async () => {
    const api = fixtureApi();
    render(<MailCompass api={api} />);
    await screen.findByRole("button", { name: "Nhập tệp email (.eml)" });
    const welcome = screen.getByRole("main");
    const files = Array.from({ length: 101 }, (_, index) => new File(["x"], `mail-${index}.eml`));

    fireEvent.drop(welcome, { dataTransfer: { types: ["Files"], files } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/100 tệp.*chia/i);
    expect(api.importDrop).not.toHaveBeenCalled();
  });

  it("keeps the assistant draft across screens and returns from a cited email", async () => {
    const conversation = {
      id: "conversation-1", title: "Báo cáo", version: 1, turn_count: 0,
      created_at: mail.received_at, updated_at: mail.received_at,
    };
    const api = fixtureApi({
      listMail: async () => [mail],
      assistantCreate: vi.fn(async () => conversation),
      assistantAsk: vi.fn(async (input) => ({
        conversation: { ...conversation, version: 2, turn_count: 1 },
        turn: {
          id: "turn-1", ordinal: 1, question: input.question, mode: "local_search" as const,
          answer: "Các dữ kiện tìm được trên máy.", created_at: mail.received_at,
          citations: [{
            citation_id: "S1", kind: "message" as const, id: mail.id, title: mail.subject, excerpt: mail.preview,
            start: 0, end: 10, available: true, stale: false,
          }],
        },
      })),
    });
    render(<MailCompass api={api} />);

    fireEvent.click(await screen.findByRole("button", { name: "Hỏi MailCompass" }));
    const question = await screen.findByLabelText("Câu hỏi");
    fireEvent.change(question, { target: { value: "báo cáo" } });
    fireEvent.click(screen.getByRole("button", { name: "Hôm nay" }));
    fireEvent.click(screen.getByRole("button", { name: "Hỏi MailCompass" }));
    expect(screen.getByLabelText("Câu hỏi")).toHaveValue("báo cáo");

    fireEvent.click(screen.getByRole("button", { name: "Tìm trên máy" }));
    fireEvent.click(await screen.findByRole("button", { name: `Mở email: ${mail.subject}` }));
    expect(await screen.findByText(mail.body_text)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Về Hỏi MailCompass" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Hỏi MailCompass" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Mở email: ${mail.subject}` })).toBeInTheDocument();
  });

  it("ignores drags that do not carry files, such as a board card", async () => {
    render(<MailCompass api={fixtureApi()} />);
    await screen.findByRole("button", { name: "Nhập tệp email (.eml)" });
    const welcome = screen.getByRole("main");

    fireEvent.dragEnter(welcome, { dataTransfer: { types: ["text/plain"], files: [] } });

    expect(screen.queryByText("Thả tệp .eml để nhập")).not.toBeInTheDocument();
  });

  it("shows active work first and moves tasks across state filters with the persisted version", async () => {
    const user = userEvent.setup();
    let current = localTask("Chuẩn bị bản trình bày");
    const done = { ...localTask("Lịch đã gửi", "done"), id: "task-done" };
    const cancelled = { ...localTask("Cuộc họp cũ", "cancelled"), id: "task-cancelled" };
    const updateTaskState = vi.fn<DesktopApi["updateTaskState"]>(async ({ state }) => {
      current = { ...current, state, version: current.version + 1 };
      return current;
    });
    render(<MailCompass api={fixtureApi({ listTasks: async () => [current, done, cancelled], updateTaskState })} />);

    await user.click(await screen.findByRole("button", { name: "Công việc" }));
    expect(screen.getByRole("radio", { name: "Đang theo dõi" })).toBeChecked();
    expect(screen.queryByText(done.title)).not.toBeInTheDocument();
    expect(screen.queryByText(cancelled.title)).not.toBeInTheDocument();

    const menu = screen.getByRole("button", { name: `Đổi trạng thái: ${current.title}` });
    menu.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitem", { name: "Đang làm" }));
    expect(await screen.findByText(`Đã cập nhật: ${current.title} · Đang làm`)).toBeInTheDocument();
    expect(updateTaskState).toHaveBeenNthCalledWith(1, expect.objectContaining({ task_id: current.id, state: "in_progress", expected_version: 1 }));

    await user.click(screen.getByRole("button", { name: `Hoàn thành: ${current.title}` }));
    expect(await screen.findByText(`Đã cập nhật: ${current.title} · Hoàn thành`)).toBeInTheDocument();
    expect(screen.queryByText(current.title)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Đang theo dõi" })).toHaveFocus();
    await user.click(screen.getByRole("radio", { name: "Đã hoàn thành" }));
    expect(await screen.findByText(done.title)).toBeVisible();
    await user.click(screen.getByRole("button", { name: `Mở lại: ${current.title}` }));
    expect(await screen.findByText(`Đã cập nhật: ${current.title} · Chưa bắt đầu`)).toBeVisible();
    expect(updateTaskState).toHaveBeenNthCalledWith(3, expect.objectContaining({ state: "not_started", expected_version: 3 }));

    await user.click(screen.getByRole("radio", { name: "Đang theo dõi" }));
    await user.click(await screen.findByRole("button", { name: `Đổi trạng thái: ${current.title}` }));
    await user.click(await screen.findByRole("menuitem", { name: "Hủy công việc" }));
    await user.click(screen.getByRole("radio", { name: "Đã hủy" }));
    expect(await screen.findByRole("button", { name: `Mở lại: ${current.title}` })).toBeVisible();
    expect(screen.getByText(cancelled.title)).toBeVisible();
    expect(updateTaskState).toHaveBeenNthCalledWith(4, expect.objectContaining({ state: "cancelled", expected_version: 4 }));
  });

  it("keeps the last confirmed state and retries the same request after a lost response", async () => {
    let task = localTask("Gọi cho nhóm");
    const updateTaskState = vi.fn<DesktopApi["updateTaskState"]>()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockImplementationOnce(async () => {
        task = { ...task, state: "done", version: 2 };
        return task;
      });
    render(<MailCompass api={fixtureApi({ listTasks: async () => [task], updateTaskState })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Công việc" }));
    fireEvent.click(screen.getByRole("button", { name: `Hoàn thành: ${task.title}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác nhận được thay đổi.");
    expect(screen.getByText("Chưa bắt đầu")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Thử lưu lại trạng thái" }));
    expect(await screen.findByText(`Đã cập nhật: ${task.title} · Hoàn thành`)).toBeVisible();
    expect(updateTaskState).toHaveBeenCalledTimes(2);
    expect(updateTaskState.mock.calls[0][0].request_key).toBeTruthy();
    expect(updateTaskState.mock.calls[1][0]).toEqual(updateTaskState.mock.calls[0][0]);
  });

  it("refreshes a version conflict without reapplying the old change", async () => {
    let task = localTask("Kiểm tra tiến độ");
    const getTask = vi.fn<DesktopApi["getTask"]>()
      .mockRejectedValueOnce(new Error("temporary refresh failure"))
      .mockImplementation(async () => {
        task = { ...task, state: "waiting", version: 2 };
        return task;
      });
    const updateTaskState = vi.fn<DesktopApi["updateTaskState"]>().mockRejectedValueOnce({ code: "version_conflict" });
    render(<MailCompass api={fixtureApi({ listTasks: async () => [task], getTask, updateTaskState })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Công việc" }));
    const complete = screen.getByRole("button", { name: `Hoàn thành: ${task.title}` });
    fireEvent.click(complete);
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được trạng thái mới.");
    expect(complete).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tải lại công việc" }));
    expect(await screen.findByText("Đang chờ")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Hãy xem trạng thái mới");
    expect(complete).toHaveAttribute("aria-disabled", "false");
    expect(updateTaskState).toHaveBeenCalledTimes(1);
  });

  it("imports independent results, reads inert mail and returns from the linked source", async () => {
    const listMail = vi.fn<DesktopApi["listMail"]>().mockResolvedValueOnce([]).mockResolvedValue([mail]);
    const api = fixtureApi({
      listMail,
      importPick: vi.fn<DesktopApi["importPick"]>(async () => [
        { filename: mail.filename, status: "imported", message_id: mail.id, error: null },
        { filename: "note.txt", status: "rejected", message_id: null, error: { code: "unsupported_file", message: "native detail" } },
      ]),
    });
    render(<MailCompass api={api} />);

    fireEvent.click(await screen.findByRole("button", { name: "Nhập tệp email (.eml)" }));
    expect(await screen.findByRole("heading", { name: "Hộp thư" })).toBeVisible();
    expect(screen.getByText("1 tệp đã nhập · 1 tệp chưa nhập được")).toBeInTheDocument();
    expect(screen.getByText("Hãy chọn tệp có đuôi .eml.")).toBeInTheDocument();
    expect(screen.queryByText("native detail")).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /Lan.*Báo cáo dự án/ }));
    const message = await screen.findByText(mail.body_text);
    expect(message.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tạo việc từ thư" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo công việc" });
    fireEvent.change(within(dialog).getByLabelText("Tên công việc"), { target: { value: "Gửi báo cáo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu công việc" }));

    expect(await screen.findByText("Đã lưu: Gửi báo cáo")).toBeInTheDocument();
    expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Gửi báo cáo", message_id: mail.id }));
    fireEvent.click(screen.getByRole("button", { name: /Thư gốc.*Gửi báo cáo/ }));
    expect(await screen.findByText(mail.body_text)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Về công việc" }));
    expect(screen.getByRole("button", { name: /Thư gốc.*Gửi báo cáo/ })).toHaveFocus();
  });

  it("creates a task with an exact excerpt and opens that span from the work list", async () => {
    const before = "📌 Việc tuần này: ";
    const quote = 'Nộp báo cáo <img src="https://example.test/tracker.png">';
    const source = { ...mail, body_text: before + quote + " 📌" };
    const draft = {
      body_revision: source.body_revision, body_sha256: source.body_sha256,
      start_codepoint: [...before].length, end_codepoint: [...before, ...quote].length,
    };
    let task: Task | null = null;
    const createTask = vi.fn<DesktopApi["createTask"]>(async (input) => {
      task = savedTask(input);
      return task;
    });
    const taskEvidence = vi.fn<DesktopApi["taskEvidence"]>().mockResolvedValue({
      ...draft, message_id: source.id, quote, status: "verified",
    });
    render(<MailCompass api={fixtureApi({
      listMail: async () => [source], getMail: async () => source,
      listTasks: async () => task ? [task] : [], createTask, taskEvidence,
    })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Hộp thư" }));
    fireEvent.click(await screen.findByRole("button", { name: /Lan.*Báo cáo dự án/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Chọn đoạn trích" }));
    const selection = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Nội dung để chọn đoạn trích" });
    selection.focus();
    selection.setSelectionRange(before.length, before.length + quote.length);
    fireEvent.select(selection);
    fireEvent.click(screen.getByRole("button", { name: "Tạo việc kèm đoạn trích" }));
    const editor = within(screen.getByRole("dialog", { name: "Tạo công việc" }));
    fireEvent.change(editor.getByLabelText("Tên công việc"), { target: { value: "Gửi báo cáo theo thư" } });
    fireEvent.click(editor.getByRole("button", { name: "Lưu công việc" }));
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ message_id: source.id, evidence: draft }));

    fireEvent.click(await screen.findByRole("button", { name: /Thư gốc.*Gửi báo cáo theo thư/ }));
    await waitFor(() => {
      const mark = screen.getByText(quote, { selector: "mark", exact: true });
      expect(mark).toHaveFocus();
      expect(mark.querySelector("img")).toBeNull();
    });
    expect(taskEvidence).toHaveBeenCalledWith("task-one");
    fireEvent.click(screen.getByRole("button", { name: "Về công việc" }));
    expect(screen.getByRole("button", { name: /Thư gốc.*Gửi báo cáo theo thư/ })).toHaveFocus();
  });

  it("keeps an unsuccessful task draft and reuses the request key on retry", async () => {
    const createTask = vi.fn<DesktopApi["createTask"]>().mockRejectedValueOnce(new Error("response lost"))
      .mockImplementation(async (input) => savedTask(input));
    render(<MailCompass api={fixtureApi({ createTask })} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tiếp tục vào không gian làm việc/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo công việc" }));

    const dialog = screen.getByRole("dialog", { name: "Tạo công việc" });
    const title = within(dialog).getByLabelText("Tên công việc");
    fireEvent.change(title, { target: { value: "Việc còn lưu được" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu công việc" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nội dung đã nhập vẫn còn.");
    expect(title).toHaveValue("Việc còn lưu được");
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu công việc" }));
    await screen.findByText("Đã lưu: Việc còn lưu được");

    const calls = createTask.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].request_key).toBeTruthy();
    expect(calls[1][0].request_key).toBe(calls[0][0].request_key);
    expect(calls[1][0].message_id).toBeNull();
  });

  it("ignores a stale mail read after selecting another message", async () => {
    const next = { ...mail, id: "mail-two", subject: "Kiểm tra bản mới", body_text: "Nội dung email thứ hai" };
    let finishOldRead: (message: MailDetail) => void = () => undefined;
    const oldRead = new Promise<MailDetail>((resolve) => { finishOldRead = resolve; });
    const getMail = vi.fn<DesktopApi["getMail"]>(async (id) => id === mail.id ? oldRead : next);
    render(<MailCompass api={fixtureApi({ listMail: async () => [mail, next], getMail })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Hộp thư" }));
    fireEvent.click(screen.getByRole("button", { name: /Lan.*Báo cáo dự án/ }));
    await waitFor(() => expect(getMail).toHaveBeenCalledWith(mail.id));
    fireEvent.click(screen.getByRole("button", { name: /Lan.*Kiểm tra bản mới/ }));
    expect(await screen.findByText(next.body_text)).toBeVisible();
    await act(async () => finishOldRead(mail));

    expect(screen.queryByText(mail.body_text)).not.toBeInTheDocument();
    expect(screen.getByText(next.body_text)).toBeVisible();
  });


  it("keeps a newer inbox search and can retry a failed next page", async () => {
    const newer = { ...mail, id: "mail-recent", subject: "Kết quả mới" };
    let finishStale: (page: Awaited<ReturnType<DesktopApi["queryMail"]>>) => void = () => undefined;
    const stale = new Promise<Awaited<ReturnType<DesktopApi["queryMail"]>>>((resolve) => { finishStale = resolve; });
    const queryMail = vi.fn<DesktopApi["queryMail"]>()
      .mockResolvedValueOnce({ items: [mail], next_cursor: null })
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce({ items: [newer], next_cursor: "mail-page-2" })
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValueOnce({ items: [mail], next_cursor: null });
    render(<MailCompass api={fixtureApi({ queryMail })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Hộp thư" }));
    const search = screen.getByRole("combobox", { name: "Tìm thư bằng toán tử Gmail hoặc mã" });
    const submit = screen.getByRole("button", { name: "Tìm email" });
    fireEvent.change(search, { target: { value: "cũ" } });
    fireEvent.click(submit);
    fireEvent.change(search, { target: { value: "mới" } });
    fireEvent.click(submit);
    const recent = await screen.findByRole("button", { name: /Kết quả mới/ });
    await act(async () => finishStale({ items: [], next_cursor: null }));
    expect(recent).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Tải thêm email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được email tiếp theo.");
    expect(recent).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("button", { name: /Lan.*Báo cáo dự án/ })).toBeVisible();
    expect(queryMail).toHaveBeenLastCalledWith({ query: "mới", cursor: "mail-page-2", limit: 40 });
  });

  it("keeps filters and email content intact when managing and removing inbox labels", async () => {
    const user = userEvent.setup();
    const label: MailLabel = { id: "budget", name: "Ngân sách", color: "#2563eb", version: 1 };
    let catalog: MailLabel[] = [];
    let isAssigned = false;
    const currentMail = () => ({ ...mail, label_ids: isAssigned ? [label.id] : [] });
    const queryMail = vi.fn<DesktopApi["queryMail"]>(async ({ label_id }) => ({
      items: !label_id || isAssigned ? [currentMail()] : [], next_cursor: null,
    }));
    const assignMailLabel = vi.fn<DesktopApi["assignMailLabel"]>(async ({ assigned }) => { isAssigned = assigned; });
    render(<MailCompass api={fixtureApi({
      queryMail, assignMailLabel, getMail: async () => currentMail(),
      listMailLabels: async () => [...catalog],
      createMailLabel: async ({ name, color }) => {
        const saved = { ...label, name, color };
        catalog = [saved];
        return saved;
      },
      deleteMailLabel: async () => { catalog = []; isAssigned = false; },
    })} />);

    await user.click(await screen.findByRole("button", { name: "Hộp thư" }));
    await user.click(screen.getByRole("button", { name: "Quản lý nhãn" }));
    let manager = within(screen.getByRole("dialog", { name: "Quản lý nhãn" }));
    await user.click(manager.getByRole("button", { name: "Tạo nhãn" }));
    await user.type(manager.getByLabelText("Tên nhãn"), label.name);
    await user.click(manager.getByRole("button", { name: "Lưu nhãn" }));
    await manager.findByText("Đã tạo nhãn.");
    await user.click(await manager.findByRole("button", { name: "Đóng quản lý nhãn" }));

    const row = () => screen.findByRole("button", { name: /Lan.*Báo cáo dự án/ });
    await user.click(await row());
    await user.selectOptions(await screen.findByLabelText("Nhãn cần thêm"), label.id);
    await user.click(screen.getByRole("button", { name: "Gắn nhãn" }));
    expect(await screen.findByRole("button", { name: "Bỏ nhãn Ngân sách" })).toBeVisible();
    expect(assignMailLabel).toHaveBeenCalledWith(expect.objectContaining({ label_id: label.id, message_id: mail.id, assigned: true }));

    await user.click(screen.getByRole("button", { name: "Về danh sách" }));
    const searchBox = screen.getByRole("combobox", { name: "Tìm thư bằng toán tử Gmail hoặc mã" });
    fireEvent.change(searchBox, { target: { value: "báo cáo" } });
    expect(searchBox).toHaveValue("báo cáo");
    fireEvent.click(screen.getByRole("button", { name: "Tìm email" }));
    expect(await row()).toBeVisible();
    expect(queryMail).toHaveBeenLastCalledWith({ query: "báo cáo", limit: 40 });
    await user.selectOptions(screen.getByLabelText("Nhãn"), label.id);
    expect(await row()).toBeVisible();
    expect(queryMail).toHaveBeenLastCalledWith({ query: "báo cáo", label_id: label.id, limit: 40 });

    await user.click(screen.getByRole("button", { name: "Quản lý nhãn" }));
    manager = within(screen.getByRole("dialog", { name: "Quản lý nhãn" }));
    await user.click(manager.getByRole("button", { name: "Xóa nhãn Ngân sách" }));
    await user.click(manager.getByRole("button", { name: "Xóa nhãn" }));
    await user.click(await manager.findByRole("button", { name: "Đóng quản lý nhãn" }));
    await waitFor(() => expect(queryMail).toHaveBeenLastCalledWith({ query: "báo cáo", limit: 40 }));
    expect(screen.getByRole("combobox", { name: "Tìm thư bằng toán tử Gmail hoặc mã" })).toHaveValue("báo cáo");
    await user.click(await row());
    expect(await screen.findByText(mail.body_text)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bỏ nhãn Ngân sách" })).not.toBeInTheDocument();
  });

  it("keeps a paused saved folder usable and marks a source email without touching linked work", async () => {
    const user = userEvent.setup();
    const folder: MailRule = {
      id: "unread-reports", name: "Báo cáo chưa đọc", enabled: false, auto_label_id: null, version: 2,
      criteria: { sender: "Lan", subject: "", text: "", read_state: "unread", has_attachment: null },
    };
    const label: MailLabel = { id: "both-origins", name: "Dự án", color: "#2563eb", version: 1 };
    let current = { ...mail, is_read: false, label_ids: [label.id], manual_label_ids: [label.id], rule_label_ids: [label.id] };
    const queryMail = vi.fn<DesktopApi["queryMail"]>(async ({ rule_id, read_state }) => ({
      items: (rule_id === folder.id || read_state === "unread") && current.is_read ? [] : [current],
      next_cursor: null,
    }));
    const setMailRead = vi.fn<DesktopApi["setMailRead"]>(async ({ is_read }) => {
      current = { ...current, is_read };
    });
    const assignMailLabel = vi.fn<DesktopApi["assignMailLabel"]>(async () => {
      current = { ...current, manual_label_ids: [] };
    });
    const linked = { ...localTask("Gửi bản tổng hợp"), message_id: mail.id };
    const api = fixtureApi({
      queryMail, setMailRead, getMail: async () => current, assignMailLabel,
      listMailLabels: async () => [label], listMailRules: async () => [folder], listTasks: async () => [linked],
    });
    render(<MailCompass api={api} />);

    await user.click(await screen.findByRole("button", { name: "Hộp thư" }));
    await user.selectOptions(await screen.findByLabelText("Thư mục đã lưu"), folder.id);
    await user.click(await screen.findByRole("button", { name: /Lan.*Báo cáo dự án/ }));
    await user.click(await screen.findByRole("button", { name: "Bỏ nhãn thủ công Dự án" }));
    expect(await screen.findByText("Quy tắc", { selector: ".mc-mail-auto-label" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bỏ nhãn thủ công Dự án" })).not.toBeInTheDocument();
    expect(assignMailLabel).toHaveBeenCalledWith(expect.objectContaining({ assigned: false, label_id: label.id }));

    await user.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    expect(await screen.findByRole("button", { name: "Đánh dấu chưa đọc" })).toBeVisible();
    expect(setMailRead).toHaveBeenCalledWith(expect.objectContaining({ is_read: true, message_id: mail.id }));
    await user.click(screen.getByRole("button", { name: "Về danh sách" }));
    expect(await screen.findByText("Không tìm thấy email phù hợp")).toBeVisible();
    expect(screen.getByLabelText("Thư mục đã lưu")).toHaveValue(folder.id);

    await user.click(screen.getByRole("button", { name: "Công việc" }));
    expect(await screen.findByText(linked.title)).toBeVisible();
    expect(api.createTask).not.toHaveBeenCalled();
    expect(api.updateTaskState).not.toHaveBeenCalled();
  });

  it("sets up a recurrence, generates a task, and retains history after retirement", async () => {
    const user = userEvent.setup();
    const generated = localTask("Gửi bản tin");
    let rule: RecurrenceView | null = null;
    let generatedTask = false;
    const createRecurrence = vi.fn<DesktopApi["createRecurrence"]>(async ({ request_key: _key, ...input }) => {
      rule = {
        ...input, id: "weekly", enabled: true, retired: false, version: 1, exhausted: false, next_index: 0,
        next_due_at: input.start_at, created_at: "2026-11-19T00:00:00Z", updated_at: "2026-11-19T00:00:00Z",
      };
      return rule;
    });
    const materializeRecurrence = vi.fn<DesktopApi["materializeRecurrence"]>()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockImplementationOnce(async () => {
        if (!rule) throw new Error("No rule");
        generatedTask = true;
        rule = { ...rule, version: 2, next_index: 1 };
        return { rule, created_task_ids: [generated.id], has_more: false };
      });
    const deleteRecurrence = vi.fn<DesktopApi["deleteRecurrence"]>(async () => {
      if (rule) rule = { ...rule, version: 3, retired: true, enabled: false };
    });
    render(<MailCompass api={fixtureApi({
      listMail: async () => [mail],
      listTasks: async () => generatedTask ? [generated] : [],
      createRecurrence, materializeRecurrence, deleteRecurrence,
      listRecurrences: async ({ retired }) => ({ items: rule && rule.retired === retired ? [rule] : [], next_cursor: null }),
      recurrenceOccurrences: async () => ({
        items: [{ task_id: generated.id, occurrence_index: 0, due_at: "2026-11-20T02:00:00Z", created_at: "2026-11-19T00:00:00Z" }],
        next_cursor: null,
      }),
    })} />);
    await user.click(await screen.findByRole("button", { name: "Công việc" }));
    await user.click(screen.getByRole("button", { name: "Lặp lại" }));
    await user.click(await screen.findByRole("button", { name: "Tạo quy tắc lặp" }));
    const editor = within(screen.getByRole("dialog", { name: "Tạo quy tắc lặp" }));
    fireEvent.change(editor.getByLabelText("Tên công việc"), { target: { value: generated.title } });
    fireEvent.change(editor.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-11-20" } });
    fireEvent.change(editor.getByLabelText("Độ lệch UTC"), { target: { value: "+07:00" } });
    fireEvent.click(editor.getByRole("button", { name: "Lưu quy tắc" }));
    await screen.findByText("Đã lưu công việc lặp lại.");
    expect(createRecurrence).toHaveBeenCalledWith(expect.objectContaining({
      start_at: "2026-11-20T09:00:00+07:00", timezone_offset_minutes: 420, frequency: "weekly",
    }));
    await user.click(await screen.findByRole("button", { name: "Tạo công việc đến hạn" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác nhận được thay đổi.");
    await user.click(screen.getByRole("button", { name: "Tạo công việc đến hạn" }));
    await screen.findByText("Đã tạo 1 công việc.");
    expect(materializeRecurrence.mock.calls[0][0]).toEqual(materializeRecurrence.mock.calls[1][0]);

    await user.click(screen.getByRole("button", { name: "Ngừng lặp" }));
    const retirement = within(screen.getByRole("dialog", { name: "Ngừng lặp công việc" }));
    await user.click(retirement.getByRole("button", { name: "Xác nhận ngừng lặp" }));
    await screen.findByText("Đã ngừng quy tắc. Công việc và lịch sử đã tạo vẫn còn.");
    await user.click(screen.getByRole("button", { name: "Đã ngừng" }));
    await user.click(await screen.findByRole("button", { name: "Xem lịch sử" }));
    expect(await screen.findByRole("button", { name: "Mở việc kỳ 1" })).toBeVisible();
    expect(deleteRecurrence).toHaveBeenCalledWith(expect.objectContaining({ rule_id: "weekly", expected_version: 2 }));
  });

  it("preserves a filtered task page and focus when returning from its source email", async () => {
    const first = { ...localTask("Báo cáo đầu tuần"), id: "first-task" };
    const second = { ...localTask("Báo cáo cuối tuần"), id: "second-task", message_id: mail.id };
    const queryTasks = vi.fn<DesktopApi["queryTasks"]>()
      .mockResolvedValueOnce({ items: [first], next_cursor: null })
      .mockResolvedValueOnce({ items: [first], next_cursor: "task-page-2" })
      .mockResolvedValueOnce({ items: [second], next_cursor: null });
    render(<MailCompass api={fixtureApi({ queryTasks })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Công việc" }));
    fireEvent.change(screen.getByLabelText("Tìm công việc"), { target: { value: "Báo cáo" } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xem thêm công việc" }));
    fireEvent.click(await screen.findByRole("button", { name: /Thư gốc.*Báo cáo cuối tuần/ }));
    expect(await screen.findByText(mail.body_text)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Về công việc" }));

    expect(screen.getByLabelText("Tìm công việc")).toHaveValue("Báo cáo");
    expect(screen.getByText(first.title)).toBeVisible();
    expect(screen.getByRole("button", { name: /Thư gốc.*Báo cáo cuối tuần/ })).toHaveFocus();
    expect(queryTasks).toHaveBeenCalledTimes(3);
    expect(queryTasks).toHaveBeenLastCalledWith({
      query: "Báo cáo", state_group: "active", cursor: "task-page-2", limit: 40,
    });
  });

  it("edits only changed fields and retains the user's changes across a conflict", async () => {
    const original = localTask("Bản cần cập nhật", "waiting");
    const latest = { ...original, owner: "Mai", importance: "high" as const, version: 2 };
    const getTask = vi.fn<DesktopApi["getTask"]>().mockResolvedValue(latest);
    let persisted = original;
    const updateTaskFields = vi.fn<DesktopApi["updateTaskFields"]>()
      .mockRejectedValueOnce({ code: "version_conflict" })
      .mockImplementationOnce(async () => {
        persisted = { ...latest, title: "Bản đã cập nhật", version: 3 };
        return persisted;
      });
    render(<MailCompass api={fixtureApi({ listTasks: async () => [persisted], getTask, updateTaskFields })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Công việc" }));
    fireEvent.click(screen.getByRole("button", { name: "Sửa công việc: " + original.title }));
    const dialog = within(screen.getByRole("dialog", { name: "Sửa công việc" }));
    fireEvent.change(dialog.getByLabelText("Tên công việc"), { target: { value: "Bản đã cập nhật" } });
    fireEvent.click(dialog.getByRole("button", { name: "Lưu thay đổi" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("Công việc đã thay đổi.");
    fireEvent.click(dialog.getByRole("button", { name: "Tải bản mới" }));
    expect(await dialog.findByRole("status")).toHaveTextContent("giữ các ô bạn đã sửa");
    expect(dialog.getByLabelText("Tên công việc")).toHaveValue("Bản đã cập nhật");
    expect(dialog.getByLabelText("Người phụ trách")).toHaveValue("Mai");
    expect(dialog.getByLabelText("Mức ưu tiên")).toHaveValue("high");
    fireEvent.click(dialog.getByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByText("Đã cập nhật: Bản đã cập nhật")).toBeVisible();
    expect(updateTaskFields).toHaveBeenNthCalledWith(2, expect.objectContaining({
      task_id: original.id, expected_version: 2, patch: { title: "Bản đã cập nhật" },
    }));
  });

  it("sets and clears a deadline with explicit offset, reasons and history", async () => {
    const original = localTask("Việc có hạn chót");
    const instant = "2026-11-22T15:30:00+07:00";
    const canonical = "2026-11-22T08:30:00Z";
    const entries: Awaited<ReturnType<DesktopApi["taskDeadlineHistory"]>>["items"] = [];
    let current = original;
    const setTaskDeadline = vi.fn<DesktopApi["setTaskDeadline"]>(async ({ change }) => {
      const previous = current;
      current = change.kind === "set"
        ? { ...current, deadline_effective: canonical, deadline_authored: instant, version: current.version + 1 }
        : { ...current, deadline_effective: null, deadline_authored: null, version: current.version + 1 };
      const id = "history-" + current.version;
      entries.unshift({
        id, task_id: current.id, source_kind: "manual", actor: "local_user", reason: change.reason, created_at: "2026-11-19T10:15:00Z",
        previous_deadline: previous.deadline_effective, previous_authored: previous.deadline_authored,
        new_deadline: current.deadline_effective, new_authored: current.deadline_authored, task_version: current.version,
      });
      return { task: current, history_id: id };
    });
    const taskDeadlineHistory = vi.fn<DesktopApi["taskDeadlineHistory"]>(async () => ({ items: [...entries], next_cursor: null }));
    render(<MailCompass api={fixtureApi({ listTasks: async () => [current], setTaskDeadline, taskDeadlineHistory })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Công việc" }));
    fireEvent.click(screen.getByRole("button", { name: "Hạn chót: " + original.title }));
    const dialog = within(screen.getByRole("dialog", { name: "Hạn chót" }));
    expect(await dialog.findByText("Chưa có lần thay đổi nào.")).toBeVisible();
    fireEvent.change(dialog.getByLabelText("Ngày"), { target: { value: "2026-11-22" } });
    fireEvent.change(dialog.getByLabelText("Giờ"), { target: { value: "15:30" } });
    fireEvent.change(dialog.getByLabelText("Độ lệch UTC"), { target: { value: "+07:00" } });
    fireEvent.click(dialog.getByRole("button", { name: "Lưu hạn chót" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("Nhập lý do");
    expect(setTaskDeadline).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByLabelText("Lý do"), { target: { value: "Lịch nhóm xác nhận" } });
    fireEvent.click(dialog.getByRole("button", { name: "Lưu hạn chót" }));
    expect(await dialog.findByText("Đã lưu hạn chót.")).toBeVisible();
    expect(await dialog.findByText("Lịch nhóm xác nhận")).toBeVisible();
    expect(dialog.getByText(/Hạn chót hiện tại/).parentElement).toHaveTextContent("22/11/2026 15:30 (UTC+07:00)");
    expect(setTaskDeadline).toHaveBeenNthCalledWith(1, expect.objectContaining({
      task_id: original.id, expected_version: 1, change: { kind: "set", instant, reason: "Lịch nhóm xác nhận" },
    }));

    fireEvent.click(dialog.getByRole("button", { name: "Xóa hạn chót" }));
    expect(dialog.queryByLabelText("Ngày")).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText("Lý do"), { target: { value: "Lịch được hủy" } });
    fireEvent.click(dialog.getByRole("button", { name: "Xác nhận xóa hạn chót" }));
    expect(await dialog.findByText("Đã xóa hạn chót.")).toBeVisible();
    expect(await dialog.findByText("Lịch được hủy")).toBeVisible();
    expect(setTaskDeadline).toHaveBeenNthCalledWith(2, expect.objectContaining({
      expected_version: 2, change: { kind: "clear", reason: "Lịch được hủy" },
    }));
  });

  it("keeps the authored deadline precision when the displayed controls are unchanged", async () => {
    const original = {
      ...localTask("Việc giữ độ chính xác"),
      deadline_effective: "2026-11-22T08:30:52.123456Z",
      deadline_authored: "2026-11-22T15:30:52.123456+07:00",
    };
    const setTaskDeadline = vi.fn<DesktopApi["setTaskDeadline"]>().mockResolvedValue({ task: original, history_id: null });
    render(<MailCompass api={fixtureApi({ listTasks: async () => [original], setTaskDeadline })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Công việc" }));
    fireEvent.click(screen.getByRole("button", { name: "Hạn chót: " + original.title }));
    const dialog = within(screen.getByRole("dialog", { name: "Hạn chót" }));
    expect(dialog.getByText(/Hạn chót hiện tại/).parentElement).toHaveTextContent("15:30:52.123456 (UTC+07:00)");
    fireEvent.change(dialog.getByLabelText("Lý do"), { target: { value: "Kiểm tra lại hạn chót" } });
    fireEvent.click(dialog.getByRole("button", { name: "Lưu hạn chót" }));
    expect(await dialog.findByText("Hạn chót không đổi.")).toBeVisible();
    expect(setTaskDeadline).toHaveBeenCalledWith(expect.objectContaining({
      change: { kind: "set", instant: original.deadline_authored, reason: "Kiểm tra lại hạn chót" },
    }));
  });

  it("switches sources from the sidebar and confirms before discarding an open editor", async () => {
    const user = userEvent.setup();
    const localAccount: ProfileAccount = {
      account_id: "test-source", source_kind: "eml", display_name: "Thư trên máy", email: null,
      lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 1,
    };
    const projectAccount: ProfileAccount = {
      account_id: "project-source", source_kind: "eml", display_name: "Hồ sơ Q4", email: null,
      lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 1,
    };
    const localWork = localTask("Việc nguồn mặc định");
    const projectWork = { ...localTask("Việc nguồn Q4"), id: "task-q4" };
    const accounts = [localAccount, projectAccount];

    function makeScopedApi(active: ProfileAccount): DesktopApi {
      return fixtureApi({
        bootstrap: vi.fn(async () => ({
          workspace_id: "test-workspace",
          account_id: active.account_id,
          workspace_name: "Workspace",
          account_name: active.display_name,
          schema_version: 16,
        })),
        listSources: vi.fn(async () => ({
          accounts,
          active_account_id: active.account_id,
          gmail_sign_in_available: false,
          gmail_sync_available: false,
          cleanups: [],
        })),
        listTasks: async () => (active.account_id === projectAccount.account_id ? [projectWork] : [localWork]),
        forSource: (target) => makeScopedApi(target),
      });
    }

    render(<MailCompass api={makeScopedApi(localAccount)} />);
    expect(await screen.findByText(localWork.title)).toBeInTheDocument();

    const switcher = await screen.findByLabelText("Chọn nguồn dữ liệu");
    expect(switcher).toHaveValue(localAccount.account_id);

    // Open the create-task editor first to verify dirty-dialog confirmation.
    await user.click(screen.getByRole("button", { name: "Tạo công việc" }));
    expect(screen.getByRole("dialog", { name: "Tạo công việc" })).toBeInTheDocument();

    // Selecting another source while an editor is open prompts for confirmation.
    fireEvent.change(switcher, { target: { value: projectAccount.account_id } });
    const confirm = await screen.findByRole("dialog", { name: "Đổi nguồn dữ liệu?" });
    await user.click(within(confirm).getByRole("button", { name: "Chuyển nguồn" }));

    expect(await screen.findByText(projectWork.title)).toBeInTheDocument();
    expect(screen.queryByText(localWork.title)).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Chọn nguồn dữ liệu")).toHaveValue(projectAccount.account_id);
  });

  it("returns to the default local source after deleting the active disconnected Gmail source", async () => {
    const user = userEvent.setup();
    const localAccount: ProfileAccount = {
      account_id: "test-source", source_kind: "eml", display_name: "Thư trên máy", email: null,
      lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 1,
    };
    const gmailAccount: ProfileAccount = {
      account_id: "gmail-1", source_kind: "gmail", display_name: "reader@example.test", email: "reader@example.test",
      lifecycle_state: "disconnected", sync_consent: false, generation: 3, data_version: 0, version: 4,
    };
    const localWork = localTask("Việc nguồn mặc định");
    const gmailWork = { ...localTask("Việc Gmail cũ"), id: "task-gmail" };
    let availableAccounts = [localAccount, gmailAccount];
    const receipt: AccountCleanupReceipt = {
      account_id: gmailAccount.account_id,
      operation_id: "op-delete-1",
      status: "succeeded",
      phase: "completed",
      fence_generation: 4,
      db_counts: { task: 1 },
      file_counts: { raw_files: 0, staging_files: 0 },
      last_error_code: null,
      updated_at: "2026-11-20T10:00:00Z",
      completed_at: "2026-11-20T10:00:00Z",
    };

    function makeScopedApi(active: ProfileAccount): DesktopApi {
      return fixtureApi({
        bootstrap: vi.fn(async () => ({
          workspace_id: "test-workspace",
          account_id: active.account_id,
          workspace_name: "Workspace",
          account_name: active.display_name,
          schema_version: 16,
        })),
        listSources: vi.fn(async () => ({
          accounts: availableAccounts,
          active_account_id: active.account_id,
          gmail_sign_in_available: true,
          gmail_sync_available: false,
          cleanups: [],
        })),
        deleteLocalAccount: vi.fn(async () => {
          availableAccounts = [localAccount];
          return receipt;
        }),
        listTasks: async () => (active.account_id === gmailAccount.account_id ? [gmailWork] : [localWork]),
        forSource: (target) => makeScopedApi(target),
      });
    }

    render(<MailCompass api={makeScopedApi(localAccount)} />);
    const switcher = await screen.findByLabelText("Chọn nguồn dữ liệu");
    await user.selectOptions(switcher, gmailAccount.account_id);
    expect(await screen.findByText(gmailWork.title)).toBeInTheDocument();

    // Open Settings and delete local data for the active disconnected Gmail account.
    await user.click(screen.getByRole("button", { name: "Cài đặt" }));
    await user.click(await screen.findByRole("button", { name: "Xóa dữ liệu trên máy cho reader@example.test" }));
    const confirm = screen.getByRole("dialog", { name: "Xóa dữ liệu trên máy?" });
    await user.click(within(confirm).getByRole("button", { name: "Xóa dữ liệu trên máy" }));

    // Workspace automatically returns to the default local source.
    expect(await screen.findByText(localWork.title)).toBeInTheDocument();
    expect(screen.queryByText(gmailWork.title)).not.toBeInTheDocument();
  });

  it("surfaces overdue and due-within-24h work on Today before far-future work", async () => {
    const now = Date.now();
    const overdueIso = new Date(now - 3 * 3600_000).toISOString();
    const soonIso = new Date(now + 6 * 3600_000).toISOString();
    const futureIso = new Date(now + 72 * 3600_000).toISOString();
    const overdueTask: Task = {
      ...localTask("Việc đã quá hạn"), id: "task-overdue",
      deadline_effective: overdueIso, deadline_authored: overdueIso,
    };
    const soonTask: Task = {
      ...localTask("Việc đến hạn trong 6 giờ"), id: "task-soon",
      deadline_effective: soonIso, deadline_authored: soonIso,
    };
    const futureTask: Task = {
      ...localTask("Việc tuần sau"), id: "task-future",
      deadline_effective: futureIso, deadline_authored: futureIso,
    };

    render(<MailCompass api={fixtureApi({ listTasks: async () => [futureTask, soonTask, overdueTask] })} />);

    const urgentSection = await screen.findByRole("region", { name: "Cần chú ý hôm nay" });
    expect(urgentSection).toHaveTextContent("1 quá hạn · 1 đến hạn trong 24 giờ");
    const rows = within(urgentSection).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Quá hạn");
    expect(rows[0]).toHaveTextContent(overdueTask.title);
    expect(rows[1]).toHaveTextContent("Trong 24 giờ");
    expect(rows[1]).toHaveTextContent(soonTask.title);
    expect(urgentSection).not.toHaveTextContent(futureTask.title);
  });

  it("refreshes a Gmail inbox by event and recovers from a missed event on focus", async () => {
    const user = userEvent.setup();
    const localAccount: ProfileAccount = {
      account_id: "test-source", source_kind: "eml", display_name: "Thư trên máy", email: null,
      lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 1,
    };
    const gmailAccount: ProfileAccount = {
      account_id: "gmail-live", source_kind: "gmail", display_name: "live@example.test", email: "live@example.test",
      lifecycle_state: "active", sync_consent: true, generation: 2, data_version: 0, version: 2,
    };
    const syncedMail: MailDetail = { ...mail, id: "gmail-msg-1", subject: "Thư mới từ Gmail" };
    let gmailMessages: MailDetail[] = [];
    let emitSync: ((event: GmailSyncEvent) => void) | null = null;
    const baseSync: GmailSyncStatus = {
      account_id: gmailAccount.account_id, generation: gmailAccount.generation,
      data_version: gmailAccount.data_version, state: "idle",
      phase: "history", last_synced_at: null, retry_at: null, discovered: 0, imported: 0,
      removed: 0, skipped: 0, has_more: false, error_code: null, sync_available: true,
    };
    let syncSnapshot = baseSync;
    const requestGmailSync = vi.fn<DesktopApi["requestGmailSync"]>().mockResolvedValue({
      ...baseSync, state: "queued",
    });

    function makeScopedApi(active: ProfileAccount): DesktopApi {
      return fixtureApi({
        bootstrap: vi.fn(async () => ({
          workspace_id: "test-workspace",
          account_id: active.account_id,
          workspace_name: "Workspace",
          account_name: active.display_name,
          schema_version: 17,
        })),
        listSources: vi.fn(async () => ({
          accounts: [localAccount, gmailAccount],
          active_account_id: active.account_id,
          gmail_sign_in_available: true,
          gmail_sync_available: true,
          cleanups: [],
        })),
        listMail: async () => (active.account_id === gmailAccount.account_id ? gmailMessages : [mail]),
        getMail: async (messageId) => {
          const message = (active.account_id === gmailAccount.account_id ? gmailMessages : [mail])
            .find((item) => item.id === messageId);
          if (!message) throw new Error("mail_not_found");
          return message;
        },
        gmailSyncStatus: vi.fn(async () => syncSnapshot),
        requestGmailSync,
        onGmailSyncUpdated: vi.fn(async (cb) => {
          emitSync = cb;
          return () => { emitSync = null; };
        }),
        forSource: (target) => makeScopedApi(target),
      });
    }

    render(<MailCompass api={makeScopedApi(localAccount)} />);
    const switcher = await screen.findByLabelText("Chọn nguồn dữ liệu");
    await user.selectOptions(switcher, gmailAccount.account_id);

    await user.click(await screen.findByRole("button", { name: "Hộp thư" }));
    const syncBtn = await screen.findByRole("button", { name: "Đồng bộ Gmail" });
    await user.click(syncBtn);
    expect(requestGmailSync).toHaveBeenCalledExactlyOnceWith({
      account_id: gmailAccount.account_id,
      expected_generation: gmailAccount.generation,
    });
    expect(await screen.findByText("Đang đồng bộ thư mới từ Gmail…")).toBeVisible();

    gmailMessages = [syncedMail];
    await act(async () => {
      emitSync?.({
        account_id: gmailAccount.account_id,
        changed: true,
        status: { ...baseSync, data_version: 1, imported: 1, last_synced_at: "2026-11-20T10:15:00Z" },
      });
    });
    await user.click(await screen.findByText(syncedMail.subject));
    const reader = await screen.findByRole("article", { name: "Trình đọc email" });
    expect(await within(reader).findByText(syncedMail.subject)).toBeVisible();

    gmailMessages = [];
    syncSnapshot = { ...baseSync, data_version: 2, removed: 1, last_synced_at: "2026-11-20T10:16:00Z" };
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(await within(reader).findByText("Chưa mở được email")).toBeVisible();
    expect(within(reader).queryByText(syncedMail.subject)).not.toBeInTheDocument();
  });

  it("deletes active and cancelled tasks after explicit confirmation", async () => {
    const user = userEvent.setup();
    let storedTasks: Task[] = [
      localTask("Bản nháp đang gõ dở"),
      { ...localTask("Công việc đã hủy"), id: "task-cancelled", state: "cancelled", version: 2 },
    ];
    const deleteTask = vi.fn<NonNullable<DesktopApi["deleteTask"]>>(async (input) => {
      storedTasks = storedTasks.filter((item) => item.id !== input.task_id);
    });
    const api = fixtureApi({
      listTasks: async () => storedTasks,
      deleteTask,
    });

    render(<MailCompass api={api} />);
    await user.click(await screen.findByRole("button", { name: "Công việc" }));
    expect(await screen.findByText("Bản nháp đang gõ dở")).toBeInTheDocument();

    // Delete from the active task overflow menu.
    await user.click(screen.getByRole("button", { name: "Đổi trạng thái: Bản nháp đang gõ dở" }));
    await user.click(await screen.findByRole("menuitem", { name: "Xóa công việc" }));
    const dialog = screen.getByRole("dialog", { name: "Xóa công việc?" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Quay lại" })).toHaveFocus());
    await user.click(within(dialog).getByRole("button", { name: "Xóa công việc" }));

    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith(expect.objectContaining({
      task_id: "task-one",
      expected_version: 1,
    }));
    await waitFor(() => expect(screen.queryByText("Bản nháp đang gõ dở")).not.toBeInTheDocument());

    // Delete a cancelled task directly from the Đã hủy tab.
    await user.click(screen.getByRole("radio", { name: "Đã hủy" }));
    expect(await screen.findByText("Công việc đã hủy")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xóa công việc: Công việc đã hủy" }));
    const cancelDialog = screen.getByRole("dialog", { name: "Xóa công việc?" });
    await user.click(within(cancelDialog).getByRole("button", { name: "Xóa công việc" }));

    expect(deleteTask).toHaveBeenCalledTimes(2);
    expect(deleteTask).toHaveBeenLastCalledWith(expect.objectContaining({
      task_id: "task-cancelled",
      expected_version: 2,
    }));
    await waitFor(() => expect(screen.queryByText("Công việc đã hủy")).not.toBeInTheDocument());
  });
});

describe("W4-06 inbox workspace", () => {
  const second: MailDetail = { ...mail, id: "mail-two", subject: "Lịch họp tuần", preview: "" };

  it("scans selected mail inline from the inbox instead of opening a scan dialog", async () => {
    const user = userEvent.setup();
    const analysisRequest = vi.fn<DesktopApi["analysisRequest"]>(async ({ message_id }) => ({
      job_id: `job-${message_id}`, message_id, body_revision: 1, extractor_version: "t", status: "queued",
      cancel_requested: false, result_run_id: null, error_code: null, created_at: mail.received_at,
      updated_at: mail.received_at, completed_at: null,
    }));
    const api = fixtureApi({
      listMail: async () => [mail, second], analysisRequest,
      analysisStatus: vi.fn(async () => ({ eligible: true, blocked_reason: null, provider_label: "Gemini", extractor_version: "t", disclosure: "" })),
    });
    render(<MailCompass api={api} />);

    await user.click(await screen.findByRole("button", { name: "Hộp thư" }));
    expect(screen.queryByRole("button", { name: /Quét hộp thư tìm việc/ })).toBeNull();
    await user.click(await screen.findByRole("checkbox", { name: "Chọn thư Báo cáo dự án" }));
    await user.click(screen.getByRole("checkbox", { name: "Chọn thư Lịch họp tuần" }));
    await user.click(within(screen.getByRole("region", { name: "Thao tác thư đã chọn" })).getByRole("button", { name: "Quét AI" }));

    expect(screen.queryByRole("dialog", { name: /chọn thư/i })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(analysisRequest).toHaveBeenCalledTimes(2));
    expect(analysisRequest.mock.calls.map(([input]) => input.message_id)).toEqual([mail.id, second.id]);
  });

  it("queries folders through the frozen mail fields, keeps the folder when clearing and opens a rule from the search", async () => {
    const user = userEvent.setup();
    const bucket = { total: 1, unread: 0 };
    const queryMail = vi.fn<DesktopApi["queryMail"]>(async ({ query }) => ({
      items: [mail], next_cursor: null,
      ...(query?.includes("from:lan") && {
        parsed_operators: [{ operator: "from", value: "lan", negated: false, raw_token: "from:lan" }],
      }),
    }));
    const api = fixtureApi({
      queryMail,
      mailboxCounts: async () => ({
        inbox: bucket, starred: bucket, important: bucket, sent: bucket, snoozed: bucket, archive: bucket, trash: bucket,
        all: bucket, categories: { primary: bucket, updates: { total: 0, unread: 0 }, promotions: { total: 0, unread: 0 },
          social: { total: 0, unread: 0 }, forums: { total: 0, unread: 0 } },
      }),
      listSavedMailSearches: async () => [],
    });
    render(<MailCompass api={api} />);

    await user.click(await screen.findByRole("button", { name: "Hộp thư" }));
    const nav = await screen.findByRole("navigation", { name: "Hộp thư" });
    await user.click(within(nav).getByRole("button", { name: "Lưu trữ" }));
    await waitFor(() => expect(queryMail).toHaveBeenLastCalledWith({ mailbox: "ARCHIVE", limit: 40 }));

    await user.click(within(nav).getByRole("button", { name: "Quan trọng" }));
    await waitFor(() => expect(queryMail).toHaveBeenLastCalledWith({ include_all_mailboxes: true, query: "is:important", limit: 40 }));

    // The resizable panels intercept pointer focus in jsdom, so set the field directly.
    fireEvent.change(screen.getByRole("combobox", { name: "Tìm thư bằng toán tử Gmail hoặc mã" }), { target: { value: "from:lan" } });
    await user.click(screen.getByRole("button", { name: "Tìm email" }));
    await waitFor(() => expect(queryMail).toHaveBeenLastCalledWith({
      include_all_mailboxes: true, query: "is:important from:lan", limit: 40,
    }));
    // The folder's own operator is not offered as a removable chip.
    expect(await screen.findByRole("button", { name: "Bỏ from:lan" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bỏ is:important" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tạo quy tắc" }));
    const ruleDialog = await screen.findByRole("dialog", { name: "Thư mục và quy tắc" });
    expect(ruleDialog).toBeVisible();
    expect(within(ruleDialog).getByRole("textbox", { name: "Người gửi có chứa" })).toHaveValue("lan");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await waitFor(() => expect(queryMail).toHaveBeenLastCalledWith({ include_all_mailboxes: true, query: "is:important", limit: 40 }));
  });
});

describe("W4-07 MailCompass central wiring (GM-05, GM-06, FD-06, FD-09)", () => {
  const second: MailDetail = { ...mail, id: "mail-two", subject: "Lịch họp tuần", preview: "" };

  afterEach(() => {
    window.localStorage.removeItem(GMAIL_SHORTCUTS_STORAGE_KEY);
  });

  it("wires GM-05 Gmail shortcuts in Inbox, opens lazy ? help dialog, and respects Settings toggle", async () => {
    const user = userEvent.setup();
    const api = fixtureApi({
      listMail: async () => [mail, second],
      getMail: async (id) => (id === second.id ? second : mail),
    });
    render(<MailCompass api={api} />);

    await user.click(await screen.findByRole("button", { name: "Hộp thư" }));
    const firstRow = await screen.findByRole("button", { name: /Lan.*Báo cáo dự án/ });
    const secondRow = screen.getByRole("button", { name: /Lan.*Lịch họp tuần/ });

    // j/k navigate focus across visible rows, o opens the focused email, u returns to list.
    fireEvent.keyDown(document.body, { key: "j" });
    expect(firstRow).toHaveFocus();
    fireEvent.keyDown(firstRow, { key: "j" });
    expect(secondRow).toHaveFocus();
    fireEvent.keyDown(secondRow, { key: "k" });
    expect(firstRow).toHaveFocus();
    fireEvent.keyDown(firstRow, { key: "o" });
    expect(await screen.findByText(mail.body_text)).toBeVisible();
    fireEvent.keyDown(document.body, { key: "u" });
    await waitFor(() => expect(screen.queryByText(mail.body_text)).not.toBeInTheDocument());

    // / focuses the search input; typing inside search input must not trigger shortcuts.
    fireEvent.keyDown(document.body, { key: "/" });
    const searchInput = screen.getByRole("combobox", { name: "Tìm thư bằng toán tử Gmail hoặc mã" });
    expect(searchInput).toHaveFocus();
    fireEvent.keyDown(searchInput, { key: "?", shiftKey: true });
    expect(screen.queryByRole("dialog", { name: /Phím tắt kiểu Gmail/i })).not.toBeInTheDocument();

    // Pressing ? outside inputs lazily loads and opens KeyboardShortcutsDialog.
    searchInput.blur();
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    const helpDialog = await screen.findByRole("dialog", { name: /Phím tắt kiểu Gmail/i });
    expect(helpDialog).toBeVisible();
    await user.click(within(helpDialog).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Phím tắt kiểu Gmail/i })).not.toBeInTheDocument());

    // Turning off Gmail shortcuts in Settings immediately disables shortcuts without reload.
    await user.click(screen.getByRole("button", { name: "Cài đặt" }));
    const shortcutsCard = await screen.findByTestId("mc-settings-shortcuts-card");
    await user.click(within(shortcutsCard).getByRole("switch"));
    expect(window.localStorage.getItem(GMAIL_SHORTCUTS_STORAGE_KEY)).toBe("false");

    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    expect(screen.queryByRole("dialog", { name: /Phím tắt kiểu Gmail/i })).not.toBeInTheDocument();
  });

  it("navigates from AssistantView blocked Gemini banner to Settings via onOpenSettings (FD-06)", async () => {
    const user = userEvent.setup();
    const api = fixtureApi({
      listMail: async () => [mail],
      assistantStatus: vi.fn(async () => ({
        local_available: true,
        cloud_available: false,
        provider_label: "Gemini (gemini-2.5-flash)",
        provider_class: "gemini_free_tier",
        blocked_reason: "gmail_cloud_blocked",
        disclosure: "Gemini Free Tier đang khóa.",
        max_sources: 8,
        max_turns: 100,
        preview_ttl_seconds: 600,
      })),
    });
    render(<MailCompass api={api} />);

    await user.click(await screen.findByRole("button", { name: "Hỏi MailCompass" }));
    const radioGroup = await screen.findByRole("radiogroup", { name: "Chọn nhà cung cấp AI" });
    await user.click(within(radioGroup).getByRole("radio", { name: /Gemini Free Tier/ }));
    await user.click(await screen.findByRole("button", { name: "Mở Cài đặt" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Cài đặt" })).toBeVisible();
  });

  it("propagates account reminder presets from SettingsView into DeadlineDialog (FD-09)", async () => {
    const user = userEvent.setup();
    let localAccount: ProfileAccount = {
      account_id: "test-source", source_kind: "eml", display_name: "Thư trên máy", email: null,
      lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 2,
      reminder_lead_presets: [24],
    };
    const task = localTask("Nộp bài tập tuần 10");
    const api = fixtureApi({
      listSources: vi.fn(async () => ({
        accounts: [localAccount],
        active_account_id: localAccount.account_id,
        gmail_sign_in_available: false,
        gmail_sync_available: false,
        cleanups: [],
      })),
      listTasks: async () => [task],
      setReminderPresets: vi.fn(async (input) => {
        localAccount = { ...localAccount, reminder_lead_presets: input.lead_hours, version: localAccount.version + 1 };
        return { task_id: null, lead_hours: input.lead_hours, version: localAccount.version };
      }),
    });
    render(<MailCompass api={api} />);

    await user.click(await screen.findByRole("button", { name: "Công việc" }));
    await user.click(await screen.findByRole("button", { name: `Hạn chót: ${task.title}` }));
    let dialog = await screen.findByRole("dialog", { name: "Hạn chót" });
    let presetsGroup = within(dialog).getByRole("group", { name: "Mốc nhắc trước hạn" });
    expect(within(presetsGroup).getByRole("button", { name: "1 ngày" })).toHaveAttribute("aria-pressed", "true");
    expect(within(presetsGroup).getByRole("button", { name: "1 tuần" })).toHaveAttribute("aria-pressed", "false");
    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));

    // Update account default reminder presets in Settings -> DeadlineDialog picks up the new default immediately.
    await user.click(screen.getByRole("button", { name: "Cài đặt" }));
    const presetsCard = await screen.findByTestId("mc-settings-reminder-presets-card");
    await user.click(within(presetsCard).getByRole("button", { name: "1 tuần" }));
    expect(await within(presetsCard).findByText("Đã lưu mốc nhắc mặc định cho tài khoản.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Công việc" }));
    await user.click(await screen.findByRole("button", { name: `Hạn chót: ${task.title}` }));
    dialog = await screen.findByRole("dialog", { name: "Hạn chót" });
    presetsGroup = within(dialog).getByRole("group", { name: "Mốc nhắc trước hạn" });
    expect(within(presetsGroup).getByRole("button", { name: "1 tuần" })).toHaveAttribute("aria-pressed", "true");
    expect(within(presetsGroup).getByRole("button", { name: "1 ngày" })).toHaveAttribute("aria-pressed", "true");
  });

  it("clears search rule draft after closing organizer so normal rule management starts clean (GM-06 / UX-05)", async () => {
    const user = userEvent.setup();
    const queryMail = vi.fn<DesktopApi["queryMail"]>(async ({ query }) => ({
      items: [mail], next_cursor: null,
      ...(query?.includes("code:W10-04") && {
        parsed_operators: [{ operator: "code", value: "W10-04", negated: false, raw_token: "code:W10-04" }],
      }),
    }));
    render(<MailCompass api={fixtureApi({ queryMail })} />);

    await user.click(await screen.findByRole("button", { name: "Hộp thư" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tìm thư bằng toán tử Gmail hoặc mã" }), {
      target: { value: "code:W10-04" },
    });
    await user.click(screen.getByRole("button", { name: "Tìm email" }));
    expect(await screen.findByRole("button", { name: "Bỏ code:W10-04" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Tạo quy tắc" }));
    const fromSearch = await screen.findByRole("dialog", { name: "Thư mục và quy tắc" });
    expect(within(fromSearch).getByRole("textbox", { name: "Mã tham chiếu" })).toHaveValue("W10-04");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Opening rule manager from the normal "Thư mục và quy tắc" button must show the rules list, not stale W10-04 draft.
    await user.click(screen.getByRole("button", { name: "Thư mục và quy tắc" }));
    const freshManager = await screen.findByRole("dialog", { name: "Thư mục và quy tắc" });
    expect(within(freshManager).getByRole("button", { name: "Tạo quy tắc" })).toBeVisible();
    expect(within(freshManager).queryByRole("textbox", { name: "Mã tham chiếu" })).not.toBeInTheDocument();
  });
});
