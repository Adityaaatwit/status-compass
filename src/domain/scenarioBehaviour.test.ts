/**
 * End-to-end behaviour for the situations the product exists to handle:
 * D/S versus fixed-date admission, OPT and STEM OPT, travel, and the
 * September 15 2026 gate that separates "not yet" from "in force".
 *
 * These assert product invariants, not specific legal outcomes — the corpus
 * owns the law, and no test here encodes a legal conclusion of its own.
 */

import { describe, expect, it } from "vitest";

import { buildChecklist } from "./buildChecklist";
import { buildMeetingKit } from "./buildMeetingKit";
import { buildPathways } from "./buildPathways";
import { buildTimeline } from "./buildTimeline";
import { loadCorpus } from "./dataAdapters";
import { evaluateRules } from "./evaluateRules";
import { emptyProfile, scenarios } from "./scenarios";
import type { StudentProfile } from "./types";

const { corpus } = loadCorpus();

const GATE = "2026-09-15";
const DAY_BEFORE_GATE = "2026-09-14";
const DAY_OF_GATE = "2026-09-15";
const AFTER_GATE = "2026-10-01";

function profile(patch: Partial<StudentProfile>): StudentProfile {
  return { ...emptyProfile, presentInUS: "yes", maintainingStatus: "yes", ...patch };
}

const dsStudent = profile({
  i94Notation: "ds",
  i20ProgramStartDate: "2024-08-19",
  i20ProgramEndDate: "2028-05-12",
  mostRecentEntryDate: "2025-08-10",
});

const fixedDateStudent = profile({
  i94Notation: "fixed_date",
  i94AdmitUntilDate: "2029-05-12",
  i20ProgramStartDate: "2026-09-20",
  i20ProgramEndDate: "2029-05-12",
  mostRecentEntryDate: "2026-09-20",
});

const stemOptStudent = profile({
  i94Notation: "ds",
  i20ProgramStartDate: "2022-08-22",
  i20ProgramEndDate: "2025-05-16",
  mostRecentEntryDate: "2024-06-02",
  academicStage: "completed",
  optStage: "stem_opt",
  eadStartDate: "2026-05-17",
  eadEndDate: "2028-05-16",
});

const travellingStudent = profile({
  i94Notation: "ds",
  i20ProgramStartDate: "2025-08-25",
  i20ProgramEndDate: "2027-05-14",
  mostRecentEntryDate: "2025-08-15",
  plannedTravel: true,
  plannedDepartureDate: "2026-09-20",
  expectedReentryDate: "2026-10-05",
});

describe("the September 15 gate", () => {
  it("produces no official date from a gated rule the day before", () => {
    const result = evaluateRules(dsStudent, corpus, DAY_BEFORE_GATE);
    for (const finding of result.findings) {
      if (!finding.pendingEffective) continue;
      for (const date of finding.dates) expect(date.kind).not.toBe("official");
    }
  });

  it("never shows a gated rule as confirm_now before the gate", () => {
    for (const p of [dsStudent, fixedDateStudent, stemOptStudent, travellingStudent]) {
      const result = evaluateRules(p, corpus, DAY_BEFORE_GATE);
      for (const finding of result.findings) {
        if (finding.pendingEffective) {
          expect(finding.attention).not.toBe("confirm_now");
        }
      }
    }
  });

  it("treats the gate date itself as reached, not still pending", () => {
    const gated = corpus.rules.rules.filter((r) => r.doNotActivateBefore === GATE);
    expect(gated.length).toBeGreaterThan(0);

    const before = evaluateRules(dsStudent, corpus, DAY_BEFORE_GATE);
    const onDay = evaluateRules(dsStudent, corpus, DAY_OF_GATE);

    for (const rule of gated) {
      const b = before.findings.find((f) => f.ruleId === rule.id);
      const d = onDay.findings.find((f) => f.ruleId === rule.id);
      // A gate is inclusive: `asOfDate < gate` is pending, `>=` is not.
      if (b && d) expect(b.dates.length).toBeLessThanOrEqual(d.dates.length);
    }
  });

  it("retires a rule the day after its activeUntil", () => {
    const expiring = corpus.rules.rules.filter((r) => r.activeUntil === DAY_BEFORE_GATE);
    expect(expiring.length).toBeGreaterThan(0);
    const after = evaluateRules(dsStudent, corpus, DAY_OF_GATE);
    for (const rule of expiring) {
      expect(after.findings.some((f) => f.ruleId === rule.id)).toBe(false);
    }
  });
});

