/**
 * Defensive validation of the bundled research corpus.
 *
 * The JSON files are the source of truth, so validation never rewrites or
 * "corrects" them: it only reports whether they can be used safely. When a file
 * is missing or structurally invalid the UI shows a data-unavailable state
 * instead of fabricating content.
 */

import type {
  CandidateCorpus,
  Corpus,
  RuleCorpus,
  RuleRecord,
  SourceCorpus,
  SourceRecord,
} from "./types";

export interface CorpusValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: { sources: number; rules: number; candidateUpdates: number };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateCorpus(corpus: Partial<Corpus> | null | undefined): CorpusValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sources = corpus?.sources as SourceCorpus | undefined;
  const rules = corpus?.rules as RuleCorpus | undefined;
  const candidates = corpus?.candidates as CandidateCorpus | undefined;

  if (!isObject(sources) || !Array.isArray(sources.sources) || sources.sources.length === 0) {
    errors.push("sources.json is missing or contains no sources.");
  }
  if (!isObject(rules) || !Array.isArray(rules.rules) || rules.rules.length === 0) {
    errors.push("rules.json is missing or contains no rules.");
  }
  if (!isObject(candidates) || !Array.isArray(candidates.updates)) {
    warnings.push("candidate-updates.json is missing; unverified updates will not be listed.");
  }

  if (errors.length === 0 && sources && rules) {
    const sourceIds = new Set(sources.sources.map((s: SourceRecord) => s?.id));
    rules.rules.forEach((rule: RuleRecord) => {
      if (!rule?.id) {
        errors.push("A rule entry has no id.");
        return;
      }
      if (!rule.finding?.attention) {
        errors.push(`Rule ${rule.id} has no finding.attention value.`);
      }
      (rule.sourceIds ?? []).forEach((id) => {
        if (!sourceIds.has(id)) {
          warnings.push(`Rule ${rule.id} cites unknown source "${id}".`);
        }
      });
    });
    if (rules.corpusVersion !== sources.corpusVersion) {
      warnings.push("Rule and source corpus versions differ.");
    }
    if (rules.ruleSetStatus && rules.ruleSetStatus !== "approved") {
      warnings.push(`Rule set status is "${rules.ruleSetStatus}".`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      sources: sources?.sources?.length ?? 0,
      rules: rules?.rules?.length ?? 0,
      candidateUpdates: candidates?.updates?.length ?? 0,
    },
  };
}
