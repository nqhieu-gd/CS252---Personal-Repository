/**
 * Pure decision preview logic for mock / client simulation (contract w2-decision-v1).
 * Specification: w2-interfaces-v2 — 29/10/2026, Section D.
 *
 * Functions here perform no I/O, read no clock and use no randomness:
 * callers pass every input, including `now`. Invalid input throws Error.
 */

import type {
  AccountKind,
  AttentionReceipt,
  AttentionSelection,
  DecisionContext,
  DecisionItem,
  DecisionPolicy,
  DecisionPreview,
  DuplicateGroup,
  Importance,
  PriorityScore,
  TaskRef,
  TaskState,
} from "../api/types";

export const POLICY_VERSION = "w2-decision-v1" as const;

export const ACTIVE_STATES: ReadonlySet<TaskState> = new Set([
  "not_started",
  "in_progress",
  "waiting",
]);

export const IMPACT_SCORES: Record<Importance, number> = {
  low: 0.25,
  normal: 0.5,
  high: 1.0,
};

export const SOURCE_KINDS: readonly AccountKind[] = ["eml", "gmail_fake", "gmail"];

const MAX_FOCUS_TERMS = 20;
const MAX_FOCUS_TERM_LENGTH = 50;
const MAX_FOCUS_WORDS = 100;

function isFiniteNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val);
}

function requireUnit(name: string, val: unknown): void {
  if (!isFiniteNumber(val) || val < 0 || val > 1) {
    throw new Error(`${name} must be a number from 0 to 1`);
  }
}

function requireInt(name: string, val: unknown, low: number, high: number): void {
  if (!Number.isSafeInteger(val) || (val as number) < low || (val as number) > high) {
    throw new Error(`${name} must be an integer from ${low} to ${high}`);
  }
}

export function validateDecisionPolicy(policy: DecisionPolicy): void {
  if (!policy || typeof policy !== "object") {
    throw new Error("policy must be an object");
  }
  requireUnit("deadline_weight", policy.deadline_weight);
  requireUnit("relevance_weight", policy.relevance_weight);
  requireUnit("impact_weight", policy.impact_weight);
  requireUnit("priority_threshold", policy.priority_threshold);
  requireUnit("source_trust_weight", policy.source_trust_weight);

  if (policy.deadline_weight + policy.relevance_weight + policy.impact_weight <= 0) {
    throw new Error("deadline, relevance and impact weights must not all be 0");
  }

  requireInt("notification_budget", policy.notification_budget, 0, 50);
  requireInt("reminder_frequency", policy.reminder_frequency, 0, 24);

  if (!isFiniteNumber(policy.duplicate_threshold) || policy.duplicate_threshold <= 0 || policy.duplicate_threshold > 1) {
    throw new Error("duplicate_threshold must be a number above 0 and at most 1");
  }

  if (!isFiniteNumber(policy.time_window) || policy.time_window < 0 || policy.time_window > 720) {
    throw new Error("time_window must be a number of hours from 0 to 720");
  }

  const trust = policy.source_trust;
  if (!trust || typeof trust !== "object") {
    throw new Error("source_trust must have keys eml, gmail_fake and gmail");
  }
  for (const kind of SOURCE_KINDS) {
    requireUnit(`source_trust.${kind}`, trust[kind]);
  }
}

export function refKey(ref: TaskRef): string {
  return `${ref.account_id}/${ref.task_id}`;
}

export function compareRef(a: TaskRef, b: TaskRef): number {
  if (a.account_id !== b.account_id) return a.account_id.localeCompare(b.account_id);
  return a.task_id.localeCompare(b.task_id);
}

export function tokenize(text: string): Set<string> {
  const matches = text.toLowerCase().match(/[\p{L}\p{M}\p{N}_]+/gu);
  return new Set(matches ?? []);
}

export function focusTermTokens(focusTerms: string[]): Set<string> {
  if (!Array.isArray(focusTerms) || focusTerms.length > MAX_FOCUS_TERMS) {
    throw new Error(`focus_terms must be an array of at most ${MAX_FOCUS_TERMS} strings`);
  }
  const words: string[] = [];
  for (const term of focusTerms) {
    if (typeof term !== "string" || term.trim().length < 1 || term.trim().length > MAX_FOCUS_TERM_LENGTH) {
      throw new Error(`each focus term must have 1 to ${MAX_FOCUS_TERM_LENGTH} characters after trimming`);
    }
    const matches = term.trim().toLowerCase().match(/[\p{L}\p{M}\p{N}_]+/gu);
    if (matches) words.push(...matches);
  }
  if (words.length > MAX_FOCUS_WORDS) {
    throw new Error(`focus_terms may contain at most ${MAX_FOCUS_WORDS} words in total`);
  }
  return new Set(words);
}

