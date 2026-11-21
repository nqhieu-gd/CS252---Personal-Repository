import { useState, useRef, useEffect } from "react";
import type { ApiClient } from "../../api/client";
import { isApiError } from "../../api/client";
import type {
  AccountKind,
  AccountScope,
  AccountView,
  AttentionReceipt,
  DecisionContext,
  DecisionItem,
  DecisionPolicy,
  DecisionPreview,
  DecisionPreviewRequest,
} from "../../api/types";
import { ErrorBox, Loading } from "../../components/StatusViews";
import { t } from "../../strings";
import { Button } from "../../components/upstream/circle/button";
import { Input } from "../../components/upstream/circle/input";
import { ArrowRight, CalendarDays, Check, Layers, Sparkles } from "lucide-react";
import { formatLocalDate } from "../workflowDate";
import { focusTermTokens, validateDecisionPolicy } from "../../lib/decisionPreviewMock";

export interface DecisionPreviewPageProps {
  client: ApiClient;
  workspaceId: string;
  accounts: AccountView[];
  initialAccountId: string | null;
  onOpenTask: (scope: AccountScope, taskId: string) => void;
}

const DEFAULT_POLICY: DecisionPolicy = {
  deadline_weight: 0.5,
  relevance_weight: 0.3,
  impact_weight: 0.2,
  source_trust_weight: 0.25,
  priority_threshold: 0.6,
  notification_budget: 5,
  reminder_frequency: 1,
  duplicate_threshold: 0.85,
  time_window: 72,
  source_trust: {
    eml: 1.0,
    gmail_fake: 1.0,
    gmail: 1.0,
  },
};

