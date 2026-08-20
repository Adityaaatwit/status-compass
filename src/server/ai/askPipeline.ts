/**
 * The one place that decides how a question becomes an answer.
 *
 * Order of operations, and why:
 *
 *  1. Classify locally. A blocked category never reaches a provider, so no
 *     amount of provider behaviour can produce an answer to "am I in status?".
 *  2. Retrieve locally. This bounds what may leave the machine.
 *  3. Build the deterministic answer *first*. It is the return value unless a
 *     provider produces something that survives validation — so every failure
 *     path is already handled before the first network call.
 *  4. Call the primary provider; on a temporary failure only, one retry, then
 *     the fallback provider.
 *  5. Validate the provider output against the context it was given. Anything
 *     that fails falls back to the answer from step 3.
 *
 * The deterministic answer is never worse than nothing, so there is no path
 * where a student sees an error instead of content.
 */

import "@tanstack/react-start/server-only";

import { buildDeterministicAnswer } from "@/domain/chat/buildDeterministicAnswer";
import type { GroundedAnswer, RetrievalResult } from "@/domain/chat/chatTypes";
import { classifyQuestion } from "@/domain/chat/safety";
import { retrieveVerifiedContext } from "@/domain/chat/retrieveVerifiedContext";
import type { Corpus, EvaluationResult, StudentProfile } from "@/domain/types";