export function deadlineScore(deadline: string | null, now: Date): number {
  if (!deadline) return 0.0;
  const deadlineDate = new Date(deadline);
  const hoursLeft = (deadlineDate.getTime() - now.getTime()) / (1000 * 3600);
  return 1 / (1 + Math.max(hoursLeft, 0.0) / 24);
}

export function relevanceScore(title: string, focusTokens: Set<string>): number {
  if (focusTokens.size === 0) return 0.5;
  const titleTokens = tokenize(title);
  let intersection = 0;
  for (const token of titleTokens) {
    if (focusTokens.has(token)) intersection++;
  }
  return intersection / focusTokens.size;
}

export function impactScore(importance: Importance): number {
  if (!(importance in IMPACT_SCORES)) {
    throw new Error(`Unknown importance: ${importance}`);
  }
  return IMPACT_SCORES[importance];
}

export function activeItems(items: DecisionItem[]): DecisionItem[] {
  const seen = new Set<string>();
  const active: DecisionItem[] = [];
  for (const item of items) {
    const key = refKey(item.ref);
    if (seen.has(key)) throw new Error(`Duplicate task reference: ${key}`);
    seen.add(key);
    if (ACTIVE_STATES.has(item.state)) {
      active.push(item);
    }
  }
  return active.sort((a, b) => compareRef(a.ref, b.ref));
}

export function rankItems(
  items: DecisionItem[],
  options: { policy: DecisionPolicy; focusTerms: string[]; now: Date },
): PriorityScore[] {
  validateDecisionPolicy(options.policy);
  const focus = focusTermTokens(options.focusTerms);
  const total =
    options.policy.deadline_weight +
    options.policy.relevance_weight +
    options.policy.impact_weight;

  const active = activeItems(items);
  const scores: PriorityScore[] = active.map((item) => {
    const d = deadlineScore(item.deadline, options.now);
    const r = relevanceScore(item.title, focus);
    const i = impactScore(item.importance);
    const priority =
      (options.policy.deadline_weight * d +
        options.policy.relevance_weight * r +
        options.policy.impact_weight * i) /
      total;

    return {
      ref: item.ref,
      deadline_score: d,
      relevance_score: r,
      impact_score: i,
      priority_score: priority,
    };
  });

  return scores.sort((a, b) => {
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    return compareRef(a.ref, b.ref);
  });
}

export function titleSimilarity(left: string, right: string): number {
  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 && b.size === 0) return 0.0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0.0;
}

export function duplicateSimilarity(
  left: DecisionItem,
  right: DecisionItem,
  policy: DecisionPolicy,
): number | null {
  if (
    left.ref.account_id === right.ref.account_id &&
    left.source_type === right.source_type
  ) {
    return null;
  }

  const leftEvent = new Date(left.event_at).getTime();
  const rightEvent = new Date(right.event_at).getTime();
  if (Math.abs(leftEvent - rightEvent) / (1000 * 3600) > policy.time_window) {
    return null;
  }

  const leftOwner = left.owner?.trim().toLowerCase() ?? null;
  const rightOwner = right.owner?.trim().toLowerCase() ?? null;
  if (leftOwner !== rightOwner) {
    return null;
  }

  const leftDl = left.deadline ? new Date(left.deadline).getTime() : null;
  const rightDl = right.deadline ? new Date(right.deadline).getTime() : null;
  if (leftDl !== rightDl) {
    return null;
  }

  const similarity = titleSimilarity(left.title, right.title);
  return similarity >= policy.duplicate_threshold ? similarity : null;
}

export function representativeScore(
  priority: number,
  sourceTrust: number,
  policy: DecisionPolicy,
): number {
  const w = policy.source_trust_weight;
  return (1 - w) * priority + w * sourceTrust;
}

