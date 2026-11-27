import { Dialog } from "@base-ui/react/dialog";
import {
  AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, FileText, Plus, Sparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Importance } from "../api/types";
import type {
  AnalysisAvailability, AnalysisEvidence, AnalysisJob, AnalysisProposal, ConfirmCandidateInput,
  DesktopApi, MailDetail, Task, TitleClarityState, WorkCandidateView,
} from "./api";
import { formatDate, importanceLabels, mutationErrorCode } from "./presentation";
import {
  authoredDeadline, deadlineDraft, proposedDeadlineDraft, setDeadlineDate, type DeadlineDraft,
} from "./taskDeadline";
import "./mail-analysis.css";

export const CANDIDATE_NEEDS_REVIEW_LABEL = "Cần đặt lại tên rõ hơn";

export function candidateNeedsTitleReview(
  candidate: Pick<WorkCandidateView, "title_clarity_state">,
): boolean {
  return candidate.title_clarity_state === "needs_user_review";
}

const statusOrder: Record<AnalysisJob["status"], number> = {
  queued: 0,
  running: 1,
  succeeded: 2,
  failed: 2,
  cancelled: 2,
};

function timeKey(instant: string) {
  // Rust uses UTC with a variable number of fractional digits.
  return instant.replace(/(?:\.(\d+))?Z$/, (_, fraction = "") => `.${fraction.padEnd(6, "0")}Z`);
}

export function freshJob(current: AnalysisJob | null, next: AnalysisJob) {
  if (!current) return next;
  if (current.job_id !== next.job_id) {
    const currentKey = [timeKey(current.created_at), current.job_id].join("/");
    const nextKey = [timeKey(next.created_at), next.job_id].join("/");
    return nextKey >= currentKey ? next : current;
  }
  if (statusOrder[next.status] < statusOrder[current.status]
    || timeKey(next.updated_at) < timeKey(current.updated_at)
    || (current.cancel_requested && !next.cancel_requested)) return current;
  return next;
}

export function freshProposal(current: AnalysisProposal | null, next: AnalysisProposal) {
  if (!current) return next;
  if (timeKey(next.created_at) < timeKey(current.created_at)) return current;
  if (current.run_id !== next.run_id) return next;
  const saved = new Map(current.candidates.map((candidate) => [candidate.candidate_id, candidate.confirmed_task_id]));
  return {
    ...next,
    candidates: next.candidates.map((candidate) => {
      const confirmed = saved.get(candidate.candidate_id);
      return confirmed && !candidate.confirmed_task_id
        ? { ...candidate, confirmed_task_id: confirmed, needs_confirmation: false }
        : candidate;
    }),
  };
}

interface MailAnalysisPanelProps {
  api: DesktopApi;
  mail: MailDetail;
  onTaskCreated?: (task: Task) => void;
  onOpenTask?: (taskId: string) => void;
  onCreateManual: () => void;
}

export function blockedReasonText(reason: string | null) {
  if (reason === "gmail_extraction_blocked") {
    return "Tài khoản Gmail thật đang bị khóa với Gemini Free Tier để bảo vệ quyền riêng tư. Bạn có thể tạo việc thủ công, hoặc vào Cài đặt → Quyền riêng tư & AI Gemini nếu chấp nhận rủi ro Free Tier.";
  }
  if (reason === "source_not_eligible") {
    return "Thư này không thuộc danh sách thử nghiệm Free Tier. Bạn có thể tạo việc thủ công, hoặc vào Cài đặt → Quyền riêng tư & AI Gemini nếu chấp nhận rủi ro Free Tier.";
  }
  if (reason === "provider_input_too_large") {
    return "Nội dung thư vượt giới hạn trích xuất tự động. Hãy tạo công việc thủ công.";
  }
  if (reason === "cloud_policy_disabled") {
    return "Chức năng tìm việc tự động đang tắt theo chính sách máy.";
  }
  return "Gemini chưa được cấu hình trên máy. Bạn vẫn có thể tạo công việc thủ công từ thư này.";
}

