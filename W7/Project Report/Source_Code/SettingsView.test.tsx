import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AccountCleanupReceipt, DesktopApi, GmailConnectionAttempt, GmailSyncEvent, GmailSyncStatus,
  MigrationAdoptionReceipt, MigrationPreflight, MigrationStagingReport, ProfileAccount,
  RedactedDiagnosticsReport, SetReminderPresetsInput, SetReminderPresetsResult, SourceCatalog,
} from "./api";
import { SettingsView } from "./SettingsView";
import { GMAIL_SHORTCUTS_STORAGE_KEY } from "./useGmailShortcuts";

const local: ProfileAccount = {
  account_id: "local", source_kind: "eml", display_name: "Thư trên máy", email: null,
  lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 1,
};

const gmail: ProfileAccount = {
  account_id: "gmail", source_kind: "gmail", display_name: "reader@example.test", email: "reader@example.test",
  lifecycle_state: "active", sync_consent: false, generation: 2, data_version: 0, version: 3,
};

const cleanupReceipt: AccountCleanupReceipt = {
  account_id: gmail.account_id,
  operation_id: "cleanup-1",
  status: "succeeded",
  phase: "completed",
  fence_generation: gmail.generation + 2,
  db_counts: { mail_item: 2, task: 1 },
  file_counts: { raw_files: 2, staging_files: 0 },
  last_error_code: null,
  updated_at: "2026-11-20T10:00:00Z",
  completed_at: "2026-11-20T10:00:00Z",
};

const waiting: GmailConnectionAttempt = { id: "attempt", status: "waiting", account: null, error_code: null };
const connected: GmailConnectionAttempt = { ...waiting, status: "connected", account: gmail };
const cancelled: GmailConnectionAttempt = { ...waiting, status: "cancelled" };

function fixture(sources: Partial<SourceCatalog> = {}) {
  const catalog: SourceCatalog = {
    accounts: [local], active_account_id: local.account_id,
    gmail_sign_in_available: true, gmail_sync_available: false, cleanups: [], ...sources,
  };
  const listSources = vi.fn<DesktopApi["listSources"]>().mockResolvedValue(catalog);
  const createLocalSource = vi.fn<DesktopApi["createLocalSource"]>().mockImplementation(async (input) => ({
    account_id: "local-custom",
    source_kind: "eml",
    display_name: input.display_name,
    email: null,
    lifecycle_state: "active",
    sync_consent: false,
    generation: 1,
    data_version: 0,
    version: 1,
  }));
  const accountCleanupStatus = vi.fn<DesktopApi["accountCleanupStatus"]>().mockResolvedValue(null);
  const deleteLocalAccount = vi.fn<DesktopApi["deleteLocalAccount"]>().mockResolvedValue(cleanupReceipt);
  const startGmailConnection = vi.fn<DesktopApi["startGmailConnection"]>().mockResolvedValue(waiting);
  const gmailConnectionStatus = vi.fn<DesktopApi["gmailConnectionStatus"]>().mockResolvedValue(connected);
  const cancelGmailConnection = vi.fn<DesktopApi["cancelGmailConnection"]>().mockResolvedValue(cancelled);
  const setGmailSyncConsent = vi.fn<DesktopApi["setGmailSyncConsent"]>().mockImplementation(async (input) => ({
    ...gmail, generation: input.expected_generation + 1, version: input.expected_version + 1,
    sync_consent: input.allowed,
  }));
  const disconnectGmail = vi.fn<DesktopApi["disconnectGmail"]>().mockResolvedValue({
    ...gmail, lifecycle_state: "disconnected", generation: gmail.generation + 1, version: gmail.version + 1,
  });
  const idleSync: GmailSyncStatus = {
    account_id: gmail.account_id, generation: gmail.generation, data_version: gmail.data_version,
    state: "idle", phase: null,
    last_synced_at: null, retry_at: null, discovered: 0, imported: 0, removed: 0, skipped: 0,
    has_more: false, error_code: null, sync_available: Boolean(catalog.gmail_sync_available),
  };
  let syncListener: ((event: GmailSyncEvent) => void) | null = null;
  const gmailSyncStatus = vi.fn<DesktopApi["gmailSyncStatus"]>().mockResolvedValue(idleSync);
  const requestGmailSync = vi.fn<DesktopApi["requestGmailSync"]>().mockResolvedValue({ ...idleSync, state: "queued" });
  const onGmailSyncUpdated = vi.fn<NonNullable<DesktopApi["onGmailSyncUpdated"]>>(async (cb) => {
    syncListener = cb;
    return () => { syncListener = null; };
  });
  const api = {
    listSources, createLocalSource, accountCleanupStatus, deleteLocalAccount,
    startGmailConnection, gmailConnectionStatus, cancelGmailConnection, setGmailSyncConsent, disconnectGmail,
    gmailSyncStatus, requestGmailSync, onGmailSyncUpdated,
  };
  const onSelect = vi.fn();
  const onSourceChanged = vi.fn();
  const onSourceDeleted = vi.fn();
  const onCatalogChanged = vi.fn();
  const user = userEvent.setup();
  return {
    api, listSources, createLocalSource, accountCleanupStatus, deleteLocalAccount,
    startGmailConnection, gmailConnectionStatus, cancelGmailConnection, setGmailSyncConsent,
    disconnectGmail, gmailSyncStatus, requestGmailSync, onGmailSyncUpdated,
    emitSync: (event: GmailSyncEvent) => syncListener?.(event),
    onSelect, onSourceChanged, onSourceDeleted, onCatalogChanged, user,
  };
}

