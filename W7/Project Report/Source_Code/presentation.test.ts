import { describe, expect, it } from "vitest";
import type { MailSummary } from "./api";
import {
  DEFAULT_REMINDER_PRESETS,
  REMINDER_PRESET_MAX_COUNT,
  REMINDER_PRESET_MAX_HOURS,
  REMINDER_PRESET_MIN_HOURS,
  WEEK4_ERROR_MESSAGES,
  mutationErrorCode,
  normalizeReminderPresets,
  reminderStageLabel,
  subjectOf,
  week4ErrorText,
} from "./presentation";

describe("presentation Week 4 error mapping (§6)", () => {
  it("maps every frozen Week 4 CoreError.code from both error objects and raw strings", () => {
    const entries: [string, string][] = [
      ["provider_label_read_only", "Nhãn Gmail chỉ đọc, không thể sửa hoặc xóa."],
      ["invalid_reminder_presets", "Chọn mốc nhắc từ 1 giờ đến 30 ngày."],
      ["provider_mismatch", "Nhà cung cấp AI đã đổi, hãy chọn lại trên thanh AI."],
      ["batch_selection_too_large", "Chọn tối đa 20 thư mỗi lượt quét AI (tối đa 200 thư cho thao tác hộp thư)."],
      ["invalid_snooze_time", "Chọn thời điểm tạm ẩn sau thời gian hiện tại."],
      ["undo_expired", "Đã quá thời gian hoàn tác thao tác này."],
      ["saved_search_duplicate", "Tên tìm kiếm đã tồn tại, hãy chọn tên khác."],
      ["gmail_message_only", "Chỉ thư đồng bộ từ Gmail mới mở được trực tiếp trên Gmail web."],
      ["gmail_cloud_blocked", "Chưa bật chấp thuận Gemini Free Tier trong Cài đặt."],
      ["gmail_extraction_blocked", "Chưa bật chấp thuận Gemini Free Tier trong Cài đặt."],
      ["source_not_eligible", "Thư chưa thuộc danh sách mẫu hoặc chưa bật chấp thuận Free Tier."],
    ];

    expect(Object.keys(WEEK4_ERROR_MESSAGES).length).toBe(entries.length);
    for (const [code, expected] of entries) {
      expect(week4ErrorText({ code })).toBe(expected);
      expect(week4ErrorText(code)).toBe(expected);
    }
  });

  it("returns fallback for unknown errors and safely ignores Object.prototype keys", () => {
    expect(week4ErrorText({ code: "unknown_code" })).toBe("Thao tác chưa hoàn tất. Hãy thử lại.");
    expect(week4ErrorText({ code: "unknown_code" }, "Lỗi riêng")).toBe("Lỗi riêng");
    expect(week4ErrorText(null, "Dự phòng")).toBe("Dự phòng");
    expect(week4ErrorText(undefined, "Dự phòng")).toBe("Dự phòng");
    expect(week4ErrorText(42, "Dự phòng")).toBe("Dự phòng");
    expect(week4ErrorText({ code: "toString" }, "An toàn")).toBe("An toàn");
    expect(week4ErrorText("constructor", "An toàn")).toBe("An toàn");
    expect(week4ErrorText("__proto__", "An toàn")).toBe("An toàn");
  });
});

describe("presentation FD-09 reminderStageLabel", () => {
  it("formats standard horizons and always prioritizes overdue", () => {
    expect(reminderStageLabel(168, false)).toEqual({ label: "Còn 1 tuần", tone: "soon" });
    expect(reminderStageLabel(48, false)).toEqual({ label: "Còn 2 ngày", tone: "soon" });
    expect(reminderStageLabel(24, false)).toEqual({ label: "Còn 1 ngày", tone: "urgent" });
    expect(reminderStageLabel(168, true)).toEqual({ label: "Quá hạn", tone: "overdue" });
    expect(reminderStageLabel(null, true)).toEqual({ label: "Quá hạn", tone: "overdue" });
  });

  it("formats custom hour/day horizons and falls back safely for null or invalid inputs", () => {
    expect(reminderStageLabel(72, false)).toEqual({ label: "Còn 3 ngày", tone: "soon" });
    expect(reminderStageLabel(12, false)).toEqual({ label: "Còn 12 giờ", tone: "urgent" });
    expect(reminderStageLabel(1, false)).toEqual({ label: "Còn 1 giờ", tone: "urgent" });
    expect(reminderStageLabel(36, false)).toEqual({ label: "Còn 36 giờ", tone: "soon" });

    expect(reminderStageLabel(null, false)).toEqual({ label: "Sắp đến hạn", tone: "soon" });
    expect(reminderStageLabel(undefined)).toEqual({ label: "Sắp đến hạn", tone: "soon" });
    expect(reminderStageLabel(0, false)).toEqual({ label: "Sắp đến hạn", tone: "soon" });
    expect(reminderStageLabel(-24, false)).toEqual({ label: "Sắp đến hạn", tone: "soon" });
    expect(reminderStageLabel(12.5, false)).toEqual({ label: "Sắp đến hạn", tone: "soon" });
    expect(reminderStageLabel(Number.NaN, false)).toEqual({ label: "Sắp đến hạn", tone: "soon" });
  });
});

describe("presentation FD-09 normalizeReminderPresets", () => {
  it("deduplicates, validates 1..=720 integers, sorts descending, caps at 6, and preserves input immutability", () => {
    expect(DEFAULT_REMINDER_PRESETS).toEqual([168, 48, 24]);
    expect(normalizeReminderPresets([])).toEqual([]);

    const raw = [24, 168, 48, 24, 0, -5, 721, 12.5, Number.NaN, Number.POSITIVE_INFINITY, 1, 720, 72, 12, 6];
    const snapshot = [...raw];
    const normalized = normalizeReminderPresets(raw);

    expect(raw).toEqual(snapshot);
    expect(normalized).toEqual([720, 168, 72, 48, 24, 12]);
    expect(normalized.length).toBeLessThanOrEqual(REMINDER_PRESET_MAX_COUNT);
    for (const h of normalized) {
      expect(h).toBeGreaterThanOrEqual(REMINDER_PRESET_MIN_HOURS);
      expect(h).toBeLessThanOrEqual(REMINDER_PRESET_MAX_HOURS);
    }
  });

  it("preserves existing presentation invariants (subjectOf & mutationErrorCode)", () => {
    expect(subjectOf({ subject: "   " } as MailSummary)).toBe("(Không có tiêu đề)");
    expect(subjectOf({ subject: "  Báo cáo W10-04 " } as MailSummary)).toBe("Báo cáo W10-04");
    expect(mutationErrorCode({ code: "provider_mismatch" })).toBe("provider_mismatch");
    expect(mutationErrorCode(null)).toBeNull();
  });
});
