import { useEffect, useRef, useState } from "react";
import type { ApiClient } from "../../api/client";
import type { AccountScope, Importance, ListTasksParams, TaskFilters, TaskState, TaskView } from "../../api/types";
import { useScopedResource } from "../../api/useScopedResource";
import { Empty, ErrorBox, Loading } from "../../components/StatusViews";
import { EvidencePanel } from "../evidence/EvidencePanel";
import { TaskEditor } from "./TaskEditor";
import { ManualTaskForm } from "./ManualTaskForm";
import { PriorityTasks } from "./PriorityTasks";
import { DeadlineReminders } from "./DeadlineReminders";
import { t } from "../../strings";
import { useStoredState, useUiSession } from "../../uiSession";
import { scopeKey } from "../../api/client";
import { ListTodo, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "../../components/upstream/circle/button";
import { Input } from "../../components/upstream/circle/input";
import { TaskLine } from "../../components/upstream/circle/TaskLine";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/upstream/circle/dialog";

interface Props {
  client: ApiClient;
  scope: AccountScope;
  focusTaskId?: string | null;
  onOpenMessage: (messageId: string) => void;
  onOpenAssistant?: (taskId: string) => void;
  /** Clock for the deadline reminders (fixed per load); injectable for tests. */
  now?: () => number;
  reminderIntervalMs?: number;
}

function toFromIso(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function toToIso(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + 1); // exclusive start of next day
  return d.toISOString();
}

export function TaskDashboard({ client, scope, focusTaskId = null, onOpenMessage, onOpenAssistant, now, reminderIntervalMs }: Props) {
  const cache = scopeKey(scope);
  const session = useUiSession();
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const lastSelectedId = useRef<string | null>(focusTaskId);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetPages = () => {
    for (const key of session.memory.entries.keys()) {
      if (key.startsWith(`task-page:${cache}:`)) session.memory.entries.delete(key);
    }
  };

  const [state, setState] = useStoredState<TaskState | "" | "active">(`task-state:${cache}`, "active");
  const [importance, setImportance] = useStoredState<Importance | "">(`task-importance:${cache}`, "");
  const [ownerInput, setOwnerInput] = useStoredState(`task-ownerInput:${cache}`, "");
  const [owner, setOwner] = useStoredState(`task-owner:${cache}`, "");
  const [searchInput, setSearchInput] = useStoredState(`task-searchInput:${cache}`, "");
  const [searchQuery, setSearchQuery] = useStoredState(`task-searchQuery:${cache}`, "");
  const [deadlineFrom, setDeadlineFrom] = useStoredState(`task-deadlineFrom:${cache}`, "");
  const [deadlineTo, setDeadlineTo] = useStoredState(`task-deadlineTo:${cache}`, "");
  const [selectedId, setSelectedId] = useStoredState<string | null>(`task-selection:${cache}`, focusTaskId);

  useEffect(() => {
    if (selectedId) lastSelectedId.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (focusTaskId) setSelectedId(focusTaskId);
  }, [focusTaskId]);

  const [listRevision, setListRevision] = useState(0);
  const [reminderRevision, setReminderRevision] = useState(0);

  function refreshAfterSave() {
    resetPages();
    setListRevision((revision) => revision + 1);
    setReminderRevision((revision) => revision + 1);
  }

  function openTask(id: string) {
    selectionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id);
  }

  const filters: TaskFilters = {
    state: state && state !== "active" ? state : undefined,
    state_group: state === "active" ? "active" : undefined,
    owner: owner || undefined,
    importance: importance || undefined,
    search_query: searchQuery || undefined,
    deadline_from: toFromIso(deadlineFrom),
    deadline_to: toToIso(deadlineTo),
  };

  return (
    <div className="dashboard circle-task-workspace h-full flex flex-col min-h-0">
      <div className="circle-page-heading flex items-end justify-between gap-4 px-7 pt-7 pb-5 shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-[.13em] text-muted-foreground mb-2">Không gian làm việc</p>
          <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight">
            {t.tasks.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-2">Theo dõi các công việc đã được xác nhận từ email.</p>
        </div>
        <ListTodo className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="circle-task-filters border-y flex items-center gap-3 px-6 py-3 flex-wrap shrink-0">
        <ManualTaskForm client={client} scope={scope} onCreated={id => {refreshAfterSave(); openTask(id);}} />
        <SlidersHorizontal className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <label className="circle-filter-control">
          <span className="sr-only">{t.tasks.filterState}</span>
          <select
            value={state}
            onChange={(e) => {
              if (e.target.value !== state) resetPages();
              setState(e.target.value as TaskState | "" | "active");
            }}
          >
            <option value="">{t.tasks.allStates}</option>
            <option value="active">Đang mở</option>
            {(Object.keys(t.tasks.states) as TaskState[]).map((s) => (
              <option key={s} value={s}>
                {t.tasks.states[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="circle-filter-control">
          <span className="sr-only">{t.tasks.filterImportance}</span>
          <select
            value={importance}
            onChange={(e) => {
              if (e.target.value !== importance) resetPages();
              setImportance(e.target.value as Importance | "");
            }}
          >
            <option value="">{t.tasks.allImportance}</option>
            {(Object.keys(t.tasks.importances) as Importance[]).map((i) => (
              <option key={i} value={i}>
                {t.tasks.importances[i]}
              </option>
            ))}
          </select>
        </label>
        <label className="circle-filter-control circle-owner-filter">
          <span className="sr-only">{t.tasks.owner}</span>
          <Input
            type="text"
            list="task-owner-options"
            className="h-8 w-36 text-xs bg-transparent"
            value={ownerInput}
            onChange={(e) => setOwnerInput(e.target.value)}
            onBlur={() => {
              if (ownerInput.trim() !== owner) resetPages();
              setOwner(ownerInput.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (ownerInput.trim() !== owner) resetPages();
                setOwner(ownerInput.trim());
              }
            }}
            placeholder="Người phụ trách"
          />
          <datalist id="task-owner-options">
            <option value="unassigned" label="Chưa có người phụ trách" />
          </datalist>
        </label>
        <label className="circle-filter-control flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Hạn từ:</span>
          <Input
            type="date"
            aria-label="Lọc hạn chót từ ngày"
            className="h-8 w-32 text-xs bg-transparent"
            value={deadlineFrom}
            onChange={(e) => {
              if (e.target.value !== deadlineFrom) resetPages();
              setDeadlineFrom(e.target.value);
            }}
          />
        </label>
        <label className="circle-filter-control flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Hạn đến:</span>
          <Input
            type="date"
            aria-label="Lọc hạn chót đến ngày"
            className="h-8 w-32 text-xs bg-transparent"
            value={deadlineTo}
            onChange={(e) => {
              if (e.target.value !== deadlineTo) resetPages();
              setDeadlineTo(e.target.value);
            }}
          />
        </label>
        <form
          role="search"
          className="circle-task-search ml-auto min-w-40 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (searchInput.trim() !== searchQuery || ownerInput.trim() !== owner) resetPages();
            setSearchQuery(searchInput.trim());
            setOwner(ownerInput.trim());
          }}
        >
          <Search className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <label>
            <span className="sr-only">{t.tasks.search}</span>
            <Input
              className="h-8 w-44 text-xs bg-transparent"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm công việc…"
            />
          </label>
          <Button variant="ghost" size="xs" type="submit">
            Tìm
          </Button>
        </form>
      </div>
      <div className="circle-task-list-region flex-1 min-h-0 overflow-y-auto">
        <PriorityTasks client={client} scope={scope} refreshToken={listRevision} filters={filters} onOpen={openTask} />
        <DeadlineReminders
          client={client}
          scope={scope}
          now={now}
          intervalMs={reminderIntervalMs}
          refreshToken={reminderRevision}
          onOpenTask={openTask}
        />
        <TaskList
          key={`${JSON.stringify(filters)}:${listRevision}`}
          client={client}
          scope={scope}
          filters={filters}
          selectedId={selectedId}
          onSelect={openTask}
          onChanged={refreshAfterSave}
        />
      </div>
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open && !session.memory.pending) setSelectedId(null);
        }}
      >
        <DialogContent
          className="workflow-task-dialog p-0 gap-0 overflow-hidden flex flex-col max-w-[calc(100vw-2rem)] sm:max-w-[1050px] max-h-[calc(100dvh-2rem)]"
          showCloseButton={false}
          onEscapeKeyDown={(event) => {
            if (session.memory.pending) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const source = selectionTrigger.current;
            const row = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-task-id]")).find(
              (element) => element.dataset.taskId === lastSelectedId.current,
            );
            (source?.isConnected ? source : row ?? heading.current)?.focus();
          }}
        >
          <div className="circle-peek-header border-b flex items-center gap-2 px-5 py-3 shrink-0">
            <ListTodo className="size-4 text-muted-foreground" aria-hidden="true" />
            <DialogTitle className="text-xs font-medium">Chi tiết công việc</DialogTitle>
            <DialogDescription className="sr-only">
              Cập nhật thuộc tính và đối chiếu nguồn email. Bản nháp được giữ khi đóng cửa sổ.
            </DialogDescription>
            {selectedId && onOpenAssistant && (
              <Button type="button" variant="outline" size="sm" className="ml-auto" disabled={session.pending > 0}
                onClick={() => onOpenAssistant(selectedId)}>
                Theo dõi và bàn giao
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={onOpenAssistant ? "size-7" : "size-7 ml-auto"}
              aria-label="Đóng chi tiết công việc"
              disabled={session.pending > 0}
              onClick={() => setSelectedId(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="circle-task-detail overflow-y-auto min-h-0">
            {selectedId ? (
              <TaskDetail
                key={selectedId}
                client={client}
                scope={scope}
                taskId={selectedId}
                onSaved={refreshAfterSave}
                onOpenMessage={onOpenMessage}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ListProps {
  client: ApiClient;
  scope: AccountScope;
  filters: TaskFilters;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}

function TaskList({ client, scope, filters, selectedId, onSelect, onChanged }: ListProps) {
  const session = useUiSession();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const queryParams: ListTasksParams = { ...filters, limit: 20 };
  const first = useScopedResource(scope, ["tasks", JSON.stringify(queryParams)], (signal) =>
    client.listTasks(scope, queryParams, { signal }),
  );
  const pageKey = `task-page:${scopeKey(scope)}:${JSON.stringify(filters)}`;
  const [extra, setExtra] = useStoredState<TaskView[]>(pageKey + ":rows", []);
  const [cursor, setCursor] = useStoredState<string | null | undefined>(pageKey + ":cursor", undefined);
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      mutation.current?.abort();
    };
  }, []);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);

  const nextCursor = cursor === undefined ? first.data?.next_cursor ?? null : cursor;
  const rows = [...(first.data?.items ?? []), ...extra];

  async function loadMore() {
    if (!nextCursor || moreBusy) return;
    const abort = new AbortController();
    controller.current = abort;
    setMoreBusy(true);
    setMoreError(null);
    try {
      const page = await client.listTasks(scope, { ...queryParams, cursor: nextCursor }, { signal: abort.signal });
      if (!alive.current || abort.signal.aborted) return;
      setExtra((e) => [...e, ...page.items]);
      setCursor(page.next_cursor);
    } catch (err) {
      if (alive.current && !abort.signal.aborted) setMoreError(err);
    } finally {
      if (alive.current) setMoreBusy(false);
    }
  }

  if (first.loading && !first.data) return <Loading />;
  if (first.error) return <ErrorBox error={first.error} onRetry={first.reload} />;
  if (rows.length === 0) return <Empty>{t.tasks.empty}</Empty>;

  return (
    <div className="task-list circle-task-list">
      <div className="circle-task-table-heading flex items-center gap-5 px-6 py-3 text-[10px] font-medium text-muted-foreground border-b">
        <span className="flex-1">CÔNG VIỆC</span>
        <span className="circle-task-state w-24">TRẠNG THÁI</span>
        <span className="circle-task-estimate w-20 text-right">THỜI LƯỢNG</span>
        <span className="circle-task-priority w-20">ƯU TIÊN</span>
        <span className="circle-task-owner w-28">PHỤ TRÁCH</span>
      </div>
      <div className="divide-y divide-border/50">
        {rows.map((task) => (
          <div key={task.id} className="flex items-center">
            <TaskLine task={task} selected={task.id === selectedId} onSelect={() => onSelect(task.id)} />
            {task.state !== "cancelled" && <Button type="button" size="sm" variant="ghost"
              disabled={savingId !== null || session.pending > 0} aria-label={`${task.state === "done" ? "Mở lại" : "Hoàn thành"} ${task.title}`}
              onClick={async () => {
                if (session.memory.pending || savingId !== null) return;
                const release = session.beginMutation();
                const abort = new AbortController();
                mutation.current = abort;
                setSavingId(task.id); setSaveError(null);
                let saved = false;
                try {
                  await client.updateTask(scope, task.id, {
                    expected_version:task.version, patch:{state:task.state === "done" ? "not_started" : "done"},
                  }, {signal:abort.signal});
                  if (!alive.current || abort.signal.aborted) return;
                  saved = true;
                } catch (error) {
                  if (!alive.current || abort.signal.aborted) return;
                  setSaveError(error);
                  setExtra([]);
                  setCursor(undefined);
                  first.reload();
                } finally {
                  release();
                  if (alive.current) setSavingId(null);
                }
                if (saved && alive.current && !abort.signal.aborted) onChanged();
              }}>{task.state === "done" ? "Mở lại" : "Hoàn thành"}</Button>}
          </div>
        ))}
      </div>
      {saveError ? <ErrorBox error={saveError} /> : null}
      {moreError ? <ErrorBox error={moreError} onRetry={() => void loadMore()} /> : null}
      {nextCursor ? (
        <div className="p-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={moreBusy}>
            {moreBusy ? t.common.loading : t.common.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface DetailProps {
  client: ApiClient;
  scope: AccountScope;
  taskId: string;
  onSaved: (task: TaskView) => void;
  onOpenMessage: (messageId: string) => void;
}

function TaskDetail({ client, scope, taskId, onSaved, onOpenMessage }: DetailProps) {
  const task = useScopedResource<TaskView>(scope, ["task", taskId], (signal) => client.getTask(scope, taskId, { signal }));
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  if (task.loading && !task.data) return <Loading />;
  if (task.error) return <ErrorBox error={task.error} onRetry={task.reload} />;
  const data = task.data;
  if (!data) return null;

  return (
    <section aria-label={data.title}>
      <TaskEditor client={client} scope={scope} task={data} onSaved={onSaved}
        onOpenMessage={onOpenMessage} onOpenEvidence={setEvidenceId} />
      {evidenceId && (
        <div className="workflow-evidence">
          <EvidencePanel client={client} scope={scope} evidenceId={evidenceId}
            onOpenMessage={onOpenMessage} onClose={() => setEvidenceId(null)} />
        </div>
      )}
    </section>
  );
}
