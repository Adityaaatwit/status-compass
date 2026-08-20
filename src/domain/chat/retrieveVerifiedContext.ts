/**
 * Deterministic retrieval over the verified corpus.
 *
 * Hard boundaries, enforced here rather than trusted to a prompt:
 *  - candidate-updates.json is never searched and never returned;
 *  - only sources whose verificationStatus is verified may be cited;
 *  - the result set is small and capped, because it is also the *only* context
 *    an AI provider is ever given.
 *
 * Ranking favours the student's own situation: a rule that produced one of
 * their findings outranks an equally-worded rule that did not, because the
 * question is nearly always about what they were just shown.
 */

import type { Corpus, EvaluationResult, RuleRecord, SourceRecord } from "../types";

import { normalizeQuestion } from "./normalizeQuestion";
import type { RetrievalResult, RetrievedRule, RetrievedSource } from "./chatTypes";

/** Source verification states that may be cited to a student. */
const CITABLE_SOURCE_STATUSES = new Set(["verified", "verified_no_rule_change"]);

/** Field weights. Title and topic are the strongest signals of intent. */
const WEIGHTS = {
  title: 5,
  topic: 4,
  headline: 3,
  explanation: 2,
  studentImpact: 2,
  supportingText: 1,
  sourceTitle: 4,
  sourceTopic: 3,
  verifiedClaim: 2,
} as const;

/** Bonuses applied to rules connected to this student's evaluation. */
const CURRENT_FINDING_BONUS = 12;
const INSUFFICIENT_NOTE_BONUS = 7;

/** Below this score, a match is noise. */
const RELEVANCE_FLOOR = 6;

export const MAX_RULES = 4;
export const MAX_SOURCES = 5;

/**
 * Counts distinct matched terms in a text, returning the matches themselves so
 * the score can be explained. Whole-word matching only — substring matching
 * makes "opt" hit "optional", "adopt" and "option" alike.
 */
function matchTerms(text: string | null | undefined, terms: string[]): string[] {
  if (!text) return [];
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return terms.filter((term) => haystack.includes(` ${term} `));
}

function scoreText(
  text: string | null | undefined,
  terms: string[],
  weight: number,
  matched: Set<string>,
): number {
  const hits = matchTerms(text, terms);
  for (const hit of hits) matched.add(hit);
  return hits.length * weight;
}

function scoreRule(rule: RuleRecord, terms: string[]): { score: number; matchedTerms: string[] } {
  const matched = new Set<string>();
  let score = 0;

  score += scoreText(rule.title, terms, WEIGHTS.title, matched);
  score += scoreText(rule.topic.replace(/_/g, " "), terms, WEIGHTS.topic, matched);
  score += scoreText(rule.finding.headline, terms, WEIGHTS.headline, matched);
  score += scoreText(rule.finding.explanation, terms, WEIGHTS.explanation, matched);
  score += scoreText(rule.finding.studentImpact, terms, WEIGHTS.studentImpact, matched);
  score += scoreText(
    [
      ...rule.finding.knownFacts,
      ...rule.finding.actions,
      ...rule.finding.questionsForDso,
      ...rule.finding.confirmationNeeded,
      rule.finding.whyThisAppears,
      rule.calculation.basis ?? "",
    ].join(" "),
    terms,
    WEIGHTS.supportingText,
    matched,
  );

  return { score, matchedTerms: [...matched].sort() };
}

function scoreSource(source: SourceRecord, terms: string[]): number {
  const matched = new Set<string>();
  let score = 0;
  score += scoreText(source.title, terms, WEIGHTS.sourceTitle, matched);
  score += scoreText(
    source.topics.join(" ").replace(/_/g, " "),
    terms,
    WEIGHTS.sourceTopic,
    matched,
  );
  score += scoreText(source.verifiedClaims.join(" "), terms, WEIGHTS.verifiedClaim, matched);
  return score;
}

/**
 * Retrieves the verified rules and sources most relevant to a question.
 *
 * `evaluation` is optional: the chat works before the student has filled in
 * anything, it simply loses the personalisation bonus.
 */
export function retrieveVerifiedContext(
  question: string,
  corpus: Corpus,
  evaluation: EvaluationResult | null,
): RetrievalResult {
  const { normalized, terms } = normalizeQuestion(question);

  if (terms.length === 0) {
    return {
      normalizedQuestion: normalized,
      terms,
      rules: [],
      sources: [],
      insufficientEvidence: true,
      topScore: 0,
    };
  }

  const findingByRuleId = new Map(evaluation?.findings.map((f) => [f.ruleId, f]) ?? []);
  const insufficientRuleIds = new Set(evaluation?.insufficient.map((n) => n.ruleId) ?? []);

  const scoredRules: RetrievedRule[] = corpus.rules.rules
    .map((rule) => {
      const { score, matchedTerms } = scoreRule(rule, terms);
      const finding = findingByRuleId.get(rule.id);

      let total = score;
      // Only boost rules that already matched something; otherwise every rule
      // in the student's evaluation would outrank a genuinely relevant one.
      if (score > 0 && finding) total += CURRENT_FINDING_BONUS;
      if (score > 0 && insufficientRuleIds.has(rule.id)) total += INSUFFICIENT_NOTE_BONUS;

      return {
        ruleId: rule.id,
        title: rule.title,
        topic: rule.topic,
        headline: rule.finding.headline,
        explanation: rule.finding.explanation,
        studentImpact: rule.finding.studentImpact,
        confirmationNeeded: rule.finding.confirmationNeeded,
        questionsForDso: rule.finding.questionsForDso,
        legalStatus: rule.legalStatus,
        sourceIds: rule.sourceIds,
        score: total,
        matchedTerms,
        isCurrentFinding: Boolean(finding),
        attention: finding?.attention ?? null,
        pendingEffective: finding?.pendingEffective ?? false,
        dates: finding?.dates ?? [],
      } satisfies RetrievedRule;
    })
    .filter((r) => r.score > 0)
    // Tie-break on ruleId so retrieval is stable across runs.
    .sort((a, b) => b.score - a.score || a.ruleId.localeCompare(b.ruleId));

  const topRules = scoredRules.slice(0, MAX_RULES);
  const topScore = topRules[0]?.score ?? 0;

  // Sources cited by the selected rules come first; the question may also match
  // a verified source directly (e.g. "what did DHS say in the final rule?").
  const citedSourceIds = new Set(topRules.flatMap((r) => r.sourceIds));

  const scoredSources: RetrievedSource[] = corpus.sources.sources
    .filter((s) => CITABLE_SOURCE_STATUSES.has(String(s.verificationStatus)))
    .map((source) => {
      const direct = scoreSource(source, terms);
      const cited = citedSourceIds.has(source.id) ? 10 : 0;
      return {
        id: source.id,
        title: source.title,
        publisher: source.publisher,
        url: source.url,
        legalStatus: source.legalStatus,
        lastCheckedAt: source.lastCheckedAt,
        verifiedClaims: source.verifiedClaims,
        score: direct + cited,
      } satisfies RetrievedSource;
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, MAX_SOURCES);

  return {
    normalizedQuestion: normalized,
    terms,
    rules: topRules,
    sources: scoredSources,
    insufficientEvidence: topScore < RELEVANCE_FLOOR || scoredSources.length === 0,
    topScore,
  };
}
