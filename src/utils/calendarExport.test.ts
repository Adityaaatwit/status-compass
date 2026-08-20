/**
 * The .ics export is the one artefact that leaves Stay Valid and lands in a
 * calendar the student will read months later, out of context. Every event must
 * therefore carry its own provenance, and the file must be valid RFC 5545.
 */

import { describe, expect, it } from "vitest";

import type { TimelineItem } from "@/domain/types";

import { buildIcs } from "./calendarExport";

const GENERATED_AT = new Date("2026-08-19T12:34:56.000Z");

/** Reverses RFC 5545 line folding: CRLF followed by a single space. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

function item(patch: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: "rule-x:deadline",
    label: "End of 60-day grace period",
    date: "2026-12-18",
    kind: "official",
    basis: "Program end date plus 60 calendar days.",
    ruleId: "rule-x",
    sourceIds: ["src-1"],
    status: "future",
    daysFromToday: 121,
    findingRuleIds: ["rule-x"],
    pathwayIds: [],
    suggestedPreparation: [],
    confirmationNeeded: [],
    studentEntered: null,
    ...patch,
  };
}

describe("buildIcs", () => {
  it("uses the generation time for DTSTAMP, not the event date", () => {
    const ics = buildIcs([item()], "1.0.0-research", GENERATED_AT);
    expect(ics).toContain("DTSTAMP:20260819T123456Z");
    expect(ics).not.toContain("DTSTAMP:20261218T000000Z");
  });

  it("is deterministic for a fixed generation time", () => {
    const a = buildIcs([item()], "1.0.0-research", GENERATED_AT);
    const b = buildIcs([item()], "1.0.0-research", GENERATED_AT);
    expect(a).toEqual(b);
  });

  it("opens and closes the calendar correctly", () => {
    const ics = buildIcs([item()], "1.0.0-research", GENERATED_AT);
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.split("BEGIN:VEVENT").length - 1).toBe(1);
    expect(ics.split("END:VEVENT").length - 1).toBe(1);
  });

  it("uses CRLF line endings as RFC 5545 requires", () => {
    const ics = buildIcs([item()], "1.0.0-research", GENERATED_AT);
    const bareNewlines = ics.split("\n").filter((l) => !l.endsWith("\r"));
    expect(bareNewlines.length).toBeLessThanOrEqual(1); // only the final segment
  });

  it("states the provenance of every date kind in the description", () => {
    const kinds: Array<TimelineItem["kind"]> = [
      "official",
      "document",
      "reminder",
      "needs_confirmation",
    ];
    for (const kind of kinds) {
      const ics = buildIcs([item({ kind })], "1.0.0-research", GENERATED_AT);
      expect(ics).toMatch(/DESCRIPTION:/);
      // A reminder must never be presented as a government deadline.
      if (kind === "reminder") {
        expect(ics).toMatch(/not a government deadline/i);
      }
    }
  });

  it("omits the synthetic 'today' marker", () => {
    const ics = buildIcs([item({ id: "today", label: "Today" })], "1.0.0-research", GENERATED_AT);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("escapes characters that would otherwise break the format", () => {
    const ics = buildIcs(
      [item({ label: "Grace period; ends, see notes" })],
      "1.0.0-research",
      GENERATED_AT,
    );
    expect(ics).toContain("\\;");
    expect(ics).toContain("\\,");
  });

  it("carries the corpus version so a stale calendar can be identified", () => {
    const ics = buildIcs([item()], "1.0.0-research", GENERATED_AT);
    // The version can straddle a 75-octet fold, so compare against the
    // unfolded text the way a calendar client would read it.
    expect(unfold(ics)).toContain("1.0.0-research");
  });

  it("folds long lines so that unfolding restores the original text", () => {
    const long = "x".repeat(400);
    const ics = buildIcs([item({ basis: long })], "1.0.0-research", GENERATED_AT);
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
    expect(unfold(ics)).toContain(long);
  });
});
