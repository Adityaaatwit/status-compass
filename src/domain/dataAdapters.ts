/**
 * Typed adapters over the raw research JSON.
 *
 * The JSON files are never edited. When a field is absent or shaped differently
 * than the product expects, the adapter normalises it here — nothing downstream
 * reads raw JSON.
 */

import rawCandidates from "@/data/candidate-updates.json";
import rawRules from "@/data/rules.json";
import rawSources from "@/data/sources.json";

import { toIsoDate } from "./dateCalculations";
import { validateCorpus, type CorpusValidation } from "./dataValidation";
import type {
  Attention,
  CandidateCorpus,
  CandidateUpdate,
  Corpus,
  RuleCorpus,
  RuleRecord,
  SourceCorpus,
  SourceRecord,
} from "./types";

const ATTENTION_VALUES: Attention[] = ["confirm_now", "prepare", "monitor", "information"];

function asAttention(value: unknown): Attention {
  return ATTENTION_VALUES.includes(value as Attention) ? (value as Attention) : "information";
}

/** Removes research citation markers such as [page:1][web:18] from display text. */
export function stripCitationMarkers(value: string): string {
  return value.replace(/\s*\[(?:page|web|source):[^\]]*\]/gi, "").trim();
}

/**
 * Reads a scalar display string, stripping research markers.
 *
 * `stripCitationMarkers` was previously applied only to array fields, so every
 * scalar the UI renders — headlines, explanations, studentImpact, rationale —
 * carried its `[page:1][web:18]` markers straight to the student. Provenance
 * belongs in the source cards, not mid-sentence.
 */
function displayString(value: unknown, fallback = ""): string {
  return stripCitationMarkers(String(value ?? fallback));
}

/** Nullable variant: keeps null as null rather than turning it into "". */
function nullableDisplayString(value: unknown): string | null {
  return typeof value === "string" ? stripCitationMarkers(value) : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").map(stripCitationMarkers)
    : [];
}

function adaptSource(raw: Record<string, unknown>): SourceRecord {
  return {
    id: String(raw["id"] ?? ""),
    title: displayString(raw["title"], "Untitled source"),
    publisher: String(raw["publisher"] ?? "Unknown publisher"),
    agency: (raw["agency"] as string | null) ?? null,
    sourceTier: Number(raw["sourceTier"] ?? 3),
    sourceType: String(raw["sourceType"] ?? "unknown"),
    url: String(raw["url"] ?? ""),
    documentNumber: (raw["documentNumber"] as string | null) ?? null,
    docketNumber: (raw["docketNumber"] as string | null) ?? null,
    citation: (raw["citation"] as string | null) ?? null,
    publishedAt: toIsoDate(raw["publishedAt"]),
    updatedAt: toIsoDate(raw["updatedAt"]),
    scheduledEffectiveAt: toIsoDate(raw["scheduledEffectiveAt"]),
    actualEffectiveAt: toIsoDate(raw["actualEffectiveAt"]),
    legalStatus: String(raw["legalStatus"] ?? "status_uncertain"),
    jurisdiction: (raw["jurisdiction"] as string | null) ?? null,
    classificationsCovered: strArray(raw["classificationsCovered"]),
    topics: strArray(raw["topics"]),
    officialRationale: nullableDisplayString(raw["officialRationale"]),
    minimalSupportingExcerpt: nullableDisplayString(raw["minimalSupportingExcerpt"]),
    verifiedClaims: strArray(raw["verifiedClaims"]),
    conflictsWithSourceIds: strArray(raw["conflictsWithSourceIds"]),
    lastCheckedAt: typeof raw["lastCheckedAt"] === "string" ? raw["lastCheckedAt"] : null,
    verificationStatus: String(raw["verificationStatus"] ?? "needs_review"),
    verificationNotes: nullableDisplayString(raw["verificationNotes"]),
  };
}

