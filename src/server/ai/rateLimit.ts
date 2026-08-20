/**
 * Quota protection: per-client rate limiting, duplicate suppression, and a
 * circuit breaker.
 *
 * State lives in module memory. On Cloudflare Workers that means per-isolate,
 * so this is a best-effort guard rather than a global counter — which is the
 * right trade here. The purpose is to stop one browser tab or one broken retry
 * loop from draining a free tier, not to implement billing. Anything stronger
 * would need Durable Objects or KV, which the brief rules out.
 *
 * Everything is time-injectable so tests never sleep.
 */

import "@tanstack/react-start/server-only";

/** Requests allowed per client within the window. */
export const REQUESTS_PER_WINDOW = 8;
export const WINDOW_MS = 60_000;

/** Consecutive provider failures before the circuit opens. */
export const BREAKER_THRESHOLD = 4;
/** How long the circuit stays open. */
export const BREAKER_COOLDOWN_MS = 120_000;

/** An identical question from the same client inside this window is a dupe. */
export const DUPLICATE_WINDOW_MS = 5_000;

interface ClientState {
  timestamps: number[];
  lastQuestionKey: string;
  lastQuestionAt: number;
}

const clients = new Map<string, ClientState>();

let breakerFailures = 0;
let breakerOpenedAt = 0;

/** Bounds memory if a worker isolate is long-lived and sees many clients. */
const MAX_TRACKED_CLIENTS = 500;

function stateFor(clientId: string): ClientState {
  let state = clients.get(clientId);
  if (!state) {
    if (clients.size >= MAX_TRACKED_CLIENTS) {
      // Drop the oldest insertion; Map preserves insertion order.
      const oldest = clients.keys().next().value;
      if (oldest !== undefined) clients.delete(oldest);
    }
    state = { timestamps: [], lastQuestionKey: "", lastQuestionAt: 0 };
    clients.set(clientId, state);
  }
  return state;
}

export type LimitDecision =
  { allowed: true } | { allowed: false; reason: "rate_limited" | "duplicate" };

/**
 * Records an attempt and says whether it may proceed.
 * Call exactly once per request, before touching a provider.
 */
export function checkClientLimit(
  clientId: string,
  questionKey: string,
  now: number = Date.now(),
): LimitDecision {
  const state = stateFor(clientId);

  // Same question, immediately again: almost always a double-submit.
  if (state.lastQuestionKey === questionKey && now - state.lastQuestionAt < DUPLICATE_WINDOW_MS) {
    return { allowed: false, reason: "duplicate" };
  }

  state.timestamps = state.timestamps.filter((t) => now - t < WINDOW_MS);
  if (state.timestamps.length >= REQUESTS_PER_WINDOW) {
    return { allowed: false, reason: "rate_limited" };
  }

  state.timestamps.push(now);
  state.lastQuestionKey = questionKey;
  state.lastQuestionAt = now;
  return { allowed: true };
}

export function isCircuitOpen(now: number = Date.now()): boolean {
  if (breakerFailures < BREAKER_THRESHOLD) return false;
  if (now - breakerOpenedAt >= BREAKER_COOLDOWN_MS) {
    // Cooldown elapsed: half-open, let one request through to test the water.
    breakerFailures = 0;
    breakerOpenedAt = 0;
    return false;
  }
  return true;
}

export function recordProviderFailure(now: number = Date.now()): void {
  breakerFailures += 1;
  if (breakerFailures >= BREAKER_THRESHOLD && breakerOpenedAt === 0) {
    breakerOpenedAt = now;
  }
}

export function recordProviderSuccess(): void {
  breakerFailures = 0;
  breakerOpenedAt = 0;
}

/** Test seam. Never called in production code. */
export function __resetLimiterForTests(): void {
  clients.clear();
  breakerFailures = 0;
  breakerOpenedAt = 0;
}

/**
 * Exponential backoff with full jitter, for the single permitted retry.
 * Jitter matters: without it, every client that hit the same 429 retries in
 * lockstep and produces a second, larger 429.
 */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(500 * 2 ** attempt, 4000);
  return Math.floor(base * (0.5 + random() * 0.5));
}
