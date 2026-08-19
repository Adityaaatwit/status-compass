/**
 * Domain types for Stay Valid.
 *
 * Two families of types live here:
 *  1. Corpus types  – shapes of the researched JSON files (read-only source of truth).
 *  2. Product types – the student profile and everything derived from it.
 *
 * Nothing in this file performs I/O or reads the clock.
 */

/* ------------------------------------------------------------------ corpus */

export type LegalStatus =
  | "effective"
  | "published_pending_effective"
  | "proposed"
  | "status_uncertain"
  | "delayed"
  | "stayed"
  | "enjoined"
  | "terminated"
  | "superseded"
  | (string & {});

export type VerificationStatus =
  | "verified"
  | "partially_verified"
  | "needs_review"
  | "verified_no_rule_change"
  | (string & {});

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  agency: string | null;
  sourceTier: number;
  sourceType: string;
  url: string;
  documentNumber?: string | null;
  docketNumber?: string | null;
  citation?: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  scheduledEffectiveAt: string | null;
  actualEffectiveAt: string | null;
  legalStatus: LegalStatus;
  jurisdiction?: string | null;
  classificationsCovered: string[];
  topics: string[];
  officialRationale?: string | null;
  minimalSupportingExcerpt?: string | null;
  verifiedClaims: string[];
  conflictsWithSourceIds: string[];
  lastCheckedAt: string | null;
  verificationStatus: VerificationStatus;
  verificationNotes?: string | null;
}

export interface SourceCorpus {
  corpusVersion: string;
  researchedAsOf: string;
  sources: SourceRecord[];
}

/** Attention levels are the ONLY status vocabulary the product may show. */
export type Attention = "confirm_now" | "prepare" | "monitor" | "information";

export interface RulePathway {
  id: string;
  title: string;
  whyItMayBeRelevant: string;
  eligibilityNotDetermined: boolean;
  confirmationNeeded: string[];
  questionsForDso: string[];
}

export interface RuleFinding {
  attention: Attention;
  headline: string;
  explanation: string;
  whyThisAppears: string;
  officialRationale: string;
  studentImpact: string;
  knownFacts: string[];
  confirmationNeeded: string[];
  actions: string[];
  questionsForDso: string[];
  documentsOrDatesToBring: string[];
}

export interface RuleCalculation {
  type: "none" | "date_add" | "source_defined" | (string & {});
  formula: string | null;
  dayCounting: string | null;
  weekendHolidayTreatment: string | null;
  basis: string | null;
  isLegalDeadline: boolean;
}

export interface RuleRecord {
  id: string;
  title: string;
  topic: string;
  classifications: string[];
  legalStatus: LegalStatus;
  activeFrom: string | null;
  activeUntil: string | null;
  doNotActivateBefore: string | null;
  appliesWhen: { all: string[]; any: string[]; not: string[] };
  requiredInputs: string[];
  calculation: RuleCalculation;
  finding: RuleFinding;
  possiblePathways: RulePathway[];
  sourceIds: string[];
  minimalSupportingExcerpt?: string | null;
  boundaryTests: Array<{
    description: string;
    inputs: Record<string, unknown>;
    asOfDate: string;
    expectedOutcome: string;
  }>;
  uncertainty?: string | null;
  humanReviewRequired: boolean;
}

export interface RuleCorpus {
  corpusVersion: string;
  researchedAsOf: string;
  ruleSetStatus: string;
  rules: RuleRecord[];
}

export interface CandidateUpdate {
  id: string;
  headline: string;
  discoveredAt: string;
  eventDate: string | null;
  topic: string;
  summary: string;
  whyItMatters: string;
  sourceIds: string[];
  affectedRuleIds: string[];
  primaryAuthorityLocated: boolean;
  verificationStatus: VerificationStatus;
  conflictingInformation: string[];
  nextVerificationSteps: string[];
  /** Always treated as true by the engine, whatever the file says. */
  mustNotActivateRules: boolean;
}

export interface CandidateCorpus {
  researchedAsOf: string;
  updates: CandidateUpdate[];
}

export interface Corpus {
  sources: SourceCorpus;
  rules: RuleCorpus;
  candidates: CandidateCorpus;
}

/* ----------------------------------------------------------------- profile */

export type I94Notation = "ds" | "fixed_date" | "unknown";

export type AcademicStage =
  | "not_started"
  | "in_progress"
  | "final_term"
  | "completed";

