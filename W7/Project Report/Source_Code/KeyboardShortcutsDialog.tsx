import { Dialog } from "@base-ui/react/dialog";
import { Keyboard, X } from "lucide-react";
import { Fragment, useRef } from "react";
import "./keyboard-shortcuts.css";

interface ShortcutItem {
  label: string;
  /** Each entry is a chord (e.g. ["Shift", "I"]); multiple entries denote alternatives (e.g. Enter / o). */
  chords: readonly (readonly string[])[];
}

interface ShortcutGroup {
  id: string;
  title: string;
  items: readonly ShortcutItem[];
}

export const GMAIL_SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: "navigation",
    title: "Điều hướng & Tìm kiếm",
    items: [
      { label: "Thư kế tiếp", chords: [["j"]] },
      { label: "Thư phía trước", chords: [["k"]] },
      { label: "Mở thư đang chọn", chords: [["Enter"], ["o"]] },
      { label: "Quay về danh sách", chords: [["u"]] },
      { label: "Nhảy vào ô tìm kiếm", chords: [["/"]] },
      { label: "Chọn hoặc bỏ chọn dòng", chords: [["x"]] },
      { label: "Bỏ chọn hoặc đóng", chords: [["Esc"]] },
      { label: "Mở bảng phím tắt", chords: [["?"]] },
    ],
  },
  {
    id: "actions",
    title: "Thao tác cục bộ",
    items: [
      { label: "Gắn hoặc bỏ sao", chords: [["s"]] },
      { label: "Lưu trữ cục bộ", chords: [["e"]] },
      { label: "Chuyển thùng rác", chords: [["#"]] },
      { label: "Đánh dấu đã đọc", chords: [["Shift", "I"]] },
      { label: "Đánh dấu chưa đọc", chords: [["Shift", "U"]] },
    ],
  },
];

export interface KeyboardShortcutsDialogProps {
  open?: boolean;
  onClose: () => void;
}

/**
 * GM-05: Lazy-loaded Gmail-style keyboard shortcuts help dialog.
 * Adapted from shadcn/ui Base UI dialog.tsx + kbd.tsx + separator.tsx (MIT).
 */
export function KeyboardShortcutsDialog({ open = true, onClose }: KeyboardShortcutsDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="mc-dialog-backdrop" data-slot="dialog-overlay" />
        <Dialog.Popup
          className="mc-dialog mc-shortcuts-dialog"
          data-slot="dialog-content"
          initialFocus={closeButton}
        >
          <div className="mc-dialog-header" data-slot="dialog-header">
            <div>
              <Dialog.Title className="mc-dialog-title">
                <Keyboard size={18} aria-hidden="true" style={{ verticalAlign: "-2px", marginInlineEnd: 8 }} />
                Phím tắt kiểu Gmail
              </Dialog.Title>
              <Dialog.Description>
                Dùng nhanh trong Hộp thư. Có thể bật hoặc tắt trong Cài đặt.
              </Dialog.Description>
            </div>
            <Dialog.Close
              ref={closeButton}
              type="button"
              className="mc-icon-button"
              aria-label="Đóng"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="mc-shortcuts-grid">
            {GMAIL_SHORTCUT_GROUPS.map((group) => (
              <section
                key={group.id}
                className="mc-shortcuts-group"
                aria-labelledby={`mc-shortcuts-group-${group.id}`}
              >
                <h3 id={`mc-shortcuts-group-${group.id}`} className="mc-shortcuts-group-title">
                  {group.title}
                </h3>
                <dl className="mc-shortcuts-list">
                  {group.items.map((item) => (
                    <div key={item.label} className="mc-shortcuts-row">
                      <dt>{item.label}</dt>
                      <dd>
                        {item.chords.map((chord, chordIndex) => (
                          <Fragment key={chord.join("+")}>
                            {chordIndex > 0 && <span className="mc-kbd-sep" aria-hidden="true">/</span>}
                            {chord.map((part, partIndex) => (
                              <Fragment key={`${part}-${partIndex}`}>
                                {partIndex > 0 && <span className="mc-kbd-sep" aria-hidden="true">+</span>}
                                <kbd className="mc-kbd" data-slot="kbd">{part}</kbd>
                              </Fragment>
                            ))}
                          </Fragment>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <p className="mc-shortcuts-note">
            Tự động tạm tắt khi bạn đang gõ tiếng Việt hoặc nhập văn bản.
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default KeyboardShortcutsDialog;