describe("D/S and fixed-date admissions stay distinct", () => {
  it("does not apply D/S-only rules to a fixed-date student", () => {
    const result = evaluateRules(fixedDateStudent, corpus, AFTER_GATE);
    const dsOnly = corpus.rules.rules
      .filter((r) => r.appliesWhen.all.includes("i94NotationIsDS"))
      .map((r) => r.id);
    for (const id of dsOnly) {
      expect(result.findings.some((f) => f.ruleId === id)).toBe(false);
    }
  });

  it("does not apply fixed-date-only rules to a D/S student", () => {
    const result = evaluateRules(dsStudent, corpus, AFTER_GATE);
    const fixedOnly = corpus.rules.rules
      .filter((r) => r.appliesWhen.all.includes("i94NotationIsDate"))
      .map((r) => r.id);
    for (const id of fixedOnly) {
      expect(result.findings.some((f) => f.ruleId === id)).toBe(false);
    }
  });

  it("evaluates nothing at all when the I-94 notation is unknown", () => {
    const unsure = profile({ i94Notation: "unknown", i20ProgramEndDate: "2028-05-12" });
    const result = evaluateRules(unsure, corpus, AFTER_GATE);
    const notationDependent = corpus.rules.rules.filter(
      (r) =>
        r.appliesWhen.all.includes("i94NotationIsDS") ||
        r.appliesWhen.all.includes("i94NotationIsDate"),
    );
    for (const rule of notationDependent) {
      expect(result.findings.some((f) => f.ruleId === rule.id)).toBe(false);
    }
  });
});

describe("distinct date meanings are never conflated", () => {
  it("keeps the I-94 admit-until date labelled as a document date", () => {
    const result = evaluateRules(fixedDateStudent, corpus, AFTER_GATE);
    const audDates = result.findings
      .flatMap((f) => f.dates)
      .filter((d) => d.label.includes("I-94 admit-until"));
    for (const date of audDates) {
      expect(date.kind).toBe("document");
      expect(date.date).toBe(fixedDateStudent.i94AdmitUntilDate);
    }
  });

  it("does not reuse the EAD end date as the program end date", () => {
    const timeline = buildTimeline(
      stemOptStudent,
      evaluateRules(stemOptStudent, corpus, AFTER_GATE),
      corpus,
      AFTER_GATE,
    );
    const programEnd = timeline.find((t) => t.id === "doc:i20-end");
    const eadEnd = timeline.find((t) => t.id === "doc:ead-end");
    expect(programEnd?.date).toBe(stemOptStudent.i20ProgramEndDate);
    expect(eadEnd?.date).toBe(stemOptStudent.eadEndDate);
    expect(programEnd?.date).not.toBe(eadEnd?.date);
  });

  it("marks every timeline entry with a provenance kind", () => {
    const evaluation = evaluateRules(stemOptStudent, corpus, AFTER_GATE);
    const timeline = buildTimeline(stemOptStudent, evaluation, corpus, AFTER_GATE);
    expect(timeline.length).toBeGreaterThan(0);
    for (const item of timeline) {
      expect(["official", "document", "reminder", "needs_confirmation"]).toContain(item.kind);
      expect(item.basis.length).toBeGreaterThan(0);
    }
  });

  it("places the DSO reminder before the earliest key date, never on it", () => {
    const evaluation = evaluateRules(dsStudent, corpus, AFTER_GATE);
    const timeline = buildTimeline(dsStudent, evaluation, corpus, AFTER_GATE);
    const reminder = timeline.find((t) => t.id === "reminder:dso-review");
    if (reminder) {
      expect(reminder.date < dsStudent.i20ProgramEndDate!).toBe(true);
      expect(reminder.kind).toBe("reminder");
      expect(reminder.date >= AFTER_GATE).toBe(true);
    }
  });
});