function adaptRule(raw: Record<string, unknown>): RuleRecord {
  const applies = (raw["appliesWhen"] ?? {}) as Record<string, unknown>;
  const finding = (raw["finding"] ?? {}) as Record<string, unknown>;
  const calc = (raw["calculation"] ?? {}) as Record<string, unknown>;
  const pathways = Array.isArray(raw["possiblePathways"]) ? raw["possiblePathways"] : [];

  return {
    id: String(raw["id"] ?? ""),
    title: displayString(raw["title"], "Untitled rule"),
    topic: String(raw["topic"] ?? "general"),
    classifications: strArray(raw["classifications"]),
    legalStatus: String(raw["legalStatus"] ?? "status_uncertain"),
    activeFrom: toIsoDate(raw["activeFrom"]),
    activeUntil: toIsoDate(raw["activeUntil"]),
    doNotActivateBefore: toIsoDate(raw["doNotActivateBefore"]),
    appliesWhen: {
      all: strArray(applies["all"]),
      any: strArray(applies["any"]),
      not: strArray(applies["not"]),
    },
    requiredInputs: strArray(raw["requiredInputs"]),
    calculation: {
      type: String(calc["type"] ?? "none"),
      formula: nullableDisplayString(calc["formula"]),
      dayCounting: (calc["dayCounting"] as string | null) ?? null,
      weekendHolidayTreatment: (calc["weekendHolidayTreatment"] as string | null) ?? null,
      basis: nullableDisplayString(calc["basis"]),
      isLegalDeadline: calc["isLegalDeadline"] === true,
    },
    finding: {
      attention: asAttention(finding["attention"]),
      headline: displayString(finding["headline"]),
      explanation: displayString(finding["explanation"]),
      whyThisAppears: displayString(finding["whyThisAppears"]),
      officialRationale: displayString(finding["officialRationale"]),
      studentImpact: displayString(finding["studentImpact"]),
      knownFacts: strArray(finding["knownFacts"]),
      confirmationNeeded: strArray(finding["confirmationNeeded"]),
      actions: strArray(finding["actions"]),
      questionsForDso: strArray(finding["questionsForDso"]),
      documentsOrDatesToBring: strArray(finding["documentsOrDatesToBring"]),
    },
    possiblePathways: pathways.map((p) => {
      const pw = (p ?? {}) as Record<string, unknown>;
      return {
        id: String(pw["id"] ?? ""),
        title: displayString(pw["title"], "Topic to discuss"),
        whyItMayBeRelevant: displayString(pw["whyItMayBeRelevant"]),
        eligibilityNotDetermined: pw["eligibilityNotDetermined"] !== false,
        confirmationNeeded: strArray(pw["confirmationNeeded"]),
        questionsForDso: strArray(pw["questionsForDso"]),
      };
    }),
    sourceIds: strArray(raw["sourceIds"]),
    minimalSupportingExcerpt: nullableDisplayString(raw["minimalSupportingExcerpt"]),
    boundaryTests: Array.isArray(raw["boundaryTests"])
      ? (raw["boundaryTests"] as RuleRecord["boundaryTests"])
      : [],
    uncertainty: nullableDisplayString(raw["uncertainty"]),
    humanReviewRequired: raw["humanReviewRequired"] === true,
  };
}

function adaptCandidate(raw: Record<string, unknown>): CandidateUpdate {
  return {
    id: String(raw["id"] ?? ""),
    headline: displayString(raw["headline"]),
    discoveredAt: String(raw["discoveredAt"] ?? ""),
    eventDate: toIsoDate(raw["eventDate"]),
    topic: String(raw["topic"] ?? "general"),
    summary: displayString(raw["summary"]),
    whyItMatters: displayString(raw["whyItMatters"]),
    sourceIds: strArray(raw["sourceIds"]),
    affectedRuleIds: strArray(raw["affectedRuleIds"]),
    primaryAuthorityLocated: raw["primaryAuthorityLocated"] === true,
    verificationStatus: String(raw["verificationStatus"] ?? "needs_review"),
    conflictingInformation: strArray(raw["conflictingInformation"]),
    nextVerificationSteps: strArray(raw["nextVerificationSteps"]),
    // Hard product invariant: candidate updates can never activate a rule.
    mustNotActivateRules: true,
  };
}

export function loadCorpus(): { corpus: Corpus; validation: CorpusValidation } {
  const sourcesRaw = rawSources as unknown as Record<string, unknown>;
  const rulesRaw = rawRules as unknown as Record<string, unknown>;
  const candidatesRaw = rawCandidates as unknown as Record<string, unknown>;

  const sources: SourceCorpus = {
    corpusVersion: String(sourcesRaw["corpusVersion"] ?? "unknown"),
    researchedAsOf: String(sourcesRaw["researchedAsOf"] ?? ""),
    sources: (Array.isArray(sourcesRaw["sources"]) ? sourcesRaw["sources"] : []).map((s) =>
      adaptSource((s ?? {}) as Record<string, unknown>),
    ),
  };

  const rules: RuleCorpus = {
    corpusVersion: String(rulesRaw["corpusVersion"] ?? "unknown"),
    researchedAsOf: String(rulesRaw["researchedAsOf"] ?? ""),
    ruleSetStatus: String(rulesRaw["ruleSetStatus"] ?? "unknown"),
    rules: (Array.isArray(rulesRaw["rules"]) ? rulesRaw["rules"] : []).map((r) =>
      adaptRule((r ?? {}) as Record<string, unknown>),
    ),
  };

  const candidates: CandidateCorpus = {
    researchedAsOf: String(candidatesRaw["researchedAsOf"] ?? ""),
    updates: (Array.isArray(candidatesRaw["updates"]) ? candidatesRaw["updates"] : []).map((u) =>
      adaptCandidate((u ?? {}) as Record<string, unknown>),
    ),
  };

  const corpus: Corpus = { sources, rules, candidates };
  return { corpus, validation: validateCorpus(corpus) };
}

export function sourceById(corpus: Corpus, id: string): SourceRecord | undefined {
  return corpus.sources.sources.find((s) => s.id === id);
}

export function sourcesByIds(corpus: Corpus, ids: string[]): SourceRecord[] {
  return ids.map((id) => sourceById(corpus, id)).filter((s): s is SourceRecord => Boolean(s));
}
