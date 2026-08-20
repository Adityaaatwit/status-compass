/**
 * The classifier decides which questions get a reviewed, fixed answer instead
 * of a generated one. Getting this wrong in the permissive direction is the
 * failure that matters: a fluent, well-cited answer to "am I still in status?"
 * is worse than no answer at all.
 */

import { describe, expect, it } from "vitest";

import {
  EMERGENCY_RESPONSE,
  LEGAL_ADVICE_RESPONSE,
  OUT_OF_SCOPE_RESPONSE,
  STATUS_DETERMINATION_RESPONSE,
  classifyQuestion,
} from "./safety";

describe("status-determination requests", () => {
  const questions = [
    "am I still in status?",
    "Am I maintaining status?",
    "do I still have valid status",
    "am I out of status?",
    "is my I-20 still valid?",
    "am I legal right now",
    "am I eligible for OPT?",
    "do I qualify for STEM OPT",
    "have I violated my status?",
  ];

  for (const question of questions) {
    it(`refuses to determine status for "${question}"`, () => {
      const result = classifyQuestion(question);
      expect(result.category).toBe("dso_confirmation");
      expect(result.approvedResponse).toBe(STATUS_DETERMINATION_RESPONSE);
      expect(result.blockAi).toBe(true);
    });
  }
});

describe("legal-advice requests", () => {
  const questions = [
    "should I leave the country?",
    "should I travel in December?",
    "what should I do?",
    "is it safe for me to re-enter?",
    "will I be deported?",
    "can I sue DHS?",
    "what are my legal options",
    "advise me on my situation",
  ];

  for (const question of questions) {
    it(`declines to advise on "${question}"`, () => {
      const result = classifyQuestion(question);
      expect(result.blockAi).toBe(true);
      expect(result.approvedResponse).toBeTruthy();
      // Either the legal-advice or the emergency wording is acceptable here;
      // both decline and both point at an attorney.
      expect([LEGAL_ADVICE_RESPONSE, EMERGENCY_RESPONSE]).toContain(result.approvedResponse);
      expect(result.approvedResponse).toMatch(/attorney/i);
    });
  }
});

describe("emergency and enforcement matters", () => {
  const questions = [
    "I was detained at the airport",
    "my SEVIS record was terminated",
    "I received a notice to appear",
    "ICE officers came to my apartment",
    "I have an immigration court date",
  ];

  for (const question of questions) {
    it(`escalates "${question}" to a DSO and an attorney`, () => {
      const result = classifyQuestion(question);
      expect(result.approvedResponse).toBe(EMERGENCY_RESPONSE);
      expect(result.blockAi).toBe(true);
      expect(result.approvedResponse).toMatch(/attorney/i);
      expect(result.approvedResponse).toMatch(/DSO/i);
    });
  }
});

describe("out-of-scope questions", () => {
  const questions = [
    "how do I apply for a green card?",
    "what about H-1B sponsorship?",
    "do I need to file taxes?",
    "how do I get a driver's licence?",
    "can I apply for asylum?",
    "what about my J-1 friend",
  ];

  for (const question of questions) {
    it(`declines "${question}" as out of scope`, () => {
      const result = classifyQuestion(question);
      expect(result.category).toBe("out_of_scope");
      expect(result.approvedResponse).toBe(OUT_OF_SCOPE_RESPONSE);
      expect(result.blockAi).toBe(true);
    });
  }
});

describe("questions the product exists to answer", () => {
  const informational = [
    "how could the September 15 rule affect someone already admitted for D/S?",
    "why is my program end date important?",
    "what does this checkpoint mean?",
    "why did DHS make this change?",
    "what is duration of status?",
  ];

  for (const question of informational) {
    it(`allows the explanation layer for "${question}"`, () => {
      const result = classifyQuestion(question);
      expect(result.blockAi).toBe(false);
      expect(result.approvedResponse).toBeNull();
      expect(result.category).toBe("informational");
    });
  }

  const preparation = [
    "what should I discuss with my DSO before traveling?",
    "what information should I bring to an OPT appointment?",
    "what documents do I need?",
    "how should I prepare for my DSO meeting?",
  ];

  for (const question of preparation) {
    it(`classifies "${question}" as preparation`, () => {
      const result = classifyQuestion(question);
      expect(result.category).toBe("preparation");
      expect(result.blockAi).toBe(false);
    });
  }
});

describe("classification is deterministic and case-insensitive", () => {
  it("gives the same answer regardless of casing or trailing punctuation", () => {
    const a = classifyQuestion("AM I STILL IN STATUS???");
    const b = classifyQuestion("am i still in status");
    expect(a.category).toBe(b.category);
    expect(a.approvedResponse).toBe(b.approvedResponse);
  });

  it("puts enforcement ahead of every other category", () => {
    // Contains both an out-of-scope cue (green card) and an emergency cue.
    const result = classifyQuestion("I was detained — should I apply for a green card?");
    expect(result.approvedResponse).toBe(EMERGENCY_RESPONSE);
  });
});
