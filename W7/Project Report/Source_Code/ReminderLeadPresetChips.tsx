import { Check, X } from "lucide-react";
import { useMemo } from "react";
import {
  REMINDER_PRESET_MAX_COUNT,
  REMINDER_PRESET_MAX_HOURS,
  REMINDER_PRESET_MIN_HOURS,
  normalizeReminderPresets,
} from "./presentation";

export interface StandardReminderPreset {
  readonly hours: number;
  readonly label: string;
}

export const STANDARD_REMINDER_PRESETS: readonly StandardReminderPreset[] = [
  { hours: 168, label: "1 tuần" },
  { hours: 48, label: "2 ngày" },
  { hours: 24, label: "1 ngày" },
] as const;

const STANDARD_HOURS = new Set<number>(STANDARD_REMINDER_PRESETS.map((preset) => preset.hours));

export function formatCustomPresetLabel(hours: number): string {
  return hours % 24 === 0 ? `${hours / 24} ngày` : `${hours} giờ`;
}

/**
 * Pure toggle transition for FD-09 reminder presets.
 * Always returns a new deduplicated array sorted descending (1..=720, max 6).
 * Refuses to exceed 6 entries when adding so existing presets are never silently dropped.
 */
export function toggleReminderPreset(current: readonly number[], hours: number): number[] {
  const normalized = normalizeReminderPresets(current);
  if (normalized.includes(hours)) {
    return normalized.filter((entry) => entry !== hours);
  }
  if (
    !Number.isInteger(hours) ||
    hours < REMINDER_PRESET_MIN_HOURS ||
    hours > REMINDER_PRESET_MAX_HOURS ||
    normalized.length >= REMINDER_PRESET_MAX_COUNT
  ) {
    return normalized;
  }
  return normalizeReminderPresets([...normalized, hours]);
}

export interface ReminderLeadPresetChipsProps {
  value: readonly number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  idPrefix?: string;
  hint?: string;
}

/**
 * FD-09: Controlled multi-horizon reminder preset chips shared by DeadlineDialog & SettingsView.
 * Adapted from shadcn/ui Base UI toggle-group.tsx + badge.tsx (MIT) using semantic `.mc-*` classes.
 */
export function ReminderLeadPresetChips({
  value,
  onChange,
  disabled = false,
  idPrefix,
  hint,
}: ReminderLeadPresetChipsProps) {
  const normalized = useMemo(() => normalizeReminderPresets(value), [value]);
  const selected = useMemo(() => new Set<number>(normalized), [normalized]);
  const customHours = useMemo(
    () => normalized.filter((hours) => !STANDARD_HOURS.has(hours)),
    [normalized],
  );
  const atMaxCount = normalized.length >= REMINDER_PRESET_MAX_COUNT;

  function handleToggle(hours: number) {
    if (disabled) return;
    const next = toggleReminderPreset(normalized, hours);
    if (next.length === normalized.length && next.every((item, index) => item === normalized[index])) {
      return;
    }
    onChange(next);
  }

  const statusHint = normalized.length === 0
    ? (hint ?? "Chỉ nhắc khi quá hạn.")
    : atMaxCount
      ? "Đã đạt tối đa 6 mốc nhắc."
      : hint;

  return (
    <div className="mc-reminder-presets" data-slot="toggle-group">
      <div className="mc-reminder-preset-group" role="group" aria-label="Mốc nhắc trước hạn">
        {STANDARD_REMINDER_PRESETS.map((preset) => {
          const active = selected.has(preset.hours);
          return (
            <button
              key={preset.hours}
              id={idPrefix ? `${idPrefix}-${preset.hours}` : undefined}
              type="button"
              className="mc-reminder-preset-chip"
              aria-pressed={active}
              disabled={disabled || (!active && atMaxCount)}
              onClick={() => handleToggle(preset.hours)}
            >
              {active && <Check size={14} aria-hidden="true" />}
              <span>{preset.label}</span>
            </button>
          );
        })}
        {customHours.map((hours) => {
          const label = formatCustomPresetLabel(hours);
          return (
            <button
              key={hours}
              id={idPrefix ? `${idPrefix}-${hours}` : undefined}
              type="button"
              className="mc-reminder-preset-chip mc-reminder-preset-chip-custom"
              aria-pressed={true}
              aria-label={`Bỏ mốc nhắc ${label}`}
              disabled={disabled}
              onClick={() => handleToggle(hours)}
            >
              <Check size={14} aria-hidden="true" />
              <span>{label}</span>
              <X size={13} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {statusHint && <p className="mc-reminder-presets-hint">{statusHint}</p>}
    </div>
  );
}
