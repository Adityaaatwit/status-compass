/**
 * A student's own answer is never a status determination.
 *
 * The rule that matters most to existing D/S students
 * (`rule-f1-transition-existing-ds-student`) is gated on "are you maintaining
 * status?". Before this behaviour existed, answering "I'm not sure" made the
 * rule vanish with no explanation — which reads as "this does not apply to
 * you", i.e. exactly the determination Stay Valid must never make.
 */

import { describe, expect, it } from "vitest";

import { loadCorpus } from "./dataAdapters";
import { evaluateRules } from "./evaluateRules";
import { emptyProfile } from "./scenarios";
import type { StudentProfile, YesNoUnsure } from "./types";

const { corpus } = loadCorpus();
const TRANSITION_RULE = "rule-f1-transition-existing-ds-student";
const AFTER_TRANSITION = "2026-10-01";

function dsStudent(maintainingStatus: YesNoUnsure): StudentProfile {
  return {
    ...emptyProfile,
    i94Notation: "ds",
    presentInUS: "yes",
    maintainingStatus,
    i20ProgramStartDate: "2024-08-19",
    i20ProgramEndDate: "2028-05-12",
    mostRecentEntryDate: "2025-08-10",
  };
}

describe("self-reported status gates", () => {
  it("surfaces the transition rule when the student reports no known problem", () => {
    const result = evaluateRules(dsStudent("yes"), corpus, AFTER_TRANSITION);
    const finding = result.findings.find((f) => f.ruleId === TRANSITION_RULE);
    expect(finding).toBeDefined();
  });

  it("labels that finding as resting on the student's own answer", () => {
    const result = evaluateRules(dsStudent("yes"), corpus, AFTER_TRANSITION);
    const finding = result.findings.find((f) => f.ruleId === TRANSITION_RULE);
    const gate = finding?.selfReportedGates.find(
      (g) => g.predicate === "maintainingF1StatusOnEffectiveDate",
    );
    expect(gate).toBeDefined();
    expect(gate?.caveat).toMatch(/cannot determine/i);
  });

  for (const answer of ["unsure", "no"] as const) {
    it(`explains rather than silently skipping when the answer is "${answer}"`, () => {
      const result = evaluateRules(dsStudent(answer), corpus, AFTER_TRANSITION);

      expect(result.findings.some((f) => f.ruleId === TRANSITION_RULE)).toBe(false);

      const note = result.insufficient.find((n) => n.ruleId === TRANSITION_RULE);
      expect(note).toBeDefined();
      expect(note?.reason).toBe("self_reported_gate");
      // The message must point at the DSO, not at the student's data entry.
      expect(note?.message).toMatch(/DSO/i);
    });
  }

  it("never states or implies a status conclusion in the note", () => {
    const result = evaluateRules(dsStudent("no"), corpus, AFTER_TRANSITION);
    const note = result.insufficient.find((n) => n.ruleId === TRANSITION_RULE);
    const forbidden = /\b(you are (out of|not in) status|you have lost status|you are illegal)\b/i;
    expect(note?.message ?? "").not.toMatch(forbidden);
  });

  it("stays deterministic across repeated evaluations", () => {
    for (const answer of ["yes", "no", "unsure"] as const) {
      const a = evaluateRules(dsStudent(answer), corpus, AFTER_TRANSITION);
      const b = evaluateRules(dsStudent(answer), corpus, AFTER_TRANSITION);
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    }
  });

  it("keeps every insufficient note tagged with a reason", () => {
    for (const answer of ["yes", "no", "unsure"] as const) {
      const result = evaluateRules(dsStudent(answer), corpus, AFTER_TRANSITION);
      for (const note of result.insufficient) {
        expect(["missing_input", "self_reported_gate"]).toContain(note.reason);
      }
    }
  });

  it("never both reports and withholds the same rule", () => {
    for (const answer of ["yes", "no", "unsure"] as const) {
      const result = evaluateRules(dsStudent(answer), corpus, AFTER_TRANSITION);
      const reported = new Set(result.findings.map((f) => f.ruleId));
      for (const note of result.insufficient) {
        expect(reported.has(note.ruleId)).toBe(false);
      }
    }
  });
});
