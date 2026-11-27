import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense, lazy, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GMAIL_SHORTCUTS_STORAGE_KEY,
  isEditableTarget,
  readGmailShortcutsEnabled,
  resolveGmailShortcutAction,
  useGmailShortcuts,
  writeGmailShortcutsEnabled,
  type GmailShortcutHandlers,
} from "./useGmailShortcuts";

const LazyKeyboardShortcutsDialog = lazy(() => import("./KeyboardShortcutsDialog"));

function ShortcutHarness({
  enabled = true,
  activeInInbox = true,
  hasOpenDialog = false,
  handlers,
}: {
  enabled?: boolean;
  activeInInbox?: boolean;
  hasOpenDialog?: boolean;
  handlers: GmailShortcutHandlers;
}) {
  useGmailShortcuts({ enabled, activeInInbox, hasOpenDialog, handlers });
  return (
    <div>
      <div tabIndex={0} data-testid="mail-row">Thư mẫu</div>
      <button type="button" data-testid="native-btn">Nút bấm</button>
      <a href="#help" data-testid="native-link">Liên kết</a>
      <input type="text" aria-label="Ô tìm kiếm" />
      <textarea aria-label="Ô soạn thảo" />
      <select aria-label="Chọn nhãn"><option value="a">A</option></select>
      <div
        contentEditable="true"
        data-testid="ce-box"
        dangerouslySetInnerHTML={{
          __html: '<span>Văn bản</span><div contenteditable="false" tabindex="0" data-testid="ce-false-island">Không sửa</div>',
        }}
      />
    </div>
  );
}

