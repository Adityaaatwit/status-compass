/**
 * The deterministic answer is the product's floor. Everything here must hold
 * with no API key, no network, and both providers down.
 */

import { describe, expect, it } from "vitest";

import { loadCorpus } from "../dataAdapters";
import { evaluateRules } from "../evaluateRules";
import { emptyProfile } from "../scenarios";
import type { StudentProfile } from "../types";

import { buildDeterministicAnswer } from "./buildDeterministicAnswer";
import { retrieveVerifiedContext } from "./retrieveVerifiedContext";
import {
  INSUFFICIENT_EVIDENCE_RESPONSE,
  OUT_OF_SCOPE_RESPONSE,
  STATUS_DETERMINATION_RESPONSE,
} from "./safety";

const { corpus } = loadCorpus();
const AS_OF = "2026-10-01";

const student: StudentProfile = {
  ...emptyProfile,
  i94Notation: "ds",
  presentInUS: "yes",
  maintainingStatus: "yes",
  i20ProgramStartDate: "2024-08-19",
  i20ProgramEndDate: "2028-05-12",
  mostRecentEntryDate: "2025-08-10",
};

const evaluation = evaluateRules(student, corpus, AS_OF);

function answer(question: string) {
  const retrieval = retrieveVerifiedContext(question, corpus, evaluation);
  return { retrieval, result: buildDeterministicAnswer(question, retrieval) };
}

describe("answers relevant questions without any AI", () => {
  it("explains the transition rule and cites sources", () => {
    const { result } = answer("how does the September 15 rule affect a d/s student?");
    expect(result.origin).toBe("deterministic");
    expect(result.insufficientEvidence).toBe(false);
    expect(result.answer.length).toBeGreaterThan(80);
    expect(result.sourceIds.length).toBeGreaterThan(0);
  });

  it("only ever cites sources retrieval actually supplied", () => {
    const { retrieval, result } = answer("what does duration of status mean?");
    const supplied = new Set(retrieval.sources.map((s) => s.id));
    for (const id of result.sourceIds) expect(supplied.has(id)).toBe(true);
  });

  it("always tells the student to confirm with a DSO", () => {
    const { result } = answer("what happens at the end of my program?");
    expect(result.needsDsoConfirmation).toBe(true);
  });

  it("labels a reminder as not being a government deadline", () => {
    const { result } = answer("when does my authorized stay as a d/s student end?");
    if (result.answer.includes("Stay Valid reminder")) {
      expect(result.answer).toMatch(/not a government deadline/i);
    }
  });

  it("says plainly that no AI was involved", () => {
    const { result } = answer("what does duration of status mean?");
    expect(result.answer).toMatch(/without using AI/i);
  });
});

describe("refuses what it must refuse", () => {
  it("will not determine status even when retrieval matches well", () => {
    const { result } = answer("am I still maintaining my f-1 status?");
    expect(result.answer).toBe(STATUS_DETERMINATION_RESPONSE);
    expect(result.safetyCategory).toBe("dso_confirmation");
    // A refusal must cite nothing — a citation implies the refusal is sourced.
    expect(result.sourceIds).toEqual([]);
  });

  it("declines out-of-scope questions with the approved wording", () => {
    const { result } = answer("how do I get a green card?");
    expect(result.answer).toBe(OUT_OF_SCOPE_RESPONSE);
    expect(result.sourceIds).toEqual([]);
  });

  it("reports insufficient evidence rather than improvising", () => {
    const { result } = answer("what is the best pizza in Chicago?");
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE_RESPONSE);
    expect(result.insufficientEvidence).toBe(true);
    expect(result.sourceIds).toEqual([]);
  });

  it("offers a way forward even when it cannot answer", () => {
    const { result } = answer("what is the best pizza in Chicago?");
    expect(result.followUpQuestions.length).toBeGreaterThan(0);
  });
});

describe("never states a legal conclusion", () => {
  const forbidden = [
    /\byou are (in|out of) status\b/i,
    /\byou are (eligible|ineligible)\b/i,
    /\byou (will|would) be (approved|denied|deported)\b/i,
    /\byou are (safe|legal|illegal)\b/i,
    /\byou (should|must) (leave|depart|stay|remain)\b/i,
    /\bguaranteed\b/i,
  ];

  const questions = [
    "how does the September 15 rule affect a d/s student?",
    "what does duration of status mean?",
    "what happens at the end of my program?",
    "tell me about opt filing",
    "what should I bring to my dso meeting?",
    "am I still maintaining my f-1 status?",
    "should I leave the country?",
  ];

  for (const question of questions) {
    it(`produces no legal conclusion for "${question}"`, () => {
      const { result } = answer(question);
      for (const pattern of forbidden) {
        expect(result.answer).not.toMatch(pattern);
      }
    });
  }
});

describe("determinism", () => {
  it("returns byte-identical answers for the same question", () => {
    const a = answer("what does duration of status mean?").result;
    const b = answer("what does duration of status mean?").result;
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("never invents a source id", () => {
    const known = new Set(corpus.sources.sources.map((s) => s.id));
    const questions = [
      "what does duration of status mean?",
      "tell me about opt",
      "travel and reentry",
      "what happens after my program ends",
    ];
    for (const question of questions) {
      const { result } = answer(question);
      for (const id of result.sourceIds) expect(known.has(id)).toBe(true);
    }
  });
});