export function DecisionPreviewPage({
  client,
  workspaceId,
  accounts,
  initialAccountId,
  onOpenTask,
}: DecisionPreviewPageProps) {
  // Account selection (1 to 8 accounts)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
      return [initialAccountId];
    }
    return accounts.length > 0 ? [accounts[0].id] : [];
  });

  // Policy form state
  const [policy, setPolicy] = useState<DecisionPolicy>(DEFAULT_POLICY);
  const [focusTermsInput, setFocusTermsInput] = useState("");
  const [simulatedReceipts, setSimulatedReceipts] = useState<AttentionReceipt[]>([]);

  // Execution state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [previewData, setPreviewData] = useState<DecisionPreview | null>(null);
  const [evaluatedFingerprint, setEvaluatedFingerprint] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const currentFingerprint = JSON.stringify({
    accountIds: [...selectedAccountIds].sort(),
    policy,
    focusTerms: focusTermsInput,
    simulatedReceipts,
  });

  const params = new URLSearchParams(location.search);
  const demoControls = import.meta.env.DEV && params.get("mode") === "mock" && params.get("demo-controls") === "1";
  const isStale = previewData !== null && evaluatedFingerprint !== currentFingerprint;
  const isAccountSelectionValid = selectedAccountIds.length >= 1 && selectedAccountIds.length <= 8;

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      }
      if (prev.length >= 8) return prev;
      return [...prev, accountId];
    });
  }

  function handlePolicyChange<K extends keyof DecisionPolicy>(key: K, value: DecisionPolicy[K]) {
    setPolicy((prev) => ({ ...prev, [key]: value }));
  }

  function handleTrustChange(kind: AccountKind, value: number) {
    setPolicy((prev) => ({
      ...prev,
      source_trust: {
        ...prev.source_trust,
        [kind]: value,
      },
    }));
  }

  async function runPreview() {
    if (!isAccountSelectionValid || busy) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const currentGen = ++generationRef.current;

    setBusy(true);
    setError(null);

    const focusTerms = focusTermsInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      focusTermTokens(focusTerms);
    } catch {
      setBusy(false);
      setError(new Error("Chủ đề quá dài. Hãy giảm số từ hoặc dùng các từ khóa ngắn hơn."));
      return;
    }
    try {
      validateDecisionPolicy(policy);
    } catch {
      setBusy(false);
      setError(new Error("Giá trị trình diễn chưa hợp lệ. Hãy kiểm tra các ô thiết lập rồi thử lại."));
      return;
    }

    const context: DecisionContext = {
      focus_terms: focusTerms,
      last_notified: simulatedReceipts.filter(({ ref }) => selectedAccountIds.includes(ref.account_id)),
    };

    const request: DecisionPreviewRequest = {
      account_ids: selectedAccountIds,
      policy,
      context,
    };

    try {
      const result = await client.previewDecisions(workspaceId, request, { signal: controller.signal });
      if (generationRef.current !== currentGen || controller.signal.aborted) return;
      setPreviewData(result);
      setEvaluatedFingerprint(currentFingerprint);
    } catch (err: unknown) {
      if (generationRef.current !== currentGen || controller.signal.aborted) return;
      if (isApiError(err)) {
        if (err.code === "account_cleanup_pending" || err.code === "account_data_deleted") {
          setPreviewData(null);
          setEvaluatedFingerprint(null);
          setSimulatedReceipts([]);
          setError(new Error(t.decisions.fencedAccount));
        } else if (err.code === "decision_input_too_large") {
          setError(new Error(t.decisions.inputTooLarge));
        } else {
          setError(new Error("Chưa thể tải gợi ý. Bạn có thể thử lại."));
        }
      } else {
        setError(new Error("Chưa thể tải gợi ý. Bạn có thể thử lại."));
      }
    } finally {
      if (generationRef.current === currentGen) {
        setBusy(false);
      }
    }
  }

  // Lookup map for fast item details
  const itemMap = new Map<string, DecisionItem>();
  if (previewData) {
    for (const item of previewData.items) {
      itemMap.set(`${item.ref.account_id}:${item.ref.task_id}`, item);
    }
  }

  const accountMap = new Map<string, AccountView>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc);
  }

  const keyOf = (ref: DecisionItem["ref"]) => `${ref.account_id}:${ref.task_id}`;
  const selected = previewData?.selection.selected ?? [];
  const selectedKeys = new Set(selected.map(keyOf));
  const otherTasks = previewData?.scores.filter(({ ref }) => !selectedKeys.has(keyOf(ref))) ?? [];
  const possibleDuplicates = previewData?.groups.filter(({ members }) => members.length > 1) ?? [];

  // Why a task is not in the attention list, so every remaining task stays explainable.
  const reasons = new Map<string, keyof typeof t.decisions.otherReasons>();
  if (previewData) {
    for (const group of possibleDuplicates) {
      for (const member of group.members) {
        if (keyOf(member) !== keyOf(group.representative)) reasons.set(keyOf(member), "grouped");
      }
    }
    const { below_threshold, cooldown, over_budget } = previewData.selection;
    for (const [list, reason] of [[over_budget, "over_budget"], [cooldown, "cooldown"], [below_threshold, "below_threshold"]] as const) {
      for (const ref of list) reasons.set(keyOf(ref), reason);
    }
  }

  function taskRow(ref: DecisionItem["ref"], note?: string) {
    const item = itemMap.get(keyOf(ref));
    if (!item) return null;
    return (
      <li key={keyOf(ref)} className="workflow-list-row">
        <button type="button" className="workflow-task-link" onClick={() =>
          onOpenTask({ workspace_id: workspaceId, account_id: ref.account_id }, ref.task_id)
        }>
          <span>
            <strong>{item.title}</strong>
            <small>{accountMap.get(ref.account_id)?.display_name ?? "Nguồn email"} · {t.tasks.states[item.state]}{note ? ` · ${note}` : ""}</small>
          </span>
          {item.deadline && <time dateTime={item.deadline}><CalendarDays size={15} />{formatLocalDate(item.deadline)}</time>}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </li>
    );
  }

  return (
    <section className="workflow-page" aria-labelledby="suggestion-heading">
      <div className="workflow-wrap">
        <header className="workflow-hero">
          <span className="workflow-icon"><Sparkles size={23} aria-hidden="true" /></span>
          <div>
            <h2 id="suggestion-heading">Việc nên làm trước</h2>
            <p>Xem những việc cần chú ý và đối chiếu các việc có thể bị ghi lặp.</p>
          </div>
        </header>

        <div className="workflow-split">
          <div className="workflow-stack">
            {isStale && <p role="status" className="workflow-notice">Bạn đã đổi lựa chọn. Bấm Xem gợi ý để cập nhật danh sách.</p>}
            {error ? <ErrorBox error={error} onRetry={() => void runPreview()} /> : null}
            <section className="workflow-panel">
              <div className="workflow-panel-heading">
                <h3>Cần chú ý trước</h3>
                {isStale && <span className="workflow-pill workflow-pill-stale" data-testid="decision-preview-stale">{t.decisions.staleResult}</span>}
                {previewData && <span className="workflow-pill">{selected.length} việc</span>}
              </div>
              {busy && !previewData ? <Loading label="Đang tìm việc cần chú ý…" /> :
                selected.length > 0 ? <ul className="workflow-list">{selected.map((ref) => taskRow(ref))}</ul> :
                  <p className="workflow-empty">{previewData ? "Chưa có việc nào cần đưa lên trước." : "Chọn nguồn email rồi bấm Xem gợi ý."}</p>}
            </section>
            {previewData && (
              <>
                <details className="workflow-panel">
                  <summary>Các công việc khác <span className="workflow-pill">{otherTasks.length}</span></summary>
                  {otherTasks.length ? <ul className="workflow-list">{otherTasks.map(({ ref }) => {
                    const reason = reasons.get(keyOf(ref));
                    return taskRow(ref, reason ? t.decisions.otherReasons[reason] : undefined);
                  })}</ul> :
                    <p className="workflow-empty">Chưa có công việc khác.</p>}
                </details>
                <section className="workflow-panel">
                  <div className="workflow-panel-heading"><h3>Có thể cùng một việc</h3></div>
                  {possibleDuplicates.length ? possibleDuplicates.map(({ representative, members }) => (
                    <div className="workflow-duplicate" key={keyOf(representative)}>
                      <p>Đối chiếu {members.length} công việc</p>
                      <ul className="workflow-list">{members.map((member) =>
                        taskRow(member, keyOf(member) === keyOf(representative) ? t.decisions.labels.representative : undefined))}</ul>
                    </div>
                  )) : <p className="workflow-empty">Chưa thấy công việc nào có khả năng trùng.</p>}
                </section>
              </>
            )}
          </div>

          <aside className="workflow-panel workflow-options workflow-decision-options" aria-label="Tùy chọn gợi ý">
            <div className="workflow-panel-heading"><h3><Layers size={17} aria-hidden="true" /> Nguồn email</h3></div>
            <div className="workflow-source-picker">
              {accounts.map(acc => (
                <label key={acc.id} className="workflow-check">
                  <input type="checkbox" checked={selectedAccountIds.includes(acc.id)}
                    disabled={selectedAccountIds.length === 8 && !selectedAccountIds.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)} />
                  <span>{acc.display_name}</span>
                </label>
              ))}
            </div>
            {!isAccountSelectionValid && <p className="workflow-notice">Vui lòng chọn ít nhất một nguồn email.</p>}
            {selectedAccountIds.length === 8 && <p className="workflow-muted">Có thể xem tối đa 8 nguồn cùng lúc.</p>}
            <label className="workflow-field">
              <span>Chủ đề đang quan tâm <small>(không bắt buộc)</small></span>
              <Input placeholder="Ví dụ: báo cáo, thuyết trình" value={focusTermsInput} onChange={e => setFocusTermsInput(e.target.value)} />
            </label>
            <Button type="button" disabled={busy || !isAccountSelectionValid} onClick={() => void runPreview()}>
              {busy ? "Đang tìm gợi ý…" : "Xem gợi ý"}
            </Button>
            {previewData && <p className="workflow-muted">Cập nhật lúc {formatLocalDate(previewData.evaluated_at)}</p>}
          </aside>
        </div>

        {demoControls && (
          <details className="workflow-panel workflow-demo">
            <summary>Thiết lập trình diễn</summary>
            <div className="workflow-fields">
              {([
                ["deadline_weight", "Mức ưu tiên hạn gần", 1, .05],
                ["relevance_weight", "Mức ưu tiên theo chủ đề", 1, .05],
                ["impact_weight", "Mức ưu tiên việc quan trọng", 1, .05],
                ["source_trust_weight", "Mức ưu tiên nguồn khi chọn bản đại diện", 1, .05],
                ["priority_threshold", "Mức tối thiểu để đưa lên trước", 1, .05],
                ["duplicate_threshold", "Mức giống nhau để gợi ý trùng", 1, .05],
                ["notification_budget", "Số nhóm đề xuất tối đa", 50, 1],
                ["reminder_frequency", "Số lần nhắc lại mỗi ngày", 24, 1],
                ["time_window", "Khoảng cách giữa hai nguồn (giờ)", 720, 1],
              ] as const).map(([key, label, max, step]) => (
                <label className="workflow-field" key={key}>{label}
                  <Input type="number" min={0} max={max} step={step}
                    value={Number.isFinite(policy[key]) ? policy[key] : ""}
                    onChange={e => handlePolicyChange(key, e.target.valueAsNumber)} />
                </label>
              ))}
              {(["eml", "gmail_fake", "gmail"] as const).map(kind => (
                <label className="workflow-field" key={kind}>Ưu tiên nguồn {t.accounts.kinds[kind]}
                  <Input type="number" min={0} max={1} step={.05}
                    value={Number.isFinite(policy.source_trust[kind]) ? policy.source_trust[kind] : ""}
                    onChange={e => handleTrustChange(kind, e.target.valueAsNumber)} />
                </label>
              ))}
            </div>
            <div className="workflow-demo-actions">
              {selected.length > 0 && <Button type="button" variant="outline" onClick={() => setSimulatedReceipts(selected.map(ref => ({
                ref, notified_at: new Date().toISOString(),
              })))}><Check size={16} /> Mô phỏng vừa nhắc các việc được chọn</Button>}
              {simulatedReceipts.length > 0 && <Button type="button" variant="outline" onClick={() => setSimulatedReceipts([])}>Đặt lại lần nhắc thử</Button>}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
