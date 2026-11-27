import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AnalysisAvailability, AnalysisEvent, AnalysisJob, AnalysisProposal, DesktopApi, MailDetail, Task,
  WorkCandidateView,
} from "./api";
import {
  CANDIDATE_NEEDS_REVIEW_LABEL, candidateNeedsTitleReview, MailAnalysisPanel,
} from "./MailAnalysisPanel";

const sampleMail: MailDetail = {
  id: "mail-1",
  subject: "Đề xuất ngân sách quý 4",
  sender: "Minh <minh@example.test>",
  sent_at: "2026-11-19T09:00:00Z",
  received_at: "2026-11-19T09:00:00Z",
  preview: "Nhờ Khoa tổng hợp báo cáo ngân sách quý 4 trước thứ Sáu.",
  has_attachments: false,
  recipients: ["Team <team@example.test>"],
  cc: [],
  body_text: "Nhờ Khoa tổng hợp báo cáo ngân sách quý 4 trước thứ Sáu.",
  body_revision: 1,
  body_sha256: "a".repeat(64),
  parser_version: "v2",
  filename: "budget.eml",
  quoted_ranges: [],
  attachment_metadata: [],
  warnings: [],
};

const eligibleAvailability: AnalysisAvailability = {
  eligible: true,
  blocked_reason: null,
  provider_label: "Gemini (gemini-2.5-flash)",
  extractor_version: "gemini:gemini-2.5-flash:prompt-v2:schema-v1",
  disclosure: "Chế độ trích xuất thử nghiệm.",
};

const sampleProposal: AnalysisProposal = {
  run_id: "run-1",
  message_id: "mail-1",
  body_revision: 1,
  extractor_version: "gemini:gemini-2.5-flash:prompt-v2:schema-v1",
  intent: "task",
  summary: "Yêu cầu Khoa tổng hợp báo cáo ngân sách quý 4.",
  warnings: ["deadline_needs_review"],
  unknown: ["deadline"],
  time_mentions: [],
  evidence: [{
    evidence_id: "ev-1",
    start_codepoint: 0,
    end_codepoint: 56,
    quote: "Nhờ Khoa tổng hợp báo cáo ngân sách quý 4 trước thứ Sáu.",
  }],
  candidates: [{
    candidate_id: "cand-1",
    run_id: "run-1",
    message_id: "mail-1",
    body_revision: 1,
    action: "Tổng hợp báo cáo ngân sách quý 4",
    proposed_owner: "Khoa",
    proposed_importance: "high",
    proposed_estimated_minutes: 45,
    proposed_deadline_utc: null,
    proposed_deadline_raw: "trước thứ Sáu",
    time_mentions: [{
      raw_text: "trước thứ Sáu",
      kind: "deadline",
      normalized_iso: null,
      timezone: null,
      confidence: 0.9,
      start: 42,
      end: 55,
    }],
    conditions: [],
    evidence_ids: ["ev-1"],
    needs_confirmation: true,
    confirmed_task_id: null,
  }],
  created_at: "2026-11-20T09:00:00Z",
};

function savedTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-confirmed-1",
    title: "Tổng hợp báo cáo ngân sách quý 4 (đã duyệt)",
    state: "not_started",
    owner: "Khoa Nguyễn",
    importance: "high",
    estimated_minutes: 60,
    message_id: "mail-1",
    deadline_effective: "2026-11-27T10:00:00Z",
    deadline_authored: "2026-11-27T17:00:00+07:00",
    version: 1,
    created_at: "2026-11-20T09:05:00Z",
    updated_at: "2026-11-20T09:05:00Z",
    ...overrides,
  };
}

function makeJob(status: AnalysisJob["status"], extra: Partial<AnalysisJob> = {}): AnalysisJob {
  return {
    job_id: "job-1",
    message_id: "mail-1",
    body_revision: 1,
    extractor_version: "gemini:gemini-2.5-flash:prompt-v2:schema-v1",
    status,
    cancel_requested: false,
    result_run_id: status === "succeeded" ? "run-1" : null,
    error_code: null,
    created_at: "2026-11-20T09:00:00Z",
    updated_at: "2026-11-20T09:00:00Z",
    completed_at: status === "succeeded" || status === "failed" || status === "cancelled"
      ? "2026-11-20T09:00:02Z"
      : null,
    ...extra,
  };
}