export function groupDuplicates(
  items: DecisionItem[],
  scores: PriorityScore[],
  options: { policy: DecisionPolicy },
): DuplicateGroup[] {
  validateDecisionPolicy(options.policy);
  const active = activeItems(items);
  const scoreMap = new Map<string, PriorityScore>();
  for (const score of scores) {
    scoreMap.set(refKey(score.ref), score);
  }

  const groups: DecisionItem[][] = [];
  const similarities: number[][] = [];

  for (const candidate of active) {
    let joined = false;
    for (let i = 0; i < groups.length; i++) {
      const members = groups[i];
      const pairScores = members.map((m) =>
        duplicateSimilarity(candidate, m, options.policy),
      );
      if (pairScores.every((score): score is number => score !== null)) {
        members.push(candidate);
        similarities[i].push(...pairScores);
        joined = true;
        break;
      }
    }
    if (!joined) {
      groups.push([candidate]);
      similarities.push([]);
    }
  }

  const result: DuplicateGroup[] = groups.map((members, index) => {
    // Pick representative
    const rep = members.reduce((best, curr) => {
      const bestPriority = scoreMap.get(refKey(best.ref))!.priority_score;
      const bestTrust = options.policy.source_trust[best.source_type];
      const bestBlend = representativeScore(bestPriority, bestTrust, options.policy);

      const currPriority = scoreMap.get(refKey(curr.ref))!.priority_score;
      const currTrust = options.policy.source_trust[curr.source_type];
      const currBlend = representativeScore(currPriority, currTrust, options.policy);

      if (currBlend !== bestBlend) {
        return currBlend > bestBlend ? curr : best;
      }
      if (currPriority !== bestPriority) {
        return currPriority > bestPriority ? curr : best;
      }
      return compareRef(curr.ref, best.ref) < 0 ? curr : best;
    });

    const groupPriority = Math.max(
      ...members.map((m) => scoreMap.get(refKey(m.ref))!.priority_score),
    );
    const pairScores = similarities[index];
    const minSim = pairScores.length > 0 ? Math.min(...pairScores) : 1.0;

    return {
      representative: rep.ref,
      members: members.map((m) => m.ref).sort(compareRef),
      priority_score: groupPriority,
      min_similarity: minSim,
    };
  });

  return result.sort((a, b) => {
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    return compareRef(a.representative, b.representative);
  });
}

export function selectAttention(
  groups: DuplicateGroup[],
  options: {
    policy: DecisionPolicy;
    receipts: AttentionReceipt[];
    now: Date;
  },
): AttentionSelection {
  validateDecisionPolicy(options.policy);
  const { policy, receipts, now } = options;

  const latestReceipts = new Map<string, Date>();
  for (const receipt of receipts) {
    const key = refKey(receipt.ref);
    if (latestReceipts.has(key)) {
      throw new Error(`Duplicate task in last_notified: ${key}`);
    }
    const receiptDate = new Date(receipt.notified_at);
    if (receiptDate.getTime() > now.getTime()) {
      throw new Error("last_notified cannot be in the future");
    }
    latestReceipts.set(key, receiptDate);
  }

  const frequency = policy.reminder_frequency;
  const intervalMs = frequency > 0 ? (24 / frequency) * 3600 * 1000 : null;

  const selection: AttentionSelection = {
    selected: [],
    below_threshold: [],
    cooldown: [],
    over_budget: [],
  };

  const sortedGroups = [...groups].sort((a, b) => {
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    return compareRef(a.representative, b.representative);
  });

  for (const group of sortedGroups) {
    const remindedTimes = group.members
      .map((member) => latestReceipts.get(refKey(member)))
      .filter((date): date is Date => date !== undefined);

    if (group.priority_score < policy.priority_threshold) {
      selection.below_threshold.push(group.representative);
    } else if (
      remindedTimes.length > 0 &&
      (intervalMs === null ||
        now.getTime() - Math.max(...remindedTimes.map((d) => d.getTime())) < intervalMs)
    ) {
      selection.cooldown.push(group.representative);
    } else if (selection.selected.length < policy.notification_budget) {
      selection.selected.push(group.representative);
    } else {
      selection.over_budget.push(group.representative);
    }
  }

  return selection;
}

export function evaluateDecisions(
  items: DecisionItem[],
  options: {
    policy: DecisionPolicy;
    context: DecisionContext;
    now: Date;
  },
): DecisionPreview {
  validateDecisionPolicy(options.policy);
  focusTermTokens(options.context.focus_terms);

  const seen = new Set<string>();
  for (const item of items) {
    const key = refKey(item.ref);
    if (seen.has(key)) throw new Error(`Duplicate item reference: ${key}`);
    seen.add(key);
  }

  const active = activeItems(items);
  const activeRefs = new Set(active.map((i) => refKey(i.ref)));

  const receipts: AttentionReceipt[] = [];
  const receiptSeen = new Set<string>();
  for (const receipt of options.context.last_notified) {
    const key = refKey(receipt.ref);
    if (receiptSeen.has(key)) {
      throw new Error(`Duplicate task in last_notified: ${key}`);
    }
    receiptSeen.add(key);
    if (!seen.has(key)) {
      throw new Error(`last_notified refers to a task that is not in the preview: ${key}`);
    }
    if (activeRefs.has(key)) {
      receipts.push(receipt);
    }
  }

  const scores = rankItems(active, {
    policy: options.policy,
    focusTerms: options.context.focus_terms,
    now: options.now,
  });

  const groups = groupDuplicates(active, scores, {
    policy: options.policy,
  });

  const selection = selectAttention(groups, {
    policy: options.policy,
    receipts,
    now: options.now,
  });

  return {
    policy_version: POLICY_VERSION,
    evaluated_at: options.now.toISOString(),
    policy: options.policy,
    items: active,
    scores,
    groups,
    selection,
  };
}
