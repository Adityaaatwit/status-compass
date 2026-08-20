/**
 * The only network endpoint in Stay Valid.
 *
 * `createServerFn` is TanStack Start's server-only RPC: the handler body is
 * stripped from the client bundle at build time and the browser is left with a
 * fetch stub. Provider modules are additionally imported dynamically *inside*
 * the handler, so nothing under `src/server/ai/` can be reached from the client
 * graph even by accident.
 *
 * What the browser sends: a question, the non-identifying profile, and a small
 * recent-message window. Retrieval and evaluation both re-run here rather than
 * trusting client-supplied context — otherwise a crafted request could smuggle
 * arbitrary text into the model prompt.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { detectIdentifiers, identifierWarning } from "@/domain/chat/identifierDetection";
import type { GroundedAnswer, RetrievedSource } from "@/domain/chat/chatTypes";

const RoleSchema = z.enum(["user", "assistant"]);

/**
 * Mirrors StudentProfile, but validated independently: this is untrusted input
 * arriving over the wire, not a value produced by our own reducer.
 */
const ProfileSchema = z.object({
  classification: z.literal("F-1"),
  i94Notation: z.enum(["ds", "fixed_date", "unknown"]),
  i94AdmitUntilDate: z.string().nullable(),
  mostRecentEntryDate: z.string().nullable(),
  presentInUS: z.enum(["yes", "no", "unsure"]),
  maintainingStatus: z.enum(["yes", "no", "unsure"]),
  i20ProgramStartDate: z.string().nullable(),
  i20ProgramEndDate: z.string().nullable(),
  academicStage: z.enum(["not_started", "in_progress", "final_term", "completed"]),
  optStage: z.enum(["none", "preparing", "applied", "post_completion_opt", "stem_opt"]),
  eadStartDate: z.string().nullable(),
  eadEndDate: z.string().nullable(),
  dsoOptRecommendationDate: z.string().nullable(),
  plannedTravel: z.boolean(),
  plannedDepartureDate: z.string().nullable(),
  expectedReentryDate: z.string().nullable(),
  pendingApplication: z.boolean(),
  goals: z.array(z.string()),
});

/** Hard ceiling independent of AI_MAX_QUESTION_CHARS, which may be raised. */
const ABSOLUTE_MAX_QUESTION_CHARS = 4000;
/** Hard ceiling on history regardless of configuration. */
const ABSOLUTE_MAX_HISTORY = 20;

export const AskRequestSchema = z.object({
  question: z.string().min(1).max(ABSOLUTE_MAX_QUESTION_CHARS),
  profile: ProfileSchema,
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasAnswers: z.boolean(),
  recentMessages: z
    .array(z.object({ role: RoleSchema, text: z.string().max(4000) }))
    .max(ABSOLUTE_MAX_HISTORY)
    .default([]),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

export interface AskResponse {
  answer: GroundedAnswer;
  sources: RetrievedSource[];
  /** True when the optional AI layer did not produce this answer. */
  usedDeterministicFallback: boolean;
  /** Set when the request was refused before any work was done. */
  blocked: { reason: "identifier_detected" | "rate_limited" | "duplicate"; message: string } | null;
}

/**
 * Whether the optional AI layer is usable, so the client knows whether to show
 * the transmission disclosure and whether calling the server can add anything.
 *
 * Returns a boolean and nothing else — no provider name, no model, no key
 * fragment. When this is false the client answers entirely in the browser and
 * makes no network request at all, which is what keeps the "your answers stay
 * in this browser" claim true for the AI-disabled configuration.
 */
export const getAiStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ aiEnabled: boolean }> => {
    const { hasKey, readAiConfig } = await import("@/server/ai/config");
    const config = readAiConfig();
    const usable =
      config.enabled &&
      (hasKey(config, config.provider) ||
        (config.fallbackProvider ? hasKey(config, config.fallbackProvider) : false));
    return { aiEnabled: usable };
  },
);

export const askStayValid = createServerFn({ method: "POST" })
  .validator((data: unknown) => AskRequestSchema.parse(data))
  .handler(async ({ data }): Promise<AskResponse> => {
    // Dynamic imports keep every server-only module out of the client graph.
    const [{ loadCorpus }, { evaluateRules }, { askStayValidPipeline }, { checkClientLimit }, req] =
      await Promise.all([
        import("@/domain/dataAdapters"),
        import("@/domain/evaluateRules"),
        import("@/server/ai/askPipeline"),
        import("@/server/ai/rateLimit"),
        import("@tanstack/react-start/server"),
      ]);

    // Defence in depth: the browser blocks these before sending, but a request
    // can be made without the browser.
    const identifiers = detectIdentifiers(data.question);
    if (identifiers.length > 0) {
      return {
        answer: {
          answer: identifierWarning(identifiers),
          sourceIds: [],
          followUpQuestions: [],
          needsDsoConfirmation: false,
          insufficientEvidence: false,
          safetyCategory: "out_of_scope",
          origin: "deterministic",
        },
        sources: [],
        usedDeterministicFallback: true,
        blocked: { reason: "identifier_detected", message: identifierWarning(identifiers) },
      };
    }

    const clientId = safeClientId(req);
    const decision = checkClientLimit(clientId, fingerprint(data.question));
    if (!decision.allowed) {
      const message =
        decision.reason === "duplicate"
          ? "That question was just asked. Give the previous answer a moment to arrive."
          : "You have asked a lot of questions in a short time. Wait a minute and try again — the timeline, checklist and meeting kit all keep working in the meantime.";
      return {
        answer: {
          answer: message,
          sourceIds: [],
          followUpQuestions: [],
          needsDsoConfirmation: false,
          insufficientEvidence: false,
          safetyCategory: "informational",
          origin: "deterministic",
        },
        sources: [],
        usedDeterministicFallback: true,
        blocked: { reason: decision.reason, message },
      };
    }

    const { corpus } = loadCorpus();
    const profile = data.profile as Parameters<typeof evaluateRules>[0];
    const evaluation = data.hasAnswers ? evaluateRules(profile, corpus, data.asOfDate) : null;

    const result = await askStayValidPipeline({
      question: data.question,
      profile,
      corpus,
      evaluation,
      recentMessages: data.recentMessages,
    });

    // Deliberately coarse: no question text, no profile dates, no answer body.
    if (result.fallbackReason && result.fallbackReason !== "ai_disabled") {
      console.info(`[ask] deterministic answer used (${result.fallbackReason})`);
    }

    return {
      answer: result.answer,
      sources: result.retrieval.sources.filter((s) => result.answer.sourceIds.includes(s.id)),
      usedDeterministicFallback: result.answer.origin === "deterministic",
      blocked: null,
    };
  });

/**
 * A coarse per-client key for rate limiting.
 *
 * The IP is used only as an in-memory bucket key for the current isolate and is
 * never stored, logged, or attached to a question.
 */
function safeClientId(req: typeof import("@tanstack/react-start/server")): string {
  try {
    return req.getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Short stable key for duplicate detection. Not reversible to the question. */
function fingerprint(question: string): string {
  const normalized = question.trim().toLowerCase().replace(/\s+/g, " ");
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return String(hash);
}
