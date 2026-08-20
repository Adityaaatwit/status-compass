/**
 * Quota guards. Time is injected everywhere so these tests never sleep.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  BREAKER_COOLDOWN_MS,
  BREAKER_THRESHOLD,
  DUPLICATE_WINDOW_MS,
  REQUESTS_PER_WINDOW,
  WINDOW_MS,
  __resetLimiterForTests,
  backoffDelayMs,
  checkClientLimit,
  isCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "./rateLimit";

beforeEach(() => {
  __resetLimiterForTests();
});

describe("per-client rate limiting", () => {
  it("allows requests up to the limit", () => {
    for (let i = 0; i < REQUESTS_PER_WINDOW; i += 1) {
      const decision = checkClientLimit("client-a", `q${i}`, 1000 + i * 10);
      expect(decision.allowed).toBe(true);
    }
  });

  it("blocks the request after the limit", () => {
    for (let i = 0; i < REQUESTS_PER_WINDOW; i += 1) {
      checkClientLimit("client-a", `q${i}`, 1000 + i * 10);
    }
    const decision = checkClientLimit("client-a", "one-more", 2000);
    expect(decision).toEqual({ allowed: false, reason: "rate_limited" });
  });

  it("lets the client through again once the window rolls over", () => {
    for (let i = 0; i < REQUESTS_PER_WINDOW; i += 1) {
      checkClientLimit("client-a", `q${i}`, 1000 + i * 10);
    }
    expect(checkClientLimit("client-a", "later", 1000 + WINDOW_MS + 1).allowed).toBe(true);
  });

  it("tracks clients independently", () => {
    for (let i = 0; i < REQUESTS_PER_WINDOW; i += 1) {
      checkClientLimit("client-a", `q${i}`, 1000 + i * 10);
    }
    expect(checkClientLimit("client-b", "first", 2000).allowed).toBe(true);
  });
});

describe("duplicate suppression", () => {
  it("rejects the same question submitted twice in quick succession", () => {
    expect(checkClientLimit("client-a", "same", 1000).allowed).toBe(true);
    expect(checkClientLimit("client-a", "same", 1500)).toEqual({
      allowed: false,
      reason: "duplicate",
    });
  });

  it("allows the same question again after the duplicate window", () => {
    checkClientLimit("client-a", "same", 1000);
    expect(checkClientLimit("client-a", "same", 1000 + DUPLICATE_WINDOW_MS + 1).allowed).toBe(true);
  });

  it("allows a different question immediately", () => {
    checkClientLimit("client-a", "one", 1000);
    expect(checkClientLimit("client-a", "two", 1100).allowed).toBe(true);
  });

  it("does not consume quota for a rejected duplicate", () => {
    checkClientLimit("client-a", "same", 1000);
    for (let i = 0; i < 20; i += 1) checkClientLimit("client-a", "same", 1000 + i);
    // Only the first attempt counted, so budget remains.
    expect(checkClientLimit("client-a", "different", 2000).allowed).toBe(true);
  });
});

describe("circuit breaker", () => {
  it("stays closed below the failure threshold", () => {
    for (let i = 0; i < BREAKER_THRESHOLD - 1; i += 1) recordProviderFailure(1000);
    expect(isCircuitOpen(1000)).toBe(false);
  });

  it("opens once the threshold is reached", () => {
    for (let i = 0; i < BREAKER_THRESHOLD; i += 1) recordProviderFailure(1000);
    expect(isCircuitOpen(1000)).toBe(true);
  });

  it("closes again after the cooldown", () => {
    for (let i = 0; i < BREAKER_THRESHOLD; i += 1) recordProviderFailure(1000);
    expect(isCircuitOpen(1000 + BREAKER_COOLDOWN_MS + 1)).toBe(false);
  });

  it("is reset by a success", () => {
    for (let i = 0; i < BREAKER_THRESHOLD - 1; i += 1) recordProviderFailure(1000);
    recordProviderSuccess();
    recordProviderFailure(1000);
    expect(isCircuitOpen(1000)).toBe(false);
  });
});

describe("backoff", () => {
  it("grows with the attempt number", () => {
    const first = backoffDelayMs(0, () => 1);
    const second = backoffDelayMs(1, () => 1);
    expect(second).toBeGreaterThan(first);
  });

  it("is capped", () => {
    expect(backoffDelayMs(20, () => 1)).toBeLessThanOrEqual(4000);
  });

  it("applies jitter so clients do not retry in lockstep", () => {
    const low = backoffDelayMs(2, () => 0);
    const high = backoffDelayMs(2, () => 1);
    expect(low).toBeLessThan(high);
  });

  it("never returns a negative delay", () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(backoffDelayMs(attempt, () => 0)).toBeGreaterThanOrEqual(0);
    }
  });
});