function createApi(overrides: Partial<DesktopApi> = {}) {
  let listener: ((event: AnalysisEvent) => void) | null = null;
  const api = {
    analysisStatus: vi.fn(async () => eligibleAvailability),
    analysisRequest: vi.fn(async () => makeJob("queued")),
    analysisLatest: vi.fn(async () => null as AnalysisProposal | null),
    analysisJobGet: vi.fn(async () => makeJob("succeeded")),
    analysisJobLatest: vi.fn(async () => null as AnalysisJob | null),
    analysisJobCancel: vi.fn(async () => makeJob("cancelled", { cancel_requested: true })),
    confirmCandidate: vi.fn(async () => ({ task: savedTask(), created: true })),
    onAnalysisUpdated: vi.fn(async (cb: (event: AnalysisEvent) => void) => {
      listener = cb;
      return () => { listener = null; };
    }),
    ...overrides,
  } as unknown as DesktopApi;
  return {
    api,
    emit: (event: AnalysisEvent) => listener?.(event),
  };
}

describe("MailAnalysisPanel", () => {
  it("runs extraction, receives live completion event, reviews relative deadline, and confirms task once", async () => {
    const onTaskCreated = vi.fn();
    const onOpenTask = vi.fn();
    const { api, emit } = createApi({
      analysisLatest: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleProposal),
    });

    render(
      <MailAnalysisPanel
        api={api}
        mail={sampleMail}
        onTaskCreated={onTaskCreated}
        onOpenTask={onOpenTask}
        onCreateManual={vi.fn()}
      />,
    );

    const runButton = await screen.findByRole("button", { name: "Tìm việc trong thư" });
    fireEvent.click(runButton);

    expect(await screen.findByText(/Đã xếp hàng phân tích thư/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy phân tích" })).toBeInTheDocument();

    await act(async () => {
      emit({ account_id: "acc-1", message_id: "mail-1", job_id: "job-1", status: "succeeded" });
    });

    const list = await screen.findByRole("list", { name: "Đề xuất công việc" });
    expect(within(list).getByText("Tổng hợp báo cáo ngân sách quý 4")).toBeInTheDocument();
    expect(within(list).getByText(/“trước thứ Sáu”/)).toBeInTheDocument();
    expect(api.confirmCandidate).not.toHaveBeenCalled();

    fireEvent.click(within(list).getByRole("button", { name: "Xem & lưu công việc" }));
    const dialog = await screen.findByRole("dialog", { name: "Xác nhận công việc từ thư" });
    fireEvent.change(within(dialog).getByLabelText("Tên công việc"), {
      target: { value: "Tổng hợp báo cáo ngân sách quý 4 (đã duyệt)" },
    });
    fireEvent.change(within(dialog).getByLabelText("Người phụ trách"), {
      target: { value: "Khoa Nguyễn" },
    });
    fireEvent.change(within(dialog).getByLabelText("Thời gian dự kiến (phút)"), {
      target: { value: "60" },
    });
    fireEvent.click(within(dialog).getByLabelText("Đặt hạn chót khi lưu công việc"));
    fireEvent.change(within(dialog).getByLabelText("Ngày"), { target: { value: "2026-11-27" } });
    fireEvent.change(within(dialog).getByLabelText("Giờ"), { target: { value: "17:00" } });
    fireEvent.change(within(dialog).getByLabelText("Độ lệch UTC"), { target: { value: "+07:00" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu công việc" }));

    await waitFor(() => expect(api.confirmCandidate).toHaveBeenCalledWith(expect.objectContaining({
      candidate_id: "cand-1",
      title: "Tổng hợp báo cáo ngân sách quý 4 (đã duyệt)",
      owner: "Khoa Nguyễn",
      importance: "high",
      estimated_minutes: 60,
      deadline_instant: "2026-11-27T17:00:00+07:00",
      expected_body_revision: 1,
    })));
    expect(onTaskCreated).toHaveBeenCalledWith(savedTask());
    expect(await screen.findByText("Đã lưu thành công việc")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mở công việc" }));
    expect(onOpenTask).toHaveBeenCalledWith("task-confirmed-1");
  });

  it("keeps a fast completion when the enqueue response arrives later", async () => {
    let finishEnqueue!: (job: AnalysisJob) => void;
    const { api, emit } = createApi({
      analysisRequest: vi.fn(() => new Promise<AnalysisJob>((resolve) => { finishEnqueue = resolve; })),
      analysisLatest: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleProposal),
    });

    render(<MailAnalysisPanel api={api} mail={sampleMail} onCreateManual={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tìm việc trong thư" }));

    await act(async () => {
      emit({ account_id: "acc-1", message_id: "mail-1", job_id: "job-1", status: "succeeded" });
    });
    expect(screen.getByRole("list", { name: "Đề xuất công việc" })).toBeInTheDocument();

    await act(async () => { finishEnqueue(makeJob("queued")); });
    expect(screen.getByRole("button", { name: "Phân tích lại" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Hủy phân tích" })).not.toBeInTheDocument();
  });

  it("reads a finished job even if the live event subscription fails", async () => {
    vi.useFakeTimers();
    try {
      const { api } = createApi({
        onAnalysisUpdated: vi.fn().mockRejectedValue(new Error("listener unavailable")),
        analysisLatest: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(sampleProposal),
      });

      await act(async () => {
        render(<MailAnalysisPanel api={api} mail={sampleMail} onCreateManual={vi.fn()} />);
      });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tìm việc trong thư" })); });
      expect(screen.getByRole("button", { name: "Hủy phân tích" })).toBeEnabled();

      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(screen.getByRole("list", { name: "Đề xuất công việc" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Hủy phân tích" })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks Gmail extraction under trial policy and keeps manual task creation available", async () => {
    const onCreateManual = vi.fn();
    const { api } = createApi({
      analysisStatus: vi.fn(async () => ({
        eligible: false,
        blocked_reason: "gmail_extraction_blocked",
        provider_label: "Gemini (gemini-2.5-flash)",
        extractor_version: "gemini:gemini-2.5-flash:prompt-v2:schema-v1",
        disclosure: "",
      })),
    });

    render(<MailAnalysisPanel api={api} mail={sampleMail} onCreateManual={onCreateManual} />);

    expect(await screen.findByText(/Tài khoản Gmail thật đang bị khóa với Gemini Free Tier/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tìm việc trong thư" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo việc thủ công" }));
    expect(onCreateManual).toHaveBeenCalledTimes(1);
    expect(api.analysisRequest).not.toHaveBeenCalled();
  });

  it("shows a clean no-result state for notice emails and supports cancelling a queued job", async () => {
    const { api } = createApi({
      analysisLatest: vi.fn(async () => ({
        ...sampleProposal,
        intent: "notice" as const,
        summary: "Thông báo nghỉ lễ cuối năm.",
        candidates: [],
        evidence: [],
        warnings: [],
      })),
    });

    const { rerender } = render(<MailAnalysisPanel api={api} mail={sampleMail} onCreateManual={vi.fn()} />);
    expect(await screen.findByText("Không tìm thấy công việc nào cần làm trong thư này.")).toBeInTheDocument();

    const { api: cancelApi } = createApi({
      analysisJobLatest: vi.fn(async () => makeJob("queued", { message_id: "mail-2" })),
      analysisJobCancel: vi.fn(async () => makeJob("cancelled", { message_id: "mail-2", cancel_requested: true })),
    });
    rerender(<MailAnalysisPanel api={cancelApi} mail={{ ...sampleMail, id: "mail-2" }} onCreateManual={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Hủy phân tích" }));
    await waitFor(() => expect(cancelApi.analysisJobCancel).toHaveBeenCalledWith(expect.objectContaining({
      job_id: "job-1",
    })));
    expect(await screen.findByText("Đã hủy tìm việc trong thư.")).toBeInTheDocument();
  });

  it("reuses the same request key when retrying a failed candidate confirmation", async () => {
    const confirmCandidate = vi.fn<DesktopApi["confirmCandidate"]>()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ task: savedTask(), created: true });
    const { api } = createApi({
      analysisLatest: vi.fn(async () => sampleProposal),
      confirmCandidate,
    });

    render(<MailAnalysisPanel api={api} mail={sampleMail} onCreateManual={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Xem & lưu công việc" }));
    const dialog = await screen.findByRole("dialog", { name: "Xác nhận công việc từ thư" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu công việc" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Chưa lưu được công việc");

    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu công việc" }));
    await waitFor(() => expect(confirmCandidate).toHaveBeenCalledTimes(2));
    expect(confirmCandidate.mock.calls[1][0].request_key).toBe(confirmCandidate.mock.calls[0][0].request_key);
  });

  it("shows clarity warning badge and auto-focuses title input when title_clarity_state is needs_user_review", async () => {
    const vagueCandidate: WorkCandidateView = {
      ...sampleProposal.candidates[0],
      candidate_id: "cand-vague",
      action: "Xử lý gấp việc này",
      title_clarity_state: "needs_user_review",
    };
    const renamedTask = savedTask({
      id: "task-renamed-1",
      title: "Gửi báo cáo ngân sách quý 4 cho Minh",
    });
    const confirmCandidate = vi.fn<DesktopApi["confirmCandidate"]>(async () => ({
      task: renamedTask,
      created: true,
    }));
    const { api } = createApi({
      analysisLatest: vi.fn(async () => ({
        ...sampleProposal,
        candidates: [vagueCandidate],
      })),
      confirmCandidate,
    });

    render(<MailAnalysisPanel api={api} mail={sampleMail} onCreateManual={vi.fn()} />);

    const list = await screen.findByRole("list", { name: "Đề xuất công việc" });
    expect(within(list).getByText(CANDIDATE_NEEDS_REVIEW_LABEL)).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: "Xem & lưu công việc" }));
    const dialog = await screen.findByRole("dialog", { name: "Xác nhận công việc từ thư" });
    const titleInput = within(dialog).getByLabelText("Tên công việc");
    await waitFor(() => expect(titleInput).toHaveFocus());

    const describedById = titleInput.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const hintNode = document.getElementById(describedById!);
    expect(hintNode).toBeInTheDocument();
    expect(hintNode).toHaveTextContent(CANDIDATE_NEEDS_REVIEW_LABEL);

    fireEvent.change(titleInput, { target: { value: "Gửi báo cáo ngân sách quý 4 cho Minh" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu công việc" }));

    await waitFor(() => expect(confirmCandidate).toHaveBeenCalledWith(expect.objectContaining({
      candidate_id: "cand-vague",
      title: "Gửi báo cáo ngân sách quý 4 cho Minh",
    })));
    expect(await within(list).findByText("Đã lưu thành công việc")).toBeInTheDocument();
    expect(within(list).queryByText(CANDIDATE_NEEDS_REVIEW_LABEL)).not.toBeInTheDocument();
  });

  it("omits clarity warning badge and title auto-focus for validated, user_edited, undefined, and already-confirmed candidates", async () => {
    expect(candidateNeedsTitleReview({ title_clarity_state: "needs_user_review" })).toBe(true);
    expect(candidateNeedsTitleReview({ title_clarity_state: "validated" })).toBe(false);
    expect(candidateNeedsTitleReview({ title_clarity_state: "user_edited" })).toBe(false);
    expect(candidateNeedsTitleReview({})).toBe(false);

    const validatedCand: WorkCandidateView = {
      ...sampleProposal.candidates[0],
      candidate_id: "cand-validated",
      action: "Hoàn thiện báo cáo ngân sách quý 4",
      title_clarity_state: "validated",
    };
    const editedCand: WorkCandidateView = {
      ...sampleProposal.candidates[0],
      candidate_id: "cand-edited",
      action: "Gửi slide ngân sách cho ban giám đốc",
      title_clarity_state: "user_edited",
    };
    const legacyCand: WorkCandidateView = {
      ...sampleProposal.candidates[0],
      candidate_id: "cand-legacy",
      action: "Rà soát số liệu chi phí tháng 11",
    };
    const confirmedVagueCand: WorkCandidateView = {
      ...sampleProposal.candidates[0],
      candidate_id: "cand-confirmed-vague",
      action: "Xử lý việc này",
      title_clarity_state: "needs_user_review",
      needs_confirmation: false,
      confirmed_task_id: "task-existing-1",
    };

    const { api } = createApi({
      analysisLatest: vi.fn(async () => ({
        ...sampleProposal,
        candidates: [validatedCand, editedCand, legacyCand, confirmedVagueCand],
      })),
    });

    render(<MailAnalysisPanel api={api} mail={sampleMail} onCreateManual={vi.fn()} />);

    const list = await screen.findByRole("list", { name: "Đề xuất công việc" });
    expect(within(list).queryByText(CANDIDATE_NEEDS_REVIEW_LABEL)).not.toBeInTheDocument();

    const reviewButtons = within(list).getAllByRole("button", { name: "Xem & lưu công việc" });
    expect(reviewButtons).toHaveLength(3);
    fireEvent.click(reviewButtons[0]);

    const dialog = await screen.findByRole("dialog", { name: "Xác nhận công việc từ thư" });
    const titleInput = within(dialog).getByLabelText("Tên công việc");
    expect(titleInput).not.toHaveAttribute("aria-describedby");
    expect(within(dialog).queryByText(new RegExp(CANDIDATE_NEEDS_REVIEW_LABEL))).not.toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Đóng" })).toHaveFocus());
    expect(titleInput).not.toHaveFocus();
  });
});
