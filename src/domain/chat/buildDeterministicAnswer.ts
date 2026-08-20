/**
 * Builds an answer without any AI, using the corpus's own approved wording.
 *
 * This is not a degraded mode. It is the baseline the product is judged on: if
 * Gemini and Groq are both unavailable, or no key is configured at all, a
 * student still gets a relevant, cited, honest answer. The AI layer, when
 * present, rephrases this material — it never adds to it.
 *
 * The builder only ever *quotes and arranges* text that is already in the
 * corpus or already in the deterministic evaluation. It composes no new legal
 * statement and calculates no date.
 */

import { formatDate } from "@/utils/dateFormatting";

import type { GroundedAnswer, RetrievalResult, RetrievedRule } from "./chatTypes";
import { INSUFFICIENT_EVIDENCE_RESPONSE, classifyQuestion, type Classification } from "./safety";

/** Kept short: a chat answer that scrolls is a chat answer nobody reads. */
const MAX_RULES_EXPLAINED = 2;
const MAX_FOLLOW_UPS = 3;

const DSO_ESCALATION =
  "Because this depends on your individual record, confirm it with your DSO before you rely on it.";

function describeDates(rule: RetrievedRule): string[] {
  return rule.dates.map((date) => {
    const kind =
      date.kind === "official"
        ? "official date"
        : date.kind === "document"
          ? "date from your own document"
          : date.kind === "reminder"
            ? "Stay Valid reminder, not a government deadline"
            : "needs confirmation — the underlying rule is not yet in force or is uncertain";
    return `${formatDate(date.date)} — ${date.label} (${kind}).`;
  });
}

function explainRule(rule: RetrievedRule): string {
  const parts: string[] = [];

  if (rule.isCurrentFinding) {
    parts.push(`This is one of the items already on your plan: “${rule.headline}”`);
  } else {
    parts.push(`From the verified rule “${rule.title}”: ${rule.headline}`);
  }

  if (rule.explanation) parts.push(rule.explanation);
  if (rule.studentImpact) parts.push(rule.studentImpact);

  if (rule.pendingEffective) {
    parts.push(
      "This rule has been published but is not in force yet, so nothing here is a deadline you can act on today.",
    );
  }

  const dates = describeDates(rule);
  if (dates.length > 0) {
    parts.push(`Dates Stay Valid derived for you:\n${dates.map((d) => `• ${d}`).join("\n")}`);
  }

  if (rule.confirmationNeeded.length > 0) {
    parts.push(
      `Still to confirm with your DSO:\n${rule.confirmationNeeded
        .slice(0, 3)
        .map((c) => `• ${c}`)
        .join("\n")}`,
    );
  }

  return parts.join("\n\n");
}

function collectFollowUps(rules: RetrievedRule[]): string[] {
  const pool = rules.flatMap((r) => r.questionsForDso);
  return [...new Set(pool)].slice(0, MAX_FOLLOW_UPS);
}

/**
 * Produces the deterministic answer for a question.
 *
 * `classification` may be passed in when the caller has already classified
 * (the server does, to decide whether the AI layer may run at all).
 */
export function buildDeterministicAnswer(
  question: string,
  retrieval: RetrievalResult,
  classification: Classification = classifyQuestion(question),
): GroundedAnswer {
  // Approved wording wins outright — retrieval never overrides a safety
  // category that has a reviewed response.
  if (classification.approvedResponse) {
    return {
      answer: classification.approvedResponse,
      // Status, legal-advice and out-of-scope responses cite nothing: there is
      // no source that supports a refusal, and citing one would imply there is.
      sourceIds: [],
      followUpQuestions:
        classification.category === "dso_confirmation"
          ? [
              "What does my I-20 program end date mean for me?",
              "What should I bring to my DSO appointment?",
            ]
          : [],
      needsDsoConfirmation: true,
      insufficientEvidence: false,
      safetyCategory: classification.category,
      origin: "deterministic",
    };
  }

  if (retrieval.insufficientEvidence || retrieval.rules.length === 0) {
    return {
      answer: INSUFFICIENT_EVIDENCE_RESPONSE,
      sourceIds: [],
      followUpQuestions: [
        "What does the September 15, 2026 effective date change?",
        "Why is my I-20 program end date important?",
        "What should I bring to a DSO appointment?",
      ],
      needsDsoConfirmation: true,
      insufficientEvidence: true,
      safetyCategory: classification.category,
      origin: "deterministic",
    };
  }

  const explained = retrieval.rules.slice(0, MAX_RULES_EXPLAINED);
  const body = explained.map(explainRule).join("\n\n---\n\n");

  const answer = [
    body,
    DSO_ESCALATION,
    "Stay Valid assembled this from its verified sources without using AI, so it is quoting the rules rather than interpreting them.",
  ].join("\n\n");

  return {
    answer,
    sourceIds: retrieval.sources.map((s) => s.id),
    followUpQuestions: collectFollowUps(explained),
    needsDsoConfirmation: true,
    insufficientEvidence: false,
    safetyCategory: classification.category,
    origin: "deterministic",
  };
}
