import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ReminderLeadPresetChips,
  formatCustomPresetLabel,
  toggleReminderPreset,
} from "./ReminderLeadPresetChips";

function ControlledWrapper({ initial, disabled = false }: { initial: number[]; disabled?: boolean }) {
  const [value, setValue] = useState<number[]>(initial);
  return (
    <div>
      <ReminderLeadPresetChips value={value} onChange={setValue} disabled={disabled} idPrefix="test-preset" />
      <output data-testid="preset-state">{JSON.stringify(value)}</output>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("FD-09 ReminderLeadPresetChips", () => {
  it("renders exact ARIA group and 3 standard toggle chips with descending sorted updates", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper initial={[24, 168, 48]} />);

    const group = screen.getByRole("group", { name: "Mốc nhắc trước hạn" });
    const weekBtn = within(group).getByRole("button", { name: "1 tuần" });
    const twoDayBtn = within(group).getByRole("button", { name: "2 ngày" });
    const oneDayBtn = within(group).getByRole("button", { name: "1 ngày" });

    expect(weekBtn).toHaveAttribute("aria-pressed", "true");
    expect(twoDayBtn).toHaveAttribute("aria-pressed", "true");
    expect(oneDayBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(twoDayBtn);
    expect(twoDayBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("preset-state")).toHaveTextContent("[168,24]");

    await user.click(twoDayBtn);
    expect(twoDayBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("preset-state")).toHaveTextContent("[168,48,24]");
  });

  it("allows clearing all chips to empty array and displays overdue-only hint", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper initial={[24]} />);

    const oneDayBtn = screen.getByRole("button", { name: "1 ngày" });
    await user.click(oneDayBtn);

    expect(oneDayBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("preset-state")).toHaveTextContent("[]");
    expect(screen.getByText("Chỉ nhắc khi quá hạn.")).toBeVisible();
  });

  it("preserves custom presets from backend when toggling standard chips and supports removing them", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper initial={[168, 72, 12]} />);

    const customDayBtn = screen.getByRole("button", { name: "Bỏ mốc nhắc 3 ngày" });
    const customHourBtn = screen.getByRole("button", { name: "Bỏ mốc nhắc 12 giờ" });
    expect(customDayBtn).toHaveAttribute("aria-pressed", "true");
    expect(customHourBtn).toHaveAttribute("aria-pressed", "true");

    // Toggling a standard chip must keep custom presets intact and sorted descending.
    await user.click(screen.getByRole("button", { name: "2 ngày" }));
    expect(screen.getByTestId("preset-state")).toHaveTextContent("[168,72,48,12]");

    // Clicking a custom chip removes only that custom preset.
    await user.click(customDayBtn);
    expect(screen.getByTestId("preset-state")).toHaveTextContent("[168,48,12]");
  });

  it("disables unselected chips at 6-preset cap without silently dropping existing presets", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper initial={[720, 336, 120, 72, 12, 6]} />);

    expect(screen.getByText("Đã đạt tối đa 6 mốc nhắc.")).toBeVisible();
    const weekBtn = screen.getByRole("button", { name: "1 tuần" });
    expect(weekBtn).toBeDisabled();

    // Removing one custom preset re-enables standard chips.
    await user.click(screen.getByRole("button", { name: "Bỏ mốc nhắc 6 giờ" }));
    expect(weekBtn).toBeEnabled();
    await user.click(weekBtn);
    expect(screen.getByTestId("preset-state")).toHaveTextContent("[720,336,168,120,72,12]");
  });

  it("respects disabled prop and never fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ReminderLeadPresetChips value={[168, 48]} onChange={onChange} disabled />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggleReminderPreset and formatCustomPresetLabel handle boundary values purely", () => {
    expect(formatCustomPresetLabel(72)).toBe("3 ngày");
    expect(formatCustomPresetLabel(12)).toBe("12 giờ");

    const base = [168, 48];
    expect(toggleReminderPreset(base, 24)).toEqual([168, 48, 24]);
    expect(base).toEqual([168, 48]);
    expect(toggleReminderPreset(base, 0)).toEqual([168, 48]);
    expect(toggleReminderPreset(base, 721)).toEqual([168, 48]);
    expect(toggleReminderPreset([720, 336, 120, 72, 12, 6], 24)).toEqual([720, 336, 120, 72, 12, 6]);
  });
});
