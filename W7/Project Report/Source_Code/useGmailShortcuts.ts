import { useEffect, useRef } from "react";

export const GMAIL_SHORTCUTS_STORAGE_KEY = "mc.v2.gmail_shortcuts_enabled";

export interface GmailShortcutHandlers {
  onNextMail?: () => void;
  onPrevMail?: () => void;
  onOpenMail?: () => void;
  onBackToList?: () => void;
  onToggleSelect?: () => void;
  onToggleStar?: () => void;
  onArchive?: () => void;
  onTrash?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  onFocusSearch?: () => void;
  onOpenHelp?: () => void;
  onEscape?: () => void;
}

export type GmailShortcutAction =
  | "nextMail"
  | "prevMail"
  | "openMail"
  | "backToList"
  | "toggleSelect"
  | "toggleStar"
  | "archive"
  | "trash"
  | "markRead"
  | "markUnread"
  | "focusSearch"
  | "openHelp"
  | "escape";

export interface UseGmailShortcutsOptions {
  enabled: boolean;
  activeInInbox: boolean;
  hasOpenDialog: boolean;
  handlers: GmailShortcutHandlers;
}

export interface ShortcutKeyEventLike {
  key: string;
  keyCode?: number;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}

export function readGmailShortcutsEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(GMAIL_SHORTCUTS_STORAGE_KEY);
    if (raw === null) return true;
    const normalized = raw.trim().toLowerCase();
    return normalized !== "false" && normalized !== "0";
  } catch {
    return true;
  }
}

export function writeGmailShortcutsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(GMAIL_SHORTCUTS_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage quota or WebView restrictions; in-memory React state still updates.
  }
}

function asElement(target: EventTarget | null | undefined): Element | null {
  if (!target || typeof target !== "object") return null;
  if ("nodeType" in target) {
    const node = target as Node;
    if (node.nodeType === 1) return node as Element;
    if (node.parentElement) return node.parentElement;
  }
  return null;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const EDITABLE_ROLES = new Set(["textbox", "searchbox", "combobox"]);
const INTERACTIVE_CONTROL_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
].join(", ");

/**
 * Returns true if the target element is an input/textarea/select, an editable
 * contenteditable region (respecting nested contenteditable="false" islands),
 * or an ARIA text-entry widget.
 */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  let current = asElement(target);
  let decidedContentEditable: boolean | null = null;

  while (current) {
    if (EDITABLE_TAGS.has(current.tagName)) return true;

    const role = current.getAttribute("role")?.trim().toLowerCase();
    if (role && EDITABLE_ROLES.has(role)) return true;

    if (decidedContentEditable === null && current.hasAttribute("contenteditable")) {
      const attr = (current.getAttribute("contenteditable") ?? "").trim().toLowerCase();
      if (attr === "false") {
        decidedContentEditable = false;
      } else if (attr === "" || attr === "true" || attr === "plaintext-only") {
        return true;
      }
    }

    current = current.parentElement;
  }

  const start = asElement(target);
  if (decidedContentEditable === null && start instanceof HTMLElement && start.isContentEditable === true) {
    return true;
  }
  return false;
}

/**
 * Prevents Enter shortcut from hijacking native button/link/tab/menu activation (WCAG 2.1.1).
 */
export function isInteractiveControlTarget(target: EventTarget | null | undefined): boolean {
  const el = asElement(target);
  if (!el) return false;
  return el.closest(INTERACTIVE_CONTROL_SELECTOR) !== null;
}

/**
 * Returns true if any visible dialog, alertdialog, or menu is currently open in the DOM,
 * preventing window-level shortcuts from hijacking child-component overlays.
 */
export function hasVisibleOpenModal(
  doc: Document | null = typeof document !== "undefined" ? document : null,
): boolean {
  if (!doc) return false;
  const overlays = doc.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"]');
  for (const overlay of overlays) {
    if (overlay.hasAttribute("hidden") || overlay.getAttribute("aria-hidden") === "true") continue;
    if (
      overlay instanceof HTMLElement
      && (overlay.style.display === "none" || overlay.style.visibility === "hidden")
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Pure O(1) Gmail shortcut resolver (IME-safe for Vietnamese Telex/VNI/Unikey).
 */
export function resolveGmailShortcutAction(
  event: ShortcutKeyEventLike,
  options: {
    enabled: boolean;
    activeInInbox: boolean;
    hasOpenDialog: boolean;
    activeElement?: Element | null;
  },
): GmailShortcutAction | null {
  if (!options.enabled || options.hasOpenDialog) return null;
  if (event.defaultPrevented) return null;
  if (event.isComposing || event.key === "Process" || event.keyCode === 229) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  const activeEl = options.activeElement !== undefined
    ? options.activeElement
    : (typeof document !== "undefined" ? document.activeElement : null);

  if (isEditableTarget(event.target) || isEditableTarget(activeEl)) return null;

  const key = event.key;
  const repeat = Boolean(event.repeat);
  const shift = Boolean(event.shiftKey);

  // Global help shortcut `?` works across workspace views when no dialog is open.
  if (key === "?") {
    return repeat ? null : "openHelp";
  }

  if (!options.activeInInbox) return null;

  // Navigation keys (allow key repeat when holding j/k).
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (!shift && lower === "j") return "nextMail";
  if (!shift && lower === "k") return "prevMail";

  // All remaining actions ignore auto-repeat to prevent accidental bulk archive/trash.
  if (repeat) return null;

  if (key === "Escape" && !shift) return "escape";
  if (key === "#") return "trash";

  if (shift) {
    if (lower === "i") return "markRead";
    if (lower === "u") return "markUnread";
    return null;
  }

  switch (lower) {
    case "o":
      return "openMail";
    case "Enter":
      if (isInteractiveControlTarget(event.target) || isInteractiveControlTarget(activeEl)) {
        return null;
      }
      return "openMail";
    case "u":
      return "backToList";
    case "x":
      return "toggleSelect";
    case "s":
      return "toggleStar";
    case "e":
      return "archive";
    case "/":
      return "focusSearch";
    default:
      return null;
  }
}

const HANDLER_KEY_MAP: Record<GmailShortcutAction, keyof GmailShortcutHandlers> = {
  nextMail: "onNextMail",
  prevMail: "onPrevMail",
  openMail: "onOpenMail",
  backToList: "onBackToList",
  toggleSelect: "onToggleSelect",
  toggleStar: "onToggleStar",
  archive: "onArchive",
  trash: "onTrash",
  markRead: "onMarkRead",
  markUnread: "onMarkUnread",
  focusSearch: "onFocusSearch",
  openHelp: "onOpenHelp",
  escape: "onEscape",
};

export function useGmailShortcuts({
  enabled,
  activeInInbox,
  hasOpenDialog,
  handlers,
}: UseGmailShortcutsOptions): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || hasOpenDialog) return;

    function onKeyDown(event: KeyboardEvent) {
      if (hasVisibleOpenModal()) return;
      const action = resolveGmailShortcutAction(event, {
        enabled,
        activeInInbox,
        hasOpenDialog,
      });
      if (!action) return;

      const handler = handlersRef.current[HANDLER_KEY_MAP[action]];
      if (typeof handler !== "function") return;

      if (action !== "escape") event.preventDefault();
      handler();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, activeInInbox, hasOpenDialog]);
}