export type OptStage =
  | "none"
  | "preparing"
  | "applied"
  | "post_completion_opt"
  | "stem_opt";

export type Goal =
  | "continue_program"
  | "complete_program"
  | "explore_opt"
  | "transfer_school"
  | "change_level"
  | "travel"
  | "dso_meeting";

export type YesNoUnsure = "yes" | "no" | "unsure";

/**
 * Student-entered facts. Deliberately contains no legal identifiers:
 * no name, DOB, passport, visa, SEVIS ID, A-number or receipt number.
 */
export interface StudentProfile {
  classification: "F-1";
  i94Notation: I94Notation;
  i94AdmitUntilDate: string | null;
  mostRecentEntryDate: string | null;
  presentInUS: YesNoUnsure;
  maintainingStatus: YesNoUnsure;
  i20ProgramStartDate: string | null;
  i20ProgramEndDate: string | null;
  academicStage: AcademicStage;
  optStage: OptStage;
  eadStartDate: string | null;
  eadEndDate: string | null;
  dsoOptRecommendationDate: string | null;
  plannedTravel: boolean;
  plannedDepartureDate: string | null;
  expectedReentryDate: string | null;
  pendingApplication: boolean;
  goals: Goal[];
}

/* ----------------------------------------------------------------- results */

export type DateKind =
  | "official" // a legal date or deadline stated by the corpus
  | "document" // a date the student read off their own document
  | "reminder" // a Stay Valid preparation reminder (not a government deadline)
  | "needs_confirmation"; // derived from a rule that is not yet effective / uncertain

export interface DerivedDate {
  id: string;
  label: string;
  date: string; // ISO yyyy-mm-dd
  kind: DateKind;
  basis: string; // why this date appears
  ruleId: string | null;
  sourceIds: string[];
}

export interface Finding {
  ruleId: string;
  title: string;
  topic: string;
  attention: Attention;
  /** Attention as stated in the corpus, before pending-effective downgrade. */
  corpusAttention: Attention;
  headline: string;
  explanation: string;
  whyThisAppears: string;
  studentImpact: string;
  knownFacts: string[];
  confirmationNeeded: string[];
  actions: string[];
  questionsForDso: string[];
  documentsOrDatesToBring: string[];
  legalStatus: LegalStatus;
  /** True when the underlying rule is published but not yet in force. */
  pendingEffective: boolean;
  isLegalDeadline: boolean;
  dates: DerivedDate[];
  pathways: RulePathway[];
  sourceIds: string[];
  matchedFacts: string[];
  uncertainty: string | null;
  humanReviewRequired: boolean;
}

export interface InsufficientInfoNote {
  ruleId: string;
  ruleTitle: string;
  missingInputs: string[];
  message: string;
}

export interface EvaluationResult {
  asOfDate: string;
  corpusVersion: string;
  researchedAsOf: string;
  ruleSetStatus: string;
  findings: Finding[];
  insufficient: InsufficientInfoNote[];
  /** Candidate updates relevant to the matched rules. Never activate anything. */
  relatedCandidateUpdates: CandidateUpdate[];
  evaluatedRuleIds: string[];
  skippedRuleIds: string[];
}

export interface TimelineItem extends DerivedDate {
  status: "past" | "today" | "future";
  daysFromToday: number;
  findingRuleIds: string[];
  pathwayIds: string[];
  suggestedPreparation: string[];
  confirmationNeeded: string[];
  studentEntered: string | null;
}

export interface PathwayCard extends RulePathway {
  ruleIds: string[];
  attention: Attention;
  relatedDateIds: string[];
  documentsOrDatesToBring: string[];
  sourceIds: string[];
  pendingEffective: boolean;
}

export interface ChecklistAction {
  id: string;
  label: string;
  attention: Attention;
  ruleId: string;
  sourceIds: string[];
  relatedDateIds: string[];
  priority: number;
}

export interface MeetingKit {
  generatedFor: string;
  asOfDate: string;
  corpusVersion: string;
  researchedAsOf: string;
  ruleSetStatus: string;
  facts: Array<{ label: string; value: string }>;
  timeline: TimelineItem[];
  findings: Finding[];
  confirmationTopics: string[];
  pathways: PathwayCard[];
  questions: string[];
  preparationChecklist: ChecklistAction[];
  citations: Array<{
    id: string;
    title: string;
    publisher: string;
    url: string;
    legalStatus: LegalStatus;
    lastCheckedAt: string | null;
  }>;
  insufficient: InsufficientInfoNote[];
}
