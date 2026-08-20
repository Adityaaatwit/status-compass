/**
 * The corpus is research output, and its prose carries inline research markers
 * like `[page:1][web:18]`. Those are provenance notes for the researcher, not
 * something a student should read mid-sentence — the source cards are where
 * provenance belongs.
 *
 * `stripCitationMarkers` existed from the start but was wired only into the
 * array helper, so every scalar the UI renders leaked its markers. 41 of them
 * were visible on a single /plan page.
 */

import { describe, expect, it } from "vitest";

import { loadCorpus, sourceById, sourcesByIds, stripCitationMarkers } from "./dataAdapters";

const { corpus, validation } = loadCorpus();

const MARKER = /\[(?:page|web|source):[^\]]*\]/i;

describe("stripCitationMarkers", () => {
  it("removes a single marker", () => {
    expect(stripCitationMarkers("A rule applies.[page:1]")).toBe("A rule applies.");
  });

  it("removes a run of markers", () => {
    expect(stripCitationMarkers("A rule applies.[page:1][web:18][web:53]")).toBe("A rule applies.");
  });

  it("removes markers mid-sentence without eating the text", () => {
    expect(stripCitationMarkers("First[web:1] and second[web:2] clause.")).toBe(
      "First and second clause.",
    );
  });

  it("leaves ordinary bracketed text alone", () => {
    const text = "See 8 CFR 214.2(f) [as amended] for the grace period.";
    expect(stripCitationMarkers(text)).toBe(text);
  });

  it("is a no-op on clean text", () => {
    expect(stripCitationMarkers("Nothing to strip here.")).toBe("Nothing to strip here.");
  });
});

describe("no research marker survives into displayable corpus text", () => {
  it("loads a valid corpus to assert against", () => {
    expect(validation.ok).toBe(true);
    expect(corpus.rules.rules.length).toBeGreaterThan(0);
  });

  it("keeps markers out of every rule field a student can read", () => {
    for (const rule of corpus.rules.rules) {
      const displayed = [
        rule.title,
        rule.finding.headline,
        rule.finding.explanation,
        rule.finding.whyThisAppears,
        rule.finding.officialRationale,
        rule.finding.studentImpact,
        rule.uncertainty ?? "",
        rule.calculation.basis ?? "",
        rule.calculation.formula ?? "",
        ...rule.finding.knownFacts,
        ...rule.finding.confirmationNeeded,
        ...rule.finding.actions,
        ...rule.finding.questionsForDso,
        ...rule.finding.documentsOrDatesToBring,
        ...rule.possiblePathways.flatMap((p) => [
          p.title,
          p.whyItMayBeRelevant,
          ...p.confirmationNeeded,
          ...p.questionsForDso,
        ]),
      ];
      for (const text of displayed) {
        expect(text, `marker survived in rule ${rule.id}`).not.toMatch(MARKER);
      }
    }
  });

  it("keeps markers out of every source field a student can read", () => {
    for (const source of corpus.sources.sources) {
      const displayed = [
        source.title,
        source.officialRationale ?? "",
        source.minimalSupportingExcerpt ?? "",
        source.verificationNotes ?? "",
        ...source.verifiedClaims,
      ];
      for (const text of displayed) {
        expect(text, `marker survived in source ${source.id}`).not.toMatch(MARKER);
      }
    }
  });

  it("keeps markers out of candidate updates", () => {
    for (const update of corpus.candidates.updates) {
      for (const text of [
        update.headline,
        update.summary,
        update.whyItMatters,
        ...update.conflictingInformation,
        ...update.nextVerificationSteps,
      ]) {
        expect(text, `marker survived in update ${update.id}`).not.toMatch(MARKER);
      }
    }
  });
});

describe("adapter invariants", () => {
  it("forces mustNotActivateRules regardless of what the file says", () => {
    for (const update of corpus.candidates.updates) {
      expect(update.mustNotActivateRules).toBe(true);
    }
  });

  it("resolves source IDs, and skips unknown ones rather than inventing", () => {
    const known = corpus.sources.sources[0]!.id;
    expect(sourceById(corpus, known)?.id).toBe(known);
    expect(sourceById(corpus, "no-such-source")).toBeUndefined();
    expect(sourcesByIds(corpus, [known, "no-such-source"]).map((s) => s.id)).toEqual([known]);
  });

  it("normalises every corpus date to a plain ISO date or null", () => {
    for (const source of corpus.sources.sources) {
      for (const value of [
        source.publishedAt,
        source.scheduledEffectiveAt,
        source.actualEffectiveAt,
      ]) {
        if (value !== null) expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
