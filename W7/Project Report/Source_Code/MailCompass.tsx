import { Dialog } from "@base-ui/react/dialog";
import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowRight, CalendarClock, CircleAlert, FolderOpen, ListOrdered, Inbox as InboxIcon, ListChecks, Plus, RefreshCw } from "lucide-react";
import type { TaskState } from "../api/types";
import { gmailStatusPollMs } from "./api";
import type { DeleteTaskInput, DesktopApi, EvidenceDraft, GmailSyncEvent, GmailSyncStatus, ImportResult, ListPage, MailLabel, MailQueryInput, MailRule, MailSummary, ProfileAccount, SearchOperatorChip, Task, UpdateTaskStateInput } from "./api";
import { Inbox, ImportOutcomes, type InboxKeyboardHandlers } from "./Inbox";
import { CodeSearchContext } from "./mail/CodeSearchInput";
import { mailboxViewQuery, type MailboxView } from "./mail/MailboxNavRail";
import type { RuleDraftFromQuery } from "./mail/mailHelpers";
import { MailLabelManager } from "./MailLabelManager";
import { MailRuleManager } from "./MailRuleManager";
import { emptyMailFilterDraft, type MailFilterDraft, type MailFilters } from "./MailFilters";
import { NotificationBell } from "./NotificationBell";
import { Brand, Sidebar, Welcome, type Destination } from "./Shell";
import { TaskDialog } from "./TaskDialog";
import { DeadlineDialog, type DeadlineProposal } from "./DeadlineDialog";
import { deadlineText } from "./taskDeadline";
import { TaskRows, TaskWorklist, taskFilter, type TaskFilter, type TaskSearchFilters, type TaskStateFailure } from "./TaskWorklist";
import { importBatchErrorText, mutationErrorCode, startupErrorText, subjectOf, taskLabels } from "./presentation";
import { readGmailShortcutsEnabled, useGmailShortcuts } from "./useGmailShortcuts";
import { pageSize, usePagedList } from "./usePagedList";

const CalendarView = lazy(() => import("./CalendarView").then(({ CalendarView }) => ({
  default: CalendarView,
})));
const NotificationsView = lazy(() => import("./NotificationsView").then(({ NotificationsView }) => ({
  default: NotificationsView,
})));
const CapacityPreviewDialog = lazy(() => import("./CapacityPreviewDialog").then(({ CapacityPreviewDialog }) => ({
  default: CapacityPreviewDialog,
})));
const RecurrencesView = lazy(() => import("./RecurrencesView").then(({ RecurrencesView }) => ({
  default: RecurrencesView,
})));
const WorkBriefView = lazy(() => import("./WorkBriefView").then(({ WorkBriefView }) => ({
  default: WorkBriefView,
})));
const CommitmentsView = lazy(() => import("./CommitmentsView").then(({ CommitmentsView }) => ({
  default: CommitmentsView,
})));
const ProjectsView = lazy(() => import("./ProjectsView").then(({ ProjectsView }) => ({
  default: ProjectsView,
})));
const AssistantView = lazy(() => import("./AssistantView").then(({ AssistantView }) => ({ default: AssistantView })));
const SettingsView = lazy(() => import("./SettingsView").then(({ SettingsView }) => ({ default: SettingsView })));
const DecisionPreviewDialog = lazy(() => import("./DecisionPreviewDialog").then(({ DecisionPreviewDialog }) => ({
  default: DecisionPreviewDialog,
})));
const KeyboardShortcutsDialog = lazy(() => import("./KeyboardShortcutsDialog").then(({ KeyboardShortcutsDialog }) => ({
  default: KeyboardShortcutsDialog,
})));

type InboxFilters = MailFilters & Pick<MailQueryInput, "label_id" | "rule_id" | "label_origin" | "category"> & {
  /** Folder in the mailbox rail (GM-01); "inbox" is the default and is left out. */
  view?: Exclude<MailboxView, "inbox">;
};

/** Turns workspace mail filters into the native query, adding the folder's own fields or operator. */
function mailQueryFor({ view, ...filters }: InboxFilters & Pick<MailQueryInput, "limit" | "cursor">): MailQueryInput {
  const folder = mailboxViewQuery(view);
  const query = [folder.operator, filters.query].filter(Boolean).join(" ");
  return { ...filters, ...folder.fields, ...(query ? { query } : {}) };
}

/** Folder and category stay put when the search is cleared, like Gmail. */
function folderOf({ view, category }: InboxFilters): InboxFilters {
  return { ...(view && { view }), ...(category && { category }) };
}

function isFiltered({ view: _view, category: _category, ...criteria }: InboxFilters) {
  return Object.values(criteria).some(Boolean);
}
type WorklistFilters = TaskSearchFilters & { state_group: TaskFilter };
const initialTaskFilters: WorklistFilters = { state_group: "active" };

interface Loaded {
  scopeKey: string;
  accountId: string;
  accountName: string;
  mail: ListPage<MailSummary>;
  tasks: ListPage<Task>;
  empty: boolean;
}

type Startup = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Loaded };
type Editor =
  | { kind: "create"; source: MailSummary | null; evidence?: EvidenceDraft }
  | { kind: "edit"; task: Task }
  | { kind: "deadline"; task: Task; proposal?: DeadlineProposal };

const pageLabels: Record<Destination, string> = {
  today: "Hôm nay",
  inbox: "Hộp thư",
  tasks: "Công việc",
  followup: "Theo dõi",
  projects: "Dự án",
  recurrences: "Công việc lặp lại",
  calendar: "Lịch",
  brief: "Chi tiết công việc",
  notifications: "Thông báo",
  assistant: "Hỏi MailCompass",
  settings: "Cài đặt",
};

const maxDropFiles = 100;
const maxDropBytes = 10 * 1024 * 1024;
const urgentWindowMs = 24 * 60 * 60 * 1000;

function selectUrgentDeadlines(items: Task[], nowMs: number) {
  const cutoff = nowMs + urgentWindowMs;
  return items
    .filter((item) => {
      if (taskFilter(item.state) !== "active" || !item.deadline_effective) return false;
      const ms = Date.parse(item.deadline_effective);
      return Number.isFinite(ms) && ms <= cutoff;
    })
    .sort((left, right) => Date.parse(left.deadline_effective!) - Date.parse(right.deadline_effective!));
}

function carriesFiles(event: { dataTransfer: DataTransfer | null }) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

async function loadWorkspace(api: DesktopApi, showWelcome: boolean): Promise<Loaded> {
  const profile = await api.bootstrap();
  const [mail, tasks] = await Promise.all([
    api.queryMail({ limit: pageSize }),
    api.queryTasks({ ...initialTaskFilters, limit: pageSize }),
  ]);
  const empty = showWelcome && mail.items.length === 0 && tasks.items.length === 0
    && (await api.queryTasks({ limit: 1 })).items.length === 0;
  return {
    scopeKey: JSON.stringify([profile.workspace_id, profile.account_id]), accountId: profile.account_id,
    accountName: profile.account_name, mail, tasks, empty,
  };
}

/** Reads one dropped file and hands its bytes to the native import, never a path. */
async function importDroppedFile(api: DesktopApi, file: File): Promise<ImportResult> {
  const rejected = (code: string, message: string): ImportResult => ({
    filename: file.name, status: "rejected", message_id: null, error: { code, message },
  });
  // Skip reading files the native check would reject for size anyway.
  if (file.size > maxDropBytes) return rejected("file_too_large", "This email is larger than 10 MiB.");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return rejected("file_unreadable", "MailCompass could not read the selected file.");
  }
  try {
    return await api.importDrop({ filename: file.name, bytes });
  } catch (error) {
    const code = mutationErrorCode(error);
    return rejected(typeof code === "string" ? code : "import_failed", "MailCompass could not import this file.");
  }
}

