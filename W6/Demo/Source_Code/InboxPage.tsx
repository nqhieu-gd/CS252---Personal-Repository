import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ApiClient } from "../../api/client";
import { isApiError } from "../../api/client";
import type { AccountScope, AnalysisProposalView, ErrorDetail, MessageView } from "../../api/types";
import { useScopedResource } from "../../api/useScopedResource";
import { Empty, ErrorBox, Loading, errorMessage } from "../../components/StatusViews";
import { GmailSyncNotice, type GmailSyncNoticeProps } from "../sync/GmailSyncNotice";
import { isAbort, newIdempotencyKey, pollJob } from "../../lib/poll";
import { ReviewCandidates } from "../analysis/ReviewCandidates";
import { t } from "../../strings";
import { useStoredState, useUiSession } from "../../uiSession";
import { scopeKey } from "../../api/client";
import { EvidencePanel } from "../evidence/EvidencePanel";
import { MailRow } from "../../components/upstream/circle/MailRow";
import { Button } from "../../components/upstream/circle/button";
import { Input } from "../../components/upstream/circle/input";
import { ArrowLeft, FileUp, Inbox, Search, PanelRightOpen, ShieldCheck } from "lucide-react";
import { CoworkSidePanel } from "../../components/upstream/jan/CoworkSidePanel";
import { MessageReader } from "../../components/MessageReader";
import { ManualTaskForm } from "../tasks/ManualTaskForm";

// Backend limit is strictly 10 MiB (docs/interfaces/issue-07-ui.md line 27 & 123).
const MAX_EML_BYTES = 10 * 1024 * 1024;

interface Props {
  client: ApiClient;
  scope: AccountScope;
  /** Email to open on mount (e.g. when navigating from a task's source link). */
  initialMessageId?: string | null;
  onOpenTask: (taskId: string) => void;
  pollIntervalMs?: number;
  /** Committed Gmail catch-up counter for this scope; a change refreshes the list and open email. */
  dataVersion?: number | null;
  /** Sync status of the selected real Gmail account, when there is one. */
  gmailSync?: GmailSyncNoticeProps;
}

// The job id lives in state so the cancel control renders as soon as the job exists.
type Phase = { name: "idle" } | { name: "running"; jobId?: string } | { name: "error"; message: string } | { name: "done" };
type AnalysisPhase = Phase | { name: "setup" } | { name: "cancelled" };

/** Provider codes get plain explanations; raw backend wording stays out of the main view. */
function analysisFailureText(error: ErrorDetail | null): string {
  return (error && t.inbox.analysisErrors[error.code]) || t.inbox.analysisFailed;
}

type ImportPhase =
  | { name: "idle" }
  | { name: "running"; current: number; total: number; jobId?: string }
  | { name: "error"; message: string }
  | { name: "done"; count: number };

interface ImportQueueItem {
  file: File;
  key: string;
  jobId?: string;
}

interface ImportQueueState {
  items: ImportQueueItem[];
  currentIndex: number;
  total: number;
  succeededCount: number;
  lastMessageId?: string;
}