describe("travel", () => {
  it("surfaces travel topics only when travel is planned", () => {
    const travelRules = corpus.rules.rules
      .filter((r) => r.appliesWhen.all.includes("plannedInternationalTravel"))
      .map((r) => r.id);
    expect(travelRules.length).toBeGreaterThan(0);

    const withTravel = evaluateRules(travellingStudent, corpus, AFTER_GATE);
    const withoutTravel = evaluateRules(dsStudent, corpus, AFTER_GATE);

    for (const id of travelRules) {
      expect(withoutTravel.findings.some((f) => f.ruleId === id)).toBe(false);
    }
    expect(travelRules.some((id) => withTravel.findings.some((f) => f.ruleId === id))).toBe(true);
  });

  it("never states a reentry outcome as an official date", () => {
    const result = evaluateRules(travellingStudent, corpus, AFTER_GATE);
    const reentry = result.findings
      .flatMap((f) => f.dates)
      .filter((d) => d.label.toLowerCase().includes("reentry"));
    for (const date of reentry) {
      // CBP discretion is not a deadline the corpus can compute.
      expect(date.kind).not.toBe("official");
    }
  });
});

describe("candidate updates never activate anything", () => {
  it("lists related updates without adding a finding or a date", () => {
    for (const scenario of scenarios) {
      const result = evaluateRules(scenario.profile, corpus, AFTER_GATE);
      const ruleIds = new Set(corpus.rules.rules.map((r) => r.id));
      for (const update of result.relatedCandidateUpdates) {
        expect(ruleIds.has(update.id)).toBe(false);
        expect(result.findings.some((f) => f.ruleId === update.id)).toBe(false);
        expect(update.mustNotActivateRules).toBe(true);
      }
    }
  });

  it("produces the same findings whether or not candidate updates exist", () => {
    const withUpdates = evaluateRules(dsStudent, corpus, AFTER_GATE);
    const without = evaluateRules(
      dsStudent,
      { ...corpus, candidates: { ...corpus.candidates, updates: [] } },
      AFTER_GATE,
    );
    expect(withUpdates.findings).toEqual(without.findings);
    expect(without.relatedCandidateUpdates).toEqual([]);
  });
});

describe("derived views stay consistent with the evaluation", () => {
  const cases: Array<[string, StudentProfile]> = [
    ["D/S student", dsStudent],
    ["fixed-date student", fixedDateStudent],
    ["STEM OPT student", stemOptStudent],
    ["travelling student", travellingStudent],
  ];

  for (const [label, p] of cases) {
    it(`builds a coherent plan for the ${label}`, () => {
      const evaluation = evaluateRules(p, corpus, AFTER_GATE);
      const timeline = buildTimeline(p, evaluation, corpus, AFTER_GATE);
      const pathways = buildPathways(evaluation);
      const actions = buildChecklist(evaluation, AFTER_GATE);
      const kit = buildMeetingKit(p, evaluation, timeline, pathways, actions, corpus);

      // Every pathway traces back to a rule that actually fired.
      const firedRuleIds = new Set(evaluation.findings.map((f) => f.ruleId));
      for (const pathway of pathways) {
        expect(pathway.ruleIds.every((id) => firedRuleIds.has(id))).toBe(true);
        expect(pathway.eligibilityNotDetermined).toBe(true);
      }

      // Every citation in the meeting kit resolves to a real source.
      const sourceIds = new Set(corpus.sources.sources.map((s) => s.id));
      for (const citation of kit.citations) expect(sourceIds.has(citation.id)).toBe(true);

      // Every checklist action traces back to a rule that fired.
      for (const action of actions) expect(firedRuleIds.has(action.ruleId)).toBe(true);

      // The timeline is sorted.
      const dates = timeline.map((t) => t.date);
      expect([...dates].sort()).toEqual(dates);
    });
  }
});
