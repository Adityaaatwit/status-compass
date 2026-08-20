/**
 * Retrieval is the boundary that decides what a student is told and, when AI is
 * enabled, what leaves the machine. These tests exist to hold that boundary.
 */

import { describe, expect, it } from "vitest";

import { loadCorpus } from "../dataAdapters";
import { evaluateRules } from "../evaluateRules";
import { emptyProfile } from "../scenarios";
import type { StudentProfile } from "../types";

import { MAX_RULES, MAX_SOURCES, retrieveVerifiedContext } from "./retrieveVerifiedContext";

const { corpus } = loadCorpus();
const AS_OF = "2026-10-01";

const dsStudent: StudentProfile = {
  ...emptyProfile,
  i94Notation: "ds",
  presentInUS: "yes",
  maintainingStatus: "yes",
  i20ProgramStartDate: "2024-08-19",
  i20ProgramEndDate: "2028-05-12",
  mostRecentEntryDate: "2025-08-10",
};

const evaluation = evaluateRules(dsStudent, corpus, AS_OF);

function retrieve(question: string, withEvaluation = true) {
  return retrieveVerifiedContext(question, corpus, withEvaluation ? evaluation : null);
}

describe("retrieval finds relevant verified material", () => {
  it("finds the grace-period rule from a plain-language question", () => {
    const result = retrieve("what happens after my program ends?");
    expect(result.insufficientEvidence).toBe(false);
    expect(result.rules.map((r) => r.ruleId)).toContain("rule-f1-program-end-ds-grace-period");
  });

  it("finds OPT rules when the student writes shorthand", () => {
    const result = retrieve("when can I file my i-765 for opt?");
    expect(result.rules.map((r) => r.ruleId)).toContain("rule-f1-opt-filing-window");
  });

  it("finds travel rules from 'can I travel and come back'", () => {
    const result = retrieve("what should I know about travelling and re-entering the US?");
    expect(result.rules.map((r) => r.ruleId)).toContain("rule-f1-travel-readmission-fixed-period");
  });

  it("resolves the September 15 shorthand to the transition rules", () => {
    const result = retrieve("how does the sept 15 rule affect me?");
    const ids = result.rules.map((r) => r.ruleId);
    expect(ids.some((id) => id.includes("transition") || id.includes("sept15"))).toBe(true);
  });
});

describe("retrieval respects the corpus boundary", () => {
  it("never returns a candidate update as a rule or a source", () => {
    const candidateIds = new Set(corpus.candidates.updates.map((u) => u.id));
    const questions = [
      "is there a lawsuit about this rule?",
      "tell me about the litigation",
      "what did the court say?",
      "has the rule been challenged in court?",
    ];
    for (const question of questions) {
      const result = retrieve(question);
      for (const rule of result.rules) expect(candidateIds.has(rule.ruleId)).toBe(false);
      for (const source of result.sources) expect(candidateIds.has(source.id)).toBe(false);
    }
  });

  it("only returns sources whose verification status permits citation", () => {
    const citable = new Set(
      corpus.sources.sources
        .filter((s) =>
          ["verified", "verified_no_rule_change"].includes(String(s.verificationStatus)),
        )
        .map((s) => s.id),
    );
    const result = retrieve("what does the final rule say about duration of status?");
    expect(result.sources.length).toBeGreaterThan(0);
    for (const source of result.sources) expect(citable.has(source.id)).toBe(true);
  });

  it("never returns a source that is only partially verified", () => {
    const partial = corpus.sources.sources
      .filter((s) => s.verificationStatus === "partially_verified")
      .map((s) => s.id);
    // Ask something that would otherwise match the partially-verified RIA doc.
    const result = retrieve("regulatory impact analysis of the duration of status rule");
    for (const id of partial) {
      expect(result.sources.map((s) => s.id)).not.toContain(id);
    }
  });

  it("caps the amount of context it will ever hand out", () => {
    const result = retrieve("status opt travel program end date i-20 i-94 grace period rule");
    expect(result.rules.length).toBeLessThanOrEqual(MAX_RULES);
    expect(result.sources.length).toBeLessThanOrEqual(MAX_SOURCES);
  });
});

describe("retrieval reports insufficient evidence honestly", () => {
  const irrelevant = [
    "what is the weather tomorrow?",
    "how do I cook rice?",
    "who won the football match?",
    "recommend a laptop",
  ];

  for (const question of irrelevant) {
    it(`returns insufficient evidence for "${question}"`, () => {
      expect(retrieve(question).insufficientEvidence).toBe(true);
    });
  }

  it("returns insufficient evidence for an empty question", () => {
    expect(retrieve("   ").insufficientEvidence).toBe(true);
    expect(retrieve("   ").rules).toEqual([]);
  });
});

describe("retrieval prefers the student's own situation", () => {
  it("ranks a rule that produced a current finding above one that did not", () => {
    const result = retrieve("tell me about my status and program dates");
    const currentFindingRanks = result.rules
      .map((r, index) => ({ index, isCurrent: r.isCurrentFinding }))
      .filter((r) => r.isCurrent)
      .map((r) => r.index);
    const otherRanks = result.rules
      .map((r, index) => ({ index, isCurrent: r.isCurrentFinding }))
      .filter((r) => !r.isCurrent)
      .map((r) => r.index);

    if (currentFindingRanks.length > 0 && otherRanks.length > 0) {
      expect(Math.min(...currentFindingRanks)).toBeLessThan(Math.max(...otherRanks));
    }
  });

  it("carries the student's derived dates onto the retrieved rule", () => {
    // The transition rule is the one that produces dates for this profile at
    // this asOfDate; confirm the fixture still holds before asserting on it.
    const finding = evaluation.findings.find(
      (f) => f.ruleId === "rule-f1-transition-existing-ds-student",
    );
    expect(finding?.dates.length).toBeGreaterThan(0);

    const result = retrieve("when does my authorized stay as a d/s student end?");
    const rule = result.rules.find((r) => r.ruleId === "rule-f1-transition-existing-ds-student");
    expect(rule?.isCurrentFinding).toBe(true);
    expect(rule?.dates.length).toBe(finding?.dates.length);
  });

  it("still works with no evaluation at all", () => {
    const result = retrieve("what is duration of status?", false);
    expect(result.rules.length).toBeGreaterThan(0);
    expect(result.rules.every((r) => r.isCurrentFinding === false)).toBe(true);
  });
});

describe("retrieval is deterministic", () => {
  it("returns identical results for identical inputs", () => {
    const a = retrieve("what happens when my i-20 expires?");
    const b = retrieve("what happens when my i-20 expires?");
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("is unaffected by question casing and punctuation", () => {
    const a = retrieve("What happens when my I-20 expires?");
    const b = retrieve("what happens when my i 20 expires");
    expect(a.rules.map((r) => r.ruleId)).toEqual(b.rules.map((r) => r.ruleId));
  });
});