import { hasKey, readAiConfig, type AiConfig, type ProviderName } from "./config";
import { AiError, countsTowardsBreaker, isFallbackEligible } from "./errors";
import { createGeminiProvider } from "./geminiProvider";
import { createGroqProvider } from "./groqProvider";
import { validateGroundedOutput } from "./outputSchema";
import type { AiChatProvider, GroundedChatInput, ShareableProfile } from "./provider";
import {
  backoffDelayMs,
  isCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "./rateLimit";

/** Why an answer ended up deterministic. Logged, never shown verbatim. */
export type FallbackReason =
  | "ai_disabled"
  | "no_key"
  | "blocked_category"
  | "insufficient_evidence"
  | "circuit_open"
  | "provider_failed"
  | "validation_failed"
  | null;

export interface AskResult {
  answer: GroundedAnswer;
  retrieval: RetrievalResult;
  fallbackReason: FallbackReason;
}

export interface AskOptions {
  question: string;
  profile: StudentProfile;
  corpus: Corpus;
  evaluation: EvaluationResult | null;
  recentMessages: Array<{ role: "user" | "assistant"; text: string }>;
  /** Injectable for tests. */
  config?: AiConfig;
  providers?: Partial<Record<ProviderName, AiChatProvider>>;
  sleep?: (ms: number) => Promise<void>;
}

/** Strips the profile down to what an explanation actually needs. */
function shareableProfile(profile: StudentProfile): ShareableProfile {
  return {
    i94Notation: profile.i94Notation,
    academicStage: profile.academicStage,
    optStage: profile.optStage,
    plannedTravel: profile.plannedTravel,
    // Whether a date exists is enough to explain a rule's relevance; the values
    // that matter are already inside the derived dates on each rule.
    hasProgramEndDate: Boolean(profile.i20ProgramEndDate),
    hasEadEndDate: Boolean(profile.eadEndDate),
  };
}

function buildChatInput(
  question: string,
  retrieval: RetrievalResult,
  profile: StudentProfile,
  recentMessages: AskOptions["recentMessages"],
  config: AiConfig,
  safetyCategory: GroundedAnswer["safetyCategory"],
): GroundedChatInput {
  return {
    question: question.slice(0, config.limits.maxQuestionChars),
    profile: shareableProfile(profile),
    rules: retrieval.rules.map((r) => ({
      ruleId: r.ruleId,
      title: r.title,
      topic: r.topic,
      legalStatus: String(r.legalStatus),
      headline: r.headline,
      explanation: r.explanation,
      studentImpact: r.studentImpact,
      confirmationNeeded: r.confirmationNeeded,
      pendingEffective: r.pendingEffective,
      isCurrentFinding: r.isCurrentFinding,
      dates: r.dates.map((d) => ({ date: d.date, label: d.label, kind: d.kind })),
      sourceIds: r.sourceIds,
    })),
    sources: retrieval.sources.map((s) => ({
      id: s.id,
      title: s.title,
      publisher: s.publisher,
      legalStatus: String(s.legalStatus),
      verifiedClaims: s.verifiedClaims,
    })),
    // Oldest first, most recent window only.
    recentMessages: recentMessages.slice(-config.limits.maxHistoryMessages),
    safetyCategory,
    limits: config.limits,
  };
}

function resolveProvider(
  name: ProviderName,
  config: AiConfig,
  overrides: AskOptions["providers"],
): AiChatProvider | null {
  const override = overrides?.[name];
  if (override) return override;
  if (!hasKey(config, name)) return null;
  return name === "gemini"
    ? createGeminiProvider(config.gemini.apiKey, config.gemini.model)
    : createGroqProvider(config.groq.apiKey, config.groq.model);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Calls one provider, allowing at most one retry and only for a temporary
 * failure. Two attempts is the whole budget — a free tier does not survive
 * aggressive retrying, and a student will not wait for a third.
 */
async function callWithSingleRetry(
  provider: AiChatProvider,
  input: GroundedChatInput,
  sleep: (ms: number) => Promise<void>,
): Promise<Awaited<ReturnType<AiChatProvider["generateGroundedAnswer"]>>> {
  try {
    return await provider.generateGroundedAnswer(input);
  } catch (error) {
    if (!isFallbackEligible(error)) throw error;
    await sleep(backoffDelayMs(0));
    return provider.generateGroundedAnswer(input);
  }
}

export async function askStayValidPipeline(options: AskOptions): Promise<AskResult> {
  const {
    question,
    profile,
    corpus,
    evaluation,
    recentMessages,
    providers,
    sleep = defaultSleep,
  } = options;
  const config = options.config ?? readAiConfig();

  const classification = classifyQuestion(question);
  const retrieval = retrieveVerifiedContext(question, corpus, evaluation);
  const deterministic = buildDeterministicAnswer(question, retrieval, classification);

  const settle = (reason: FallbackReason): AskResult => ({
    answer: deterministic,
    retrieval,
    fallbackReason: reason,
  });

  // Never send a question that has reviewed wording. This is checked before
  // the enabled flag so the ordering cannot be reversed by configuration.
  if (classification.blockAi) return settle("blocked_category");
  if (!config.enabled) return settle("ai_disabled");

  // Nothing to ground an explanation in — sending it would invite invention.
  if (retrieval.insufficientEvidence || retrieval.rules.length === 0) {
    return settle("insufficient_evidence");
  }

  if (isCircuitOpen()) return settle("circuit_open");

  const primary = resolveProvider(config.provider, config, providers);
  const fallback = config.fallbackProvider
    ? resolveProvider(config.fallbackProvider, config, providers)
    : null;
  if (!primary && !fallback) return settle("no_key");

  const input = buildChatInput(
    question,
    retrieval,
    profile,
    recentMessages,
    config,
    classification.category,
  );

  const chain = [primary, fallback].filter((p): p is AiChatProvider => p !== null);
  let sawProviderFailure = false;

  for (const [index, provider] of chain.entries()) {
    try {
      const output = await callWithSingleRetry(provider, input, sleep);
      const { answer } = validateGroundedOutput(output.raw, {
        suppliedSourceIds: retrieval.sources.map((s) => s.id),
        contextText: output.contextText,
        localSafetyCategory: classification.category,
        origin: provider.name,
      });

      if (!answer) {
        // The provider answered but the answer was not trustworthy. That is not
        // a provider outage, so do not try the next one with the same prompt.
        recordProviderSuccess();
        return settle("validation_failed");
      }

      recordProviderSuccess();
      return { answer, retrieval, fallbackReason: null };
    } catch (error) {
      sawProviderFailure = true;
      if (countsTowardsBreaker(error)) recordProviderFailure();

      const isLast = index === chain.length - 1;
      // Only a temporary failure earns the second provider.
      if (!isLast && isFallbackEligible(error)) continue;

      if (error instanceof AiError && error.kind === "no_key" && !isLast) continue;
      break;
    }
  }

  return settle(sawProviderFailure ? "provider_failed" : "no_key");
}
