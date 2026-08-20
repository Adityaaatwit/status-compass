/**
 * Provider failure taxonomy.
 *
 * The distinction that matters most here is *which failures justify calling a
 * second provider*. A timeout or a 503 means "this provider is unwell, someone
 * else might answer" — worth a fallback. A safety refusal or an invalid request
 * means "this question should not be answered this way", and asking a different
 * model until one agrees is exactly the wrong behaviour.
 */

export type AiErrorKind =
  /** AI_CHAT_ENABLED is false. Not an error — the configured state. */
  | "disabled"
  /** Enabled but no usable API key for the selected provider. */
  | "no_key"
  /** Provider did not respond within AI_TIMEOUT_MS. */
  | "timeout"
  /** HTTP 429. */
  | "rate_limited"
  /** HTTP 5xx. */
  | "server_error"
  /** Provider replied, but not with output matching the schema. */
  | "invalid_output"
  /** Provider declined on safety grounds. */
  | "safety_refusal"
  /** HTTP 4xx other than 429: bad request, bad key, unsupported model. */
  | "invalid_request"
  /** Local guard: too many requests from this client. */
  | "client_rate_limited"
  /** Circuit breaker is open after repeated provider failures. */
  | "circuit_open";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  /** Which provider produced it, when applicable. */
  readonly provider: string | null;

  constructor(kind: AiErrorKind, message: string, provider: string | null = null) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.provider = provider;
  }
}

/**
 * Kinds that justify trying the fallback provider.
 *
 * Deliberately excludes `safety_refusal`, `invalid_request`, `invalid_output`
 * and every local guard. Falling back on a safety refusal would turn the
 * fallback into a way to shop for a permissive model; falling back on invalid
 * input just burns the second quota on the same bad request.
 */
const FALLBACK_ELIGIBLE = new Set<AiErrorKind>(["timeout", "rate_limited", "server_error"]);

export function isFallbackEligible(error: unknown): boolean {
  return error instanceof AiError && FALLBACK_ELIGIBLE.has(error.kind);
}

/** Kinds that count towards opening the circuit breaker. */
const BREAKER_ELIGIBLE = new Set<AiErrorKind>([
  "timeout",
  "rate_limited",
  "server_error",
  "invalid_request",
]);

export function countsTowardsBreaker(error: unknown): boolean {
  return error instanceof AiError && BREAKER_ELIGIBLE.has(error.kind);
}

/**
 * Maps an HTTP status to an error kind. Used identically by both providers so
 * their retry and fallback behaviour cannot drift apart.
 */
export function kindForStatus(status: number): AiErrorKind {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "invalid_request";
}

/**
 * Provider errors must never reach a student verbatim: they leak model names,
 * quota details and sometimes the prompt. This is what the UI is told instead.
 */
export function studentFacingMessage(): string {
  return "The optional AI explanation is unavailable right now, so this answer was assembled directly from Stay Valid's verified sources instead.";
}