export function MailCompass({ api }: { api: DesktopApi }) {
  // Dropping a file outside a handled area would otherwise navigate the WebView to it.
  useEffect(() => {
    const keepWindow = (event: globalThis.DragEvent) => { if (carriesFiles(event)) event.preventDefault(); };
    window.addEventListener("dragover", keepWindow);
    window.addEventListener("drop", keepWindow);
    return () => {
      window.removeEventListener("dragover", keepWindow);
      window.removeEventListener("drop", keepWindow);
    };
  }, []);
  const [startup, setStartup] = useState<Startup>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [source, setSource] = useState<ProfileAccount | null>(null);
  const [sources, setSources] = useState<ProfileAccount[]>([]);
  const scopedApi = useMemo(() => source && api.forSource ? api.forSource(source) : api, [api, source]);
  const sourceRequests = useRef(0);
  const catalogRequests = useRef(0);
  const assistantDrafts = useRef(new Map<string, string>());

  const refreshSources = useCallback(async () => {
    const request = ++catalogRequests.current;
    try {
      const catalog = await api.listSources();
      if (request === catalogRequests.current) setSources(catalog.accounts);
    } catch {
      // Keep the last known list; SettingsView handles explicit catalog errors.
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const data = await loadWorkspace(api, true);
        if (active) {
          setStartup({ status: "ready", data });
          void refreshSources();
        }
      } catch (error) {
        if (active) setStartup({ status: "error", message: startupErrorText(error) });
      }
    }
    void start();
    return () => { active = false; sourceRequests.current += 1; catalogRequests.current += 1; };
  }, [api, attempt, refreshSources]);

  async function selectSource(account: ProfileAccount) {
    if (startup.status !== "ready" || account.account_id === startup.data.accountId) return;
    if (!api.forSource) throw new Error("account_scope_unavailable");
    const request = ++sourceRequests.current;
    const data = await loadWorkspace(api.forSource(account), false);
    if (data.accountId !== account.account_id) throw new Error("account_scope_mismatch");
    if (request !== sourceRequests.current) return;
    setSource(account);
    setStartup({ status: "ready", data });
  }

  function updateSource(account: ProfileAccount) {
    setSource((current) => current?.account_id === account.account_id
      && current.generation < account.generation ? account : current);
    setSources((current) => {
      const exists = current.some((entry) => entry.account_id === account.account_id);
      if (!exists) return [...current, account];
      return current.map((entry) => entry.account_id === account.account_id && entry.version <= account.version
        ? account : entry);
    });
  }

  async function handleSourceDeleted(accountId: string) {
    for (const key of Array.from(assistantDrafts.current.keys())) {
      try {
        const parsed = JSON.parse(key) as unknown;
        if (Array.isArray(parsed) && parsed[1] === accountId) {
          assistantDrafts.current.delete(key);
        }
      } catch {
        // Ignore malformed keys.
      }
    }
    setSources((current) => current.filter((entry) => entry.account_id !== accountId));
    void refreshSources();
    if (startup.status === "ready" && startup.data.accountId === accountId) {
      const request = ++sourceRequests.current;
      const data = await loadWorkspace(api, false);
      if (request !== sourceRequests.current) return;
      setSource(null);
      setStartup({ status: "ready", data });
    }
  }

  if (startup.status === "ready") {
    const { data } = startup;
    return <Workspace key={data.scopeKey} api={scopedApi} data={data} source={source} sources={sources}
      onSelectSource={selectSource} onSourceChanged={updateSource}
      onSourceDeleted={handleSourceDeleted} onCatalogChanged={() => { void refreshSources(); }}
      assistantDraft={assistantDrafts.current.get(data.scopeKey) ?? ""}
      onAssistantDraftChange={(draft) => {
        if (draft) assistantDrafts.current.set(data.scopeKey, draft);
        else assistantDrafts.current.delete(data.scopeKey);
      }} />;
  }

  return (
    <main className="mc-startup">
      <Brand />
      {startup.status === "loading" ? (
        <p role="status">Đang mở không gian làm việc…</p>
      ) : (
        <section aria-labelledby="mc-startup-title">
          <CircleAlert size={25} aria-hidden="true" />
          <h1 id="mc-startup-title">Chưa mở được MailCompass</h1>
          <p role="alert">{startup.message}</p>
          <button type="button" className="mc-button mc-primary" onClick={() => {
            setStartup({ status: "loading" });
            setAttempt(attempt + 1);
          }}>Thử lại</button>
        </section>
      )}
    </main>
  );
}

