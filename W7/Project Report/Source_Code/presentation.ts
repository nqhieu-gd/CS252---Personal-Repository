import type { Importance, TaskState } from "../api/types";
import type { ImportResult, MailSummary } from "./api";

export const taskLabels: Record<TaskState, string> = {
  not_started: "Chưa bắt đầu",
  in_progress: "Đang làm",
  waiting: "Đang chờ",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const importanceLabels: Record<Importance, string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
};

const shortDate = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "short",
});

const fullDate = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "long",
  timeStyle: "short",
});

export function formatDate(value: string | null | undefined, long = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (long ? fullDate : shortDate).format(date);
}

export function subjectOf(mail: MailSummary) {
  return mail.subject.trim() || "(Không có tiêu đề)";
}

export function mutationErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? error.code : null;
}

export function startupErrorText(error: unknown) {
  const code = mutationErrorCode(error);
  if (code === "profile_in_use") return "Một cửa sổ MailCompass khác đang mở dữ liệu này. Hãy đóng cửa sổ đó rồi thử lại.";
  if (code === "unsupported_profile") return "Phiên bản này chưa mở được dữ liệu trên máy. Hãy mở bằng bản MailCompass tương ứng.";
  return "Chưa thể đọc dữ liệu trên máy. Hãy thử lại.";
}

export function importBatchErrorText(error: unknown) {
  const code = mutationErrorCode(error);
  if (code === "too_many_files") {
    return "Chỉ có thể nhập tối đa 100 tệp mỗi lần. Hãy chia tệp thành nhiều lô rồi chọn lại.";
  }
  return "Chưa nhập được email. Hãy thử chọn tệp .eml lại.";
}

export function importErrorText(result: ImportResult) {
  const key = result.error?.code;
  if (key === "file_too_large") return "Tệp vượt quá 10 MiB.";
  if (key === "unsupported_file") return "Hãy chọn tệp có đuôi .eml.";
  if (key === "file_unreadable") return "Không mở được tệp này.";
  if (key === "empty_file") return "Tệp email trống.";
  return "Không thể nhập tệp này. Hãy kiểm tra tệp gốc và thử lại.";
}

export const REMINDER_PRESET_MIN_HOURS = 1;
export const REMINDER_PRESET_MAX_HOURS = 720;
export const REMINDER_PRESET_MAX_COUNT = 6;
export const DEFAULT_REMINDER_PRESETS: readonly number[] = [168, 48, 24];

export type ReminderStageTone = "overdue" | "urgent" | "soon";

export interface ReminderStageBadge {
  label: string;
  tone: ReminderStageTone;
}

export const WEEK4_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  provider_label_read_only: "Nhãn Gmail chỉ đọc, không thể sửa hoặc xóa.",
  invalid_reminder_presets: "Chọn mốc nhắc từ 1 giờ đến 30 ngày.",
  provider_mismatch: "Nhà cung cấp AI đã đổi, hãy chọn lại trên thanh AI.",
  batch_selection_too_large: "Chọn tối đa 20 thư mỗi lượt quét AI (tối đa 200 thư cho thao tác hộp thư).",
  invalid_snooze_time: "Chọn thời điểm tạm ẩn sau thời gian hiện tại.",
  undo_expired: "Đã quá thời gian hoàn tác thao tác này.",
  saved_search_duplicate: "Tên tìm kiếm đã tồn tại, hãy chọn tên khác.",
  gmail_message_only: "Chỉ thư đồng bộ từ Gmail mới mở được trực tiếp trên Gmail web.",
  gmail_cloud_blocked: "Chưa bật chấp thuận Gemini Free Tier trong Cài đặt.",
  gmail_extraction_blocked: "Chưa bật chấp thuận Gemini Free Tier trong Cài đặt.",
  source_not_eligible: "Thư chưa thuộc danh sách mẫu hoặc chưa bật chấp thuận Free Tier.",
};

/**
 * Maps frozen Week 4 CoreError.code values (§6) to concise Vietnamese FD-03 copy.
 * Accepts either a CoreError-like object (`{ code }`) or a raw error code string.
 */
export function week4ErrorText(error: unknown, fallback = "Thao tác chưa hoàn tất. Hãy thử lại."): string {
  const rawCode = typeof error === "string" ? error : mutationErrorCode(error);
  if (typeof rawCode === "string" && Object.prototype.hasOwnProperty.call(WEEK4_ERROR_MESSAGES, rawCode)) {
    return WEEK4_ERROR_MESSAGES[rawCode];
  }
  return fallback;
}

/**
 * Formats a multi-horizon deadline reminder stage badge (FD-09) for NotificationsView & NotificationBell.
 */
export function reminderStageLabel(
  leadHours: number | null | undefined,
  isOverdue = false,
): ReminderStageBadge {
  if (isOverdue) return { label: "Quá hạn", tone: "overdue" };
  if (typeof leadHours === "number" && Number.isInteger(leadHours) && leadHours > 0) {
    if (leadHours === 168) return { label: "Còn 1 tuần", tone: "soon" };
    if (leadHours === 48) return { label: "Còn 2 ngày", tone: "soon" };
    if (leadHours === 24) return { label: "Còn 1 ngày", tone: "urgent" };
    const label = leadHours % 24 === 0 ? `Còn ${leadHours / 24} ngày` : `Còn ${leadHours} giờ`;
    return { label, tone: leadHours <= 24 ? "urgent" : "soon" };
  }
  return { label: "Sắp đến hạn", tone: "soon" };
}

/**
 * Normalizes pre-deadline reminder presets (FD-09 Rule 7):
 * keeps integers in 1..=720, deduplicates, sorts descending, caps at 6 entries.
 */
export function normalizeReminderPresets(hours: readonly number[]): number[] {
  const unique = new Set<number>();
  for (const value of hours) {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= REMINDER_PRESET_MIN_HOURS &&
      value <= REMINDER_PRESET_MAX_HOURS
    ) {
      unique.add(value);
    }
  }
  return [...unique].sort((a, b) => b - a).slice(0, REMINDER_PRESET_MAX_COUNT);
}
