/**
 * Types for "Ask Stay Valid".
 *
 * The chat is an explanation layer over work the rules engine has already done.
 * Nothing here evaluates a rule, computes a date, or decides a legal question —
 * retrieval selects *which already-verified material* is relevant, and the
 * answer builder restates that material in the corpus's own approved wording.
 *
 * Everything in this file is pure and runs in the browser. It has no knowledge
 * of any AI provider.
 */

import type { Attention, DerivedDate, LegalStatus } from "../types";

/**
 * How a question was classified. Drives which approved response is used and
 * whether the question may be sent to an AI provider at all.
 */
export type SafetyCategory =
  | "informational" // explain a rule, a term, or a date
  | "preparation" // what to bring / ask / do before an appointment
  | "dso_confirmation" // asks Stay Valid to determine status or eligibility
  | "legal_advice_request" // asks what the student should legally do
  | "out_of_scope"; // outside F-1 educational preparation

export type ChatRole = "user" | "assistant";

/** Where an assistant answer came from. Always shown to the student. */
export type AnswerOrigin = "deterministic" | "gemini" | "groq";

/** A verified rule selected by retrieval, with the evidence for its score. */
export interface RetrievedRule {
  ruleId: string;
  title: string;
  topic: string;
  headline: string;
  explanation: string;
  studentImpact: string;
  confirmationNeeded: string[];
  questionsForDso: string[];
  legalStatus: LegalStatus;
  sourceIds: string[];
  score: number;
  matchedTerms: string[];
  /** True when this rule produced a finding for the current student. */
  isCurrentFinding: boolean;
  /** Attention level, when this rule is a current finding. */
  attention: Attention | null;
  /** True when the rule is published but not yet in force. */
  pendingEffective: boolean;
  /** Dates this rule produced for the current student, if any. */
  dates: DerivedDate[];
}

/** A verified source selected by retrieval. */
export interface RetrievedSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  legalStatus: LegalStatus;
  lastCheckedAt: string | null;
  /** Short verified statements, used as approved wording. */
  verifiedClaims: string[];
  score: number;
}

/** Everything retrieval found for one question. */
export interface RetrievalResult {
  /** The normalised form actually searched. */
  normalizedQuestion: string;
  terms: string[];
  rules: RetrievedRule[];
  sources: RetrievedSource[];
  /** True when nothing scored above the relevance floor. */
  insufficientEvidence: boolean;
  /** Highest rule score, for diagnostics and tests. */
  topScore: number;
}

/**
 * A grounded answer, whether written deterministically or by a provider.
 * The shape is identical either way so the UI never needs to branch.
 */
export interface GroundedAnswer {
  answer: string;
  /** Source IDs actually cited. Always a subset of what retrieval supplied. */
  sourceIds: string[];
  followUpQuestions: string[];
  needsDsoConfirmation: boolean;
  insufficientEvidence: boolean;
  safetyCategory: SafetyCategory;
  origin: AnswerOrigin;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Present on assistant messages only. */
  answer?: GroundedAnswer;
  /** Sources resolved for display, present on assistant messages only. */
  sources?: RetrievedSource[];
}