function LazyDialogHarness() {
  const [open, setOpen] = useState(false);
  useGmailShortcuts({
    enabled: true,
    activeInInbox: true,
    hasOpenDialog: open,
    handlers: {
      onOpenHelp: () => setOpen(true),
    },
  });
  return (
    <div>
      <main tabIndex={0}>Nội dung hộp thư</main>
      {open && (
        <Suspense fallback={<p role="status">Đang mở bảng phím tắt…</p>}>
          <LazyKeyboardShortcutsDialog open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

beforeEach(() => {
  window.localStorage.removeItem(GMAIL_SHORTCUTS_STORAGE_KEY);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function createSpyHandlers(): Record<keyof GmailShortcutHandlers, ReturnType<typeof vi.fn<() => void>>> {
  return {
    onNextMail: vi.fn(),
    onPrevMail: vi.fn(),
    onOpenMail: vi.fn(),
    onBackToList: vi.fn(),
    onToggleSelect: vi.fn(),
    onToggleStar: vi.fn(),
    onArchive: vi.fn(),
    onTrash: vi.fn(),
    onMarkRead: vi.fn(),
    onMarkUnread: vi.fn(),
    onFocusSearch: vi.fn(),
    onOpenHelp: vi.fn(),
    onEscape: vi.fn(),
  };
}

describe("GM-05 localStorage preference helpers", () => {
  it("defaults to true, persists false/true, and tolerates storage failures", () => {
    expect(readGmailShortcutsEnabled()).toBe(true);

    writeGmailShortcutsEnabled(false);
    expect(window.localStorage.getItem(GMAIL_SHORTCUTS_STORAGE_KEY)).toBe("false");
    expect(readGmailShortcutsEnabled()).toBe(false);

    writeGmailShortcutsEnabled(true);
    expect(readGmailShortcutsEnabled()).toBe(true);

    window.localStorage.setItem(GMAIL_SHORTCUTS_STORAGE_KEY, "0");
    expect(readGmailShortcutsEnabled()).toBe(false);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(readGmailShortcutsEnabled()).toBe(true);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => writeGmailShortcutsEnabled(false)).not.toThrow();
  });
});

describe("GM-05 useGmailShortcuts guards & keybindings", () => {
  it("dispatches all 13 Gmail shortcuts accurately in Inbox and guards key repeat on destructive actions", () => {
    const handlers = createSpyHandlers();
    render(<ShortcutHarness handlers={handlers} />);
    const row = screen.getByTestId("mail-row");
    row.focus();

    fireEvent.keyDown(row, { key: "j" });
    fireEvent.keyDown(row, { key: "j", repeat: true });
    expect(handlers.onNextMail).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(row, { key: "k" });
    fireEvent.keyDown(row, { key: "k", repeat: true });
    expect(handlers.onPrevMail).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(row, { key: "o" });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(handlers.onOpenMail).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(row, { key: "u" });
    expect(handlers.onBackToList).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "x" });
    fireEvent.keyDown(row, { key: "x", repeat: true });
    expect(handlers.onToggleSelect).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "s" });
    fireEvent.keyDown(row, { key: "s", repeat: true });
    expect(handlers.onToggleStar).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "e" });
    fireEvent.keyDown(row, { key: "e", repeat: true });
    expect(handlers.onArchive).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "#", shiftKey: true });
    fireEvent.keyDown(row, { key: "#", shiftKey: true, repeat: true });
    expect(handlers.onTrash).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "I", shiftKey: true });
    expect(handlers.onMarkRead).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "U", shiftKey: true });
    expect(handlers.onMarkUnread).toHaveBeenCalledTimes(1);
    expect(handlers.onBackToList).toHaveBeenCalledTimes(1); // Shift+U must not trigger lowercase `u`

    fireEvent.keyDown(row, { key: "/" });
    expect(handlers.onFocusSearch).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "?", shiftKey: true });
    expect(handlers.onOpenHelp).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "Escape" });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });

  it("ignores Vietnamese IME composition events (isComposing, Process, keyCode 229)", () => {
    const handlers = createSpyHandlers();
    render(<ShortcutHarness handlers={handlers} />);
    const row = screen.getByTestId("mail-row");
    row.focus();

    fireEvent.keyDown(row, { key: "s", isComposing: true });
    fireEvent.keyDown(row, { key: "e", isComposing: true });
    fireEvent.keyDown(row, { key: "Process" });
    fireEvent.keyDown(row, { key: "j", keyCode: 229 });
    fireEvent.keyDown(row, { key: "?", shiftKey: true, isComposing: true });

    for (const spy of Object.values(handlers)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("ignores shortcuts when focus or target is inside input, textarea, select, or contenteditable", () => {
    const handlers = createSpyHandlers();
    render(<ShortcutHarness handlers={handlers} />);

    const editableNodes = [
      screen.getByLabelText("Ô tìm kiếm"),
      screen.getByLabelText("Ô soạn thảo"),
      screen.getByLabelText("Chọn nhãn"),
      screen.getByTestId("ce-box"),
      screen.getByTestId("ce-box").querySelector("span")!,
    ];

    for (const node of editableNodes) {
      expect(isEditableTarget(node)).toBe(true);
      if (node instanceof HTMLElement) node.focus();
      fireEvent.keyDown(node, { key: "e" });
      fireEvent.keyDown(node, { key: "#", shiftKey: true });
      fireEvent.keyDown(node, { key: "?", shiftKey: true });
      fireEvent.keyDown(node, { key: "/" });
    }

    for (const spy of Object.values(handlers)) {
      expect(spy).not.toHaveBeenCalled();
    }

    // Explicit contenteditable="false" island is NOT editable.
    const island = screen.getByTestId("ce-false-island");
    expect(isEditableTarget(island)).toBe(false);
    island.focus();
    fireEvent.keyDown(island, { key: "j" });
    expect(handlers.onNextMail).toHaveBeenCalledTimes(1);
  });

  it("ignores Ctrl/Meta/Alt modified keys and prevents Enter from hijacking native buttons or links", () => {
    const handlers = createSpyHandlers();
    render(<ShortcutHarness handlers={handlers} />);
    const row = screen.getByTestId("mail-row");
    row.focus();

    fireEvent.keyDown(row, { key: "j", ctrlKey: true });
    fireEvent.keyDown(row, { key: "e", metaKey: true });
    fireEvent.keyDown(row, { key: "s", altKey: true });
    fireEvent.keyDown(row, { key: "?", ctrlKey: true, shiftKey: true });

    const btn = screen.getByTestId("native-btn");
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });

    const link = screen.getByTestId("native-link");
    link.focus();
    fireEvent.keyDown(link, { key: "Enter" });

    for (const spy of Object.values(handlers)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("respects enabled=false, hasOpenDialog=true, and activeInInbox=false scoping", () => {
    const disabledHandlers = createSpyHandlers();
    const { rerender } = render(<ShortcutHarness enabled={false} handlers={disabledHandlers} />);
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    for (const spy of Object.values(disabledHandlers)) expect(spy).not.toHaveBeenCalled();

    const modalHandlers = createSpyHandlers();
    rerender(<ShortcutHarness enabled={true} hasOpenDialog={true} handlers={modalHandlers} />);
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    for (const spy of Object.values(modalHandlers)) expect(spy).not.toHaveBeenCalled();

    const outsideInboxHandlers = createSpyHandlers();
    rerender(<ShortcutHarness enabled={true} activeInInbox={false} hasOpenDialog={false} handlers={outsideInboxHandlers} />);
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "e" });
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    expect(outsideInboxHandlers.onNextMail).not.toHaveBeenCalled();
    expect(outsideInboxHandlers.onArchive).not.toHaveBeenCalled();
    expect(outsideInboxHandlers.onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it("pure resolver returns null on defaultPrevented events", () => {
    expect(
      resolveGmailShortcutAction(
        { key: "j", defaultPrevented: true },
        { enabled: true, activeInInbox: true, hasOpenDialog: false, activeElement: null },
      ),
    ).toBeNull();
  });

  it("suppresses window shortcuts while a visible child dialog or menu exists in the DOM", () => {
    const handlers = createSpyHandlers();
    render(
      <>
        <ShortcutHarness enabled={true} activeInInbox={true} hasOpenDialog={false} handlers={handlers} />
        <div role="dialog" aria-label="Hộp thoại con">Nội dung hộp thoại</div>
      </>,
    );

    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "e" });
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    fireEvent.keyDown(document.body, { key: "Escape" });
    for (const spy of Object.values(handlers)) expect(spy).not.toHaveBeenCalled();

    // Hidden dialog nodes must not block shortcuts.
    screen.getByRole("dialog", { name: "Hộp thoại con" }).setAttribute("hidden", "");
    fireEvent.keyDown(document.body, { key: "j" });
    expect(handlers.onNextMail).toHaveBeenCalledTimes(1);
  });
});

describe("GM-05 lazy KeyboardShortcutsDialog", () => {
  it("loads lazily on `?`, displays both groups with IME safety note, focuses close button, and closes cleanly", async () => {
    const user = userEvent.setup();
    render(<LazyDialogHarness />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });

    const dialog = await screen.findByRole("dialog", { name: /Phím tắt kiểu Gmail/i });
    expect(dialog).toBeVisible();
    expect(screen.getByText("Điều hướng & Tìm kiếm")).toBeVisible();
    expect(screen.getByText("Thao tác cục bộ")).toBeVisible();
    expect(screen.getByText("Thư kế tiếp")).toBeVisible();
    expect(screen.getByText("Đánh dấu đã đọc")).toBeVisible();
    expect(screen.getByText(/Tự động tạm tắt khi bạn đang gõ tiếng Việt/i)).toBeVisible();

    const closeBtn = screen.getByRole("button", { name: "Đóng" });
    await waitFor(() => expect(closeBtn).toHaveFocus());

    await user.click(closeBtn);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
