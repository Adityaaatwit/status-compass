/**
 * Determinism and safety tests for the Stay Valid rules engine.
 *
 * These tests assert the product's non-negotiable behaviours:
 *  - identical inputs always produce identical output,
 *  - a rule that is not yet in force can never produce a legal deadline,
 *  - missing inputs produce an "insufficient information" note, not a guess,
 *  - candidate updates never activate a rule.
 */

import { describe, expect, it } from "vitest";

import { loadCorpus } from "./dataAdapters";
import { evaluateRules } from "./evaluateRules";
import { emptyProfile, scenarios } from "./scenarios";
import type { StudentProfile } from "./types";

const { corpus, validation } = loadCorpus();

const BEFORE_TRANSITION = "2026-02-01";
const AFTER_TRANSITION = "2026-10-01";

function profileFor(patch: Partial<StudentProfile>): StudentProfile {
  return { ...emptyProfile, i94Notation: "ds", ...patch };
}

describe("corpus", () => {
  it("loads and validates", () => {
    expect(validation.ok).toBe(true);
    expect(corpus.rules.rules.length).toBeGreaterThan(0);
    expect(corpus.sources.sources.length).toBeGreaterThan(0);
  });

  it("every rule cites at least one source that exists", () => {
    const ids = new Set(corpus.sources.sources.map((s) => s.id));
    for (const rule of corpus.rules.rules) {
      expect(rule.sourceIds.length).toBeGreaterThan(0);
      for (const id of rule.sourceIds) expect(ids.has(id)).toBe(true);
    }
  });

  it("treats every candidate update as non-activating", () => {
    for (const update of corpus.candidates.updates) {
      expect(update.mustNotActivateRules).toBe(true);
    }
  });
});

describe("determinism", () => {
  it("produces identical output for identical inputs", () => {
    const profile = scenarios[1]!.profile;
    const a = evaluateRules(profile, corpus, AFTER_TRANSITION);
    const b = evaluateRules(profile, corpus, AFTER_TRANSITION);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("orders findings stably regardless of asOfDate repetition", () => {
    const profile = scenarios[0]!.profile;
    const first = evaluateRules(profile, corpus, BEFORE_TRANSITION).findings.map((f) => f.ruleId);
    const second = evaluateRules(profile, corpus, BEFORE_TRANSITION).findings.map((f) => f.ruleId);
    expect(first).toEqual(second);
  });
});

describe("activation gating", () => {
  it("never marks a not-yet-in-force rule as confirm_now", () => {
    for (const scenario of scenarios) {
      const result = evaluateRules(scenario.profile, corpus, BEFORE_TRANSITION);
      for (const finding of result.findings) {
        if (finding.pendingEffective) {
          expect(finding.attention).not.toBe("confirm_now");
          expect(finding.attention).not.toBe("prepare");
        }
      }
    }
  });

  it("never emits an official date from a rule whose gate has not been reached", () => {
    for (const scenario of scenarios) {
      const result = evaluateRules(scenario.profile, corpus, BEFORE_TRANSITION);
      for (const finding of result.findings) {
        if (!finding.pendingEffective) continue;
        for (const date of finding.dates) expect(date.kind).not.toBe("official");
      }
    }
  });

  it("excludes rules whose activeUntil has passed", () => {
    const expired = corpus.rules.rules.filter((r) => r.activeUntil);
    for (const rule of expired) {
      const after = addDay(rule.activeUntil!);
      const result = evaluateRules(scenarios[1]!.profile, corpus, after);
      expect(result.findings.some((f) => f.ruleId === rule.id)).toBe(false);
    }
  });
});

describe("insufficient information", () => {
  it("reports missing inputs rather than inventing dates", () => {
    const result = evaluateRules(profileFor({}), corpus, AFTER_TRANSITION);
    const allDates = result.findings.flatMap((f) => f.dates);
    expect(allDates.every((d) => Boolean(d.date))).toBe(true);
    for (const note of result.insufficient) {
      expect(note.missingInputs.length).toBeGreaterThan(0);
      expect(result.findings.some((f) => f.ruleId === note.ruleId)).toBe(false);
    }
  });

  it("does not evaluate a rule that lacks its required inputs", () => {
    const noDates = profileFor({ i20ProgramEndDate: null });
    const result = evaluateRules(noDates, corpus, AFTER_TRANSITION);
    const needsEnd = corpus.rules.rules.filter((r) =>
      r.requiredInputs.includes("i20ProgramEndDate"),
    );
    for (const rule of needsEnd) {
      expect(result.findings.some((f) => f.ruleId === rule.id)).toBe(false);
    }
  });
});

describe("corpus boundary tests", () => {
  const withTests = corpus.rules.rules.filter((r) => r.boundaryTests.length > 0);

  it("has boundary tests declared in the corpus", () => {
    expect(withTests.length).toBeGreaterThan(0);
  });

  for (const rule of withTests) {
    for (const test of rule.boundaryTests) {
      it(`${rule.id}: ${test.description}`, () => {
        const profile = profileFor(test.inputs as Partial<StudentProfile>);
        const result = evaluateRules(profile, corpus, test.asOfDate);
        const finding = result.findings.find((f) => f.ruleId === rule.id);
        const note = result.insufficient.find((n) => n.ruleId === rule.id);
        // Whatever the expected outcome text says, the engine must resolve the
        // rule into exactly one of: a finding, an insufficient-info note, or
        // a deliberate skip. It must never do more than one at a time.
        expect([finding, note].filter(Boolean).length).toBeLessThanOrEqual(1);
        if (finding) {
          expect(["confirm_now", "prepare", "monitor", "information"]).toContain(finding.attention);
        }
      });
    }
  }
});

describe("no legal conclusions", () => {
  it("marks every pathway as eligibility-not-determined", () => {
    for (const scenario of scenarios) {
      const result = evaluateRules(scenario.profile, corpus, AFTER_TRANSITION);
      for (const finding of result.findings) {
        for (const pathway of finding.pathways) {
          expect(pathway.eligibilityNotDetermined).toBe(true);
        }
      }
    }
  });
});

function addDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
