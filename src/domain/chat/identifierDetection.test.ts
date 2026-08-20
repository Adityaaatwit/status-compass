/**
 * A student pasting their SEVIS ID into a chat box is the single most likely
 * privacy failure in this product. Detection runs in the browser before the
 * message is sent anywhere, so these tests guard the only line of defence.
 *
 * Both directions matter: missing an identifier leaks it, and flagging "60
 * days" trains students to ignore the warning.
 */

import { describe, expect, it } from "vitest";

import { containsIdentifier, detectIdentifiers, identifierWarning } from "./identifierDetection";

describe("detects likely legal identifiers", () => {
  const cases: Array<[string, string]> = [
    ["my SEVIS ID is N0012345678", "sevis_id"],
    ["sevis N-0012345678 shows my program", "sevis_id"],
    ["my A-number is A123456789", "a_number"],
    ["A 123 456 789 is on my paperwork", "a_number"],
    ["receipt number IOE0912345678", "receipt_number"],
    ["my receipt is WAC2190123456", "receipt_number"],
    ["my passport number is X1234567", "passport_number"],
    ["passport AB1234567 expires next year", "passport_number"],
    ["the number 123456789012 is on my form", "long_numeric_id"],
  ];

  for (const [text, kind] of cases) {
    it(`flags ${kind} in "${text}"`, () => {
      const found = detectIdentifiers(text);
      expect(found.map((f) => f.kind)).toContain(kind);
      expect(containsIdentifier(text)).toBe(true);
    });
  }
});

describe("does not flag ordinary student questions", () => {
  const safe = [
    "what happens after my 60 day grace period?",
    "my program ends on 2028-05-12, what should I do?",
    "does the September 15, 2026 rule apply to me?",
    "I have been here since 2024",
    "can I file 90 days before my program end date?",
    "what is the 4 year cap about?",
    "my I-20 says the program runs to May 2028",
    "I paid the $350 SEVIS fee",
    "what should I bring to my DSO appointment?",
    "why is my I-94 admit until date important?",
  ];

  for (const text of safe) {
    it(`allows "${text}"`, () => {
      expect(detectIdentifiers(text)).toEqual([]);
      expect(containsIdentifier(text)).toBe(false);
    });
  }
});

describe("the warning shown to the student", () => {
  it("names the kind detected", () => {
    const warning = identifierWarning(detectIdentifiers("my SEVIS ID is N0012345678"));
    expect(warning).toMatch(/SEVIS ID/i);
  });

  it("never echoes the identifier back", () => {
    const secret = "N0012345678";
    const warning = identifierWarning(detectIdentifiers(`my sevis id is ${secret}`));
    expect(warning).not.toContain(secret);
  });

  it("lists multiple kinds readably", () => {
    const warning = identifierWarning(
      detectIdentifiers("sevis N0012345678 and A-number A123456789"),
    );
    expect(warning).toMatch(/ and /);
  });

  it("is empty when nothing was detected", () => {
    expect(identifierWarning([])).toBe("");
  });

  it("tells the student what to do instead", () => {
    const warning = identifierWarning(detectIdentifiers("N0012345678"));
    expect(warning).toMatch(/remove/i);
  });
});
