import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { Switch } from "@base-ui/react/switch";
import {
  ArrowUpRight, BellRing, FileText, FolderPlus, HelpCircle, Keyboard, Mail, Paperclip,
  RefreshCw, ShieldAlert, ShieldCheck, Trash2,
} from "lucide-react";
import { useCallback, useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { gmailStatusPollMs } from "./api";
import type {
  AccountCleanupReceipt, AiPrivacyStatus, AttachmentSyncPolicy, DesktopApi, GmailConnectionAttempt,
  GmailSyncStatus, MigrationAdoptionReceipt, MigrationPreflight, MigrationStagingReport,
  ProfileAccount, RedactedDiagnosticsReport, SourceCatalog,
} from "./api";
import { resolveAccountReminderPresets } from "./DeadlineDialog";
import {
  REMINDER_PRESET_MAX_COUNT,
  formatDate,
  mutationErrorCode,
  normalizeReminderPresets,
  week4ErrorText,
} from "./presentation";
import { ReminderLeadPresetChips } from "./ReminderLeadPresetChips";
import { readGmailShortcutsEnabled, writeGmailShortcutsEnabled } from "./useGmailShortcuts";
import "./settings.css";

const connectionPollMs = 750;

export interface AttachmentPolicySummary {
  policy: AttachmentSyncPolicy;
  statusBadge: string;
  statusHeading: string;
  blockedCount: number;
  blockedLine: string;
}

export function attachmentPolicySummary(
  account: Pick<ProfileAccount, "attachment_sync_policy" | "blocked_attachment_count"> | null | undefined,
): AttachmentPolicySummary {
  const policy: AttachmentSyncPolicy = account?.attachment_sync_policy === "metadata_only_explicit_fetch"
    ? "metadata_only_explicit_fetch"
    : "block_binary";
  const rawCount = account?.blocked_attachment_count;
  const blockedCount = typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount > 0
    ? Math.floor(rawCount)
    : 0;
  const statusBadge = policy === "metadata_only_explicit_fetch" ? "Chỉ siêu dữ liệu" : "Đang bật";
  const statusHeading = policy === "metadata_only_explicit_fetch"
    ? "Chặn đồng bộ tệp đính kèm: Chỉ lưu siêu dữ liệu"
    : "Chặn đồng bộ tệp đính kèm: Đang bật";
  const blockedLine = `Đã bỏ qua ${blockedCount} tệp đính kèm nhị phân khi đồng bộ.`;
  return { policy, statusBadge, statusHeading, blockedCount, blockedLine };
}

export function resolveAccountPresets(
  account: Pick<ProfileAccount, "reminder_lead_presets"> | null | undefined,
): number[] {
  return resolveAccountReminderPresets(account?.reminder_lead_presets);
}

export interface SettingsViewProps {
  api: Pick<DesktopApi,
    "listSources" | "createLocalSource" | "accountCleanupStatus" | "deleteLocalAccount"
    | "startGmailConnection" | "gmailConnectionStatus" | "cancelGmailConnection"
    | "setGmailSyncConsent" | "disconnectGmail"> &
    Partial<Pick<DesktopApi,
      "gmailSyncStatus" | "requestGmailSync" | "onGmailSyncUpdated"
      | "migrationStatus" | "migrationInspect" | "migrationStage" | "migrationAdopt"
      | "exportDiagnostics" | "aiPrivacyStatus" | "setFreeTierRiskConsent"
      | "setReminderPresets">>;
  active?: boolean;
  onSelect: (account: ProfileAccount) => void | Promise<void>;
  onSourceChanged?: (account: ProfileAccount) => void;
  onSourceDeleted?: (accountId: string) => void | Promise<void>;
  onCatalogChanged?: () => void;
  onAiPrivacyChanged?: () => void;
  onGmailShortcutsChanged?: (enabled: boolean) => void;
}

type Confirmation =
  | { kind: "consent"; account: ProfileAccount; allowed: boolean }
  | { kind: "disconnect"; account: ProfileAccount }
  | { kind: "delete_local"; account: ProfileAccount };

function connectionError(code: unknown) {
  switch (code) {
    case "provider_not_configured":
    case "gmail_not_configured":
      return "Bản MailCompass này chưa được thiết lập để kết nối Gmail.";
    case "oauth_denied":
    case "gmail_scope_not_granted":
      return "Bạn chưa cấp quyền đọc Gmail. Hãy kết nối lại khi sẵn sàng.";
    case "oauth_expired":
      return "Phiên đăng nhập đã hết hạn. Hãy thử lại.";
    case "provider_revoked":
      return "Quyền truy cập Gmail đã hết hiệu lực. Hãy kết nối lại.";
    case "google_account_mismatch":
    case "gmail_account_mismatch":
    case "gmail_identity_mismatch":
    case "oauth_account_mismatch":
      return "Tài khoản Google vừa chọn khác với tài khoản cần kết nối lại.";
    case "gmail_account_exists":
      return "Hộp thư Gmail này đã có trong danh sách. Hãy chọn Kết nối lại nếu cần.";
    case "legacy_gmail_reconnect_unavailable":
      return "Thư cũ vẫn xem được trên máy. Để đồng bộ địa chỉ Gmail của tổ chức, hãy thêm địa chỉ đó làm nguồn mới.";
    case "gmail_identity_changed":
      return "Thông tin tài khoản Google vừa thay đổi. Hãy kiểm tra lại trước khi kết nối.";
    case "account_cleanup_pending":
      return "Dữ liệu trên máy của tài khoản này đang được xóa. Hãy hoàn tất việc xóa trước.";
    case "oauth_in_progress":
    case "oauth_already_in_progress":
    case "gmail_sign_in_busy":
      return "Đang có một phiên đăng nhập Gmail. Hãy hoàn tất phiên đó rồi thử lại.";
    case "gmail_browser_unavailable":
      return "Chưa mở được trình duyệt mặc định. Hãy thử lại.";
    case "gmail_attempt_not_found":
      return "Phiên đăng nhập đã kết thúc. Bạn có thể thử kết nối lại.";
    case "account_not_found":
    case "account_version_conflict":
      return "Tài khoản vừa thay đổi. Hãy xem trạng thái mới rồi thử lại.";
    case "provider_timeout":
    case "provider_rate_limited":
    case "provider_unavailable":
      return "Google chưa phản hồi. Hãy thử lại sau.";
    default:
      return "Chưa kết nối được Gmail. Hãy thử lại.";
  }
}

function gmailStatus(account: ProfileAccount, canSync: boolean) {
  if (account.lifecycle_state === "deleting") return "Đang xóa dữ liệu trên máy";
  if (account.lifecycle_state === "disconnected") return "Đã ngắt kết nối";
  if (!account.sync_consent) return "Đã kết nối · Chưa cho phép đồng bộ";
  return canSync ? "Đã cho phép đồng bộ" : "Đã cho phép · Chưa đồng bộ";
}

function cleanupPhaseLabel(phase: AccountCleanupReceipt["phase"]) {
  switch (phase) {
    case "started": return "Đang gỡ quyền truy cập lưu trên máy";
    case "tokens_removed": return "Đang xóa tệp email trên máy";
    case "raw_removed":
    case "db_purged": return "Đang xóa bản ghi trong cơ sở dữ liệu";
    case "completed": return "Đã hoàn tất xóa dữ liệu trên máy";
  }
}

function cleanupSummary(receipt: AccountCleanupReceipt) {
  const files = receipt.file_counts.raw_files + receipt.file_counts.staging_files;
  const rows = Object.values(receipt.db_counts).reduce((sum, value) => sum + value, 0);
  return `${files} tệp, ${rows} bản ghi`;
}

function syncStatusDescription(status: GmailSyncStatus | undefined) {
  if (!status) return null;
  if (status.state === "queued" || status.state === "syncing") {
    return status.phase === "scan"
      ? "Đang quét hộp thư đến Gmail (30 ngày gần nhất)…"
      : "Đang đồng bộ thư mới từ Gmail…";
  }
  if (status.state === "reconnect_required") {
    return "Quyền truy cập Gmail đã hết hiệu lực. Hãy kết nối lại để tiếp tục đồng bộ.";
  }
  if (status.state === "backoff") {
    const retry = formatDate(status.retry_at, true);
    return retry
      ? `Google tạm thời chưa phản hồi. MailCompass sẽ tự thử lại lúc ${retry}.`
      : "Google tạm thời chưa phản hồi. MailCompass sẽ tự thử lại sau.";
  }
  if (status.last_synced_at) {
    const at = formatDate(status.last_synced_at, true) ?? status.last_synced_at;
    const summary = status.imported > 0 ? ` · ${status.imported} thư cập nhật` : "";
    return `Đồng bộ gần nhất: ${at}${summary}`;
  }
  if (status.error_code) {
    return "Lần đồng bộ gần nhất chưa hoàn tất. Bạn có thể bấm Đồng bộ ngay để thử lại.";
  }
  return null;
}

function migrationErrorMessage(code: unknown) {
  switch (code) {
    case "migration_default_not_found":
      return "Không tìm thấy hồ sơ MailCompass V1 mặc định trên máy này. Hãy chọn thư mục thủ công.";
    case "migration_unfrozen":
      return "Hãy đóng ứng dụng MailCompass V1 đang mở rồi thử lại.";
    case "migration_unsupported_schema":
      return "Hồ sơ này không thuộc định dạng MailCompass V1 (schema v14) được hỗ trợ.";
    case "migration_original_mismatch":
      return "Một hoặc nhiều tệp email gốc (.eml) bị thiếu hoặc không khớp mã kiểm tra SHA-256.";
    case "migration_insufficient_space":
      return "Ổ đĩa không đủ dung lượng trống để dựng bản kiểm tra chuyển dữ liệu.";
    case "migration_unresolved_gaps":
      return "Bản dựng thử có mục dữ liệu chưa tương thích hoặc đang chờ xóa nên chưa thể kích hoạt.";
    case "migration_destination_not_empty":
      return "Hồ sơ MailCompass V2 đã có dữ liệu. Chỉ có thể chuyển dữ liệu V1 vào hồ sơ V2 chưa được sử dụng.";
    case "migration_no_eligible_accounts":
      return "Không tìm thấy nguồn thư cục bộ (.eml) hợp lệ trong hồ sơ V1 đã chọn.";
    default:
      return "Chưa thực hiện được bước chuyển dữ liệu V1. Hãy kiểm tra lại thư mục hồ sơ.";
  }
}

function accountIdentity(account: ProfileAccount) {
  return account.email ?? account.display_name;
}

function versionedAccount(account: ProfileAccount) {
  return {
    account_id: account.account_id,
    expected_generation: account.generation,
    expected_version: account.version,
  };
}

export function SettingsView({
  api,
  active = true,
  onSelect,
  onSourceChanged,
  onSourceDeleted,
  onCatalogChanged,
  onAiPrivacyChanged,
  onGmailShortcutsChanged,
}: SettingsViewProps) {
  const [catalog, setCatalog] = useState<SourceCatalog | null>(null);
  const [attempt, setAttempt] = useState<GmailConnectionAttempt | null>(null);
  const [reconnectRequiredId, setReconnectRequiredId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [operation, setOperation] = useState<"start" | "cancel" | "select" | "change" | "local" | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [localName, setLocalName] = useState("");
  const [localError, setLocalError] = useState("");
  const [syncStatuses, setSyncStatuses] = useState<Record<string, GmailSyncStatus>>({});
  const syncRevisions = useRef(new Map<string, number>());
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [migrationReceipt, setMigrationReceipt] = useState<MigrationAdoptionReceipt | null>(null);
  const [migrationPreflight, setMigrationPreflight] = useState<MigrationPreflight | null>(null);
  const [migrationReport, setMigrationReport] = useState<MigrationStagingReport | null>(null);
  const [migrationBusy, setMigrationBusy] = useState<"inspect" | "stage" | "adopt" | null>(null);
  const [migrationError, setMigrationError] = useState("");
  const [diagnostics, setDiagnostics] = useState<RedactedDiagnosticsReport | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [aiPrivacy, setAiPrivacy] = useState<AiPrivacyStatus | null>(null);
  const [aiPrivacyBusy, setAiPrivacyBusy] = useState(false);
  const [aiPrivacyError, setAiPrivacyError] = useState("");
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [riskChecked, setRiskChecked] = useState(false);
  const [pendingPresets, setPendingPresets] = useState<{ accountId: string; hours: number[] } | null>(null);
  const [presetsBusy, setPresetsBusy] = useState(false);
  const [presetsError, setPresetsError] = useState("");
  const [presetsNotice, setPresetsNotice] = useState("");
  const [gmailShortcuts, setGmailShortcuts] = useState<boolean>(() => readGmailShortcutsEnabled());
  const catalogRequest = useRef(0);
  const attemptEpoch = useRef(0);
  const changing = useRef(false);
  const presetsSaving = useRef(false);
  const presetsEpoch = useRef(0);
  const lastPresetsAccountId = useRef<string | null>(null);
  const localRequest = useRef<{ name: string; key: string } | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const riskCancelButton = useRef<HTMLButtonElement>(null);
  const sourceHeadings = useRef(new Map<string, HTMLHeadingElement>());
  const focusAfterDialog = useRef<string | null>(null);
  const waitingId = attempt?.status === "waiting" ? attempt.id : null;
  const cancelInProgress = operation === "cancel";
  const activeAccount = catalog?.accounts.find((entry) => entry.account_id === catalog.active_account_id)
    ?? catalog?.accounts[0];
  const activeAccountId = activeAccount?.account_id ?? null;
  const accountPresets = pendingPresets && pendingPresets.accountId === activeAccountId
    ? pendingPresets.hours
    : resolveAccountPresets(activeAccount);
  const attachmentPolicy = attachmentPolicySummary(activeAccount);

  const loadSources = useCallback(async () => {
    const request = ++catalogRequest.current;
    const epoch = attemptEpoch.current;
    setCatalogError(false);
    try {
      const sources = await api.listSources();
      if (request !== catalogRequest.current) return;
      setCatalog(sources);
      const pending = sources.gmail_attempt;
      if (pending?.status === "waiting" && epoch === attemptEpoch.current) {
        setAttempt((current) => current?.id === pending.id ? current : pending);
      }
      if (api.migrationStatus) {
        try {
          const receipt = await api.migrationStatus();
          if (request === catalogRequest.current) setMigrationReceipt(receipt);
        } catch {
          // Ignore optional migration status errors during catalog load.
        }
      }
      if (api.aiPrivacyStatus) {
        try {
          const privacy = await api.aiPrivacyStatus();
          if (request === catalogRequest.current) setAiPrivacy(privacy);
        } catch {
          // Ignore optional AI privacy status errors during catalog load.
        }
      }
    } catch {
      if (request === catalogRequest.current) setCatalogError(true);
    }
  }, [api]);

  useEffect(() => {
    if (!active) return;
    void loadSources();
    setGmailShortcuts(readGmailShortcutsEnabled());
    return () => { catalogRequest.current += 1; };
  }, [active, loadSources]);

  useEffect(() => {
    if (!activeAccountId) return;
    const previousAccountId = lastPresetsAccountId.current;
    lastPresetsAccountId.current = activeAccountId;
    if (previousAccountId !== null && previousAccountId !== activeAccountId) {
      presetsEpoch.current += 1;
      presetsSaving.current = false;
      setPendingPresets(null);
      setPresetsBusy(false);
      setPresetsError("");
      setPresetsNotice("");
    }
  }, [activeAccountId]);

  const accounts = catalog?.accounts;
  useEffect(() => {
    const getStatus = api.gmailSyncStatus;
    if (!active || !getStatus || !accounts) return;
    const eligible = accounts.filter((entry) =>
      entry.source_kind === "gmail" && entry.lifecycle_state === "active" && entry.sync_consent);
    if (!eligible.length) return;

    let live = true;
    let reading = false;
    const refresh = async () => {
      if (reading || document.visibilityState === "hidden") return;
      reading = true;
      const results = await Promise.allSettled(eligible.map(async (account) => {
        const revision = syncRevisions.current.get(account.account_id);
        const status = await getStatus(account.account_id);
        return { account, revision, status };
      }));
      reading = false;
      if (!live) return;
      setSyncStatuses((previous) => {
        const next = { ...previous };
        for (const item of results) {
          if (item.status !== "fulfilled") continue;
          const { account, revision, status } = item.value;
          const id = account.account_id;
          if (status.account_id === id && status.generation === account.generation &&
              revision === syncRevisions.current.get(id)) next[id] = status;
        }
        return next;
      });
    };
    void refresh();
    const timer = window.setInterval(refresh, gmailStatusPollMs);
    return () => { live = false; window.clearInterval(timer); };
  }, [active, accounts, api.gmailSyncStatus]);

  useEffect(() => {
    if (!api.onGmailSyncUpdated) return;
    let live = true;
    let off: (() => void) | undefined;
    void api.onGmailSyncUpdated((event) => {
      if (!live) return;
      const { account_id: id, status } = event;
      syncRevisions.current.set(id, (syncRevisions.current.get(id) ?? 0) + 1);
      setSyncStatuses((previous) => {
        const current = previous[id];
        return current && current.generation > status.generation ? previous : { ...previous, [id]: status };
      });
    }).then((stop) => {
      if (live) off = stop;
      else stop();
    }, () => {});
    return () => { live = false; off?.(); };
  }, [api]);

  useEffect(() => {
    if (confirmation || !focusAfterDialog.current) return;
    const accountId = focusAfterDialog.current;
    focusAfterDialog.current = null;
    if (active) sourceHeadings.current.get(accountId)?.focus({ preventScroll: true });
  }, [active, confirmation]);

  function publishAccount(account: ProfileAccount, cleanupPending?: boolean) {
    catalogRequest.current += 1;
    setCatalog((current) => {
      if (!current) return current;
      const found = current.accounts.find((entry) => entry.account_id === account.account_id);
      if (found && found.version > account.version) return current;
      const accounts = found
        ? current.accounts.map((entry) => entry.account_id === account.account_id ? account : entry)
        : [...current.accounts, account];
      if (cleanupPending === undefined) return { ...current, accounts };
      const cleanup = (current.gmail_cleanup_pending ?? []).filter((id) => id !== account.account_id);
      if (cleanupPending) cleanup.push(account.account_id);
      return { ...current, accounts, gmail_cleanup_pending: cleanup };
    });
    onSourceChanged?.(account);
    onCatalogChanged?.();
  }

  function applyAttempt(result: GmailConnectionAttempt) {
    setAttempt(result);
    setPollError(false);
    setError("");
    if (result.status === "connected" && result.account) {
      publishAccount(result.account, false);
      const connectedId = result.account.account_id;
      setReconnectRequiredId((current) => current === connectedId ? null : current);
      setNotice(result.account.sync_consent
        ? "Đã kết nối lại Gmail."
        : "Đã kết nối Gmail. Bạn có thể chọn có lưu thư về máy hay không.");
    } else if (result.status === "cancelled") {
      setNotice("Đã hủy đăng nhập Gmail.");
    } else if (result.status === "failed" || result.status === "connected") {
      setError(connectionError(result.error_code));
    }
  }

  const applyPolledAttempt = useEffectEvent(applyAttempt);
  useEffect(() => {
    if (!active || !waitingId || cancelInProgress) return;
    const attemptId = waitingId;
    const epoch = attemptEpoch.current;
    let current = true;
    let timer: number | undefined;

    function schedule() {
      timer = window.setTimeout(() => void poll(), connectionPollMs);
    }

    async function poll() {
      try {
        const result = await api.gmailConnectionStatus(attemptId);
        if (!current || attemptEpoch.current !== epoch) return;
        if (result.id !== attemptId) {
          setPollError(true);
        } else if (result.status === "waiting") {
          setPollError(false);
        } else {
          applyPolledAttempt(result);
          return;
        }
      } catch (reason) {
        if (!current || attemptEpoch.current !== epoch) return;
        if (mutationErrorCode(reason) === "gmail_attempt_not_found") {
          applyPolledAttempt({ id: attemptId, status: "failed", account: null, error_code: "gmail_attempt_not_found" });
          return;
        }
        setPollError(true);
      }
      schedule();
    }

    schedule();
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [active, api, cancelInProgress, waitingId]);

  async function run(kind: Exclude<typeof operation, null>, action: () => Promise<void>) {
    if (changing.current) return;
    changing.current = true;
    setOperation(kind);
    setError("");
    setNotice("");
    try {
      await action();
    } finally {
      changing.current = false;
      setOperation(null);
    }
  }

  function startConnection(account?: ProfileAccount) {
    if (waitingId) return;
    void run("start", async () => {
      attemptEpoch.current += 1;
      setAttempt(null);
      try {
        applyAttempt(await api.startGmailConnection(account && {
          account_id: account.account_id,
          expected_version: account.version,
        }));
      } catch (reason) {
        const code = mutationErrorCode(reason);
        setError(connectionError(code));
        if (code === "account_version_conflict" || code === "account_not_found") void loadSources();
      }
    });
  }

  function cancelConnection() {
    if (!waitingId) return;
    void run("cancel", async () => {
      attemptEpoch.current += 1;
      try {
        const result = await api.cancelGmailConnection(waitingId);
        if (result.id !== waitingId) {
          setPollError(true);
          return;
        }
        applyAttempt(result);
      } catch (reason) {
        if (mutationErrorCode(reason) === "gmail_attempt_not_found") {
          applyAttempt({ id: waitingId, status: "failed", account: null, error_code: "gmail_attempt_not_found" });
        } else {
          setError("Chưa hủy được phiên đăng nhập. Hãy thử lại.");
        }
      }
    });
  }

  function selectSource(account: ProfileAccount) {
    if (waitingId) return;
    void run("select", async () => {
      try {
        await onSelect(account);
      } catch {
        setError("Chưa mở được nguồn dữ liệu. Hãy kiểm tra danh sách và thử lại.");
        void loadSources();
      }
    });
  }

  function createLocal(event: FormEvent) {
    event.preventDefault();
    if (waitingId) return;
    const trimmed = localName.trim();
    if (!trimmed) {
      setLocalError("Hãy nhập tên nguồn thư.");
      return;
    }
    if (trimmed.length > 80) {
      setLocalError("Tên nguồn thư không quá 80 ký tự.");
      return;
    }
    if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
      setLocalError("Tên nguồn thư chứa ký tự không hợp lệ.");
      return;
    }
    setLocalError("");
    const request = localRequest.current?.name === trimmed
      ? localRequest.current
      : { name: trimmed, key: crypto.randomUUID() };
    localRequest.current = request;
    void run("local", async () => {
      try {
        const created = await api.createLocalSource({ display_name: trimmed, request_key: request.key });
        localRequest.current = null;
        setLocalName("");
        setLocalError("");
        publishAccount(created);
        setNotice(`Đã thêm nguồn thư trên máy: ${created.display_name}.`);
      } catch (reason) {
        const code = mutationErrorCode(reason);
        if (code === "invalid_account_name") {
          localRequest.current = null;
          setLocalError("Tên nguồn thư không hợp lệ (1–80 ký tự).");
        } else if (code === "local_account_limit") {
          localRequest.current = null;
          setLocalError("Đã đạt giới hạn 20 nguồn thư trên máy.");
        } else if (code === "request_conflict") {
          localRequest.current = null;
          setLocalError("Yêu cầu tạo nguồn đã thay đổi. Hãy thử lại.");
        } else {
          setLocalError("Chưa thêm được nguồn thư trên máy. Hãy thử lại.");
        }
      }
    });
  }

  async function syncGmailNow(account: ProfileAccount) {
    if (!api.requestGmailSync || syncingAccountId !== null || waitingId) return;
    const id = account.account_id;
    const revision = (syncRevisions.current.get(id) ?? 0) + 1;
    syncRevisions.current.set(id, revision);
    setSyncingAccountId(id);
    setError("");
    setNotice("");
    try {
      const status = await api.requestGmailSync({
        account_id: account.account_id,
        expected_generation: account.generation,
      });
      if (syncRevisions.current.get(id) === revision) {
        setSyncStatuses((previous) => ({ ...previous, [id]: status }));
      }
    } catch (reason) {
      const code = mutationErrorCode(reason);
      if (code === "account_scope_stale" || code === "account_not_found") {
        setError("Tài khoản vừa thay đổi. Đang tải lại danh sách nguồn.");
        void loadSources();
      } else if (code === "gmail_sync_not_allowed") {
        setError("Hãy cho phép đồng bộ Gmail trước khi làm mới hộp thư.");
      } else if (code === "gmail_not_configured") {
        setError("Bản MailCompass này chưa được thiết lập để đồng bộ Gmail.");
      } else {
        setError("Chưa gửi được yêu cầu đồng bộ Gmail. Hãy thử lại.");
      }
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function inspectV1Profile(useDefault: boolean) {
    if (!api.migrationInspect || migrationBusy !== null || waitingId) return;
    setMigrationBusy("inspect");
    setMigrationError("");
    setError("");
    setNotice("");
    try {
      const preflight = await api.migrationInspect(useDefault);
      if (!preflight) return;
      setMigrationPreflight(preflight);
      setMigrationReport(null);
      setNotice(`Đã kiểm tra hồ sơ MailCompass V1 (${preflight.checked_originals} tệp .eml gốc hợp lệ).`);
    } catch (reason) {
      setMigrationError(migrationErrorMessage(mutationErrorCode(reason)));
    } finally {
      setMigrationBusy(null);
    }
  }

  async function stageV1Profile() {
    if (!api.migrationStage || migrationBusy !== null || waitingId) return;
    setMigrationBusy("stage");
    setMigrationError("");
    setError("");
    setNotice("");
    try {
      const report = await api.migrationStage();
      setMigrationReport(report);
      setMigrationPreflight(report.preflight);
      setNotice("Đã dựng xong bản kiểm tra chuyển dữ liệu V1 sang V2.");
    } catch (reason) {
      setMigrationError(migrationErrorMessage(mutationErrorCode(reason)));
    } finally {
      setMigrationBusy(null);
    }
  }

  async function adoptV1Profile() {
    if (!api.migrationAdopt || !migrationReport?.adoption_ready || !migrationReport.stage_directory || migrationBusy !== null || waitingId) return;
    setMigrationBusy("adopt");
    setMigrationError("");
    setError("");
    setNotice("");
    try {
      const receipt = await api.migrationAdopt(migrationReport.stage_directory);
      setMigrationReceipt(receipt);
      setMigrationReport(null);
      setMigrationPreflight(null);
      await loadSources();
      onCatalogChanged?.();
      setNotice("Đã kích hoạt dữ liệu MailCompass V1 trong hồ sơ V2. Hồ sơ V1 gốc vẫn được giữ nguyên.");
    } catch (reason) {
      setMigrationError(migrationErrorMessage(mutationErrorCode(reason)));
    } finally {
      setMigrationBusy(null);
    }
  }

  async function runDiagnosticsExport() {
    if (!api.exportDiagnostics || diagnosticsBusy || waitingId) return;
    setDiagnosticsBusy(true);
    setError("");
    setNotice("");
    try {
      const report = await api.exportDiagnostics();
      setDiagnostics(report);
      setNotice("Đã tạo báo cáo chẩn đoán đã ẩn thông tin riêng tư.");
    } catch {
      setError("Chưa tạo được báo cáo chẩn đoán. Hãy thử lại.");
    } finally {
      setDiagnosticsBusy(false);
    }
  }

  function confirmAccountChange(change: Confirmation) {
    const { account } = change;
    if (change.kind === "disconnect") {
      disconnectAccount(account);
      return;
    }
    if (change.kind === "delete_local") {
      deleteLocalData(account);
      return;
    }
    void run("change", async () => {
      try {
        publishAccount(await api.setGmailSyncConsent({ ...versionedAccount(account), allowed: change.allowed }));
        setNotice(change.allowed
          ? "Đã lưu lựa chọn cho phép đồng bộ Gmail."
          : "Đã tắt đồng bộ Gmail. Thư đã lưu vẫn có trên máy.");
        setConfirmation(null);
      } catch (reason) {
        if (mutationErrorCode(reason) === "credential_reconnect_required") {
          setReconnectRequiredId(account.account_id);
          focusAfterDialog.current = account.account_id;
          setConfirmation(null);
          setError("Hãy kết nối lại Gmail trước khi cho phép đồng bộ.");
        } else {
          accountChangeError(reason);
        }
      }
    });
  }

  function deleteLocalData(account: ProfileAccount) {
    const request_key = `delete-local-${account.account_id}`;
    const identity = accountIdentity(account);
    const isGmailSource = account.source_kind === "gmail";
    void run("change", async () => {
      try {
        const receipt = await api.deleteLocalAccount({ ...versionedAccount(account), request_key });
        catalogRequest.current += 1;
        setCatalog((current) => {
          if (!current) return current;
          const accounts = current.accounts.filter((entry) => entry.account_id !== account.account_id);
          const active_account_id = current.active_account_id === account.account_id
            ? (accounts.find((entry) => entry.source_kind === "eml" && entry.lifecycle_state === "active")?.account_id
              ?? accounts[0]?.account_id
              ?? current.active_account_id)
            : current.active_account_id;
          const pending = (current.gmail_cleanup_pending ?? []).filter((id) => id !== account.account_id);
          const cleanups = [
            receipt,
            ...(current.cleanups ?? []).filter((entry) => entry.account_id !== receipt.account_id),
          ];
          return { ...current, accounts, active_account_id, gmail_cleanup_pending: pending, cleanups };
        });
        setConfirmation(null);
        setNotice(isGmailSource
          ? `Đã xóa dữ liệu trên máy cho ${identity} (${cleanupSummary(receipt)}). Email trên Gmail không bị ảnh hưởng.`
          : `Đã xóa nguồn ${identity} (${cleanupSummary(receipt)}). Các nguồn dữ liệu khác vẫn giữ nguyên.`);
        await onSourceDeleted?.(account.account_id);
        onCatalogChanged?.();
      } catch (reason) {
        const code = mutationErrorCode(reason);
        if (code === "account_disconnect_required") {
          setConfirmation(null);
          setError("Hãy ngắt kết nối Gmail trước khi xóa dữ liệu trên máy.");
          void loadSources();
        } else if (code === "last_local_account_required") {
          setConfirmation(null);
          setError("Cần giữ lại ít nhất một nguồn thư trên máy.");
          void loadSources();
        } else if (code === "account_cleanup_pending" || code === "credential_delete_failed" || code === "vault_cleanup_failed") {
          setConfirmation(null);
          setError("Quá trình xóa dữ liệu trên máy chưa hoàn tất. Hãy thử xóa tiếp hoặc kiểm tra trạng thái.");
          await loadSources();
          onCatalogChanged?.();
        } else if (code === "account_version_conflict" || code === "account_not_found" || code === "account_scope_stale" || code === "account_data_deleted") {
          setConfirmation(null);
          setError("Tài khoản vừa thay đổi. Hãy xem trạng thái mới rồi thử lại.");
          void loadSources();
          onCatalogChanged?.();
        } else {
          setError("Chưa xóa được dữ liệu trên máy cho nguồn này. Hãy thử lại.");
        }
      }
    });
  }

  function checkCleanupStatus(account: ProfileAccount) {
    void run("change", async () => {
      try {
        const receipt = await api.accountCleanupStatus(account.account_id);
        await loadSources();
        onCatalogChanged?.();
        if (!receipt) {
          setNotice("Không tìm thấy tiến trình xóa dữ liệu cho tài khoản này.");
        } else if (receipt.status === "succeeded") {
          setNotice(`Đã hoàn tất xóa dữ liệu trên máy (${cleanupSummary(receipt)}).`);
          await onSourceDeleted?.(account.account_id);
        } else {
          setNotice(`Trạng thái xóa: ${cleanupPhaseLabel(receipt.phase)} (${cleanupSummary(receipt)}).`);
        }
      } catch {
        setError("Chưa kiểm tra được trạng thái xóa dữ liệu. Hãy thử lại.");
      }
    });
  }

  function disconnectAccount(account: ProfileAccount, retryCleanup = false) {
    void run("change", async () => {
      try {
        const result = await api.disconnectGmail(versionedAccount(account));
        const cleanupPending = result.credential_cleanup_pending === true;
        publishAccount(result, cleanupPending);
        if (!retryCleanup) focusAfterDialog.current = account.account_id;
        setConfirmation(null);
        if (cleanupPending) {
          setNotice("Gmail đã ngắt kết nối. Bạn có thể thử gỡ quyền truy cập đã lưu trên máy.");
        } else if (retryCleanup) {
          sourceHeadings.current.get(account.account_id)?.focus({ preventScroll: true });
          setNotice("Đã gỡ quyền truy cập Gmail lưu trên máy.");
        } else {
          setNotice("Đã ngắt kết nối Gmail. Bạn vẫn có thể xem dữ liệu đã lưu trên máy.");
        }
      } catch (reason) {
        accountChangeError(reason);
      }
    });
  }

  function accountChangeError(reason: unknown) {
    const code = mutationErrorCode(reason);
    if (code === "account_version_conflict" || code === "account_not_found" || code === "account_scope_stale") {
      setConfirmation(null);
      setError("Tài khoản vừa thay đổi. Hãy xem trạng thái mới rồi thử lại.");
      void loadSources();
    } else {
      setError("Chưa lưu được thay đổi cho tài khoản này. Hãy thử lại.");
    }
  }

  async function updateFreeTierRiskConsent(accept: boolean) {
    if (!api.setFreeTierRiskConsent || aiPrivacyBusy) return;
    setAiPrivacyBusy(true);
    setAiPrivacyError("");
    setNotice("");
    setError("");
    try {
      const updated = await api.setFreeTierRiskConsent({
        accept_free_tier_risk: accept,
        request_key: crypto.randomUUID(),
      });
      setAiPrivacy(updated);
      setRiskDialogOpen(false);
      setRiskChecked(false);
      setNotice(accept
        ? "Đã bật dùng Gemini Free Tier theo xác nhận chấp nhận rủi ro của bạn. Tài khoản Gmail và mọi tệp .eml giờ đều có thể trích xuất việc và hỏi Gemini."
        : "Đã tắt tùy chọn chấp nhận rủi ro và quay lại chế độ khóa an toàn cho Gemini Free Tier.");
      onAiPrivacyChanged?.();
    } catch {
      setAiPrivacyError("Chưa lưu được thiết lập quyền riêng tư AI. Hãy thử lại.");
    } finally {
      setAiPrivacyBusy(false);
    }
  }

  async function saveAccountPresets(next: number[]) {
    if (!api.setReminderPresets || !activeAccount || presetsSaving.current || blocked) return;
    const normalized = normalizeReminderPresets(next);
    const targetAccount = activeAccount;
    if (lastPresetsAccountId.current === null) {
      lastPresetsAccountId.current = targetAccount.account_id;
    }
    const epoch = presetsEpoch.current;
    presetsSaving.current = true;
    setPresetsBusy(true);
    setPresetsError("");
    setPresetsNotice("");
    setPendingPresets({ accountId: targetAccount.account_id, hours: normalized });
    try {
      const result = await api.setReminderPresets({
        task_id: null,
        lead_hours: normalized,
        expected_version: targetAccount.version,
        request_key: crypto.randomUUID(),
      });
      if (epoch !== presetsEpoch.current) return;
      const committed = normalizeReminderPresets(result.lead_hours);
      const nextVersion = typeof result.version === "number" && Number.isFinite(result.version)
        ? Math.max(targetAccount.version, result.version)
        : targetAccount.version;
      setPendingPresets(null);
      publishAccount({
        ...targetAccount,
        reminder_lead_presets: committed,
        version: nextVersion,
      });
      setPresetsNotice("Đã lưu mốc nhắc mặc định cho tài khoản.");
    } catch (reason) {
      if (epoch !== presetsEpoch.current) return;
      const code = mutationErrorCode(reason);
      setPendingPresets(null);
      setPresetsError(week4ErrorText(reason, "Chưa lưu được mốc nhắc mặc định. Hãy thử lại."));
      if (code === "account_version_conflict" || code === "version_conflict" || code === "account_not_found") {
        void loadSources();
      }
    } finally {
      if (epoch === presetsEpoch.current) {
        presetsSaving.current = false;
        setPresetsBusy(false);
      }
    }
  }

  function handleGmailShortcutsChange(checked: boolean) {
    writeGmailShortcutsEnabled(checked);
    setGmailShortcuts(checked);
    onGmailShortcutsChanged?.(checked);
  }

  const blocked = operation !== null || Boolean(waitingId);
  const completedCleanups = (catalog?.cleanups ?? []).filter((entry) => entry.status === "succeeded");
  const activeLocalCount = (catalog?.accounts ?? []).filter(
    (entry) => entry.source_kind === "eml" && entry.lifecycle_state === "active",
  ).length;
  const hasAdvancedTools = Boolean(api.migrationInspect || migrationReceipt || api.exportDiagnostics);

  return (
    <section className="mc-settings" aria-labelledby="mc-settings-sources">
      <header className="mc-settings-heading">
        <h2 id="mc-settings-sources">Nguồn dữ liệu</h2>
        <p className="mc-muted">Chọn nguồn để xem thư và công việc đã lưu riêng cho nguồn đó.</p>
      </header>

      {catalogError && (
        <div className="mc-settings-message">
          <p className="mc-form-error" role="alert">Chưa tải được danh sách nguồn.</p>
          <button type="button" className="mc-text-button" onClick={() => void loadSources()}>Tải lại</button>
        </div>
      )}
      {!catalog && !catalogError && <p className="mc-muted" role="status">Đang mở danh sách nguồn…</p>}
      {notice && <p className="mc-settings-success" role="status">{notice}</p>}
      {error && !confirmation && <p className="mc-form-error" role="alert">{error}</p>}

      {catalog && (
        <>
          {catalog.accounts.length > 0 && (
            <ul className="mc-settings-sources" aria-label="Nguồn dữ liệu đã lưu">
              {catalog.accounts.map((account) => {
                const selected = account.account_id === catalog.active_account_id;
                const isGmail = account.source_kind === "gmail";
                const connected = account.lifecycle_state === "active";
                const isDeleting = account.lifecycle_state === "deleting";
                const cachedStatus = syncStatuses[account.account_id];
                const syncStatus = isGmail && cachedStatus?.generation === account.generation ? cachedStatus : undefined;
                const syncReconnect = syncStatus?.state === "reconnect_required";
                const syncBusy = syncingAccountId === account.account_id
                  || syncStatus?.state === "queued" || syncStatus?.state === "syncing";
                const syncLine = isGmail && connected && account.sync_consent ? syncStatusDescription(syncStatus) : null;
                const needsReconnect = isGmail && !isDeleting && (!connected || reconnectRequiredId === account.account_id || syncReconnect);
                const cleanupPending = isGmail && !connected && !isDeleting && catalog.gmail_cleanup_pending?.includes(account.account_id);
                const activeCleanup = catalog.cleanups?.find((entry) => entry.account_id === account.account_id && entry.status !== "succeeded");
                const canDeleteLocal = !isGmail && connected && !isDeleting && activeLocalCount > 1;
                const consentLabel = account.sync_consent ? "Tắt đồng bộ" : "Cho phép đồng bộ";
                const Icon = isGmail ? Mail : FileText;
                const identity = accountIdentity(account);

                return (
                  <li key={account.account_id} className="mc-settings-card" data-selected={selected}>
                    <span className="mc-settings-icon" aria-hidden="true"><Icon size={18} /></span>
                    <div className="mc-settings-details">
                      <h3 tabIndex={-1} ref={(heading) => {
                        if (heading) sourceHeadings.current.set(account.account_id, heading);
                        else sourceHeadings.current.delete(account.account_id);
                      }}>{identity}</h3>
                      <p className="mc-muted">{isGmail
                        ? isDeleting ? "Đang xóa dữ liệu trên máy"
                          : connected && needsReconnect ? "Cần kết nối lại"
                          : gmailStatus(account, catalog.gmail_sync_available)
                        : isDeleting ? "Đang xóa dữ liệu trên máy"
                          : "Email nhập từ tệp .eml"}</p>
                      {selected && !isDeleting && <span className="mc-settings-current">Đang mở</span>}
                      {syncLine && <p className={syncReconnect ? "mc-form-error" : "mc-muted"}>{syncLine}</p>}
                      {isGmail && !connected && !isDeleting && <p className="mc-muted">Bạn vẫn có thể mở dữ liệu đã lưu trên máy.</p>}
                      {isDeleting && (
                        <p className="mc-muted">
                          {activeCleanup ? cleanupPhaseLabel(activeCleanup.phase) : "Nguồn này đang chờ hoàn tất xóa dữ liệu trên máy."}
                        </p>
                      )}
                      {cleanupPending && <p className="mc-muted">Quyền truy cập Gmail cũ vẫn chờ được gỡ khỏi máy.</p>}
                    </div>
                    <div className="mc-settings-actions">
                      {!selected && !isDeleting && (
                        <button type="button" className="mc-button mc-secondary" disabled={blocked}
                          aria-label={`Mở ${identity}`} onClick={() => selectSource(account)}>
                          Mở nguồn
                        </button>
                      )}
                      {isGmail && connected && account.sync_consent && !syncReconnect && catalog.gmail_sync_available && api.requestGmailSync && (
                        <button type="button" className="mc-button mc-secondary" disabled={blocked || syncBusy}
                          aria-label={`Đồng bộ ngay cho ${identity}`}
                          onClick={() => void syncGmailNow(account)}>
                          <RefreshCw size={16} aria-hidden="true" /> {syncBusy ? "Đang đồng bộ…" : "Đồng bộ ngay"}
                        </button>
                      )}
                      {isGmail && needsReconnect && (
                        <button type="button" className="mc-button mc-secondary"
                          disabled={blocked || !catalog.gmail_sign_in_available}
                          aria-label={`Kết nối lại ${identity}`} onClick={() => startConnection(account)}>
                          Kết nối lại <ArrowUpRight size={16} aria-hidden="true" />
                        </button>
                      )}
                      {cleanupPending && (
                        <button type="button" className="mc-text-button" disabled={blocked}
                          aria-label={`Thử gỡ quyền Gmail đã lưu cho ${identity}`} onClick={() => disconnectAccount(account, true)}>
                          Thử gỡ quyền đã lưu
                        </button>
                      )}
                      {canDeleteLocal && (
                        <button type="button" className="mc-text-button mc-danger-text" disabled={blocked}
                          aria-label={`Xóa nguồn ${identity}`}
                          onClick={() => setConfirmation({ kind: "delete_local", account })}>
                          <Trash2 size={16} aria-hidden="true" /> Xóa nguồn
                        </button>
                      )}
                      {isGmail && !connected && !isDeleting && (
                        <button type="button" className="mc-text-button mc-danger-text" disabled={blocked}
                          aria-label={`Xóa dữ liệu trên máy cho ${identity}`}
                          onClick={() => setConfirmation({ kind: "delete_local", account })}>
                          <Trash2 size={16} aria-hidden="true" /> Xóa dữ liệu trên máy
                        </button>
                      )}
                      {isDeleting && (
                        <>
                          <button type="button" className="mc-button mc-secondary" disabled={blocked}
                            aria-label={`Kiểm tra lại trạng thái xóa cho ${identity}`}
                            onClick={() => checkCleanupStatus(account)}>
                            <RefreshCw size={16} aria-hidden="true" /> Kiểm tra lại
                          </button>
                          <button type="button" className="mc-button mc-danger" disabled={blocked}
                            aria-label={`Thử xóa tiếp dữ liệu trên máy cho ${identity}`}
                            onClick={() => deleteLocalData(account)}>
                            <Trash2 size={16} aria-hidden="true" /> Thử xóa tiếp
                          </button>
                        </>
                      )}
                      {isGmail && connected && (
                        <>
                          {(!needsReconnect || account.sync_consent) && (
                            <button type="button" className="mc-button mc-secondary" disabled={blocked}
                              aria-label={`${consentLabel} cho ${identity}`}
                              onClick={() => setConfirmation({ kind: "consent", account, allowed: !account.sync_consent })}>
                              {consentLabel}
                            </button>
                          )}
                          <button type="button" className="mc-text-button" disabled={blocked}
                            aria-label={`Ngắt kết nối ${identity}`}
                            onClick={() => setConfirmation({ kind: "disconnect", account })}>
                            Ngắt kết nối
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <section className="mc-settings-card mc-settings-add" aria-labelledby="mc-settings-local-add">
            <span className="mc-settings-icon" aria-hidden="true"><FolderPlus size={18} /></span>
            <div className="mc-settings-details">
              <h3 id="mc-settings-local-add">Thêm nguồn thư trên máy</h3>
              <p className="mc-muted">Tạo hộp thư cục bộ riêng để nhập tệp .eml theo từng nhóm công việc hoặc dự án.</p>
              <form className="mc-settings-local-form" onSubmit={createLocal} noValidate>
                <div className="mc-field">
                  <label htmlFor="mc-local-source-name">Tên nguồn thư</label>
                  <input
                    id="mc-local-source-name"
                    type="text"
                    maxLength={80}
                    placeholder="Ví dụ: Hồ sơ dự án Q4"
                    value={localName}
                    disabled={blocked}
                    aria-invalid={Boolean(localError)}
                    onChange={(event) => {
                      setLocalName(event.target.value);
                      if (localError) setLocalError("");
                    }}
                  />
                </div>
                <button type="submit" className="mc-button mc-secondary" disabled={blocked}>
                  {operation === "local" ? "Đang thêm…" : "Thêm nguồn"}
                </button>
              </form>
              {localError && <p className="mc-form-error" role="alert">{localError}</p>}
            </div>
          </section>

          <section className="mc-settings-card mc-settings-add" aria-labelledby="mc-settings-gmail">
            <span className="mc-settings-icon" aria-hidden="true"><Mail size={18} /></span>
            <div className="mc-settings-details">
              <h3 id="mc-settings-gmail">Kết nối tài khoản Gmail</h3>
              <p className="mc-muted">Google sẽ mở trong trình duyệt để bạn cấp quyền chỉ đọc.</p>
              <p className="mc-muted">Sau khi đăng nhập, bạn sẽ chọn riêng có cho phép lưu thư về máy hay không.</p>
              {!catalog.gmail_sign_in_available && <p className="mc-muted">Bản MailCompass này chưa được thiết lập để kết nối Gmail.</p>}
            </div>
            <div className="mc-settings-actions">
              <button type="button" className="mc-button mc-primary"
                disabled={blocked || !catalog.gmail_sign_in_available} onClick={() => startConnection()}>
                {operation === "start" ? "Đang mở trình duyệt…" : "Kết nối Gmail"}
                <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </div>
          </section>

          {activeAccount && (
            <section
              className="mc-settings-card mc-settings-add"
              aria-labelledby="mc-settings-attachment-policy"
              data-testid="mc-settings-attachment-policy-card"
            >
              <span className="mc-settings-icon" aria-hidden="true"><Paperclip size={18} /></span>
              <div className="mc-settings-details">
                <div className="mc-settings-title-row">
                  <h3 id="mc-settings-attachment-policy">{attachmentPolicy.statusHeading}</h3>
                  <span className="mc-settings-status-badge">{attachmentPolicy.statusBadge}</span>
                  <Popover.Root>
                    <Popover.Trigger
                      type="button"
                      className="mc-settings-help-trigger"
                      aria-label="Giải thích chặn đồng bộ tệp đính kèm"
                      title="Giải thích chặn đồng bộ tệp đính kèm"
                    >
                      <HelpCircle size={15} aria-hidden="true" />
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        collisionPadding={12}
                        className="mc-settings-help-positioner"
                      >
                        <Popover.Popup className="mc-settings-help-popover">
                          <Popover.Title className="mc-settings-help-title">
                            Vì sao chặn tệp đính kèm nhị phân?
                          </Popover.Title>
                          <p className="mc-muted">
                            MailCompass không tự tải tệp đính kèm nhị phân khi đồng bộ để tiết kiệm băng thông và dung lượng đĩa.
                          </p>
                          <p className="mc-muted">
                            Bạn vẫn lọc được thư có đính kèm bằng <code>has:attachment</code> và <code>filename:</code>.
                          </p>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
                <p>{attachmentPolicy.blockedLine}</p>
                <p className="mc-muted">
                  Chỉ lưu siêu dữ liệu đính kèm trên máy; không tự tải hay mở tệp nhị phân.
                </p>
              </div>
            </section>
          )}

          {activeAccount && (
            <section
              className="mc-settings-card mc-settings-add"
              aria-labelledby="mc-settings-reminder-presets"
              data-testid="mc-settings-reminder-presets-card"
            >
              <span className="mc-settings-icon" aria-hidden="true"><BellRing size={18} /></span>
              <div className="mc-settings-details">
                <h3 id="mc-settings-reminder-presets">Mốc nhắc hạn mặc định</h3>
                <p className="mc-muted">
                  Áp dụng cho công việc mới có hạn của nguồn {accountIdentity(activeAccount)} (tối đa {REMINDER_PRESET_MAX_COUNT} mốc).
                </p>
                <div className="mc-settings-presets-body">
                  <ReminderLeadPresetChips
                    value={accountPresets}
                    onChange={(next) => void saveAccountPresets(next)}
                    disabled={blocked || presetsBusy || !api.setReminderPresets}
                    idPrefix="mc-settings-account-presets"
                  />
                  {presetsBusy && <p className="mc-muted" role="status">Đang lưu mốc nhắc mặc định…</p>}
                  {presetsNotice && !presetsBusy && <p className="mc-settings-success" role="status">{presetsNotice}</p>}
                  {presetsError && <p className="mc-form-error" role="alert">{presetsError}</p>}
                </div>
              </div>
            </section>
          )}

          <section
            className="mc-settings-card mc-settings-add"
            aria-labelledby="mc-settings-shortcuts"
            data-testid="mc-settings-shortcuts-card"
          >
            <span className="mc-settings-icon" aria-hidden="true"><Keyboard size={18} /></span>
            <div className="mc-settings-details">
              <h3 id="mc-settings-shortcuts">Phím tắt kiểu Gmail</h3>
              <p className="mc-muted">
                Dùng j/k, e, r, g i, / để thao tác nhanh. Nhấn ? để xem bảng phím tắt (tự tạm tắt khi đang gõ tiếng Việt).
              </p>
            </div>
            <div className="mc-settings-actions">
              <div className="mc-settings-switch-row">
                <Switch.Root
                  className="mc-settings-switch"
                  checked={gmailShortcuts}
                  onCheckedChange={handleGmailShortcutsChange}
                  aria-labelledby="mc-settings-shortcuts"
                >
                  <Switch.Thumb className="mc-settings-switch-thumb" />
                </Switch.Root>
                <span className="mc-settings-switch-state" aria-hidden="true">
                  {gmailShortcuts ? "Bật" : "Tắt"}
                </span>
              </div>
            </div>
          </section>

          {aiPrivacy && aiPrivacy.provider_configured && aiPrivacy.provider_class === "gemini_free_tier" && (
            <section className="mc-settings-card mc-settings-add" aria-labelledby="mc-settings-ai-privacy">
              <span className="mc-settings-icon" aria-hidden="true">
                {aiPrivacy.accept_free_tier_risk ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
              </span>
              <div className="mc-settings-details">
                <h3 id="mc-settings-ai-privacy">Quyền riêng tư &amp; AI Gemini (Free Tier)</h3>
                <p>
                  {aiPrivacy.accept_free_tier_risk
                    ? "Đang bật theo xác nhận chấp nhận rủi ro của bạn"
                    : "Đang khóa an toàn (Mặc định)"}
                  {aiPrivacy.provider_label ? ` · ${aiPrivacy.provider_label}` : ""}
                </p>
                {aiPrivacy.accept_free_tier_risk ? (
                  <>
                    <p className="mc-muted">
                      Cho phép trích xuất việc và hỏi Gemini Free Tier trên cả tài khoản Gmail thật và mọi tệp .eml.
                      Ứng dụng vẫn bắt buộc xem trước từng byte JSON trước khi hỏi và xác nhận thủ công trước khi tạo công việc.
                    </p>
                    {aiPrivacy.updated_at && (
                      <p className="mc-muted">
                        Cập nhật lần cuối: {formatDate(aiPrivacy.updated_at, true) ?? aiPrivacy.updated_at}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mc-muted">
                    Tài khoản Gmail thật và các tệp .eml ngoài danh sách thử nghiệm bị chặn gửi lên Gemini Free Tier
                    (Google có thể dùng nội dung gửi lên Free Tier để cải thiện dịch vụ). Nếu bạn hiểu và chấp nhận rủi ro này, bạn có thể bật cho phép dùng trên hồ sơ này.
                  </p>
                )}
                {aiPrivacyError && !riskDialogOpen && <p className="mc-form-error" role="alert">{aiPrivacyError}</p>}
              </div>
              {api.setFreeTierRiskConsent && (
                <div className="mc-settings-actions">
                  {aiPrivacy.accept_free_tier_risk ? (
                    <button
                      type="button"
                      className="mc-button mc-secondary"
                      disabled={blocked || aiPrivacyBusy}
                      onClick={() => void updateFreeTierRiskConsent(false)}
                    >
                      {aiPrivacyBusy ? "Đang cập nhật…" : "Tắt & quay lại khóa an toàn"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mc-button mc-secondary"
                      disabled={blocked || aiPrivacyBusy}
                      onClick={() => {
                        setAiPrivacyError("");
                        setRiskChecked(false);
                        setRiskDialogOpen(true);
                      }}
                    >
                      Cho phép dùng Gemini Free Tier
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {completedCleanups.length > 0 && (
            <section className="mc-settings-cleanups" aria-labelledby="mc-settings-cleanup-history">
              <h3 id="mc-settings-cleanup-history">Lịch sử xóa dữ liệu trên máy</h3>
              <ul>
                {completedCleanups.map((receipt) => {
                  const timestamp = receipt.completed_at ?? receipt.updated_at;
                  return (
                    <li key={receipt.operation_id}>
                      <span>Đã xóa dữ liệu trên máy ({cleanupSummary(receipt)})</span>
                      <time dateTime={timestamp}>{formatDate(timestamp, true) ?? timestamp}</time>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {hasAdvancedTools && (
            <details className="mc-settings-advanced">
              <summary>Công cụ nâng cao &amp; hỗ trợ kỹ thuật</summary>
              <div className="mc-settings-advanced-body">
                {(api.migrationInspect || migrationReceipt) && (
                  <section className="mc-settings-card mc-settings-add" aria-labelledby="mc-settings-migration">
                    <span className="mc-settings-icon" aria-hidden="true"><FileText size={18} /></span>
                    <div className="mc-settings-details">
                      <h3 id="mc-settings-migration">Chuyển dữ liệu từ MailCompass V1</h3>
                      <p className="mc-muted">
                        Kiểm tra thư và công việc trong hồ sơ V1 trước khi chuyển sang một hồ sơ V2 trống. Hồ sơ V1 gốc vẫn dùng được. Tài khoản Gmail cần đăng nhập và cấp quyền đồng bộ lại.
                      </p>
                      {migrationReceipt && (
                        <p className="mc-source-note" data-testid="mc-migration-receipt">
                          <ShieldCheck size={17} aria-hidden="true" />
                          <span>
                            Đã chuyển từ MailCompass V1 (schema v{migrationReceipt.source_schema_version} · {migrationReceipt.verified_original_bytes} byte tệp gốc · {formatDate(migrationReceipt.adopted_at, true) ?? migrationReceipt.adopted_at}).
                          </span>
                        </p>
                      )}
                      {migrationPreflight && (
                        <div className="mc-settings-migration-summary" data-testid="mc-migration-preflight">
                          <p>
                            Hồ sơ V1 schema v{migrationPreflight.source_schema_version} · {migrationPreflight.checked_originals} tệp .eml gốc · {migrationPreflight.checked_canonical_bodies} nội dung thư đã đối chiếu · {migrationPreflight.sufficient_space ? "Đủ dung lượng trống" : "Thiếu dung lượng trống"}
                          </p>
                        </div>
                      )}
                      {migrationReport && (
                        <div className="mc-settings-migration-summary" data-testid="mc-migration-stage-report">
                          <p>
                            Bản dựng thử: {migrationReport.verified_original_bytes} byte tệp gốc đã xác minh
                            {migrationReport.stage_directory ? ` (${migrationReport.stage_directory})` : ""}.
                          </p>
                          {!migrationReport.adoption_ready && (
                            <p className="mc-form-error" role="alert">
                              Bản sao chưa đủ điều kiện để chuyển. Hãy kiểm tra hồ sơ V1 và hoàn tất các thao tác xóa dữ liệu đang chờ, rồi thử lại.
                            </p>
                          )}
                        </div>
                      )}
                      {migrationError && <p className="mc-form-error" role="alert">{migrationError}</p>}
                    </div>
                    {api.migrationInspect && (
                      <div className="mc-settings-actions">
                        <button
                          type="button"
                          className="mc-button mc-secondary"
                          disabled={blocked || migrationBusy !== null}
                          onClick={() => void inspectV1Profile(false)}
                        >
                          {migrationBusy === "inspect" ? "Đang kiểm tra…" : "Chọn thư mục hồ sơ V1"}
                        </button>
                        {migrationPreflight && migrationPreflight.sufficient_space && api.migrationStage && (
                          <button
                            type="button"
                            className="mc-button mc-secondary"
                            disabled={blocked || migrationBusy !== null}
                            onClick={() => void stageV1Profile()}
                          >
                            {migrationBusy === "stage" ? "Đang dựng bản thử…" : "Dựng bản thử nghiệm"}
                          </button>
                        )}
                        {migrationReport?.stage_directory
                          && migrationReport.adoption_ready
                          && api.migrationAdopt && (
                            <button
                              type="button"
                              className="mc-button mc-primary"
                              disabled={blocked || migrationBusy !== null}
                              onClick={() => void adoptV1Profile()}
                            >
                              {migrationBusy === "adopt" ? "Đang kích hoạt…" : "Kích hoạt dữ liệu V1"}
                            </button>
                          )}
                      </div>
                    )}
                  </section>
                )}

                {api.exportDiagnostics && (
                  <section className="mc-settings-card mc-settings-add" aria-labelledby="mc-settings-diagnostics">
                    <span className="mc-settings-icon" aria-hidden="true"><ShieldCheck size={18} /></span>
                    <div className="mc-settings-details">
                      <h3 id="mc-settings-diagnostics">Chẩn đoán hệ thống (đã ẩn thông tin riêng tư)</h3>
                      <p className="mc-muted">
                        Báo cáo chỉ gồm phiên bản cơ sở dữ liệu, số lượng bản ghi và mã lỗi hệ thống. Không bao gồm địa chỉ email, tiêu đề, người gửi, nội dung thư, công việc, đường dẫn tệp hay khóa xác thực.
                      </p>
                      {diagnostics && (
                        <div className="mc-settings-diagnostics-output" data-testid="mc-diagnostics-report">
                          <p>
                            Schema v{diagnostics.schema_version} · {diagnostics.counts.accounts} nguồn · {diagnostics.counts.messages} thư · {diagnostics.counts.tasks} công việc · {diagnostics.counts.analysis_runs} lượt phân tích
                          </p>
                          <pre className="mc-diagnostics-pre">{JSON.stringify(diagnostics, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                    <div className="mc-settings-actions">
                      <button
                        type="button"
                        className="mc-button mc-secondary"
                        disabled={blocked || diagnosticsBusy}
                        onClick={() => void runDiagnosticsExport()}
                      >
                        {diagnosticsBusy ? "Đang tổng hợp…" : "Tạo báo cáo chẩn đoán"}
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </details>
          )}
        </>
      )}

      {waitingId && (
        <div className="mc-settings-message">
          <p role="status">Đang chờ Google xác nhận trong trình duyệt.</p>
          <button type="button" className="mc-text-button" disabled={cancelInProgress} onClick={cancelConnection}>
            {cancelInProgress ? "Đang hủy…" : "Hủy đăng nhập"}
          </button>
          {pollError && <p className="mc-muted">Tạm thời chưa kiểm tra được trạng thái. MailCompass sẽ tự kiểm tra lại.</p>}
        </div>
      )}

      {confirmation && active && (
        <Dialog.Root open onOpenChange={(open) => {
          if (!open && !changing.current) {
            setConfirmation(null);
            setError("");
          }
        }}>
          <Dialog.Portal>
            <Dialog.Backdrop className="mc-dialog-backdrop" />
            <Dialog.Popup className="mc-dialog mc-settings-dialog" initialFocus={cancelButton}>
              <Dialog.Title className="mc-dialog-title">
                {confirmation.kind === "delete_local"
                  ? confirmation.account.source_kind === "eml"
                    ? "Xóa nguồn thư trên máy?"
                    : "Xóa dữ liệu trên máy?"
                  : confirmation.kind === "disconnect" ? "Ngắt kết nối Gmail?"
                  : confirmation.allowed ? "Cho phép đồng bộ Gmail?" : "Tắt đồng bộ Gmail?"}
              </Dialog.Title>
              <Dialog.Description className="mc-muted">
                {confirmation.kind === "delete_local"
                  ? confirmation.account.source_kind === "eml"
                    ? `MailCompass sẽ xóa vĩnh viễn nguồn ${accountIdentity(confirmation.account)} cùng toàn bộ email đã nhập, công việc, nhãn, quy tắc và lịch thuộc nguồn này.`
                    : `MailCompass sẽ xóa vĩnh viễn toàn bộ email, công việc, nhãn, quy tắc, lịch và quyền truy cập đã lưu trên máy cho ${accountIdentity(confirmation.account)}.`
                  : confirmation.kind === "disconnect"
                    ? `MailCompass sẽ dừng kết nối với ${accountIdentity(confirmation.account)}. Thư và công việc đã lưu vẫn có trên máy. Để thu hồi quyền đã cấp cho MailCompass, mở mục kết nối với ứng dụng bên thứ ba trong Tài khoản Google.`
                    : confirmation.allowed
                      ? `Bạn cho phép MailCompass lưu thư từ hộp thư đến của ${accountIdentity(confirmation.account)} về máy. MailCompass chỉ đọc Gmail.`
                      : `MailCompass sẽ ngừng lấy thư mới từ ${accountIdentity(confirmation.account)}. Thư đã lưu vẫn có trên máy.`}
              </Dialog.Description>
              {confirmation.kind === "delete_local" && (
                <p className="mc-source-note">
                  <ShieldCheck size={17} aria-hidden="true" />
                  {confirmation.account.source_kind === "eml"
                    ? " Các tệp .eml gốc trong thư mục của bạn và các nguồn dữ liệu khác trong MailCompass không bị ảnh hưởng."
                    : " Email trên Gmail của bạn không bị ảnh hưởng. Các nguồn dữ liệu khác trên máy vẫn giữ nguyên."}
                </p>
              )}
              {confirmation.kind === "consent" && confirmation.allowed && !catalog?.gmail_sync_available && (
                <p className="mc-source-note"><ShieldCheck size={17} aria-hidden="true" /> Bản này lưu lựa chọn của bạn. Thư sẽ chỉ được tải khi tính năng đồng bộ sẵn sàng.</p>
              )}
              {error && <p className="mc-form-error" role="alert">{error}</p>}
              <div className="mc-dialog-footer">
                <Dialog.Close ref={cancelButton} type="button" className="mc-button mc-quiet" disabled={operation !== null}>
                  Quay lại
                </Dialog.Close>
                <button type="button" className={confirmation.kind === "delete_local" ? "mc-button mc-danger" : "mc-button mc-primary"}
                  disabled={operation !== null} onClick={() => confirmAccountChange(confirmation)}>
                  {confirmation.kind === "delete_local"
                    ? confirmation.account.source_kind === "eml" ? "Xóa nguồn" : "Xóa dữ liệu trên máy"
                    : confirmation.kind === "disconnect" ? "Ngắt kết nối"
                    : confirmation.allowed ? "Cho phép" : "Tắt đồng bộ"}
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {riskDialogOpen && active && (
        <Dialog.Root open onOpenChange={(open) => {
          if (!open && !aiPrivacyBusy) {
            setRiskDialogOpen(false);
            setRiskChecked(false);
            setAiPrivacyError("");
          }
        }}>
          <Dialog.Portal>
            <Dialog.Backdrop className="mc-dialog-backdrop" />
            <Dialog.Popup className="mc-dialog mc-settings-dialog" initialFocus={riskCancelButton}>
              <Dialog.Title className="mc-dialog-title">
                Chấp nhận rủi ro gửi dữ liệu lên Gemini Free Tier?
              </Dialog.Title>
              <Dialog.Description className="mc-muted">
                Với Gemini API bản miễn phí (Free Tier), Google có thể lưu trữ và sử dụng nội dung gửi lên để cải thiện dịch vụ hoặc cho người rà soát kiểm tra.
              </Dialog.Description>
              <p className="mc-source-note">
                <ShieldAlert size={17} aria-hidden="true" />
                <span>
                  Khi bật tùy chọn này, bạn cho phép gửi nội dung email (kể cả Gmail thật và mọi tệp .eml) lên Gemini Free Tier khi chủ động bấm Tìm việc trong thư hoặc xác nhận Xem trước hỏi Gemini. Mọi gợi ý công việc vẫn cần bạn duyệt thủ công, và bạn có thể tắt lại bất cứ lúc nào.
                </span>
              </p>
              <label className="mc-settings-risk-check">
                <input
                  type="checkbox"
                  checked={riskChecked}
                  disabled={aiPrivacyBusy}
                  onChange={(event) => setRiskChecked(event.target.checked)}
                />
                <span>Tôi đã hiểu rủi ro của Gemini Free Tier và chấp nhận bật cho hồ sơ này.</span>
              </label>
              {aiPrivacyError && <p className="mc-form-error" role="alert">{aiPrivacyError}</p>}
              <div className="mc-dialog-footer">
                <Dialog.Close ref={riskCancelButton} type="button" className="mc-button mc-quiet" disabled={aiPrivacyBusy}>
                  Quay lại
                </Dialog.Close>
                <button
                  type="button"
                  className="mc-button mc-primary"
                  disabled={!riskChecked || aiPrivacyBusy}
                  onClick={() => void updateFreeTierRiskConsent(true)}
                >
                  {aiPrivacyBusy ? "Đang lưu…" : "Tôi chấp nhận rủi ro & Bật"}
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </section>
  );
}
