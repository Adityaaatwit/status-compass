/**
 * Turns matched findings into "topics to discuss" pathway cards.
 *
 * Pathways never assert eligibility. The corpus flag `eligibilityNotDetermined`
 * is carried through so the UI can always render confirmation language.
 */

import type { Attention, EvaluationResult, PathwayCard } from "./types";

const ORDER: Attention[] = ["confirm_now", "prepare", "monitor", "information"];

export function buildPathways(evaluation: EvaluationResult): PathwayCard[] {
  const byId = new Map<string, PathwayCard>();

  for (const finding of evaluation.findings) {
    for (const pathway of finding.pathways) {
      if (!pathway.id) continue;
      const existing = byId.get(pathway.id);
      if (existing) {
        existing.ruleIds.push(finding.ruleId);
        existing.relatedDateIds.push(...finding.dates.map((d) => d.id));
        existing.sourceIds = [...new Set([...existing.sourceIds, ...finding.sourceIds])];
        existing.documentsOrDatesToBring = [
          ...new Set([...existing.documentsOrDatesToBring, ...finding.documentsOrDatesToBring]),
        ];
        existing.confirmationNeeded = [
          ...new Set([...existing.confirmationNeeded, ...pathway.confirmationNeeded]),
        ];
        existing.questionsForDso = [
          ...new Set([...existing.questionsForDso, ...pathway.questionsForDso]),
        ];
        if (ORDER.indexOf(finding.attention) < ORDER.indexOf(existing.attention)) {
          existing.attention = finding.attention;
        }
        existing.pendingEffective = existing.pendingEffective && finding.pendingEffective;
        continue;
      }
      byId.set(pathway.id, {
        ...pathway,
        eligibilityNotDetermined: true,
        ruleIds: [finding.ruleId],
        attention: finding.attention,
        relatedDateIds: finding.dates.map((d) => d.id),
        documentsOrDatesToBring: [...finding.documentsOrDatesToBring],
        sourceIds: [...finding.sourceIds],
        pendingEffective: finding.pendingEffective,
      });
    }
  }

  return [...byId.values()].sort(
    (a, b) => ORDER.indexOf(a.attention) - ORDER.indexOf(b.attention),
  );
}