export function InboxPage({ client, scope, initialMessageId = null, onOpenTask, pollIntervalMs = 1000, dataVersion = null, gmailSync }: Props) {
  const cache=scopeKey(scope);
  const session=useUiSession();
  const [selectedId, setSelectedId] = useStoredState<string|null>(`inbox-selection:${cache}`,initialMessageId);
  const [searchQuery, setSearchQuery] = useStoredState(`inbox-search:${cache}`,"");
  const [isReviewMode, setIsReviewMode] = useStoredState(`inbox-review:${cache}`,false);
  const [cursor,setCursor]=useStoredState<string|null>(`inbox-cursor:${cache}`,null);
  const [history,setHistory]=useStoredState<Array<string|null>>(`inbox-history:${cache}`,[]);
  useEffect(()=>{if(initialMessageId){setSelectedId(initialMessageId);setIsReviewMode(false);}},[initialMessageId]);
  // Remember which committed Gmail data version the list and cursor belong to.
  const [seenVersion,setSeenVersion]=useStoredState<number|null>(`inbox-data-version:${cache}`,null);
  const [contentVersion,setContentVersion]=useState(0);

  const list = useScopedResource(
    scope,
    ["messages", searchQuery,cursor],
    (signal) => {
      if (searchQuery.trim()) {
        return client.searchMessages(scope, { q: searchQuery.trim(), limit: 50,cursor:cursor??undefined }, { signal });
      }
      return client.listMessages(scope, { limit: 50,cursor:cursor??undefined }, { signal });
    },
  );
  const firstVersionCheck = useRef(true);
  useEffect(() => {
    const first = firstVersionCheck.current;
    firstVersionCheck.current = false;
    if (dataVersion === null) return;
    if (seenVersion !== null && seenVersion !== dataVersion) {
      // New mail was committed: an old cursor no longer describes the data, so go
      // back to page one of the same query. Selection and drafts stay untouched.
      if (cursor !== null || history.length) {
        setCursor(null);
        setHistory([]);
      } else if (!first) {
        list.reload();
      }
      if (!first) setContentVersion((n) => n + 1);
    }
    if (seenVersion !== dataVersion) setSeenVersion(dataVersion);
  }, [dataVersion]);
  const listRef = useRef<HTMLElement>(null);
  const scrollKey = `mail-scroll:${cache}:${searchQuery}:${cursor ?? ""}`;
  useLayoutEffect(() => {
    if (!isReviewMode && !selectedId && !list.loading && listRef.current) {
      listRef.current.scrollTop = Number(session.memory.entries.get(scrollKey)?.value ?? 0);
    }
  }, [isReviewMode, selectedId, list.loading, scrollKey]);

  // ---- import queue (batch .eml import; one idempotency key per file) -------
  const [importPhase, setImportPhase] = useStoredState<ImportPhase>(`import-phase:${cache}`,{ name: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const queueKey = `import-queue:${cache}`;
  const queueRef = useRef<ImportQueueState | null>(
    (session.memory.entries.get(queueKey)?.value as ImportQueueState | undefined) ?? null,
  );
  const rememberQueue = useCallback(
    (queue: ImportQueueState | null) => {
      queueRef.current = queue;
      if (queue) {
        session.memory.entries.set(queueKey, { value: queue, dirty: false });
      } else {
        session.memory.entries.delete(queueKey);
      }
    },
    [queueKey, session.memory.entries],
  );
  const importAbort = useRef<AbortController | null>(null);

  const runImportQueue = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue || (importAbort.current && !importAbort.current.signal.aborted)) return;

    const controller = new AbortController();
    importAbort.current = controller;
    try {
      while (queue.currentIndex < queue.items.length) {
        const item = queue.items[queue.currentIndex];
        const progress = { name: "running", current: queue.currentIndex + 1, total: queue.total } as const;
        setImportPhase({ ...progress, jobId: item.jobId });

        try {
          const started = item.jobId
            ? { id: item.jobId }
            : await client.importEml(scope, item.file, item.key, { signal: controller.signal });
          if (controller.signal.aborted) return;
          item.jobId = started.id;
          rememberQueue(queue);
          setImportPhase({ ...progress, jobId: started.id });

          const job = await pollJob(client, scope, started.id, { intervalMs: pollIntervalMs, signal: controller.signal });
          if (controller.signal.aborted) return;
          if (job.status !== "succeeded" || job.kind !== "import_eml") {
            // Only a known terminal failure starts a new import intent on retry.
            item.key = newIdempotencyKey();
            item.jobId = undefined;
            rememberQueue(queue);
            throw new Error(job.error?.message ?? t.inbox.importFailed);
          }

          queue.succeededCount += 1;
          queue.lastMessageId = job.result?.message_id ?? queue.lastMessageId;
          queue.currentIndex += 1;
          rememberQueue(queue);
        } catch (error) {
          if (controller.signal.aborted || isAbort(error)) return;
          const message = errorMessage(error);
          setImportPhase({
            name: "error",
            message: queue.total > 1 ? `${item.file.name}: ${message}` : message,
          });
          list.reload();
          return;
        }
      }

      rememberQueue(null);
      setImportPhase({ name: "done", count: queue.succeededCount });
      list.reload();
      if (queue.lastMessageId) {
        setIsReviewMode(false);
        setSelectedId(queue.lastMessageId);
      }
    } finally {
      if (importAbort.current === controller) importAbort.current = null;
    }
  }, [client, scope, pollIntervalMs, list.reload, rememberQueue, setSelectedId, setImportPhase, setIsReviewMode]);

  function onPickFiles(pickedFiles: File[] | FileList | null | undefined) {
    if (!pickedFiles || (importAbort.current && !importAbort.current.signal.aborted)) return;
    const files = Array.from(pickedFiles);
    if (files.length === 0) return;

    const validFiles = files.filter(
      (f) => /\.eml$/i.test(f.name) && f.size > 0 && f.size <= MAX_EML_BYTES,
    );
    const invalidCount = files.length - validFiles.length;

    if (validFiles.length === 0) {
      setFileError(t.inbox.invalidFile);
      return;
    }

    if (invalidCount > 0) {
      setFileError(t.inbox.invalidFilesSkipped(invalidCount));
    } else {
      setFileError(null);
    }

    const items: ImportQueueItem[] = validFiles.map((file) => ({
      file,
      key: newIdempotencyKey(),
    }));

    const queue: ImportQueueState = {
      items,
      currentIndex: 0,
      total: items.length,
      succeededCount: 0,
    };
    rememberQueue(queue);
    void runImportQueue();
  }

  // Abort anything in flight when leaving the screen or switching account.
  useEffect(
    () => () => {
      importAbort.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (importPhase.name === "running" && queueRef.current) void runImportQueue();
  }, []);

  const messages = list.data?.items ?? [];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (importPhase.name !== "running") {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (importPhase.name === "running") return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onPickFiles(e.dataTransfer.files);
    }
  };

  const currentActiveJobId = importPhase.name === "running" ? importPhase.jobId : undefined;

  // Circle Inbox list/preview primitives, adapted to a full-page triage → reader flow.
  return (
    <section
      className={`inbox workspace-view ${isDraggingOver ? "inbox-drop-active" : ""}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!isReviewMode && <header className="page-heading">
        <div><div className="page-eyebrow">THƯ & CÔNG VIỆC</div><h2>{t.inbox.title}</h2><p>Đọc email, kiểm tra đề xuất và chuyển thành công việc.</p></div>
        <label className={`import-btn-label ${importPhase.name === "running" ? "disabled" : ""}`}>
          <input
            type="file"
            multiple
            accept=".eml,message/rfc822"
            aria-label={t.inbox.importLabel}
            className="file-input"
            disabled={importPhase.name === "running"}
            onChange={e => { onPickFiles(e.target.files); e.target.value = ""; }}
          />
          <span className="action-btn"><FileUp size={15} aria-hidden="true" />{t.inbox.importLabel}</span>
        </label>
      </header>}
      {gmailSync && !isReviewMode ? <GmailSyncNotice {...gmailSync} /> : null}
      <div className="import-status-zone">
        {importPhase.name === "running" ? (
          <div className="inline-feedback">
            <Loading
              label={
                importPhase.total && importPhase.total > 1
                  ? t.inbox.importProgress(importPhase.current ?? 1, importPhase.total)
                  : t.inbox.importing
              }
            />
            {currentActiveJobId ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  importAbort.current?.abort();
                  void client.cancelJob(scope, currentActiveJobId)
                    .catch(error => setFileError(errorMessage(error)))
                    .finally(list.reload);
                  rememberQueue(null);
                  setImportPhase({ name: "idle" });
                }}
              >
                Hủy tác vụ
              </Button>
            ) : null}
          </div>
        ) : null}
        {importPhase.name === "done" ? (
          <p role="status" className="status-success">
            {importPhase.count && importPhase.count > 1
              ? t.inbox.importDoneCount(importPhase.count)
              : t.inbox.importDone}
          </p>
        ) : null}
        {importPhase.name === "error" ? (
          <div className="inline-feedback">
            <ErrorBox
              error={new Error(importPhase.message)}
              title={t.inbox.importFailed}
              onRetry={() => void runImportQueue()}
            />
            {queueRef.current && queueRef.current.total > 1 ? (
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  rememberQueue(null);
                  setImportPhase({ name: "idle" });
                }}
              >
                {t.inbox.cancelQueue}
              </Button>
            ) : null}
          </div>
        ) : null}
        {fileError ? <p role="alert" className="status status-error">{fileError}</p> : null}
      </div>
      {isReviewMode && selectedId ? <ReviewWorkspace client={client} scope={scope} messageId={selectedId}
        pollIntervalMs={pollIntervalMs} contentVersion={contentVersion} onOpenTask={onOpenTask} onOpenMessage={setSelectedId} onBackToInbox={()=>setIsReviewMode(false)}/>
      : selectedId ? <div className="mail-reading-page">
        <div className="reader-navigation"><Button variant="ghost" size="sm" onClick={()=>setSelectedId(null)}><ArrowLeft size={14} aria-hidden="true"/>Quay lại danh sách</Button><span>Email nguồn · Văn bản gốc</span></div>
        <div className="message-detail"><MessageDetail key={selectedId} client={client} scope={scope} messageId={selectedId}
          pollIntervalMs={pollIntervalMs} contentVersion={contentVersion} onOpenTask={onOpenTask} onOpenMessage={setSelectedId} onEnterReview={()=>setIsReviewMode(true)}/></div>
      </div> : <div className="inbox-triage">
        <div className="inbox-controls"><div className="list-context"><Inbox size={15} aria-hidden="true"/><span>Tất cả email</span></div>
          <div className="inbox-search-box"><Search size={15} aria-hidden="true"/><Input type="search" placeholder="Tìm trong thư…" aria-label="Tìm trong thư" value={searchQuery}
            onChange={e=>{setSearchQuery(e.target.value);setCursor(null);setHistory([]);}}/></div>
        </div>
        <div className="mail-list-labels"><span>NGƯỜI GỬI</span><span>NỘI DUNG EMAIL</span><span>THỜI GIAN</span></div>
        <nav aria-label={t.inbox.title} className="message-list" ref={listRef}
          onScroll={e=>session.memory.entries.set(scrollKey,{value:e.currentTarget.scrollTop,dirty:false})}>
          {list.loading ? <Loading/>:null}
          {list.error ? <ErrorBox error={list.error} onRetry={list.reload}/>:null}
          {!list.loading && !list.error && messages.length === 0 ? <Empty>{searchQuery.trim()?"Không tìm thấy email phù hợp.":t.inbox.emptyList}</Empty>:null}
          <ul>{messages.map(m=><li key={m.id}><MailRow message={m} onClick={()=>setSelectedId(m.id)}/></li>)}</ul>
        </nav>
        <footer className="list-pagination"><span>{messages.length ? `${messages.length} email trên trang này` : t.inbox.noSelection}</span><div>
          {history.length ? <Button variant="outline" size="xs" onClick={()=>{setCursor(history[history.length-1]);setHistory(history.slice(0,-1));}}>Trang trước</Button>:null}
          {list.data?.next_cursor ? <Button variant="outline" size="xs" onClick={()=>{setHistory([...history,cursor]);setCursor(list.data!.next_cursor);}}>Trang tiếp theo</Button>:null}
        </div></footer>
      </div>}
    </section>
  );
}

interface DetailProps {
  client: ApiClient;
  scope: AccountScope;
  messageId: string;
  pollIntervalMs: number;
  contentVersion: number;
  onOpenTask: (taskId: string) => void;
  onOpenMessage: (messageId: string) => void;
  onEnterReview?: () => void;
}

function MessageDetail({
  client,
  scope,
  messageId,
  pollIntervalMs,
  contentVersion,
  onOpenTask,
  onEnterReview,
}: DetailProps) {
  const message = useScopedResource<MessageView>(scope, ["message", messageId], (signal) =>
    client.getMessage(scope, messageId, { signal }),
  );
  useReloadOnChange(contentVersion, message.reload);
  const analysis = useScopedResource<AnalysisProposalView | null>(scope, ["analysis", messageId], (signal) =>
    client.getLatestAnalysis(scope, messageId, { signal }),
  );
  const session=useUiSession();
  const intentKey=`analysis-intent:${scopeKey(scope)}:${messageId}`;
  const [phase, setPhase] = useStoredState<AnalysisPhase>(`analysis-phase:${scopeKey(scope)}:${messageId}`,{name:"idle"});
  const analysisKey = useRef<string|null>((session.memory.entries.get(intentKey)?.value as {key:string}|undefined)?.key??null);
  const jobId=useRef<string|null>((session.memory.entries.get(intentKey)?.value as {jobId?:string}|undefined)?.jobId??null);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );

  const forgetIntent = () => { analysisKey.current = null; jobId.current = null; session.memory.entries.delete(intentKey); };

  async function analyze() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    if (!analysisKey.current) analysisKey.current = newIdempotencyKey();
    setPhase({ name: "running", jobId: jobId.current ?? undefined });
    try {
      session.memory.entries.set(intentKey,{value:{key:analysisKey.current,jobId:jobId.current},dirty:false});
      const started = jobId.current?{id:jobId.current}:await client.startAnalysis(scope, messageId, analysisKey.current, { signal: controller.signal });
      jobId.current=started.id;session.memory.entries.set(intentKey,{value:{key:analysisKey.current,jobId:started.id},dirty:false});
      if (!controller.signal.aborted) setPhase({ name: "running", jobId: started.id });
      const job = await pollJob(client, scope, started.id, { intervalMs: pollIntervalMs, signal: controller.signal });
      // A terminal job ends this intent: the next attempt is a new request with a new key.
      forgetIntent();
      if (job.status === "succeeded") {
        setPhase({ name: "done" });
        analysis.reload();
      } else if (job.status === "cancelled") {
        setPhase({ name: "cancelled" });
      } else if (job.error?.code === "provider_not_configured") {
        setPhase({ name: "setup" });
      } else {
        setPhase({ name: "error", message: analysisFailureText(job.error) });
      }
    } catch (err) {
      if (controller.signal.aborted || isAbort(err)) return;
      if (isApiError(err) && err.code === "provider_not_configured") {
        // 503 before any job exists: nothing was recorded, stored mail and proposals stay usable.
        setPhase({ name: "setup" });
        return;
      }
      // Network/5xx keeps the same intent (replay the key or re-read the job); 4xx does not.
      if (isApiError(err) && err.status >= 400 && err.status < 500) forgetIntent();
      setPhase({
        name: "error",
        message: isApiError(err) && err.code === "analysis_demo_only"
          ? t.inbox.analysisErrors.analysis_demo_only
          : errorMessage(err),
      });
    }
  }

  useEffect(()=>{if(jobId.current)void analyze();},[]);
  const m = message.data;
  if (!m) {
    if (message.error) return <ErrorBox error={message.error} onRetry={message.reload} />;
    return <Loading />;
  }

  return (
    <>
      <MessageReader message={m} actions={<div className="analysis-bar">
          <ManualTaskForm client={client} scope={scope} messageId={messageId} onCreated={onOpenTask} />
          <button type="button" onClick={() => void analyze()} disabled={phase.name === "running"}>
            {phase.name === "running" ? t.inbox.analyzing : t.inbox.analyze}
          </button>
          {analysis.data && onEnterReview ? (
            <button type="button" className="primary" onClick={onEnterReview}>
              Xem đề xuất ({analysis.data.candidates.length})
            </button>
          ) : null}
          {phase.name === "running" ? <div className="analysis-status" role="status"><Loading label={t.inbox.analyzing}/><p className="workflow-muted">{t.inbox.analysisRunning}</p>{phase.jobId?<button type="button" onClick={()=>void client.cancelJob(scope,phase.jobId!).catch(error=>setPhase({name:"error",message:errorMessage(error)}))}>Hủy tác vụ</button>:null}</div> : null}
          {phase.name === "setup" ? (
            <div data-testid="analysis-setup-needed" role="alert" className="workflow-notice analysis-setup">
              <strong>{t.inbox.analysisSetupTitle}</strong>
              <p>{t.inbox.analysisSetupBody}</p>
              <p className="workflow-muted">{t.inbox.analysisKeepsSaved}</p>
              <button type="button" onClick={() => void analyze()}>{t.common.retry}</button>
            </div>
          ) : null}
          {phase.name === "cancelled" ? <p role="status" className="workflow-muted">{t.inbox.analysisCancelled}</p> : null}
          {phase.name === "error" ? (
            <ErrorBox error={new Error(phase.message)} title={t.inbox.analysisFailed} onRetry={() => void analyze()} />
          ) : null}
        </div>} />

      {m.linked_task_ids.length > 0 ? (
        <div className="linked-tasks">
          <h4>{t.inbox.linkedTasks}</h4>
          {m.linked_task_ids.map((id) => (
            <button key={id} type="button" onClick={() => onOpenTask(id)} aria-label={`${t.inbox.openTask} ${id}`}>
              {t.inbox.openTask}
            </button>
          ))}
        </div>
      ) : null}

      {analysis.loading && !analysis.data ? <Loading/>:null}
      {analysis.error?<ErrorBox error={analysis.error} onRetry={analysis.reload}/>:null}

    </>
  );
}

/** Proposal workspace with the source-adapted Jan contextual side panel. */
interface ReviewWorkspaceProps {
  client: ApiClient;
  scope: AccountScope;
  messageId: string;
  pollIntervalMs: number;
  contentVersion: number;
  onOpenTask: (taskId: string) => void;
  onOpenMessage: (messageId: string) => void;
  onBackToInbox: () => void;
}

function ReviewWorkspace({
  client,
  scope,
  messageId,
  contentVersion,
  onOpenTask,
  onOpenMessage,
  onBackToInbox,
}: ReviewWorkspaceProps) {
  const message = useScopedResource<MessageView>(scope, ["message", messageId], (signal) =>
    client.getMessage(scope, messageId, { signal }),
  );
  useReloadOnChange(contentVersion, message.reload);
  const analysis = useScopedResource<AnalysisProposalView | null>(scope, ["analysis", messageId], (signal) =>
    client.getLatestAnalysis(scope, messageId, { signal }),
  );

  const [activeTab,setActiveTab]=useStoredState<"source"|"proposals">(`review-tab:${scopeKey(scope)}:${messageId}`,"proposals");
  const [evidenceId,setEvidenceId]=useStoredState<string|null|undefined>(`review-evidence:${scopeKey(scope)}:${messageId}`,undefined);
  const [focusRequest, setFocusRequest] = useState(0);
  const [sourceOpen,setSourceOpen]=useStoredState(`review-source-open:${scopeKey(scope)}:${messageId}`,true);
  const m = message.data;
  const p = analysis.data;

  if (!m || !p) {
    if (message.error) return <ErrorBox error={message.error} onRetry={message.reload} />;
    if (analysis.error) return <ErrorBox error={analysis.error} onRetry={analysis.reload} />;
    if(m && !analysis.loading && analysis.data===null) return <article className="reader-container"><button type="button" onClick={onBackToInbox}>Quay lại hộp thư</button><h3>{m.subject}</h3><p role="status">Chưa có kết quả phân tích cho email này. Quay lại hộp thư để phân tích.</p><pre className="email-body">{m.body_text}</pre></article>;
    return <Loading />;
  }

  const source = (evidenceId===undefined ? p.candidates[0]?.evidence_ids.find(id=>p.evidence.find(e=>e.id===id)?.accessible) : evidenceId);
  return (
    <div className="review-mode" data-active-tab={activeTab} data-source-open={sourceOpen}>
      <header className="review-toolbar">
        <Button variant="ghost" size="sm" onClick={onBackToInbox} aria-label="Quay lại hộp thư"><ArrowLeft size={14} aria-hidden="true"/>Quay lại hộp thư</Button>
        <div className="review-subject"><span className="muted">Duyệt đề xuất</span><strong>{m.subject}</strong></div>
        <Button variant="outline" size="sm" onClick={()=>{setSourceOpen(!sourceOpen);setActiveTab("source");}} aria-pressed={sourceOpen}><PanelRightOpen size={15} aria-hidden="true"/>Nguồn email</Button>
      </header>
      <div className="review-tab-bar" role="tablist" aria-label="Đối chiếu đề xuất">
        <button role="tab" aria-selected={activeTab==="proposals"} onClick={()=>setActiveTab("proposals")}>Đề xuất</button>
        <button role="tab" aria-selected={activeTab==="source"} onClick={()=>{setActiveTab("source");setSourceOpen(true);}}>Nguồn</button>
      </div>
      <div className="review-workspace">
        <main className="proposal-canvas"><div className="proposal-canvas-inner">
          <div className="proposal-workspace-heading"><span className="verification-icon"><ShieldCheck size={20} aria-hidden="true"/></span><div><div className="page-eyebrow">KIỂM TRA TRƯỚC KHI TẠO</div><h2>{p.candidates.length} đề xuất công việc</h2></div></div>
          <ReviewCandidates key={p.id} client={client} scope={scope} proposal={p} onTaskCreated={()=>message.reload()}
            onOpenTask={onOpenTask} onOpenMessage={onOpenMessage}
            onSelectEvidence={(id,reveal)=>{setEvidenceId(id);setFocusRequest(n=>n+1);if(reveal){setActiveTab("source");setSourceOpen(true);}}}/>
        </div></main>
        {sourceOpen && <CoworkSidePanel title="Email nguồn" leading={<MailSourceIcon/>}
          className="review-source-panel" defaultWidth={440} onClose={()=>{setSourceOpen(false);setActiveTab("proposals");}}>
          <section className="review-source-col" aria-label="Email nguồn">
            {source ? <EvidencePanel embedded focusRequest={focusRequest} client={client} scope={scope} evidenceId={source}
              savedQuote={p.evidence.find(e=>e.id===source)?.quote} refreshToken={contentVersion}/> : <MessageReader message={m}/>}
          </section>
        </CoworkSidePanel>}
      </div>
    </div>
  );
}
function MailSourceIcon() { return <Inbox size={15} aria-hidden="true"/>; }

/** Re-reads a resource when the committed mail version moves; the first value is the baseline. */
function useReloadOnChange(version: number, reload: () => void) {
  const last = useRef(version);
  useEffect(() => {
    if (version === last.current) return;
    last.current = version;
    reload();
  }, [version, reload]);
}