export function jobErrorText(code: string | null) {
  if (code === "analysis_interrupted") {
    return "Phân tích bị gián đoạn khi MailCompass đóng. Hãy thử lại hoặc tạo việc thủ công.";
  }
  if (code === "provider_rate_limited") return "Gemini đang giới hạn lượt gọi. Hãy thử lại sau hoặc tạo việc thủ công.";
  if (code === "provider_timeout") return "Gemini phản hồi quá chậm. Hãy thử lại hoặc tạo việc thủ công.";
  if (code === "provider_auth_failed") return "Khóa API Gemini không hợp lệ. Hãy kiểm tra lại cấu hình trên máy.";
  if (code === "provider_refused") return "Gemini không thể phân tích thư này. Hãy tạo việc thủ công.";
  if (code === "provider_unavailable") return "Không kết nối được Gemini lúc này. Bạn vẫn có thể tạo việc thủ công.";
  if (code === "invalid_evidence" || code === "invalid_analysis_output" || code === "invalid_json") {
    return "Kết quả trích xuất không khớp với nội dung thư nên đã bị loại bỏ. Hãy thử lại hoặc tạo việc thủ công.";
  }
  if (code === "source_not_eligible" || code === "gmail_extraction_blocked") {
    return blockedReasonText(code);
  }
  if (code === "invalid_revision") return "Nội dung thư đã thay đổi khi đang phân tích. Hãy thử lại.";
  return "Chưa phân tích được thư này. Hãy thử lại hoặc tạo việc thủ công.";
}

function warningText(code: string) {
  if (code === "deadline_needs_review" || code === "time_normalization_rejected") {
    return "Thư có mốc thời gian tương đối hoặc chưa đủ múi giờ — hãy kiểm tra kỹ trước khi đặt hạn chót.";
  }
  if (code === "ambiguous_deadline") {
    return "Thư nêu nhiều mốc hạn khác nhau — hạn chót được để trống để bạn tự chọn.";
  }
  if (code === "quoted_only") {
    return "Đã bỏ qua yêu cầu chỉ xuất hiện trong phần trích dẫn thư cũ.";
  }
  if (code === "owner_not_grounded") {
    return "Người phụ trách không xuất hiện rõ trong câu trích dẫn nên được để trống.";
  }
  return null;
}

function confirmErrorText(error: unknown) {
  const code = mutationErrorCode(error);
  if (code === "candidate_stale" || code === "evidence_stale") {
    return "Nội dung thư đã thay đổi sau khi trích xuất. Hãy đóng hộp thoại để phân tích lại hoặc tạo việc thủ công.";
  }
  if (code === "candidate_already_confirmed") {
    return "Đề xuất này đã được lưu thành công việc trước đó.";
  }
  if (code === "invalid_deadline") {
    return "Ngày, giờ, độ lệch UTC hoặc lý do hạn chót chưa hợp lệ.";
  }
  if (code === "invalid_task") {
    return "Hãy kiểm tra lại tên công việc, người phụ trách và thời gian dự kiến.";
  }
  return "Chưa lưu được công việc. Thông tin bạn đã chỉnh vẫn được giữ nguyên, hãy thử lại.";
}

