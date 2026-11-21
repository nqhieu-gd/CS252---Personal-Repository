import { describe, expect, it } from "vitest";
import {
  deadlineScore,
  duplicateSimilarity,
  evaluateDecisions,
  impactScore,
  rankItems,
  relevanceScore,
  selectAttention,
  titleSimilarity,
} from "./decisionPreviewMock";
import type { DecisionItem, DecisionPolicy } from "../api/types";

const defaultPolicy: DecisionPolicy = {
  deadline_weight: 0.5,
  relevance_weight: 0.3,
  impact_weight: 0.2,
  priority_threshold: 0.6,
  notification_budget: 5,
  reminder_frequency: 1,
  duplicate_threshold: 0.85,
  time_window: 72,
  source_trust_weight: 0.25,
  source_trust: { eml: 1, gmail_fake: 1, gmail: 1 },
};

describe("decisionPreviewMock - Section D6 acceptance vectors", () => {
  const now = new Date("2026-10-30T10:00:00Z");

  it("Vector 1: calculates part scores and weighted priority", () => {
    // Deadline after 24h: 2026-10-31T10:00:00Z
    const deadline = "2026-10-31T10:00:00Z";
    const d = deadlineScore(deadline, now);
    expect(d).toBeCloseTo(0.5, 4);

    const r = relevanceScore("Send Report Now", new Set(["send", "report"]));
    expect(r).toBeCloseTo(1.0, 4);

    const i = impactScore("normal");
    expect(i).toBe(0.5);

    const item: DecisionItem = {
      ref: { account_id: "acc-1", task_id: "task-1" },
      title: "Send Report Now",
      state: "not_started",
      owner: "Lan",
      importance: "normal",
      deadline,
      event_at: now.toISOString(),
      source_type: "eml",
    };

    // weights .5 / .3 / .2 -> .65
    const [score1] = rankItems([item], {
      policy: defaultPolicy,
      focusTerms: ["send", "report"],
      now,
    });
    expect(score1.priority_score).toBeCloseTo(0.65, 4);

    // weights .8 / .1 / .1 -> .55
    const policy2: DecisionPolicy = {
      ...defaultPolicy,
      deadline_weight: 0.8,
      relevance_weight: 0.1,
      impact_weight: 0.1,
    };
    const [score2] = rankItems([item], {
      policy: policy2,
      focusTerms: ["send", "report"],
      now,
    });
    expect(score2.priority_score).toBeCloseTo(0.55, 4);
  });

  it("Vector 2: calculates Jaccard similarity and duplicate threshold gates", () => {
    const j = titleSimilarity("send report", "send final report");
    // tokens: ['send', 'report'] vs ['send', 'final', 'report']
    // intersection = 2, union = 3 -> 2/3
    expect(j).toBeCloseTo(2 / 3, 4);

    const itemA: DecisionItem = {
      ref: { account_id: "acc-1", task_id: "task-a" },
      title: "send report",
      state: "not_started",
      owner: "Lan",
      importance: "normal",
      deadline: "2026-10-31T10:00:00Z",
      event_at: now.toISOString(),
      source_type: "eml",
    };
    const itemB: DecisionItem = {
      ref: { account_id: "acc-2", task_id: "task-b" },
      title: "send final report",
      state: "not_started",
      owner: "Lan",
      importance: "normal",
      deadline: "2026-10-31T10:00:00Z",
      event_at: now.toISOString(),
      source_type: "gmail",
    };

    // threshold 0.6 -> matches
    const sim6 = duplicateSimilarity(itemA, itemB, { ...defaultPolicy, duplicate_threshold: 0.6 });
    expect(sim6).toBeCloseTo(2 / 3, 4);

    // threshold 0.8 -> null
    const sim8 = duplicateSimilarity(itemA, itemB, { ...defaultPolicy, duplicate_threshold: 0.8 });
    expect(sim8).toBeNull();
  });

  it("Vector 3: cooldown on reminder_frequency boundaries", () => {
    // Last notified 6 hours ago
    const sixHoursAgo = new Date(now.getTime() - 6 * 3600 * 1000).toISOString();
    const group = {
      representative: { account_id: "acc-1", task_id: "task-1" },
      members: [{ account_id: "acc-1", task_id: "task-1" }],
      priority_score: 0.9,
      min_similarity: 1.0,
    };

    // frequency 1 = cooldown 24h -> 6h ago is in cooldown
    const sel1 = selectAttention([group], {
      policy: { ...defaultPolicy, reminder_frequency: 1, priority_threshold: 0.6 },
      receipts: [{ ref: group.representative, notified_at: sixHoursAgo }],
      now,
    });
    expect(sel1.cooldown).toEqual([group.representative]);
    expect(sel1.selected).toEqual([]);

    // frequency 4 = cooldown 6h -> boundary >= 6h is eligible
    const sel4 = selectAttention([group], {
      policy: { ...defaultPolicy, reminder_frequency: 4, priority_threshold: 0.6 },
      receipts: [{ ref: group.representative, notified_at: sixHoursAgo }],
      now,
    });
    expect(sel4.cooldown).toEqual([]);
    expect(sel4.selected).toEqual([group.representative]);
  });

  it("Vector 4: respects notification_budget", () => {
    const group1 = {
      representative: { account_id: "acc-1", task_id: "t1" },
      members: [{ account_id: "acc-1", task_id: "t1" }],
      priority_score: 0.9,
      min_similarity: 1.0,
    };
    const group2 = {
      representative: { account_id: "acc-1", task_id: "t2" },
      members: [{ account_id: "acc-1", task_id: "t2" }],
      priority_score: 0.7,
      min_similarity: 1.0,
    };

    const selBudget1 = selectAttention([group1, group2], {
      policy: { ...defaultPolicy, notification_budget: 1, priority_threshold: 0.6 },
      receipts: [],
      now,
    });
    expect(selBudget1.selected).toEqual([group1.representative]);
    expect(selBudget1.over_budget).toEqual([group2.representative]);

    const selBudget2 = selectAttention([group1, group2], {
      policy: { ...defaultPolicy, notification_budget: 2, priority_threshold: 0.6 },
      receipts: [],
      now,
    });
    expect(selBudget2.selected).toEqual([group1.representative, group2.representative]);
    expect(selBudget2.over_budget).toEqual([]);
  });

  it("evaluates complete preview and filters done/cancelled items", () => {
    const items: DecisionItem[] = [
      {
        ref: { account_id: "acc-1", task_id: "t1" },
        title: "Active task",
        state: "not_started",
        owner: "Lan",
        importance: "high",
        deadline: "2026-10-31T10:00:00Z",
        event_at: now.toISOString(),
        source_type: "eml",
      },
      {
        ref: { account_id: "acc-1", task_id: "t2" },
        title: "Done task",
        state: "done",
        owner: "Lan",
        importance: "high",
        deadline: null,
        event_at: now.toISOString(),
        source_type: "eml",
      },
    ];

    const preview = evaluateDecisions(items, {
      policy: defaultPolicy,
      context: { focus_terms: ["active"], last_notified: [] },
      now,
    });

    expect(preview.policy_version).toBe("w2-decision-v1");
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0].ref.task_id).toBe("t1");
    expect(preview.scores).toHaveLength(1);
    expect(preview.groups).toHaveLength(1);
    expect(preview.selection.selected).toHaveLength(1);
  });
});
