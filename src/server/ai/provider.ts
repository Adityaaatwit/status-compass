/**
 * Provider-neutral contract for the explanation layer.
 *
 * `GroundedChatInput` is deliberately the *complete* list of what may leave the
 * machine. It is built once, on the server, from retrieval output — no provider
 * implementation gets access to the corpus, the candidate updates, the full
 * profile, or the full conversation.
 */

import "@tanstack/react-start/server-only";

import type { SafetyCategory } from "@/domain/chat/chatTypes";

import type { AiLimits } from "./config";
import type { RawGroundedAnswer } from "./outputSchema";

/** Non-identifying profile facts relevant to explaining a rule. */
export interface ShareableProfile {
  i94Notation: "ds" | "fixed_date" | "unknown";
  academicStage: string;
  optStage: string;
  plannedTravel: boolean;
  /** Whether a date exists, never the date itself where it is not needed. */
  hasProgramEndDate: boolean;
  hasEadEndDate: boolean;
}

/** One rule, flattened to the fields the model needs to explain it. */
export interface ShareableRule {
  ruleId: string;
  title: string;
  topic: string;
  legalStatus: string;
  headline: string;
  explanation: string;
  studentImpact: string;
  confirmationNeeded: string[];
  pendingEffective: boolean;
  isCurrentFinding: boolean;
  /** Dates the deterministic engine already derived. Never recomputed. */
  dates: Array<{ date: string; label: string; kind: string }>;
  sourceIds: string[];
}

/** Source metadata, limited to what a citation needs. */
export interface ShareableSource {
  id: string;
  title: string;
  publisher: string;
  legalStatus: string;
  verifiedClaims: string[];
}

export interface GroundedChatInput {
  question: string;
  profile: ShareableProfile;
  rules: ShareableRule[];
  sources: ShareableSource[];
  /** Small recent window, oldest first. Never the whole conversation. */
  recentMessages: Array<{ role: "user" | "assistant"; text: string }>;
  /** Locally computed. The model is told, but cannot change it. */
  safetyCategory: SafetyCategory;
  limits: AiLimits;
}

export interface GroundedChatOutput {
  raw: RawGroundedAnswer;
  /** The exact context text sent, so validation can check dates against it. */
  contextText: string;
}

export interface AiChatProvider {
  readonly name: "gemini" | "groq";
  generateGroundedAnswer(input: GroundedChatInput): Promise<GroundedChatOutput>;
}