export function MailAnalysisPanel({
  api, mail, onTaskCreated, onOpenTask, onCreateManual,
}: MailAnalysisPanelProps) {
  const [availability, setAvailability] = useState<AnalysisAvailability | null>(null);
  const [proposal, setProposal] = useState<AnalysisProposal | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reviewing, setReviewing] = useState<WorkCandidateView | null>(null);
  const epoch = useRef(0);

  const acceptJob = useCallback((currentEpoch: number, next: AnalysisJob | null) => {
    if (epoch.current === currentEpoch && next?.message_id === mail.id && next.body_revision === mail.body_revision) {
      setJob((current) => freshJob(current, next));
    }
  }, [mail.id, mail.body_revision]);

  const loadProposal = useCallback(async (currentEpoch: number) => {
    const next = await api.analysisLatest(mail.id);
    if (epoch.current === currentEpoch && next?.message_id === mail.id && next.body_revision === mail.body_revision) {
      setProposal((current) => freshProposal(current, next));
    }
  }, [api, mail.id, mail.body_revision]);

  useEffect(() => {
    const currentEpoch = ++epoch.current;
    setAvailability(null);
    setProposal(null);
    setJob(null);
    setRequestError(null);
    setReviewing(null);
    setSubmitting(false);
    setCancelling(false);

    if (!api.analysisStatus || !api.analysisLatest || !api.analysisJobLatest) return;

    void api.analysisStatus(mail.id).then((next) => {
      if (epoch.current === currentEpoch) setAvailability(next);
    }).catch(() => {});
    void loadProposal(currentEpoch).catch(() => {});
    void api.analysisJobLatest(mail.id).then((next) => acceptJob(currentEpoch, next)).catch(() => {});

    let unlisten: (() => void) | undefined;
    void api.onAnalysisUpdated?.((event) => {
      if (epoch.current !== currentEpoch || event.message_id !== mail.id) return;
      void api.analysisJobGet(event.job_id).then((next) => acceptJob(currentEpoch, next)).catch(() => {});
      if (event.status === "succeeded") void loadProposal(currentEpoch).catch(() => {});
    }).then((stop) => {
      if (epoch.current === currentEpoch) unlisten = stop;
      else stop();
    }).catch(() => {});
    return () => {
      ++epoch.current;
      unlisten?.();
    };
  }, [api, mail.id, acceptJob, loadProposal]);

  const pendingJobId = job?.status === "queued" || job?.status === "running" ? job.job_id : null;
  useEffect(() => {
    if (!pendingJobId) return;
    const currentEpoch = epoch.current;
    const timer = window.setInterval(() => {
      void api.analysisJobGet(pendingJobId).then(async (next) => {
        acceptJob(currentEpoch, next);
        if (next.status === "succeeded") await loadProposal(currentEpoch);
      }).catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [api, pendingJobId, acceptJob, loadProposal]);

  const evidenceById = useMemo(
    () => new Map<string, AnalysisEvidence>(proposal?.evidence.map((ev) => [ev.evidence_id, ev]) ?? []),
    [proposal],
  );

  const visibleWarnings = useMemo(() => {
    const notes = new Set<string>();
    for (const code of proposal?.warnings ?? []) {
      const text = warningText(code);
      if (text) notes.add(text);
    }
    return [...notes];
  }, [proposal]);

  async function requestAnalysis() {
    if (submitting || !availability?.eligible) return;
    const currentEpoch = epoch.current;
    setSubmitting(true);
    setRequestError(null);
    try {
      const nextJob = await api.analysisRequest({
        message_id: mail.id,
        request_key: crypto.randomUUID(),
      });
      acceptJob(currentEpoch, nextJob);
      if (nextJob.status === "succeeded") await loadProposal(currentEpoch);
    } catch (error) {
      if (epoch.current !== currentEpoch) return;
      const code = mutationErrorCode(error);
      setRequestError(jobErrorText(typeof code === "string" ? code : null));
    } finally {
      if (epoch.current === currentEpoch) setSubmitting(false);
    }
  }

  async function cancelAnalysis() {
    if (!job || cancelling) return;
    const currentEpoch = epoch.current;
    setCancelling(true);
    setRequestError(null);
    try {
      const updated = await api.analysisJobCancel({
        job_id: job.job_id,
        request_key: crypto.randomUUID(),
      });
      acceptJob(currentEpoch, updated);
    } catch {
      if (epoch.current === currentEpoch) setRequestError("Chưa gửi được yêu cầu hủy phân tích.");
    } finally {
      if (epoch.current === currentEpoch) setCancelling(false);
    }
  }

  function handleConfirmed(candidateId: string, task: Task) {
    setProposal((current) => {
      if (!current) return current;
      return {
        ...current,
        candidates: current.candidates.map((item) => {
          if (item.candidate_id !== candidateId) return item;
          const nextClarity: TitleClarityState | undefined = task.title !== item.action
            ? "user_edited"
            : item.title_clarity_state;
          return {
            ...item,
            needs_confirmation: false,
            confirmed_task_id: task.id,
            ...(nextClarity ? { title_clarity_state: nextClarity } : {}),
          };
        }),
      };
    });
    setReviewing(null);
    onTaskCreated?.(task);
  }

  // In unit tests or minimal environments without analysis IPC, stay unobtrusive.
  if (!availability && !proposal && !job) return null;

  const isRunning = job?.status === "queued" || job?.status === "running";

  return (
    <section className="mc-analysis-panel" aria-labelledby="mc-analysis-heading">
      <div className="mc-analysis-header">
        <div>
          <h3 id="mc-analysis-heading">
            <Sparkles size={16} aria-hidden="true" /> Đề xuất công việc từ thư
          </h3>
          {availability?.provider_label && availability.eligible && (
            <p className="mc-muted mc-analysis-subtitle">{availability.provider_label} · Chỉ lưu khi bạn xác nhận</p>
          )}
        </div>
        <div className="mc-analysis-actions">
          {isRunning ? (
            <button
              type="button"
              className="mc-button mc-quiet"
              disabled={cancelling || Boolean(job?.cancel_requested)}
              onClick={() => void cancelAnalysis()}
            >
              {job?.cancel_requested ? "Đang hủy…" : "Hủy phân tích"}
            </button>
          ) : availability?.eligible ? (
            <button
              type="button"
              className="mc-button mc-secondary"
              disabled={submitting}
              onClick={() => void requestAnalysis()}
            >
              <Sparkles size={16} aria-hidden="true" />
              {submitting ? "Đang gửi…" : proposal ? "Phân tích lại" : "Tìm việc trong thư"}
            </button>
          ) : null}
        </div>
      </div>

      {isRunning && (
        <p className="mc-analysis-status" role="status">
          {job?.status === "running"
            ? "Đang phân tích nội dung thư để gợi ý công việc…"
            : "Đã xếp hàng phân tích thư… Bạn vẫn có thể làm việc bình thường."}
        </p>
      )}

      {!isRunning && job?.status === "failed" && (
        <div className="mc-analysis-notice" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <div>
            <p>{jobErrorText(job.error_code)}</p>
            <div className="mc-analysis-inline-actions">
              {availability?.eligible && (
                <button type="button" className="mc-text-button" onClick={() => void requestAnalysis()}>
                  Thử lại
                </button>
              )}
              <button type="button" className="mc-text-button" onClick={onCreateManual}>
                Tạo việc thủ công
              </button>
            </div>
          </div>
        </div>
      )}

      {!isRunning && job?.status === "cancelled" && !proposal && (
        <p className="mc-muted" role="status">Đã hủy tìm việc trong thư.</p>
      )}

      {requestError && <p className="mc-form-error" role="alert">{requestError}</p>}

      {availability && !availability.eligible && !proposal && !isRunning && (
        <div className="mc-analysis-blocked">
          <p className="mc-muted">{blockedReasonText(availability.blocked_reason)}</p>
          <button type="button" className="mc-text-button" onClick={onCreateManual}>
            <Plus size={15} aria-hidden="true" /> Tạo việc thủ công
          </button>
        </div>
      )}

      {proposal && (
        <div className="mc-analysis-results">
          {proposal.summary && <p className="mc-analysis-summary">{proposal.summary}</p>}
          {visibleWarnings.length > 0 && (
            <ul className="mc-analysis-warnings">
              {visibleWarnings.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
          {proposal.candidates.length === 0 ? (
            <div className="mc-analysis-empty">
              <p className="mc-muted">Không tìm thấy công việc nào cần làm trong thư này.</p>
              <button type="button" className="mc-text-button" onClick={onCreateManual}>
                <Plus size={15} aria-hidden="true" /> Tạo việc thủ công
              </button>
            </div>
          ) : (
            <ul className="mc-candidate-list" aria-label="Đề xuất công việc">
              {proposal.candidates.map((candidate) => {
                const needsTitleReview = candidateNeedsTitleReview(candidate) && !candidate.confirmed_task_id;
                const quotes = candidate.evidence_ids
                  .map((id) => evidenceById.get(id))
                  .filter((ev): ev is AnalysisEvidence => Boolean(ev));
                const deadlineLabel = candidate.proposed_deadline_utc
                  ? `Hạn đề xuất: ${formatDate(candidate.proposed_deadline_utc, true)} (cần xác nhận)`
                  : candidate.proposed_deadline_raw
                    ? `Thời hạn trong thư: “${candidate.proposed_deadline_raw}” (cần chọn ngày giờ)`
                    : "Chưa rõ hạn chót";
                return (
                  <li key={candidate.candidate_id} className="mc-candidate-card">
                    <div className="mc-candidate-top">
                      <strong>{candidate.action}</strong>
                      <div className="mc-candidate-badges">
                        {needsTitleReview && (
                          <span className="mc-candidate-clarity-badge">
                            <AlertTriangle size={14} aria-hidden="true" />
                            <span>{CANDIDATE_NEEDS_REVIEW_LABEL}</span>
                          </span>
                        )}
                        <span className="mc-candidate-importance">{importanceLabels[candidate.proposed_importance]}</span>
                      </div>
                    </div>
                    <p className="mc-muted mc-candidate-meta">
                      {candidate.proposed_owner ? `Phụ trách: ${candidate.proposed_owner}` : "Chưa rõ người phụ trách"}
                      {candidate.proposed_estimated_minutes ? ` · Khoảng ${candidate.proposed_estimated_minutes} phút` : ""}
                    </p>
                    <p className="mc-candidate-deadline">
                      <CalendarClock size={15} aria-hidden="true" /> {deadlineLabel}
                    </p>
                    {candidate.conditions.length > 0 && (
                      <p className="mc-muted mc-candidate-conditions">
                        Điều kiện: {candidate.conditions.join(" · ")}
                      </p>
                    )}
                    {quotes.length > 0 && (
                      <blockquote className="mc-candidate-quote">{quotes[0].quote}</blockquote>
                    )}
                    <div className="mc-candidate-actions">
                      {candidate.confirmed_task_id ? (
                        <>
                          <span className="mc-candidate-confirmed">
                            <CheckCircle2 size={15} aria-hidden="true" /> Đã lưu thành công việc
                          </span>
                          {onOpenTask && (
                            <button
                              type="button"
                              className="mc-text-button"
                              onClick={() => onOpenTask(candidate.confirmed_task_id!)}
                            >
                              <FileText size={15} aria-hidden="true" /> Mở công việc
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          className="mc-button mc-primary"
                          onClick={() => setReviewing(candidate)}
                        >
                          Xem & lưu công việc
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {reviewing && (
        <CandidateConfirmDialog
          api={api}
          candidate={reviewing}
          evidence={reviewing.evidence_ids
            .map((id) => evidenceById.get(id))
            .filter((ev): ev is AnalysisEvidence => Boolean(ev))}
          onClose={() => setReviewing(null)}
          onConfirmed={(task) => handleConfirmed(reviewing.candidate_id, task)}
        />
      )}
    </section>
  );
}

export function CandidateConfirmDialog({
  api, candidate, evidence, onClose, onConfirmed,
}: {
  api: DesktopApi;
  candidate: WorkCandidateView;
  evidence: AnalysisEvidence[];
  onClose: () => void;
  onConfirmed: (task: Task) => void;
}) {
  const needsTitleReview = candidateNeedsTitleReview(candidate);
  const clarityHintId = "mc-cand-title-clarity-hint";
  const [title, setTitle] = useState(candidate.action);
  const [owner, setOwner] = useState(candidate.proposed_owner ?? "");
  const [importance, setImportance] = useState<Importance>(candidate.proposed_importance);
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    candidate.proposed_estimated_minutes?.toString() ?? "",
  );
  const [setDeadline, setSetDeadline] = useState(false);
  const [deadline, setDeadlineDraft] = useState<DeadlineDraft>(() => {
    const defaultReason = candidate.proposed_deadline_raw
      ? `Xác nhận "${candidate.proposed_deadline_raw}" từ email`
      : "Xác nhận hạn từ đề xuất email";
    if (candidate.proposed_deadline_utc) {
      return proposedDeadlineDraft(candidate.proposed_deadline_utc, defaultReason)
        ?? { ...deadlineDraft({ deadline_authored: null, deadline_effective: null }), reason: defaultReason };
    }
    return { ...deadlineDraft({ deadline_authored: null, deadline_effective: null }), reason: defaultReason };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const request = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    if (!needsTitleReview) return;
    const frame = window.requestAnimationFrame(() => {
      if (document.activeElement === titleInput.current) {
        titleInput.current?.select();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [needsTitleReview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");

    const cleanTitle = title.trim();
    if (!cleanTitle || [...cleanTitle].length > 500) {
      setError(cleanTitle ? "Tên công việc tối đa 500 ký tự." : "Hãy nhập tên công việc.");
      titleInput.current?.focus();
      return;
    }

    const minutesValue = estimatedMinutes.trim() === "" ? null : Number(estimatedMinutes.trim());
    if (minutesValue !== null && (!Number.isInteger(minutesValue) || minutesValue <= 0)) {
      setError("Thời gian dự kiến phải là số phút nguyên dương.");
      return;
    }

    let deadlineInstant: string | undefined;
    let deadlineReason: string | undefined;
    if (setDeadline) {
      const authored = authoredDeadline(deadline);
      const reason = deadline.reason.trim();
      if (!authored) {
        setError("Hãy nhập ngày, giờ hợp lệ và độ lệch UTC theo dạng +07:00.");
        return;
      }
      if (!reason || [...reason].length > 500) {
        setError("Hãy nhập lý do đặt hạn từ 1 đến 500 ký tự.");
        return;
      }
      deadlineInstant = authored;
      deadlineReason = reason;
    }

    const payload: Omit<ConfirmCandidateInput, "request_key"> = {
      candidate_id: candidate.candidate_id,
      title: cleanTitle,
      owner: owner.trim() || null,
      importance,
      estimated_minutes: minutesValue,
      expected_body_revision: candidate.body_revision,
      ...(deadlineInstant ? { deadline_instant: deadlineInstant, deadline_reason: deadlineReason } : {}),
    };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature) {
      request.current = { signature, key: crypto.randomUUID() };
    }

    setSaving(true);
    try {
      const result = await api.confirmCandidate({ ...payload, request_key: request.current.key });
      onConfirmed(result.task);
    } catch (failure) {
      setError(confirmErrorText(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="mc-dialog-backdrop" />
        <Dialog.Popup
          className="mc-dialog mc-candidate-dialog"
          initialFocus={needsTitleReview ? titleInput : undefined}
        >
          <div className="mc-dialog-header">
            <div>
              <Dialog.Title className="mc-dialog-title">Xác nhận công việc từ thư</Dialog.Title>
              <Dialog.Description>
                Kiểm tra lại thông tin gợi ý trước khi lưu thành công việc chính thức.
              </Dialog.Description>
            </div>
            <button
              type="button"
              className="mc-icon-button"
              aria-label="Đóng"
              disabled={saving}
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form className="mc-candidate-form" onSubmit={(event) => void submit(event)}>
            {evidence.length > 0 && (
              <div className="mc-candidate-evidence-box">
                <p className="mc-muted">Đoạn trích căn cứ trong email</p>
                {evidence.map((ev) => (
                  <blockquote key={ev.evidence_id} className="mc-candidate-quote">{ev.quote}</blockquote>
                ))}
              </div>
            )}

            <div className="mc-field">
              <label htmlFor="mc-cand-title">Tên công việc</label>
              {needsTitleReview && (
                <div id={clarityHintId} className="mc-candidate-clarity-alert" role="note">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>
                    <strong>{CANDIDATE_NEEDS_REVIEW_LABEL}</strong> · Hãy sửa tên công việc rõ hành động trước khi lưu.
                  </span>
                </div>
              )}
              <input
                ref={titleInput}
                id="mc-cand-title"
                type="text"
                maxLength={500}
                value={title}
                disabled={saving}
                aria-describedby={needsTitleReview ? clarityHintId : undefined}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="mc-candidate-grid">
              <div className="mc-field">
                <label htmlFor="mc-cand-owner">Người phụ trách</label>
                <input
                  id="mc-cand-owner"
                  type="text"
                  maxLength={200}
                  placeholder="Để trống nếu chưa rõ"
                  value={owner}
                  disabled={saving}
                  onChange={(event) => setOwner(event.target.value)}
                />
              </div>

              <div className="mc-field">
                <label htmlFor="mc-cand-importance">Mức độ ưu tiên</label>
                <select
                  id="mc-cand-importance"
                  value={importance}
                  disabled={saving}
                  onChange={(event) => setImportance(event.target.value as Importance)}
                >
                  <option value="low">{importanceLabels.low}</option>
                  <option value="normal">{importanceLabels.normal}</option>
                  <option value="high">{importanceLabels.high}</option>
                </select>
              </div>

              <div className="mc-field">
                <label htmlFor="mc-cand-estimate">Thời gian dự kiến (phút)</label>
                <input
                  id="mc-cand-estimate"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Ví dụ: 30"
                  value={estimatedMinutes}
                  disabled={saving}
                  onChange={(event) => setEstimatedMinutes(event.target.value)}
                />
              </div>
            </div>

            <fieldset className="mc-candidate-deadline-group">
              <legend>Hạn chót (tùy chọn)</legend>
              {candidate.proposed_deadline_raw && (
                <p className="mc-muted">
                  Cụm thời gian trong thư: <strong>“{candidate.proposed_deadline_raw}”</strong>
                  {candidate.proposed_deadline_utc
                    ? ` (${formatDate(candidate.proposed_deadline_utc, true)})`
                    : " — mốc tương đối, cần bạn tự chọn ngày giờ chính xác."}
                </p>
              )}
              <label className="mc-candidate-deadline-toggle">
                <input
                  type="checkbox"
                  checked={setDeadline}
                  disabled={saving}
                  onChange={(event) => setSetDeadline(event.target.checked)}
                />
                <span>Đặt hạn chót khi lưu công việc</span>
              </label>

              {setDeadline && (
                <div className="mc-candidate-deadline-fields">
                  <div className="mc-field">
                    <label htmlFor="mc-cand-date">Ngày</label>
                    <input
                      id="mc-cand-date"
                      type="date"
                      value={deadline.date}
                      disabled={saving}
                      onChange={(event) => setDeadlineDraft((current) => setDeadlineDate(current, { date: event.target.value }))}
                    />
                  </div>
                  <div className="mc-field">
                    <label htmlFor="mc-cand-time">Giờ</label>
                    <input
                      id="mc-cand-time"
                      type="time"
                      value={deadline.time}
                      disabled={saving}
                      onChange={(event) => setDeadlineDraft((current) => setDeadlineDate(current, { time: event.target.value }))}
                    />
                  </div>
                  <div className="mc-field">
                    <label htmlFor="mc-cand-offset">Độ lệch UTC</label>
                    <input
                      id="mc-cand-offset"
                      type="text"
                      value={deadline.offset}
                      disabled={saving}
                      onChange={(event) => setDeadlineDraft((current) => ({ ...current, offset: event.target.value, offsetEdited: true }))}
                    />
                  </div>
                  <div className="mc-field mc-candidate-reason-field">
                    <label htmlFor="mc-cand-reason">Lý do đặt hạn</label>
                    <input
                      id="mc-cand-reason"
                      type="text"
                      maxLength={500}
                      value={deadline.reason}
                      disabled={saving}
                      onChange={(event) => setDeadlineDraft((current) => ({ ...current, reason: event.target.value }))}
                    />
                  </div>
                </div>
              )}
            </fieldset>

            {error && <p className="mc-form-error" role="alert">{error}</p>}

            <div className="mc-dialog-footer">
              <button type="button" className="mc-button mc-secondary" disabled={saving} onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="mc-button mc-primary" disabled={saving}>
                {saving ? "Đang lưu…" : "Lưu công việc"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