function openSettings(props: ReturnType<typeof fixture>, active = true) {
  return (
    <SettingsView
      api={props.api}
      active={active}
      onSelect={props.onSelect}
      onSourceChanged={props.onSourceChanged}
      onSourceDeleted={props.onSourceDeleted}
      onCatalogChanged={props.onCatalogChanged}
    />
  );
}

describe("Tài khoản Gmail", () => {
  it("separates Google authorization, sync consent, and source selection", async () => {
    const props = fixture();
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Kết nối Gmail" }));
    expect(props.startGmailConnection).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Đang chờ Google xác nhận trong trình duyệt.")).toBeInTheDocument();
    const authorize = await screen.findByRole("button", { name: "Cho phép đồng bộ cho reader@example.test" });
    expect(props.gmailConnectionStatus).toHaveBeenCalledWith(waiting.id);
    expect(screen.getByText("Đã kết nối · Chưa cho phép đồng bộ")).toBeInTheDocument();
    expect(props.setGmailSyncConsent).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();

    await props.user.click(authorize);
    const dialog = screen.getByRole("dialog", { name: "Cho phép đồng bộ Gmail?" });
    expect(dialog).toHaveTextContent(gmail.email ?? "");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Quay lại" })).toHaveFocus());
    await props.user.click(within(dialog).getByRole("button", { name: "Cho phép" }));
    expect(props.setGmailSyncConsent).toHaveBeenCalledExactlyOnceWith({
      account_id: gmail.account_id, allowed: true, expected_generation: gmail.generation, expected_version: gmail.version,
    });
    expect(await screen.findByText("Đã cho phép · Chưa đồng bộ")).toBeInTheDocument();
    expect(props.onSourceChanged).toHaveBeenLastCalledWith(expect.objectContaining({ sync_consent: true, generation: gmail.generation + 1 }));
    expect(props.onSelect).not.toHaveBeenCalled();

    await props.user.click(screen.getByRole("button", { name: "Mở reader@example.test" }));
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ account_id: gmail.account_id, sync_consent: true }));
  });

  it("ignores a late status response after the user cancels", async () => {
    const props = fixture();
    let resolveStatus!: (status: GmailConnectionAttempt) => void;
    props.gmailConnectionStatus.mockReturnValueOnce(new Promise((resolve) => { resolveStatus = resolve; }));
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Kết nối Gmail" }));
    await waitFor(() => expect(props.gmailConnectionStatus).toHaveBeenCalledTimes(1));
    await props.user.click(screen.getByRole("button", { name: "Hủy đăng nhập" }));
    expect(await screen.findByText("Đã hủy đăng nhập Gmail.")).toBeInTheDocument();
    expect(props.cancelGmailConnection).toHaveBeenCalledExactlyOnceWith(waiting.id);

    await act(async () => { resolveStatus(connected); });
    expect(screen.queryByText(gmail.display_name)).not.toBeInTheDocument();
    expect(props.onSourceChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Kết nối Gmail" })).toBeEnabled();
  });

  it("resumes a sign-in already waiting in the native source catalog", async () => {
    const props = fixture({ gmail_attempt: waiting });
    render(openSettings(props));

    expect(await screen.findByRole("button", { name: "Hủy đăng nhập" })).toBeEnabled();
    expect(await screen.findByRole("heading", { name: gmail.display_name }, { timeout: 2000 })).toBeInTheDocument();
    expect(props.gmailConnectionStatus).toHaveBeenCalledWith(waiting.id);
    expect(props.startGmailConnection).not.toHaveBeenCalled();
  });

  it("targets the requested account on reconnect and preserves the source after disconnect", async () => {
    const disconnected: ProfileAccount = { ...gmail, lifecycle_state: "disconnected" };
    const props = fixture({ accounts: [local, disconnected] });
    props.startGmailConnection.mockResolvedValueOnce(connected);
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Kết nối lại reader@example.test" }));
    expect(props.startGmailConnection).toHaveBeenCalledExactlyOnceWith({ account_id: gmail.account_id, expected_version: gmail.version });
    expect(await screen.findByText("Đã kết nối · Chưa cho phép đồng bộ")).toBeInTheDocument();
    await props.user.click(screen.getByRole("button", { name: "Ngắt kết nối reader@example.test" }));
    const dialog = screen.getByRole("dialog", { name: "Ngắt kết nối Gmail?" });
    expect(dialog).toHaveTextContent(/Thư và công việc đã lưu vẫn có trên máy/);
    expect(dialog).toHaveTextContent(/thu hồi quyền đã cấp cho MailCompass.*Tài khoản Google/);
    await props.user.click(within(dialog).getByRole("button", { name: "Ngắt kết nối" }));
    expect(props.disconnectGmail).toHaveBeenCalledExactlyOnceWith({
      account_id: gmail.account_id, expected_generation: gmail.generation, expected_version: gmail.version,
    });
    expect(await screen.findByText("Đã ngắt kết nối")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "reader@example.test" })).toHaveFocus());
    await props.user.click(screen.getByRole("button", { name: "Mở reader@example.test" }));
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ lifecycle_state: "disconnected" }));
    expect(screen.getByRole("button", { name: "Xóa dữ liệu trên máy cho reader@example.test" })).toBeEnabled();
  });

  it("leaves local sources available when Google sign-in is unconfigured", async () => {
    const props = fixture({ gmail_sign_in_available: false });
    render(openSettings(props));

    expect(await screen.findByText("Thư trên máy")).toBeInTheDocument();
    expect(screen.getByText("Đang mở")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kết nối Gmail" })).toBeDisabled();
    expect(screen.getByText("Bản MailCompass này chưa được thiết lập để kết nối Gmail.")).toBeInTheDocument();
    expect(props.startGmailConnection).not.toHaveBeenCalled();
  });

  it("retries removal of a saved credential with the committed disconnected account version", async () => {
    const props = fixture({ accounts: [local, gmail] });
    const disconnected: ProfileAccount = {
      ...gmail, lifecycle_state: "disconnected", version: gmail.version + 1, generation: gmail.generation + 1,
    };
    props.disconnectGmail
      .mockResolvedValueOnce({ ...disconnected, credential_cleanup_pending: true })
      .mockResolvedValueOnce(disconnected);
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Ngắt kết nối reader@example.test" }));
    const dialog = screen.getByRole("dialog", { name: "Ngắt kết nối Gmail?" });
    await props.user.click(within(dialog).getByRole("button", { name: "Ngắt kết nối" }));
    expect(await screen.findByText("Đã ngắt kết nối")).toBeInTheDocument();
    expect(props.onSourceChanged).toHaveBeenCalledWith(expect.objectContaining(disconnected));

    const cleanup = await screen.findByRole("button", { name: "Thử gỡ quyền Gmail đã lưu cho reader@example.test" });
    await props.user.click(cleanup);
    expect(props.disconnectGmail).toHaveBeenNthCalledWith(2, {
      account_id: gmail.account_id, expected_generation: disconnected.generation, expected_version: disconnected.version,
    });
    expect(await screen.findByText("Đã gỡ quyền truy cập Gmail lưu trên máy.")).toBeInTheDocument();
    expect(cleanup).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở reader@example.test" })).toBeEnabled();
  });

  it("offers recovery for a connected account if its local credential is missing", async () => {
    const props = fixture({ accounts: [local, gmail] });
    props.setGmailSyncConsent.mockRejectedValueOnce({ code: "credential_reconnect_required" });
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Cho phép đồng bộ cho reader@example.test" }));
    const dialog = screen.getByRole("dialog", { name: "Cho phép đồng bộ Gmail?" });
    await props.user.click(within(dialog).getByRole("button", { name: "Cho phép" }));

    expect(await screen.findByRole("button", { name: "Kết nối lại reader@example.test" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Hãy kết nối lại Gmail trước khi cho phép đồng bộ.");
    expect(screen.queryByRole("button", { name: "Cho phép đồng bộ cho reader@example.test" })).not.toBeInTheDocument();
    expect(props.onSourceChanged).not.toHaveBeenCalled();
  });

  it("redacts provider diagnostics and leaves Gmail sign-in available to retry", async () => {
    const props = fixture();
    props.startGmailConnection.mockRejectedValueOnce({ code: "oauth_denied", message: "provider detail must stay private" });
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Kết nối Gmail" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bạn chưa cấp quyền đọc Gmail.");
    expect(screen.queryByText(/provider detail/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kết nối Gmail" })).toBeEnabled();
  });

  it("maps backend Gmail identity mismatch and duplicate account error codes accurately", async () => {
    const props = fixture();
    props.startGmailConnection
      .mockResolvedValueOnce({ id: "a1", status: "failed", account: null, error_code: "gmail_identity_mismatch" })
      .mockResolvedValueOnce({ id: "a2", status: "failed", account: null, error_code: "gmail_account_exists" });
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Kết nối Gmail" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("khác với tài khoản cần kết nối lại");

    await props.user.click(screen.getByRole("button", { name: "Kết nối Gmail" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hộp thư Gmail này đã có trong danh sách");
  });

  it("creates an isolated local .eml source and reuses request_key on retry", async () => {
    const props = fixture();
    props.createLocalSource
      .mockRejectedValueOnce({ code: "io_error" })
      .mockResolvedValueOnce({
        account_id: "local-q4", source_kind: "eml", display_name: "Hồ sơ Q4", email: null,
        lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 1,
      });
    render(openSettings(props));

    const submit = await screen.findByRole("button", { name: "Thêm nguồn" });
    await props.user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent("Hãy nhập tên nguồn thư.");
    expect(props.createLocalSource).not.toHaveBeenCalled();

    await props.user.type(screen.getByLabelText("Tên nguồn thư"), "  Hồ sơ Q4  ");
    await props.user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thêm được nguồn thư trên máy");
    await props.user.click(submit);

    expect(await screen.findByRole("heading", { name: "Hồ sơ Q4" })).toBeInTheDocument();
    expect(props.createLocalSource).toHaveBeenCalledTimes(2);
    expect(props.createLocalSource.mock.calls[0]?.[0]).toEqual(props.createLocalSource.mock.calls[1]?.[0]);
    expect(props.createLocalSource.mock.calls[0]?.[0].display_name).toBe("Hồ sơ Q4");
    expect(props.onCatalogChanged).toHaveBeenCalled();
  });

  it("allows deleting an extra local .eml source while protecting the last local source", async () => {
    const extraLocal: ProfileAccount = {
      account_id: "local-extra", source_kind: "eml", display_name: "Hồ sơ tạm", email: null,
      lifecycle_state: "active", sync_consent: false, generation: 1, data_version: 0, version: 1,
    };
    const localReceipt: AccountCleanupReceipt = {
      ...cleanupReceipt,
      account_id: extraLocal.account_id,
      operation_id: "cleanup-local-1",
      db_counts: { messages: 1, tasks: 1 },
      file_counts: { raw_files: 1, staging_files: 0 },
    };
    const props = fixture({ accounts: [local, extraLocal] });
    props.deleteLocalAccount.mockResolvedValueOnce(localReceipt);
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Xóa nguồn Hồ sơ tạm" }));
    const dialog = screen.getByRole("dialog", { name: "Xóa nguồn thư trên máy?" });
    expect(dialog).toHaveTextContent(/tệp \.eml gốc trong thư mục của bạn/);
    await props.user.click(within(dialog).getByRole("button", { name: "Xóa nguồn" }));

    expect(props.deleteLocalAccount).toHaveBeenCalledExactlyOnceWith({
      account_id: extraLocal.account_id,
      expected_generation: extraLocal.generation,
      expected_version: extraLocal.version,
      request_key: `delete-local-${extraLocal.account_id}`,
    });
    expect(await screen.findByText(/Đã xóa nguồn Hồ sơ tạm \(1 tệp, 2 bản ghi\)/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hồ sơ tạm" })).not.toBeInTheDocument();
    // With only one local source left, delete is no longer offered on the sole remaining local source.
    expect(screen.queryByRole("button", { name: "Xóa nguồn Thư trên máy" })).not.toBeInTheDocument();
    expect(props.onSourceDeleted).toHaveBeenCalledExactlyOnceWith(extraLocal.account_id);
  });

  it("deletes local data for a disconnected Gmail account with confirmation and receipt", async () => {
    const disconnected: ProfileAccount = { ...gmail, lifecycle_state: "disconnected" };
    const props = fixture({ accounts: [local, disconnected] });
    render(openSettings(props));

    await props.user.click(await screen.findByRole("button", { name: "Xóa dữ liệu trên máy cho reader@example.test" }));
    const dialog = screen.getByRole("dialog", { name: "Xóa dữ liệu trên máy?" });
    expect(dialog).toHaveTextContent(/Email trên Gmail của bạn không bị ảnh hưởng/);
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Quay lại" })).toHaveFocus());
    await props.user.click(within(dialog).getByRole("button", { name: "Xóa dữ liệu trên máy" }));

    expect(props.deleteLocalAccount).toHaveBeenCalledExactlyOnceWith({
      account_id: gmail.account_id,
      expected_generation: gmail.generation,
      expected_version: gmail.version,
      request_key: `delete-local-${gmail.account_id}`,
    });
    expect(await screen.findByText(/Đã xóa dữ liệu trên máy cho reader@example.test \(2 tệp, 3 bản ghi\)/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "reader@example.test" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lịch sử xóa dữ liệu trên máy" })).toBeInTheDocument();
    expect(props.onSourceDeleted).toHaveBeenCalledExactlyOnceWith(gmail.account_id);
  });

  it("fences a deleting Gmail account and lets the user inspect status or resume cleanup", async () => {
    const deleting: ProfileAccount = { ...gmail, lifecycle_state: "deleting", generation: 3, version: 4 };
    const partialReceipt: AccountCleanupReceipt = {
      ...cleanupReceipt,
      status: "failed",
      phase: "tokens_removed",
      db_counts: {},
      file_counts: { raw_files: 0, staging_files: 0 },
      last_error_code: "vault_cleanup_failed",
      completed_at: null,
    };
    const props = fixture({ accounts: [local, deleting], cleanups: [partialReceipt] });
    props.accountCleanupStatus.mockResolvedValueOnce(partialReceipt);
    render(openSettings(props));

    expect(await screen.findByText("Đang xóa dữ liệu trên máy")).toBeInTheDocument();
    expect(screen.getByText("Đang xóa tệp email trên máy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở reader@example.test" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kết nối lại reader@example.test" })).not.toBeInTheDocument();

    await props.user.click(screen.getByRole("button", { name: "Kiểm tra lại trạng thái xóa cho reader@example.test" }));
    expect(props.accountCleanupStatus).toHaveBeenCalledExactlyOnceWith(deleting.account_id);
    expect(await screen.findByText(/Trạng thái xóa: Đang xóa tệp email trên máy/)).toBeInTheDocument();

    await props.user.click(screen.getByRole("button", { name: "Thử xóa tiếp dữ liệu trên máy cho reader@example.test" }));
    expect(props.deleteLocalAccount).toHaveBeenCalledExactlyOnceWith({
      account_id: deleting.account_id,
      expected_generation: deleting.generation,
      expected_version: deleting.version,
      request_key: `delete-local-${deleting.account_id}`,
    });
    expect(await screen.findByText(/Đã xóa dữ liệu trên máy cho reader@example.test/)).toBeInTheDocument();
    expect(props.onSourceDeleted).toHaveBeenCalledExactlyOnceWith(deleting.account_id);
  });

  it("keeps the completed Gmail status when the manual request reply is delayed", async () => {
    const consented: ProfileAccount = { ...gmail, sync_consent: true };
    const props = fixture({ accounts: [local, consented], gmail_sync_available: true });
    const finished: GmailSyncStatus = {
      account_id: consented.account_id,
      generation: consented.generation,
      data_version: 0,
      state: "idle",
      phase: "history",
      last_synced_at: "2026-11-20T10:15:00Z",
      retry_at: null,
      discovered: 2,
      imported: 2,
      removed: 0,
      skipped: 0,
      has_more: false,
      error_code: null,
      sync_available: true,
    };
    let finishRequest!: (status: GmailSyncStatus) => void;
    props.requestGmailSync.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));
    render(openSettings(props));
    const button = await screen.findByRole("button", { name: "Đồng bộ ngay cho reader@example.test" });
    await props.user.click(button);

    await act(async () => {
      props.emitSync({ account_id: consented.account_id, changed: true, status: finished });
    });
    await act(async () => {
      finishRequest({ ...finished, state: "queued", last_synced_at: null, discovered: 0, imported: 0 });
    });

    expect(button).toBeEnabled();
    expect(screen.getByText(/Đồng bộ gần nhất:.*2 thư cập nhật/)).toBeVisible();
  });

  it("triggers manual Gmail sync and updates status live from sync events", async () => {
    const consented: ProfileAccount = { ...gmail, sync_consent: true };
    const props = fixture({ accounts: [local, consented], gmail_sync_available: true });
    render(openSettings(props));

    const syncButton = await screen.findByRole("button", { name: "Đồng bộ ngay cho reader@example.test" });
    await props.user.click(syncButton);
    expect(props.requestGmailSync).toHaveBeenCalledExactlyOnceWith({
      account_id: consented.account_id,
      expected_generation: consented.generation,
    });
    expect(await screen.findByText("Đang đồng bộ thư mới từ Gmail…")).toBeVisible();

    await act(async () => {
      props.emitSync({
        account_id: consented.account_id,
        changed: true,
        status: {
          account_id: consented.account_id,
          generation: consented.generation,
          data_version: 0,
          state: "idle",
          phase: "history",
          last_synced_at: "2026-11-20T10:15:00Z",
          retry_at: null,
          discovered: 3,
          imported: 2,
          removed: 0,
          skipped: 0,
          has_more: false,
          error_code: null,
          sync_available: true,
        },
      });
    });
    expect(await screen.findByText(/Đồng bộ gần nhất:.*2 thư cập nhật/)).toBeVisible();

    await act(async () => {
      props.emitSync({
        account_id: consented.account_id,
        changed: false,
        status: {
          account_id: consented.account_id,
          generation: consented.generation,
          data_version: 0,
          state: "reconnect_required",
          phase: "history",
          last_synced_at: "2026-11-20T10:15:00Z",
          retry_at: null,
          discovered: 0,
          imported: 0,
          removed: 0,
          skipped: 0,
          has_more: false,
          error_code: "provider_revoked",
          sync_available: true,
        },
      });
    });
    expect(await screen.findByRole("button", { name: "Kết nối lại reader@example.test" })).toBeEnabled();
  });

  it("inspects, stages, and adopts a V1 profile and exports redacted diagnostics", async () => {
    const preflight: MigrationPreflight = {
      source_schema_version: 14,
      table_counts: [
        { name: "accounts", rows: 2 },
        { name: "messages", rows: 12 },
        { name: "tasks", rows: 5 },
      ],
      checked_canonical_bodies: 12,
      bodies_without_saved_digest: 0,
      checked_originals: 12,
      messages_without_originals: 0,
      database_bytes: 65536,
      original_bytes: 24576,
      estimated_required_bytes: 180224,
      available_target_bytes: 10485760,
      sufficient_space: true,
    };
    const stageReport: MigrationStagingReport = {
      preflight,
      stage_directory: "migration-rehearsal-00000000-0000-0000-0000-000000000099",
      staged_counts: [
        { name: "accounts", rows: 2 },
        { name: "messages", rows: 12 },
        { name: "tasks", rows: 5 },
      ],
      verified_original_bytes: 24576,
      gaps: [],
      adoption_ready: true,
    };
    const receipt: MigrationAdoptionReceipt = {
      migration_id: "00000000-0000-0000-0000-000000000100",
      source_schema_version: 14,
      stage_directory: "migration-rehearsal-00000000-0000-0000-0000-000000000099",
      verified_original_bytes: 24576,
      staged_counts: stageReport.staged_counts,
      gaps: [],
      adopted_at: "2026-11-20T10:30:00Z",
    };
    const diagnosticsReport: RedactedDiagnosticsReport = {
      schema_version: 20,
      generated_at: "2026-11-20T10:31:00Z",
      accounts: [
        {
          source_slot: "source-1",
          source_kind: "eml",
          lifecycle_state: "active",
          sync_consent: false,
          generation: 1,
          data_version: 3,
          sync_phase: null,
          sync_error_code: null,
          cleanup_status: null,
          cleanup_phase: null,
          cleanup_error_code: null,
        },
      ],
      counts: {
        accounts: 2,
        messages: 12,
        raw_objects: 12,
        tasks: 5,
        evidence: 4,
        analysis_runs: 3,
        work_candidates: 4,
        projects: 1,
        recurrence_rules: 1,
        calendar_blocks: 2,
        commitments: 1,
        work_change_reviews: 1,
        notifications_state: 2,
        mail_labels: 2,
        mail_rules: 1,
        assistant_conversations: 1,
        assistant_turns: 2,
        outbound_previews: 1,
        change_records: 8,
      },
      recent_error_codes: [],
      migration: {
        source_schema_version: 14,
        verified_original_bytes: 24576,
        staged_counts: stageReport.staged_counts,
        gaps: [],
        adopted_at: "2026-11-20T10:30:00Z",
      },
    };

    const props = fixture();
    const migrationStatus = vi.fn<NonNullable<DesktopApi["migrationStatus"]>>().mockResolvedValue(null);
    const migrationInspect = vi.fn<NonNullable<DesktopApi["migrationInspect"]>>().mockResolvedValue(preflight);
    const migrationStage = vi.fn<NonNullable<DesktopApi["migrationStage"]>>().mockResolvedValue(stageReport);
    const migrationAdopt = vi.fn<NonNullable<DesktopApi["migrationAdopt"]>>().mockImplementation(async () => {
      migrationStatus.mockResolvedValue(receipt);
      return receipt;
    });
    const exportDiagnostics = vi.fn<NonNullable<DesktopApi["exportDiagnostics"]>>().mockResolvedValue(diagnosticsReport);

    render(
      <SettingsView
        api={{
          ...props.api,
          migrationStatus,
          migrationInspect,
          migrationStage,
          migrationAdopt,
          exportDiagnostics,
        }}
        onSelect={props.onSelect}
        onSourceChanged={props.onSourceChanged}
        onSourceDeleted={props.onSourceDeleted}
        onCatalogChanged={props.onCatalogChanged}
      />,
    );

    const advancedToggle = await screen.findByText("Công cụ nâng cao & hỗ trợ kỹ thuật");
    await props.user.click(advancedToggle);

    const inspectBtn = await screen.findByRole("button", { name: "Chọn thư mục hồ sơ V1" });
    await props.user.click(inspectBtn);
    expect(migrationInspect).toHaveBeenCalledExactlyOnceWith(false);
    expect(await screen.findByTestId("mc-migration-preflight")).toHaveTextContent(/12 tệp \.eml gốc/);

    const stageBtn = await screen.findByRole("button", { name: "Dựng bản thử nghiệm" });
    await props.user.click(stageBtn);
    expect(migrationStage).toHaveBeenCalledExactlyOnceWith();
    expect(await screen.findByTestId("mc-migration-stage-report")).toHaveTextContent(/24576 byte tệp gốc đã xác minh/);

    const adoptBtn = await screen.findByRole("button", { name: "Kích hoạt dữ liệu V1" });
    await props.user.click(adoptBtn);
    expect(migrationAdopt).toHaveBeenCalledExactlyOnceWith(stageReport.stage_directory);
    expect(await screen.findByTestId("mc-migration-receipt")).toHaveTextContent(/Đã chuyển từ MailCompass V1/);
    expect(props.onCatalogChanged).toHaveBeenCalled();

    const diagBtn = screen.getByRole("button", { name: "Tạo báo cáo chẩn đoán" });
    await props.user.click(diagBtn);
    expect(exportDiagnostics).toHaveBeenCalledExactlyOnceWith();
    const diagBox = await screen.findByTestId("mc-diagnostics-report");
    expect(diagBox).toHaveTextContent(/Schema v20 · 2 nguồn · 12 thư · 5 công việc/);
    expect(diagBox).toHaveTextContent(/source-1/);
  });

  it("requires explicit risk acknowledgement to opt in to Gemini Free Tier and lets the user revoke it", async () => {
    const props = fixture({ accounts: [local, gmail] });
    const onAiPrivacyChanged = vi.fn();
    const aiPrivacyStatus = vi.fn<NonNullable<DesktopApi["aiPrivacyStatus"]>>().mockResolvedValue({
      provider_configured: true,
      provider_class: "gemini_free_tier",
      provider_label: "Gemini (gemini-3.5-flash-lite)",
      accept_free_tier_risk: false,
      updated_at: null,
    });
    const setFreeTierRiskConsent = vi.fn<NonNullable<DesktopApi["setFreeTierRiskConsent"]>>()
      .mockImplementation(async (input) => ({
        provider_configured: true,
        provider_class: "gemini_free_tier",
        provider_label: "Gemini (gemini-3.5-flash-lite)",
        accept_free_tier_risk: input.accept_free_tier_risk,
        updated_at: "2026-11-20T16:25:00Z",
      }));

    render(
      <SettingsView
        api={{ ...props.api, aiPrivacyStatus, setFreeTierRiskConsent }}
        onSelect={props.onSelect}
        onSourceChanged={props.onSourceChanged}
        onSourceDeleted={props.onSourceDeleted}
        onCatalogChanged={props.onCatalogChanged}
        onAiPrivacyChanged={onAiPrivacyChanged}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Quyền riêng tư & AI Gemini (Free Tier)" })).toBeInTheDocument();
    expect(screen.getByText(/Đang khóa an toàn \(Mặc định\)/)).toBeInTheDocument();

    await props.user.click(screen.getByRole("button", { name: "Cho phép dùng Gemini Free Tier" }));
    const dialog = await screen.findByRole("dialog", { name: "Chấp nhận rủi ro gửi dữ liệu lên Gemini Free Tier?" });
    const confirmBtn = within(dialog).getByRole("button", { name: "Tôi chấp nhận rủi ro & Bật" });
    expect(confirmBtn).toBeDisabled();

    await props.user.click(within(dialog).getByRole("checkbox"));
    expect(confirmBtn).toBeEnabled();
    await props.user.click(confirmBtn);

    expect(setFreeTierRiskConsent).toHaveBeenCalledWith(expect.objectContaining({ accept_free_tier_risk: true }));
    expect(onAiPrivacyChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Đang bật theo xác nhận chấp nhận rủi ro của bạn/)).toBeInTheDocument();

    await props.user.click(screen.getByRole("button", { name: "Tắt & quay lại khóa an toàn" }));
    expect(setFreeTierRiskConsent).toHaveBeenLastCalledWith(expect.objectContaining({ accept_free_tier_risk: false }));
    expect(onAiPrivacyChanged).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Đang khóa an toàn \(Mặc định\)/)).toBeInTheDocument();
  });
});

describe("Cài đặt nâng cao Tuần 4 (FD-01, FD-09, GM-05)", () => {
  afterEach(() => {
    window.localStorage.removeItem(GMAIL_SHORTCUTS_STORAGE_KEY);
  });

  it("renders FD-01 attachment policy card with blocked count, zero download actions, and explanatory popover", async () => {
    const accountWithPolicy: ProfileAccount = {
      ...gmail,
      attachment_sync_policy: "block_binary",
      blocked_attachment_count: 7,
    };
    const props = fixture({ accounts: [accountWithPolicy], active_account_id: accountWithPolicy.account_id });
    render(openSettings(props));

    const card = await screen.findByTestId("mc-settings-attachment-policy-card");
    expect(within(card).getByRole("heading", { name: "Chặn đồng bộ tệp đính kèm: Đang bật" })).toBeInTheDocument();
    expect(within(card).getByText("Đã bỏ qua 7 tệp đính kèm nhị phân khi đồng bộ.")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /tải xuống|mở tệp/i })).not.toBeInTheDocument();

    await props.user.click(within(card).getByRole("button", { name: "Giải thích chặn đồng bộ tệp đính kèm" }));
    expect(await screen.findByText("Vì sao chặn tệp đính kèm nhị phân?")).toBeVisible();
    expect(screen.getByText("has:attachment")).toBeVisible();
    expect(screen.getByText("filename:")).toBeVisible();
  });

  it("reflects metadata_only_explicit_fetch attachment policy label accurately", async () => {
    const metadataAccount: ProfileAccount = {
      ...local,
      attachment_sync_policy: "metadata_only_explicit_fetch",
      blocked_attachment_count: 2,
    };
    const props = fixture({ accounts: [metadataAccount], active_account_id: metadataAccount.account_id });
    render(openSettings(props));

    const card = await screen.findByTestId("mc-settings-attachment-policy-card");
    expect(within(card).getByRole("heading", { name: "Chặn đồng bộ tệp đính kèm: Chỉ lưu siêu dữ liệu" })).toBeInTheDocument();
    expect(within(card).getByText("Đã bỏ qua 2 tệp đính kèm nhị phân khi đồng bộ.")).toBeInTheDocument();
  });

  it("saves FD-09 account default reminder presets and rolls back cleanly on invalid or conflicting save", async () => {
    const accountWithPresets: ProfileAccount = {
      ...local,
      version: 2,
      reminder_lead_presets: [24],
    };
    const props = fixture({ accounts: [accountWithPresets], active_account_id: accountWithPresets.account_id });
    const setReminderPresets = vi.fn<(input: SetReminderPresetsInput) => Promise<SetReminderPresetsResult>>()
      .mockResolvedValueOnce({ task_id: null, lead_hours: [168, 24], version: 3 })
      .mockRejectedValueOnce({ code: "invalid_reminder_presets" })
      .mockRejectedValueOnce({ code: "account_version_conflict" });

    render(
      <SettingsView
        api={{ ...props.api, setReminderPresets }}
        onSelect={props.onSelect}
        onSourceChanged={props.onSourceChanged}
        onSourceDeleted={props.onSourceDeleted}
        onCatalogChanged={props.onCatalogChanged}
      />,
    );

    const card = await screen.findByTestId("mc-settings-reminder-presets-card");
    const oneDayChip = within(card).getByRole("button", { name: "1 ngày" });
    const oneWeekChip = within(card).getByRole("button", { name: "1 tuần" });
    const twoDaysChip = within(card).getByRole("button", { name: "2 ngày" });
    expect(oneDayChip).toHaveAttribute("aria-pressed", "true");
    expect(oneWeekChip).toHaveAttribute("aria-pressed", "false");

    await props.user.click(oneWeekChip);
    expect(setReminderPresets).toHaveBeenNthCalledWith(1, expect.objectContaining({
      task_id: null,
      lead_hours: [168, 24],
      expected_version: 2,
      request_key: expect.any(String),
    }));
    await waitFor(() => expect(oneWeekChip).toHaveAttribute("aria-pressed", "true"));
    expect(await within(card).findByText("Đã lưu mốc nhắc mặc định cho tài khoản.")).toBeInTheDocument();
    expect(props.onSourceChanged).toHaveBeenCalledWith(expect.objectContaining({
      account_id: accountWithPresets.account_id,
      version: 3,
      reminder_lead_presets: [168, 24],
    }));
    expect(props.onCatalogChanged).toHaveBeenCalled();

    await props.user.click(twoDaysChip);
    expect(setReminderPresets).toHaveBeenNthCalledWith(2, expect.objectContaining({
      task_id: null,
      lead_hours: [168, 48, 24],
      expected_version: 3,
    }));
    expect(await within(card).findByRole("alert")).toHaveTextContent(/Chọn mốc nhắc từ 1 giờ đến 30 ngày/);
    expect(twoDaysChip).toHaveAttribute("aria-pressed", "false");
    expect(oneWeekChip).toHaveAttribute("aria-pressed", "true");

    const callsBeforeConflict = props.listSources.mock.calls.length;
    await props.user.click(twoDaysChip);
    await waitFor(() => expect(props.listSources.mock.calls.length).toBeGreaterThan(callsBeforeConflict));
    expect(within(card).getByRole("alert")).toBeInTheDocument();
  });

  it("toggles GM-05 Gmail shortcuts switch, persists localStorage, and notifies callback", async () => {
    window.localStorage.setItem(GMAIL_SHORTCUTS_STORAGE_KEY, "true");
    const props = fixture();
    const onGmailShortcutsChanged = vi.fn();

    render(
      <SettingsView
        api={props.api}
        onSelect={props.onSelect}
        onSourceChanged={props.onSourceChanged}
        onSourceDeleted={props.onSourceDeleted}
        onCatalogChanged={props.onCatalogChanged}
        onGmailShortcutsChanged={onGmailShortcutsChanged}
      />,
    );

    const toggle = await screen.findByRole("switch", { name: "Phím tắt kiểu Gmail" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await props.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(window.localStorage.getItem(GMAIL_SHORTCUTS_STORAGE_KEY)).toBe("false");
    expect(onGmailShortcutsChanged).toHaveBeenNthCalledWith(1, false);

    await props.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem(GMAIL_SHORTCUTS_STORAGE_KEY)).toBe("true");
    expect(onGmailShortcutsChanged).toHaveBeenNthCalledWith(2, true);
  });
});