function Workspace({
  api, data, source, sources, onSelectSource, onSourceChanged, onSourceDeleted, onCatalogChanged,
  assistantDraft, onAssistantDraftChange,
}: {
  api: DesktopApi; data: Loaded; source: ProfileAccount | null; sources: ProfileAccount[];
  onSelectSource: (account: ProfileAccount) => Promise<void>;
  onSourceChanged: (account: ProfileAccount) => void;
  onSourceDeleted: (accountId: string) => Promise<void>;
  onCatalogChanged: () => void;
  assistantDraft: string; onAssistantDraftChange: (draft: string) => void;
}) {
  const [welcome, setWelcome] = useState(data.empty);
  const [view, setView] = useState<Destination>("today");
  const [mailOperators, setMailOperators] = useState<{ parsed: SearchOperatorChip[]; unsupported: string[] }>({
    parsed: [], unsupported: [],
  });
  const mailOperatorRequest = useRef(0);
  const mail = usePagedList<MailSummary, InboxFilters>((query) => {
    const request = query.cursor ? mailOperatorRequest.current : ++mailOperatorRequest.current;
    return api.queryMail(mailQueryFor(query)).then((page) => {
      if (!query.cursor && request === mailOperatorRequest.current) {
        setMailOperators({ parsed: page.parsed_operators ?? [], unsupported: page.unsupported_operators ?? [] });
      }
      return page;
    });
  }, {}, data.mail);
  // Filled in by the inbox for the Gmail shortcuts hook (GM-05) and read by the rule editor (GM-06).
  const inboxKeyboard = useRef<InboxKeyboardHandlers | null>(null);
  const ruleDraftFromSearch = useRef<RuleDraftFromQuery | null>(null);
  const tasks = usePagedList<Task, WorklistFilters>((query) => api.queryTasks(query), initialTaskFilters, data.tasks);
  const [mailDraft, setMailDraft] = useState<MailFilterDraft>(emptyMailFilterDraft);
  const mailListScroll = useRef(0);
  const [mailLabels, setMailLabels] = useState<MailLabel[]>([]);
  const [labelCatalogError, setLabelCatalogError] = useState(false);
  const [mailRules, setMailRules] = useState<MailRule[]>([]);
  const [organizer, setOrganizer] = useState<"labels" | "rules" | null>(null);
  const [mailReadRevision, setMailReadRevision] = useState(0);
  const labelCatalogRequest = useRef(0);
  const labelManagerTrigger = useRef<HTMLElement | null>(null);
  const [hasMail, setHasMail] = useState(data.mail.items.length > 0);
  const [recentActive, setRecentActive] = useState(data.tasks.items.slice(0, 5));
  const [urgentDeadlines, setUrgentDeadlines] = useState<Task[]>(() => selectUrgentDeadlines(data.tasks.items, Date.now()));
  const todayQuery = useRef(0);
  const urgentQuery = useRef(0);
  const { state_group: filter, ...taskSearch } = tasks.filters;
  const [selected, setSelected] = useState<string | null>(null);
  const [sourceTask, setSourceTask] = useState<{ id?: string; from: Destination; scrollTop: number } | null>(null);
  const sourceTrigger = useRef<HTMLElement | null>(null);
  const [enteredFollowup, setEnteredFollowup] = useState(false);
  const [enteredProjects, setEnteredProjects] = useState(false);
  const [enteredRecurrences, setEnteredRecurrences] = useState(false);
  const [enteredCalendar, setEnteredCalendar] = useState(false);
  const [enteredNotifications, setEnteredNotifications] = useState(false);
  const [enteredAssistant, setEnteredAssistant] = useState(false);
  const [enteredSettings, setEnteredSettings] = useState(false);
  const canImport = source?.source_kind !== "gmail";
  const isConsentedGmail = source?.source_kind === "gmail" && source.lifecycle_state === "active" && source.sync_consent;
  const [syncStatus, setGmailSync] = useState<GmailSyncStatus | null>(null);
  const gmailSync = isConsentedGmail && syncStatus?.generation === source.generation ? syncStatus : null;
  const syncRevision = useRef(0);
  const lastGmailDataVersion = useRef(source?.data_version ?? 0);
  const [requestingSync, setRequestingSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [notificationTick, setNotificationTick] = useState(0);
  const [notificationCount, setNotificationCount] = useState<number | null>(null);
  const [notificationCountError, setNotificationCountError] = useState(false);
  const [recurrenceRevision, setRecurrenceRevision] = useState(0);
  const [brief, setBrief] = useState<{ taskId: string; from: Destination; focusId: string | null; scrollTop: number } | null>(null);
  const [workRevision, setWorkRevision] = useState(0);
  const [aiPolicyRevision, setAiPolicyRevision] = useState(0);
  const notificationRevision = workRevision + notificationTick;

  const [editor, setEditor] = useState<Editor | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [gmailShortcutsEnabled, setGmailShortcutsEnabled] = useState<boolean>(() => readGmailShortcutsEnabled());
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const shortcutsTrigger = useRef<HTMLElement | null>(null);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [sourceSwitchError, setSourceSwitchError] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<ProfileAccount | null>(null);
  const sourceSwitchCancel = useRef<HTMLButtonElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [dropProgress, setDropProgress] = useState<{ done: number; total: number } | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const dragDepth = useRef(0);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);
  const [taskFailure, setTaskFailure] = useState<TaskStateFailure | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleteTaskBusy, setDeleteTaskBusy] = useState(false);
  const [deleteTaskError, setDeleteTaskError] = useState<string | null>(null);
  const deleteTaskCancel = useRef<HTMLButtonElement>(null);
  const deleteTaskRequest = useRef<DeleteTaskInput | null>(null);
  const importInFlight = useRef(false);
  const taskInFlight = useRef(false);
  const taskRequest = useRef<UpdateTaskStateInput | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const focusId = pendingFocus.current;
    const missingRowFallback = focusId.startsWith("mc-task-state-action-") ? "mc-task-list-title" : "mc-page-title";
    const anchoredControl = focusId === "stored-source-control" && sourceTrigger.current?.isConnected ? sourceTrigger.current : null;
    const destination = anchoredControl ?? document.getElementById(focusId) ?? document.getElementById(missingRowFallback);
    pendingFocus.current = null;
    const scrollTop = focusId === "mc-reader-focus" ? 0 : pendingScroll.current;
    pendingScroll.current = null;
    if (scrollTop !== null && document.scrollingElement) document.scrollingElement.scrollTop = scrollTop;
    const keepInboxPosition = view === "inbox" && (focusId === "mc-page-title" || focusId.startsWith("mc-mail-"));
    destination?.focus({ preventScroll: scrollTop !== null || keepInboxPosition });
  }, [selected, view, welcome, tasks.items]);

  const loadMailOrganization = useCallback(async () => {
    const request = ++labelCatalogRequest.current;
    try {
      const [labels, rules] = await Promise.all([api.listMailLabels(), api.listMailRules()]);
      if (request !== labelCatalogRequest.current) return null;
      setMailLabels(labels);
      setMailRules(rules);
      setLabelCatalogError(false);
      return { labels, rules };
    } catch (error) {
      if (request === labelCatalogRequest.current) setLabelCatalogError(true);
      throw error;
    }
  }, [api]);

  useEffect(() => {
    void loadMailOrganization().catch(() => {});
    return () => { labelCatalogRequest.current += 1; };
  }, [loadMailOrganization]);

  const refreshNotifications = useCallback(() => setNotificationTick((value) => value + 1), []);
  useEffect(() => {
    if (welcome) return;
    function refreshWhileVisible() {
      if (!document.hidden) refreshNotifications();
    }
    const timer = window.setInterval(refreshWhileVisible, 30_000);
    window.addEventListener("focus", refreshWhileVisible);
    document.addEventListener("visibilitychange", refreshWhileVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhileVisible);
      document.removeEventListener("visibilitychange", refreshWhileVisible);
    };
  }, [refreshNotifications, welcome]);

  useEffect(() => {
    if (welcome) return;
    let current = true;
    void api.notificationCount().then(({ unread_count }) => {
      if (!current) return;
      setNotificationCount(unread_count);
      setNotificationCountError(false);
    }, () => {
      if (current) setNotificationCountError(true);
    });
    return () => { current = false; };
  }, [api, notificationRevision, welcome]);

  useEffect(() => {
    if (welcome) return;
    if (!data.tasks.next_cursor && workRevision === 0) return;
    const request = ++urgentQuery.current;
    const nowMs = Date.now();
    const cutoffIso = new Date(nowMs + urgentWindowMs).toISOString();
    void api.queryTasks({ state_group: "active", deadline_to: cutoffIso, limit: 50 }).then((page) => {
      if (request === urgentQuery.current) {
        setUrgentDeadlines(selectUrgentDeadlines(page.items, Date.now()));
      }
    }, () => {});
    return () => { urgentQuery.current += 1; };
  }, [api, data.tasks.next_cursor, workRevision, welcome]);

  function navigate(destination: Destination) {
    if (destination !== "brief" && destination !== "inbox") setBrief(null);
    if (destination === "followup") setEnteredFollowup(true);
    if (destination === "projects") setEnteredProjects(true);
    if (destination === "recurrences") setEnteredRecurrences(true);
    if (destination === "calendar") setEnteredCalendar(true);
    if (destination === "assistant") setEnteredAssistant(true);
    if (destination === "settings") setEnteredSettings(true);
    if (destination === "notifications") {
      setEnteredNotifications(true);
      refreshNotifications();
    }
    pendingFocus.current = "mc-page-title";
    if (destination !== view) setView(destination);
    else {
      document.getElementById("mc-page-title")?.focus();
      pendingFocus.current = null;
    }
  }

  function openMail(messageId: string, fromTask?: string, trackOrigin = false) {
    sourceTrigger.current = trackOrigin && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(messageId);
    setSourceTask(fromTask || trackOrigin ? {
      id: fromTask, from: view, scrollTop: document.scrollingElement?.scrollTop ?? 0,
    } : null);
    if (view !== "inbox" || selected !== messageId) pendingFocus.current = "mc-reader-focus";
    setView("inbox");
  }

  function returnFromMail() {
    if (sourceTask) {
      pendingFocus.current = sourceTrigger.current ? "stored-source-control" : `mc-task-source-${sourceTask.id}`;
      pendingScroll.current = sourceTask.scrollTop;
      setView(sourceTask.from);
    } else {
      pendingFocus.current = selected ? `mc-mail-${selected}` : "mc-page-title";
    }
    setSelected(null);
    setSourceTask(null);
  }

  function openEditor(next: Editor) {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor(next);
  }

  function showDecision() {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDecisionOpen(true);
  }

  function showCapacity() {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCapacityOpen(true);
  }

  function closeDecision() {
    setDecisionOpen(false);
    setCapacityOpen(false);
    requestAnimationFrame(() => editorTrigger.current?.focus());
  }

  function openWorkBrief(taskId: string) {
    const from = view === "brief" ? brief?.from ?? "tasks" : view;
    const focusId = document.activeElement instanceof HTMLElement ? document.activeElement.id || null : null;
    setBrief({ taskId, from, focusId, scrollTop: document.scrollingElement?.scrollTop ?? 0 });
    pendingScroll.current = 0;
    pendingFocus.current = "mc-page-title";
    setView("brief");
  }

  function returnFromBrief() {
    if (!brief) return;
    pendingScroll.current = brief.scrollTop;
    pendingFocus.current = brief.focusId ?? "mc-page-title";
    setView(brief.from);
    setBrief(null);
  }

  function showEditor(source: MailSummary | null, evidence?: EvidenceDraft) {
    openEditor({ kind: "create", source, evidence });
  }

  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => {
      const trigger = editorTrigger.current;
      (trigger?.isConnected ? trigger : document.getElementById("mc-page-title"))?.focus();
    });
  }

  function taskSaved(task: Task) {
    setWorkRevision((value) => value + 1);
    const createdGroup = taskFilter(task.state);
    if (Object.values(taskSearch).some(Boolean) || createdGroup !== filter) {
      void tasks.apply({ state_group: createdGroup });
    } else {
      tasks.update((current) => [task, ...current.filter((previous) => previous.id !== task.id)]);
      void tasks.refresh();
    }
    updateToday(task);
    setTaskNotice(`Đã lưu: ${task.title}`);
    setEditor(null);
    setView("tasks");
    pendingFocus.current = "mc-page-title";
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        document.getElementById("mc-page-title")?.focus();
      }
    });
  }

  function updateToday(task?: Task) {
    if (task) {
      setRecentActive((current) => current.flatMap((item) => {
        if (item.id !== task.id || item.version > task.version) return [item];
        return taskFilter(task.state) === "active" ? [task] : [];
      }));
    }
    const request = ++todayQuery.current;
    void api.queryTasks({ state_group: "active", limit: 5 }).then((page) => {
      if (request === todayQuery.current) setRecentActive(page.items);
    }, () => {});
  }

  function refreshNewWork() {
    setWorkRevision((value) => value + 1);
    void tasks.refresh();
    updateToday();
  }

  const onScheduledWork = useEffectEvent(() => {
    setRecurrenceRevision((value) => value + 1);
    refreshNewWork();
  });

  const applyGmailStatus = useEffectEvent((status: GmailSyncStatus, changed = false) => {
    if (!isConsentedGmail || status.account_id !== data.accountId || status.generation !== source.generation) return;
    if (status.data_version < lastGmailDataVersion.current) return;
    setGmailSync(status);
    if (status.state === "idle" && !status.error_code) setSyncError(null);
    if (changed || status.data_version > lastGmailDataVersion.current) {
      lastGmailDataVersion.current = status.data_version;
      setHasMail(true);
      setMailReadRevision((value) => value + 1);
      void mail.refresh();
    }
  });

  const canReadGmailStatus = useEffectEvent(() => !requestingSync);
  const syncAccountId = isConsentedGmail ? source.account_id : null;
  const syncGeneration = isConsentedGmail ? source.generation : null;
  useEffect(() => {
    if (syncAccountId === null) return;
    let active = true;
    let reading = false;
    const readStatus = async () => {
      if (reading || !canReadGmailStatus() || document.visibilityState === "hidden") return;
      reading = true;
      const revision = syncRevision.current;
      try {
        const status = await api.gmailSyncStatus(syncAccountId);
        if (active && syncRevision.current === revision) applyGmailStatus(status);
      } catch {
        // Local workspace browsing continues if the sync worker is unavailable.
      } finally {
        reading = false;
      }
    };
    void readStatus();
    const timer = window.setInterval(readStatus, gmailStatusPollMs);
    document.addEventListener("visibilitychange", readStatus);
    window.addEventListener("focus", readStatus);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", readStatus);
      window.removeEventListener("focus", readStatus);
    };
  }, [api, syncAccountId, syncGeneration]);

  const onGmailSyncEvent = useEffectEvent((event: GmailSyncEvent) => {
    if (!isConsentedGmail || event.account_id !== data.accountId || event.status.generation !== source.generation) return;
    ++syncRevision.current;
    applyGmailStatus(event.status, event.changed);
  });

  useEffect(() => {
    if (!api.onGmailSyncUpdated || source?.source_kind !== "gmail") return;
    let active = true;
    let off: (() => void) | undefined;
    void api.onGmailSyncUpdated((event) => {
      if (active) onGmailSyncEvent(event);
    }).then((stop) => {
      if (active) off = stop;
      else stop();
    }, () => {});
    return () => { active = false; off?.(); };
  }, [api, source?.source_kind]);

  useEffect(() => {
    if (!api.onRecurringTasksCreated) return;
    let active = true;
    let off: (() => void) | undefined;
    void api.onRecurringTasksCreated(() => {
      if (active) onScheduledWork();
    }).then((stop) => {
      if (active) off = stop;
      else stop();
    }, () => {});
    return () => { active = false; off?.(); };
  }, [api]);

  function acceptTaskRevision(updated: Task) {
    setWorkRevision((value) => value + 1);
    tasks.update((current, filters) => current.flatMap((item) => {
      if (item.id !== updated.id || item.version > updated.version) return [item];
      return taskFilter(updated.state) === filters.state_group ? [updated] : [];
    }));
    void tasks.refresh();
    updateToday(updated);
  }

  function taskEdited(task: Task) {
    acceptTaskRevision(task);
    setTaskNotice("Đã cập nhật: " + task.title);
    closeEditor();
  }

  function preserveTaskFocus(taskId: string) {
    const active = document.activeElement;
    if (!document.getElementById("mc-task-list-title")) return;
    if (active === document.body || document.getElementById(`mc-task-${taskId}`)?.contains(active) || active?.closest(".mc-task-menu")) {
      pendingFocus.current = `mc-task-state-action-${taskId}`;
    }
  }

  async function refreshChangedTask(taskId: string) {
    try {
      const updated = await api.getTask(taskId);
      preserveTaskFocus(taskId);
      acceptTaskRevision(updated);
      setTaskFailure({ kind: "notice", text: "Công việc đã thay đổi. Hãy xem trạng thái mới trước khi cập nhật tiếp." });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "task_not_found") {
        preserveTaskFocus(taskId);
        tasks.update((items) => items.filter((item) => item.id !== taskId));
        void tasks.refresh();
        updateToday();
        setTaskFailure({ kind: "notice", text: "Công việc này không còn trong danh sách hiện tại." });
        return;
      }
      setTaskFailure({
        kind: "refresh", taskId,
        text: "Chưa tải được trạng thái mới. Hãy tải lại công việc trước khi thử cập nhật.",
      });
    }
  }

  async function changeTaskState(task: Task, nextState: TaskState) {
    if (taskInFlight.current || task.state === nextState || (taskFailure?.kind === "refresh" && taskFailure.taskId === task.id)) return;
    const previous = taskRequest.current;
    const request = previous?.task_id === task.id && previous.state === nextState && previous.expected_version === task.version
      ? previous
      : { task_id: task.id, state: nextState, expected_version: task.version, request_key: crypto.randomUUID() };
    taskRequest.current = request;
    taskInFlight.current = true;
    setBusyTaskId(task.id);
    setTaskNotice(null);
    setTaskFailure(null);
    try {
      const updated = await api.updateTaskState(request);
      taskRequest.current = null;
      preserveTaskFocus(task.id);
      acceptTaskRevision(updated);
      setTaskNotice(`Đã cập nhật: ${updated.title} · ${taskLabels[updated.state]}`);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (code === "version_conflict" || code === "task_not_found" || code === "request_conflict") {
        taskRequest.current = null;
        await refreshChangedTask(task.id);
      } else {
        setTaskFailure({
          kind: "retry", task, nextState,
          text: "Chưa xác nhận được thay đổi. Hãy thử lưu lại trạng thái.",
        });
      }
    } finally {
      taskInFlight.current = false;
      setBusyTaskId(null);
    }
  }

  async function confirmDeleteTask(task: Task) {
    if (!api.deleteTask || deleteTaskBusy || taskInFlight.current) return;
    const previous = deleteTaskRequest.current;
    const request = previous?.task_id === task.id && previous.expected_version === task.version
      ? previous
      : { task_id: task.id, expected_version: task.version, request_key: crypto.randomUUID() };
    deleteTaskRequest.current = request;
    taskInFlight.current = true;
    setDeleteTaskBusy(true);
    setDeleteTaskError(null);
    setTaskNotice(null);
    setTaskFailure(null);
    try {
      await api.deleteTask(request);
      deleteTaskRequest.current = null;
      setWorkRevision((value) => value + 1);
      tasks.update((items) => items.filter((item) => item.id !== task.id));
      void tasks.refresh();
      setRecentActive((items) => items.filter((item) => item.id !== task.id));
      setUrgentDeadlines((items) => items.filter((item) => item.id !== task.id));
      updateToday();
      setDeletingTask(null);
      if (brief?.taskId === task.id) {
        setBrief(null);
        setView("tasks");
        pendingFocus.current = "mc-page-title";
      }
      setTaskNotice(`Đã xóa công việc: ${task.title}`);
    } catch (error) {
      const code = mutationErrorCode(error);
      if (code === "version_conflict" || code === "task_not_found" || code === "request_conflict") {
        deleteTaskRequest.current = null;
        setDeletingTask(null);
        await refreshChangedTask(task.id);
      } else {
        setDeleteTaskError("Chưa xóa được công việc. Hãy thử lại.");
      }
    } finally {
      taskInFlight.current = false;
      setDeleteTaskBusy(false);
    }
  }

  async function retryTaskState(failure: TaskStateFailure) {
    if (failure.kind === "retry") {
      await changeTaskState(failure.task, failure.nextState);
    } else if (failure.kind === "refresh" && !taskInFlight.current) {
      taskInFlight.current = true;
      setBusyTaskId(failure.taskId);
      try {
        await refreshChangedTask(failure.taskId);
      } finally {
        taskInFlight.current = false;
        setBusyTaskId(null);
      }
    }
  }

  function searchMail(filters: InboxFilters) {
    mailListScroll.current = 0;
    setSelected(null);
    setSourceTask(null);
    void mail.apply(filters);
  }

  async function refreshMailOrganization() {
    const catalog = await loadMailOrganization();
    if (!catalog) return;
    const { labels, rules } = catalog;
    setMailReadRevision((value) => value + 1);
    await mail.refresh((filters) => {
      const { label_id, rule_id, ...criteria } = filters;
      const label = label_id && labels.some((item) => item.id === label_id) ? label_id : undefined;
      const rule = rule_id && rules.some((item) => item.id === rule_id) ? rule_id : undefined;
      if (label === label_id && rule === rule_id) return filters;
      mailListScroll.current = 0;
      return { ...criteria, ...(label && { label_id: label }), ...(rule && { rule_id: rule }) };
    });
  }

  function openMailOrganizer(kind: "labels" | "rules") {
    labelManagerTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOrganizer(kind);
  }

  function closeMailOrganizer() {
    ruleDraftFromSearch.current = null;
    setOrganizer(null);
    requestAnimationFrame(() => {
      const trigger = labelManagerTrigger.current;
      if (trigger?.isConnected) trigger.focus();
    });
  }

  function openShortcutsHelp() {
    shortcutsTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setShortcutsHelpOpen(true);
  }

  function closeShortcutsHelp() {
    setShortcutsHelpOpen(false);
    requestAnimationFrame(() => {
      const trigger = shortcutsTrigger.current;
      if (document.activeElement === document.body) {
        (trigger?.isConnected ? trigger : document.getElementById("mc-page-title"))?.focus();
      }
    });
  }

  const hasOpenDialog = Boolean(
    welcome
    || editor !== null
    || organizer !== null
    || decisionOpen
    || capacityOpen
    || deletingTask !== null
    || pendingSource !== null
    || shortcutsHelpOpen,
  );

  useGmailShortcuts({
    enabled: gmailShortcutsEnabled,
    activeInInbox: view === "inbox",
    hasOpenDialog,
    handlers: {
      onNextMail: () => inboxKeyboard.current?.onNextMail(),
      onPrevMail: () => inboxKeyboard.current?.onPrevMail(),
      onOpenMail: () => inboxKeyboard.current?.onOpenMail(),
      onBackToList: () => inboxKeyboard.current?.onBackToList(),
      onToggleSelect: () => inboxKeyboard.current?.onToggleSelect(),
      onToggleStar: () => inboxKeyboard.current?.onToggleStar(),
      onArchive: () => inboxKeyboard.current?.onArchive(),
      onTrash: () => inboxKeyboard.current?.onTrash(),
      onMarkRead: () => inboxKeyboard.current?.onMarkRead(),
      onMarkUnread: () => inboxKeyboard.current?.onMarkUnread(),
      onFocusSearch: () => inboxKeyboard.current?.onFocusSearch(),
      onOpenHelp: openShortcutsHelp,
      onEscape: () => inboxKeyboard.current?.onEscape(),
    },
  });

  async function pickMail() {
    if (importInFlight.current) return;
    importInFlight.current = true;
    setImporting(true);
    setImportError(null);
    try {
      const results = await api.importPick();
      if (results.length === 0) return;
      await showImportResults(results);
    } catch (error) {
      setImportError(importBatchErrorText(error));
    } finally {
      importInFlight.current = false;
      setImporting(false);
    }
  }

  async function showImportResults(results: ImportResult[]) {
    setImportResults(results);
    pendingFocus.current = "mc-page-title";
    setWelcome(false);
    setView("inbox");
    if (results.some((result) => result.status !== "rejected")) setHasMail(true);
    await mail.refresh();
  }

  async function importDroppedFiles(files: File[]) {
    if (files.length === 0 || importInFlight.current) return;
    setImportError(null);
    if (files.length > maxDropFiles) {
      setImportError(importBatchErrorText({ code: "too_many_files" }));
      return;
    }
    importInFlight.current = true;
    setImporting(true);
    setDropProgress({ done: 0, total: files.length });
    const results: ImportResult[] = [];
    try {
      // One file at a time keeps memory bounded and gives each file its own outcome.
      for (const file of files) {
        results.push(await importDroppedFile(api, file));
        setDropProgress({ done: results.length, total: files.length });
      }
      await showImportResults(results);
    } catch (error) {
      setImportError(importBatchErrorText(error));
    } finally {
      importInFlight.current = false;
      setImporting(false);
      setDropProgress(null);
    }
  }

  const fileDrop = {
    onDragEnter: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDraggingFiles(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = importInFlight.current ? "none" : "copy";
    },
    onDragLeave: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDraggingFiles(false);
    },
    onDrop: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDraggingFiles(false);
      void importDroppedFiles(Array.from(event.dataTransfer.files));
    },
  };
  const dropOverlay = draggingFiles && (
    <div className="mc-drop-overlay" aria-hidden="true">
      <div>
        <FolderOpen size={18} />
        <strong>Thả tệp .eml để nhập</strong>
        <span>Tối đa 100 tệp, mỗi tệp không quá 10 MiB</span>
      </div>
    </div>
  );

  if (welcome) {
    return (
      <div className="mc-drop-root" {...fileDrop}>
        <Welcome onImport={() => void pickMail()} busy={importing} error={importError} onSettings={() => {
          setWelcome(false);
          navigate("settings");
        }} onContinue={() => {
          pendingFocus.current = "mc-page-title";
          setWelcome(false);
        }} />
        {dropOverlay}
      </div>
    );
  }

  const onImport = () => { void pickMail(); };
  const latestMail = Object.values(mail.filters).some(Boolean) ? [] : mail.items.slice(0, 3);
  const onNewTask = () => showEditor(null);
  const activeSourceName = source ? (source.email ?? source.display_name) : data.accountName || undefined;
  const listedAccount = sources.find((entry) => entry.account_id === data.accountId);
  const activeAccount = listedAccount && (!source || listedAccount.version >= source.version)
    ? listedAccount
    : source;
  const switchingBlocked = switchingSource || importing || busyTaskId !== null;
  const gmailSyncBusy = requestingSync || gmailSync?.state === "queued" || gmailSync?.state === "syncing";

  async function requestActiveGmailSync() {
    if (!source || !isConsentedGmail || gmailSyncBusy) return;
    const revision = ++syncRevision.current;
    setRequestingSync(true);
    setSyncError(null);
    try {
      const status = await api.requestGmailSync({
        account_id: source.account_id,
        expected_generation: source.generation,
      });
      if (syncRevision.current === revision) setGmailSync(status);
    } catch (reason) {
      if (syncRevision.current !== revision) return;
      const code = mutationErrorCode(reason);
      if (code === "gmail_not_configured") {
        setSyncError("Bản MailCompass này chưa được thiết lập để đồng bộ Gmail.");
      } else if (code === "gmail_sync_not_allowed") {
        setSyncError("Hãy cho phép đồng bộ Gmail trong Cài đặt trước khi làm mới.");
      } else {
        setSyncError("Chưa gửi được yêu cầu đồng bộ Gmail. Hãy thử lại.");
      }
    } finally {
      setRequestingSync(false);
    }
  }

  async function performSourceSwitch(account: ProfileAccount) {
    if (switchingBlocked) return;
    ruleDraftFromSearch.current = null;
    setShortcutsHelpOpen(false);
    setSwitchingSource(true);
    setSourceSwitchError(null);
    setPendingSource(null);
    try {
      await onSelectSource(account);
    } catch {
      setSourceSwitchError("Chưa chuyển được nguồn dữ liệu. Hãy kiểm tra lại trong Cài đặt.");
    } finally {
      setSwitchingSource(false);
    }
  }

  function requestSidebarSourceSwitch(account: ProfileAccount) {
    if (switchingBlocked || account.account_id === data.accountId) return;
    if (editor !== null || organizer !== null) {
      setPendingSource(account);
      return;
    }
    void performSourceSwitch(account);
  }

  return (
    <CodeSearchContext.Provider value={api.searchMailCodes}>
    <div className="mc-workspace" {...(canImport ? fileDrop : {})}>
      {dropOverlay}
      <a className="mc-skip" href="#mc-page-title">Đến nội dung chính</a>
      <Sidebar destination={view} onNavigate={navigate} sources={sources}
        activeAccountId={data.accountId} activeSourceName={activeSourceName}
        switchingBlocked={switchingBlocked} onSelectSource={requestSidebarSourceSwitch} />
      <main className={`mc-main mc-main-${view}`}>
        <header className="mc-page-header">
          <div className="mc-page-title">
            <h1 id="mc-page-title" tabIndex={-1}>{pageLabels[view]}</h1>
            {(source?.source_kind === "gmail" || (source && sources.length > 1)) && <p>{source.email ?? source.display_name}</p>}
          </div>
          <div className="mc-page-actions">
            {(view === "today" || view === "tasks") && (
              <button type="button" className="mc-button mc-secondary" onClick={showDecision}>
                <ListOrdered size={18} aria-hidden="true" /> Việc nên làm trước
              </button>
            )}
            {view === "calendar" || view === "notifications" || view === "assistant" || view === "settings" ? null : view === "inbox" ? (canImport ? (
              <button type="button" className="mc-button mc-primary" onClick={onImport} disabled={importing}>
                <FolderOpen size={18} aria-hidden="true" /> {importing ? "Đang nhập…" : "Nhập tệp email"}
              </button>
            ) : isConsentedGmail && gmailSync?.sync_available !== false && gmailSync?.state !== "reconnect_required" ? (
              <button type="button" className="mc-button mc-primary" onClick={() => void requestActiveGmailSync()} disabled={gmailSyncBusy}>
                <RefreshCw size={18} aria-hidden="true" /> {gmailSyncBusy ? "Đang đồng bộ…" : "Đồng bộ Gmail"}
              </button>
            ) : null) : (
              <button type="button" className="mc-button mc-primary" onClick={onNewTask}>
                <Plus size={18} aria-hidden="true" /> Tạo công việc
              </button>
            )}
            <NotificationBell api={api} revision={notificationRevision} unreadCount={notificationCount}
              unreadError={notificationCountError} notificationOpen={view === "notifications"}
              onOpen={() => navigate("notifications")} />
          </div>
        </header>
        {importing && (
          <p className="mc-operation" role="status">
            {dropProgress ? `Đang nhập ${dropProgress.done}/${dropProgress.total} tệp email…` : "Đang chờ chọn tệp hoặc đọc các tệp đã chọn."}
          </p>
        )}
        {importError && <p className="mc-operation mc-form-error" role="alert">{importError}</p>}
        {sourceSwitchError && <p className="mc-operation mc-form-error" role="alert">{sourceSwitchError}</p>}
        {(view === "inbox" || view === "today") && gmailSyncBusy && (
          <p className="mc-operation" role="status">
            {gmailSync?.phase === "scan"
              ? "Đang quét hộp thư đến Gmail (30 ngày gần nhất)…"
              : "Đang đồng bộ thư mới từ Gmail…"}
          </p>
        )}
        {(view === "inbox" || view === "today") && gmailSync?.state === "reconnect_required" && (
          <div className="mc-operation">
            <p className="mc-form-error" role="alert">Quyền truy cập Gmail đã hết hiệu lực. Hãy kết nối lại để tiếp tục đồng bộ.</p>
            <button type="button" className="mc-text-button" onClick={() => navigate("settings")}>Mở Cài đặt</button>
          </div>
        )}
        {(view === "inbox" || view === "today") && gmailSync?.state === "backoff" && (
          <p className="mc-operation" role="status">Google tạm thời chưa phản hồi. MailCompass sẽ tự thử đồng bộ lại sau.</p>
        )}
        {(view === "inbox" || view === "today") && syncError && (
          <p className="mc-operation mc-form-error" role="alert">{syncError}</p>
        )}
        {view === "inbox" && labelCatalogError && (
          <div className="mc-operation">
            <p className="mc-form-error" role="alert">Chưa tải được nhãn và thư mục đã lưu.</p>
            <button type="button" className="mc-text-button" onClick={() => void refreshMailOrganization().catch(() => {})}>
              Tải lại nhãn và thư mục
            </button>
          </div>
        )}
        {view === "inbox" && importResults.length > 0 && (
          <ImportOutcomes results={importResults} onOpen={openMail} onDismiss={() => setImportResults([])} />
        )}
        {view === "inbox" && (
          <Inbox api={api} items={mail.items} selected={selected} onOpen={openMail} onBack={returnFromMail} onCreateTask={showEditor}
            onTaskCreated={acceptTaskRevision} onOpenTask={openWorkBrief}
            returningToTask={sourceTask !== null} sourceTaskId={sourceTask?.id} listScroll={mailListScroll}
            backLabel={sourceTask?.from === "notifications" ? "Về thông báo" : sourceTask?.from === "assistant" ? "Về Hỏi MailCompass" : undefined}
            scopeKey={`${data.accountId}:${source?.generation ?? ""}`} accountId={data.accountId}
            sourceKind={source?.source_kind}
            groupQuery={{
              ...(mail.filters.query && { query: mailQueryFor(mail.filters).query }),
              ...(mail.filters.label_id && { label_id: mail.filters.label_id }),
            }}
            mailbox={{
              view: mail.filters.view ?? "inbox",
              category: mail.filters.category ?? null,
              onView: (next, category) => {
                setMailDraft(emptyMailFilterDraft);
                searchMail({ ...(next !== "inbox" && { view: next }), ...(category && { category }) });
              },
              onCategory: (category) => {
                if (category !== mail.filters.category) searchMail({ ...mail.filters, category });
              },
            }}
            onMailChanged={() => mail.refresh()}
            onCreateRuleFromQuery={(draft) => {
              ruleDraftFromSearch.current = draft;
              openMailOrganizer("rules");
            }}
            keyboardHandlers={inboxKeyboard}
            labeling={{
              labels: mailLabels,
              activeLabelId: mail.filters.label_id ?? null,
              onFilter: (id) => {
                const { label_id: previous, ...criteria } = mail.filters;
                if (id !== (previous ?? null)) searchMail(id ? { ...criteria, label_id: id } : criteria);
              },
              activeOrigin: mail.filters.label_origin ?? null,
              onOrigin: (origin) => {
                const { label_origin: previous, ...criteria } = mail.filters;
                if (origin !== (previous ?? null)) searchMail(origin ? { ...criteria, label_origin: origin } : criteria);
              },
              onManage: () => openMailOrganizer("labels"),
              onAssigned: mail.refresh,
            }}
            folders={{
              rules: mailRules,
              activeRuleId: mail.filters.rule_id ?? null,
              onFilter: (id) => {
                const { rule_id: previous, ...criteria } = mail.filters;
                if (id !== (previous ?? null)) searchMail(id ? { ...criteria, rule_id: id } : criteria);
              },
              onManage: () => {
                ruleDraftFromSearch.current = null;
                openMailOrganizer("rules");
              },
            }}
            refreshRevision={mailReadRevision}
            onReadChanged={mail.refresh}
            search={{
              draft: mailDraft, onDraftChange: setMailDraft,
              onApply: (filters) => {
                const { label_id, rule_id, label_origin } = mail.filters;
                searchMail({
                  ...folderOf(mail.filters), ...filters,
                  ...(label_id && { label_id }), ...(rule_id && { rule_id }), ...(label_origin && { label_origin }),
                });
              },
              onClear: () => { setMailDraft(emptyMailFilterDraft); searchMail(folderOf(mail.filters)); },
              filtered: isFiltered(mail.filters), loading: mail.loading !== null && mail.loading !== "more",
              loadingMore: mail.loading === "more", firstError: mail.error === "first", moreError: mail.error === "more",
              hasMore: Boolean(mail.next_cursor), onRetry: () => void (mail.error === "more" ? mail.more() : mail.refresh()),
              onLoadMore: () => void mail.more(),
              appliedQuery: mail.filters.query ?? "",
              parsedOperators: mailOperators.parsed,
              unsupportedOperators: mailOperators.unsupported,
            }} />
        )}
        {view === "today" && (
          <div className="mc-today">
            {urgentDeadlines.length > 0 && (() => {
              const nowMs = Date.now();
              const overdueCount = urgentDeadlines.filter((item) => Date.parse(item.deadline_effective!) < nowMs).length;
              const soonCount = urgentDeadlines.length - overdueCount;
              const summaryParts = [
                overdueCount > 0 ? `${overdueCount} quá hạn` : "",
                soonCount > 0 ? `${soonCount} đến hạn trong 24 giờ` : "",
              ].filter(Boolean).join(" · ");
              return (
                <section className="mc-overview mc-today-urgent" aria-labelledby="mc-today-urgent-title">
                  <div className="mc-overview-heading">
                    <CalendarClock size={18} aria-hidden="true" />
                    <h2 id="mc-today-urgent-title">Cần chú ý hôm nay</h2>
                    <span className="mc-muted">{summaryParts}</span>
                    <div className="mc-overview-actions">
                      <button type="button" className="mc-text-button" onClick={() => navigate("tasks")}>
                        Xem danh sách <ArrowRight size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <ul className="mc-today-urgent-list" aria-label="Công việc quá hạn và sắp đến hạn">
                    {urgentDeadlines.slice(0, 8).map((item) => {
                      const overdue = Date.parse(item.deadline_effective!) < nowMs;
                      return (
                        <li key={item.id} className="mc-today-urgent-row">
                          <span className="mc-today-urgent-badge" data-overdue={overdue}>
                            {overdue ? "Quá hạn" : "Trong 24 giờ"}
                          </span>
                          <div className="mc-today-urgent-main">
                            <button type="button" className="mc-text-button mc-task-title-link"
                              onClick={() => openWorkBrief(item.id)}>
                              {item.title}
                            </button>
                            <p className="mc-muted">
                              <time dateTime={item.deadline_effective!}>
                                {deadlineText(item.deadline_effective!, item.deadline_authored)}
                              </time>
                              {item.owner ? ` · ${item.owner}` : ""}
                            </p>
                          </div>
                          <button type="button" className="mc-text-button"
                            aria-label={`Hạn chót: ${item.title}`}
                            onClick={() => openEditor({ kind: "deadline", task: item })}>
                            Hạn chót
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })()}
            <section className="mc-overview" aria-labelledby="mc-today-task">
              <div className="mc-overview-heading">
                <ListChecks size={18} aria-hidden="true" />
                <h2 id="mc-today-task">Công việc gần đây</h2>
                <div className="mc-overview-actions">
                  <button type="button" className="mc-text-button" onClick={showCapacity}>Thử xếp lịch</button>
                  <button type="button" className="mc-text-button" onClick={() => navigate("tasks")}>
                    Đến công việc <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {recentActive.length > 0 ? (
                <TaskRows compact items={recentActive} onOpenMail={openMail} onOpenTask={(task) => openWorkBrief(task.id)} />
              ) : (
                <p className="mc-overview-copy">Chưa có công việc.</p>
              )}
            </section>
            <section className="mc-overview mc-overview-inbox" aria-labelledby="mc-today-mail">
              <div className="mc-overview-heading">
                <InboxIcon size={18} aria-hidden="true" />
                <h2 id="mc-today-mail">{canImport ? "Hộp thư trên máy" : "Hộp thư Gmail"}</h2>
              </div>
              {latestMail.length > 0 && (
                <ul className="mc-today-mail" aria-label="Email mới nhập">
                  {latestMail.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="mc-today-mail-row" onClick={() => openMail(item.id)}>
                        <span className="mc-today-mail-sender">{item.sender || "Không rõ người gửi"}</span>
                        <span className="mc-today-mail-subject">{subjectOf(item)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mc-overview-copy">{hasMail ? "Đọc và tạo việc từ email."
                : canImport ? "Chưa có email .eml." : "Chưa có email trên máy."}</p>
              {hasMail ? (
                <button type="button" className="mc-button mc-secondary" onClick={() => navigate("inbox")}>Mở hộp thư</button>
              ) : canImport ? (
                <button type="button" className="mc-button mc-secondary" disabled={importing} onClick={onImport}>Nhập tệp email</button>
              ) : <button type="button" className="mc-button mc-secondary" onClick={() => navigate("settings")}>Cài đặt hộp thư</button>}
            </section>
          </div>
        )}
        {(view === "tasks" || view === "followup" || view === "projects" || view === "recurrences" || view === "brief") && (
          <nav className="mc-work-sections" aria-label="Mục công việc">
            {([["tasks", "Danh sách"], ["projects", "Dự án"], ["followup", "Theo dõi cam kết"], ["recurrences", "Lặp lại"]] as const)
              .map(([destination, label]) => (
                <button key={destination} type="button" className="mc-text-button" aria-current={view === destination ? "page" : undefined}
                  onClick={() => navigate(destination)}>{label}</button>
              ))}
          </nav>
        )}
        {enteredFollowup && (
          <div hidden={view !== "followup"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở phần theo dõi…</p>}>
              <CommitmentsView api={api} onOpenTask={openWorkBrief}
                onOpenMail={(id) => openMail(id, undefined, true)} onChanged={refreshNotifications} />
            </Suspense>
          </div>
        )}
        {enteredProjects && (
          <div hidden={view !== "projects"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở dự án…</p>}>
              <ProjectsView api={api} active={view === "projects"} onOpenTask={openWorkBrief} onOpenMail={(messageId, taskId) => openMail(messageId, taskId, true)} onTaskChanged={acceptTaskRevision} />
            </Suspense>
          </div>
        )}
        {enteredRecurrences && (
          <div hidden={view !== "recurrences"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở công việc lặp lại…</p>}>
              <RecurrencesView api={api} revision={recurrenceRevision}
                onOpenTask={openWorkBrief} onTasksGenerated={refreshNewWork} />
            </Suspense>
          </div>
        )}
        {enteredCalendar && (
          <div hidden={view !== "calendar"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở lịch…</p>}>
              <CalendarView api={api} active={view === "calendar"} revision={workRevision}
                onOpenTask={openWorkBrief} onCapacity={showCapacity} />
            </Suspense>
          </div>
        )}
        {enteredNotifications && (
          <div hidden={view !== "notifications"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở thông báo…</p>}>
              <NotificationsView api={api} active={view === "notifications"} revision={notificationRevision}
                onCountChange={refreshNotifications} onOpenTask={openWorkBrief}
                onOpenMail={(id) => openMail(id, undefined, true)} />
            </Suspense>
          </div>
        )}
        {enteredAssistant && (
          <div className="mc-assistant-host" hidden={view !== "assistant"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở Hỏi MailCompass…</p>}>
              <AssistantView api={api} active={view === "assistant"} policyRevision={aiPolicyRevision} onOpenTask={openWorkBrief}
                initialDraft={assistantDraft} onDraftChange={onAssistantDraftChange}
                onOpenMail={(id) => openMail(id, undefined, true)}
                onOpenSettings={() => navigate("settings")} />
            </Suspense>
          </div>
        )}
        {enteredSettings && (
          <div hidden={view !== "settings"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở Cài đặt…</p>}>
              <SettingsView api={api} active={view === "settings"} onSelect={onSelectSource}
                onSourceChanged={onSourceChanged} onSourceDeleted={onSourceDeleted}
                onCatalogChanged={onCatalogChanged}
                onAiPrivacyChanged={() => setAiPolicyRevision((value) => value + 1)}
                onGmailShortcutsChanged={setGmailShortcutsEnabled} />
            </Suspense>
          </div>
        )}
        {brief && (
          <div hidden={view !== "brief"}>
            <Suspense fallback={<p className="mc-operation" role="status">Đang mở công việc…</p>}>
              <WorkBriefView key={brief.taskId} api={api} taskId={brief.taskId} revision={workRevision}
                onOpenMail={(messageId, taskId) => openMail(messageId, taskId, true)}
                onEdit={(task) => openEditor({ kind: "edit", task })}
                onDeadline={(task, proposal) => openEditor({ kind: "deadline", task, proposal })}
                onDelete={api.deleteTask ? (task) => { setDeleteTaskError(null); setDeletingTask(task); } : undefined}
                onTaskChanged={acceptTaskRevision}
                onBack={returnFromBrief} />
            </Suspense>
          </div>
        )}
        {view === "tasks" && (
          <TaskWorklist items={tasks.items} filter={filter}
            onFilter={(state_group) => void tasks.apply({ ...taskSearch, state_group })}
            search={taskSearch} onSearch={(search) => void tasks.apply({ ...search, state_group: filter })}
            loading={tasks.loading !== null && tasks.loading !== "more"} loadingMore={tasks.loading === "more"}
            queryError={tasks.error ? "Chưa tải được danh sách công việc. Hãy thử lại." : null}
            nextCursor={tasks.next_cursor} onQueryRetry={() => void (tasks.error === "more" ? tasks.more() : tasks.refresh())}
            onLoadMore={() => void tasks.more()} notice={taskNotice} failure={taskFailure}
            busyId={busyTaskId} onOpenMail={openMail} onOpenTask={(task) => openWorkBrief(task.id)} onChangeState={(task, state) => void changeTaskState(task, state)}
            onEdit={(task) => openEditor({ kind: "edit", task })}
            onDeadline={(task) => openEditor({ kind: "deadline", task })}
            onDelete={api.deleteTask ? (task) => { setDeleteTaskError(null); setDeletingTask(task); } : undefined}
            onRetry={(failure) => void retryTaskState(failure)} />
        )}
      </main>
      {capacityOpen && (
        <Suspense fallback={<p className="mc-sr-only" role="status">Đang mở lịch thử…</p>}>
          <CapacityPreviewDialog api={api} onClose={closeDecision} />
        </Suspense>
      )}
      {decisionOpen && (
        <Suspense fallback={<p className="mc-sr-only" role="status">Đang mở gợi ý công việc…</p>}>
          <DecisionPreviewDialog api={api} sources={sources} activeAccountId={data.accountId}
            onClose={closeDecision} onOpenTasks={() => {
              setDecisionOpen(false);
              navigate("tasks");
            }} />
        </Suspense>
      )}
      {organizer === "labels" && (
        <MailLabelManager api={api} labels={mailLabels} onSaved={refreshMailOrganization} onClose={closeMailOrganizer} />
      )}
      {organizer === "rules" && (
        <MailRuleManager api={api} rules={mailRules} labels={mailLabels}
          initialCriteria={ruleDraftFromSearch.current}
          onSaved={refreshMailOrganization} onClose={closeMailOrganizer} />
      )}
      {editor?.kind === "create" && <TaskDialog api={api} source={editor.source} evidence={editor.evidence} onClose={closeEditor} onSaved={taskSaved} />}
      {editor?.kind === "edit" && (
        <TaskDialog api={api} source={null} existing={editor.task} onClose={closeEditor} onSaved={taskEdited} onReloaded={acceptTaskRevision} />
      )}
      {editor?.kind === "deadline" && (
        <DeadlineDialog api={api} task={editor.task} proposal={editor.proposal}
          accountReminderPresets={activeAccount?.reminder_lead_presets}
          onClose={closeEditor} onSaved={acceptTaskRevision}
          onProposalStale={() => setWorkRevision((value) => value + 1)} />
      )}
      {shortcutsHelpOpen && (
        <Suspense fallback={<p className="mc-sr-only" role="status">Đang mở bảng phím tắt…</p>}>
          <KeyboardShortcutsDialog open={shortcutsHelpOpen} onClose={closeShortcutsHelp} />
        </Suspense>
      )}
      {deletingTask && (
        <Dialog.Root open onOpenChange={(open) => { if (!open && !deleteTaskBusy) { setDeletingTask(null); setDeleteTaskError(null); } }}>
          <Dialog.Portal>
            <Dialog.Backdrop className="mc-dialog-backdrop" />
            <Dialog.Popup className="mc-dialog" initialFocus={deleteTaskCancel}>
              <Dialog.Title className="mc-dialog-title">Xóa công việc?</Dialog.Title>
              <Dialog.Description className="mc-muted">
                MailCompass sẽ xóa vĩnh viễn công việc “{deletingTask.title}” cùng lịch sử hạn và cam kết liên quan. Email gốc và các khung giờ trên lịch vẫn được giữ nguyên.
              </Dialog.Description>
              {deleteTaskError && <p className="mc-form-error" role="alert">{deleteTaskError}</p>}
              <div className="mc-dialog-footer">
                <Dialog.Close ref={deleteTaskCancel} type="button" className="mc-button mc-quiet" disabled={deleteTaskBusy}>
                  Quay lại
                </Dialog.Close>
                <button type="button" className="mc-button mc-danger" disabled={deleteTaskBusy}
                  onClick={() => void confirmDeleteTask(deletingTask)}>
                  {deleteTaskBusy ? "Đang xóa…" : "Xóa công việc"}
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      {pendingSource && (
        <Dialog.Root open onOpenChange={(open) => { if (!open && !switchingSource) setPendingSource(null); }}>
          <Dialog.Portal>
            <Dialog.Backdrop className="mc-dialog-backdrop" />
            <Dialog.Popup className="mc-dialog" initialFocus={sourceSwitchCancel}>
              <Dialog.Title className="mc-dialog-title">Đổi nguồn dữ liệu?</Dialog.Title>
              <Dialog.Description className="mc-muted">
                Bạn đang mở hộp thoại chỉnh sửa chưa lưu. Chuyển sang {pendingSource.email ?? pendingSource.display_name} sẽ đóng hộp thoại hiện tại và bỏ thay đổi chưa lưu.
              </Dialog.Description>
              <div className="mc-dialog-footer">
                <Dialog.Close ref={sourceSwitchCancel} type="button" className="mc-button mc-quiet" disabled={switchingSource}>
                  Ở lại
                </Dialog.Close>
                <button type="button" className="mc-button mc-primary" disabled={switchingSource}
                  onClick={() => void performSourceSwitch(pendingSource)}>
                  Chuyển nguồn
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
    </CodeSearchContext.Provider>
  );
}
