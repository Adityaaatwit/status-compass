/**
 * The shape a provider must return, and the checks that run afterwards.
 *
 * Structured output guarantees *formatting*, never *truthfulness*. A model can
 * return perfectly schema-valid JSON citing a source ID that does not exist, or
 * stating a deadline nothing in the context supports. Schema validation is
 * therefore step one of two; `validateGroundedOutput` below is the step that
 * actually protects the student.
 */

import { z } from "zod";

import type { GroundedAnswer, SafetyCategory } from "@/domain/chat/chatTypes";

export const GroundedAnswerSchema = z.object({
  answer: z.string().min(1).max(2500),
  sourceIds: z.array(z.string()).max(5),
  followUpQuestions: z.array(z.string()).max(3),
  needsDsoConfirmation: z.boolean(),
  insufficientEvidence: z.boolean(),
  safetyCategory: z.enum([
    "informational",
    "preparation",
    "dso_confirmation",
    "legal_advice_request",
    "out_of_scope",
  ]),
});

export type RawGroundedAnswer = z.infer<typeof GroundedAnswerSchema>;

/** What the validator changed, for logging and tests. Never shown verbatim. */
export interface ValidationReport {
  ok: boolean;
  /** Citations dropped because they were not in the supplied context. */
  droppedSourceIds: string[];
  /** Why the answer was rejected outright, if it was. */
  rejectedReason: string | null;
}

/**
 * Phrases that assert a legal outcome. A grounded explanation layer has no
 * business producing any of these, whatever the context said.
 */
const FORBIDDEN_ASSERTIONS: Array<[RegExp, string]> = [
  [/\byou are (currently )?(in|out of) status\b/i, "asserts a status determination"],
  [/\byou (have|haven't|have not) (lost|maintained|violated)\b/i, "asserts a status determination"],
  [/\byou are (legal|illegal|lawful|unlawful)\b/i, "asserts legality"],
  [/\byou are (eligible|ineligible|approved|qualified)\b/i, "asserts eligibility"],
  [/\byou (will|won't|will not) be (approved|denied|deported|removed)\b/i, "predicts an outcome"],
  [/\byou (are )?(guaranteed|certain) to\b/i, "guarantees an outcome"],
  [
    /\byou (should|must) (leave|depart|remain in|stay in|re-?enter|return to) the (us|country|united states)\b/i,
    "advises on remaining in or leaving the US",
  ],
  [
    /\bit is safe (for you )?to (leave|travel|stay|re-?enter)\b/i,
    "advises on remaining in or leaving the US",
  ],
  [/\byou do not need to (worry|do anything)\b/i, "reassures against acting"],
];

/**
 * Any date the model wrote that the context did not contain.
 *
 * Deadlines are the engine's job. A model restating "2026-09-15" from context
 * is fine; a model producing "2027-03-01" from nowhere is a fabricated legal
 * deadline and the answer must be discarded.
 */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
/** Long-form dates such as "September 15, 2026" or "15 September 2026". */
const LONG_DATE =
  /\b(?:\d{1,2}\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}?,?\s*\d{4}\b/gi;

export interface ValidationInput {
  /** Source IDs that were actually supplied to the model. */
  suppliedSourceIds: string[];
  /**
   * The full context text handed to the model, used to check that any date in
   * the answer was already present.
   */
  contextText: string;
  /** Classification computed locally, which the model may not override. */
  localSafetyCategory: SafetyCategory;
  origin: "gemini" | "groq";
}

function normalizeDate(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .trim();
}

function datesIn(text: string): string[] {
  const iso = text.match(ISO_DATE) ?? [];
  const long = text.match(LONG_DATE) ?? [];
  return [...iso, ...long].map(normalizeDate);
}

/**
 * Validates a schema-valid provider answer against the context it was given.
 * Returns the cleaned answer, or `null` when the answer must be discarded and
 * the deterministic response used instead.
 */
export function validateGroundedOutput(
  raw: RawGroundedAnswer,
  input: ValidationInput,
): { answer: GroundedAnswer | null; report: ValidationReport } {
  // 1. Invented citations are removed, not tolerated.
  const supplied = new Set(input.suppliedSourceIds);
  const kept = raw.sourceIds.filter((id) => supplied.has(id));
  const dropped = raw.sourceIds.filter((id) => !supplied.has(id));

  // 2. An answer that cited *only* invented sources was not grounded in the
  //    context at all. Discard it rather than silently showing it uncited.
  if (raw.sourceIds.length > 0 && kept.length === 0) {
    return {
      answer: null,
      report: {
        ok: false,
        droppedSourceIds: dropped,
        rejectedReason: "every cited source id was invented",
      },
    };
  }

  // 3. No legal conclusions, whatever the context said.
  for (const [pattern, reason] of FORBIDDEN_ASSERTIONS) {
    if (pattern.test(raw.answer)) {
      return {
        answer: null,
        report: { ok: false, droppedSourceIds: dropped, rejectedReason: reason },
      };
    }
  }

  // 4. No dates the context did not contain.
  const contextDates = new Set(datesIn(input.contextText));
  const unsupported = datesIn(raw.answer).filter((d) => !contextDates.has(d));
  if (unsupported.length > 0) {
    return {
      answer: null,
      report: {
        ok: false,
        droppedSourceIds: dropped,
        rejectedReason: "answer contained a date absent from the supplied context",
      },
    };
  }

  return {
    answer: {
      answer: raw.answer,
      sourceIds: kept,
      followUpQuestions: raw.followUpQuestions,
      // The model may raise the need for DSO confirmation but never lower it.
      needsDsoConfirmation: true,
      insufficientEvidence: raw.insufficientEvidence,
      // Local classification is authoritative; a model cannot reclassify its
      // way out of a category that would have blocked it.
      safetyCategory: input.localSafetyCategory,
      origin: input.origin,
    },
    report: { ok: true, droppedSourceIds: dropped, rejectedReason: null },
  };
}
