/**
 * Prioritised action checklist. Priority comes from the attention level of the
 * rule that produced the action, then from how close its nearest date is.
 */

import { diffInDays } from "./dateCalculations";
import type { Attention, ChecklistAction, EvaluationResult } from "./types";

const WEIGHT: Record<Attention, number> = {
  confirm_now: 0,
  prepare: 1,
  monitor: 2,
  information: 3,
};

export function buildChecklist(
  evaluation: EvaluationResult,
  asOfDate: string,
): ChecklistAction[] {
  const actions: ChecklistAction[] = [];

  evaluation.findings.forEach((finding) => {
    const nearest = finding.dates
      .map((d) => diffInDays(asOfDate, d.date))
      .filter((n): n is number => n !== null && n >= 0)
      .sort((a, b) => a - b)[0];

    finding.actions.forEach((label, index) => {
      actions.push({
        id: `${finding.ruleId}:action-${index}`,
        label,
        attention: finding.attention,
        ruleId: finding.ruleId,
        sourceIds: finding.sourceIds,
        relatedDateIds: finding.dates.map((d) => d.id),
        priority:
          WEIGHT[finding.attention] * 1000 +
          Math.min(nearest ?? 999, 999) +
          index * 0.1,
      });
    });
  });

  return actions.sort((a, b) => a.priority - b.priority);
}

export function topActions(actions: ChecklistAction[], count = 3): ChecklistAction[] {
  return actions.slice(0, count);
}
