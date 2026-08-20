/**
 * Deterministic rules engine.
 *
 * Contract: `evaluateRules(profile, corpus, asOfDate)` is a pure function. The
 * same profile + rule corpus + asOfDate always produces the same result. The
 * clock is never read here — callers pass `asOfDate` explicitly.
 *
 * Activation model (derived from the corpus fields, not invented):
 *  - `appliesWhen.all/any/not` reference named predicates evaluated against the
 *    student profile (see PREDICATES below).
 *  - `doNotActivateBefore` gates any rule whose calculation is a legal deadline:
 *    before that date no deadline is computed and the rule is reported as
 *    pending-effective with attention downgraded to "monitor".
 *  - `activeFrom` / `activeUntil` bound the window in which a rule may produce
 *    findings at all.
 *  - Rule legal statuses such as delayed / stayed / enjoined / terminated /
 *    superseded / status_uncertain never produce legal deadlines.
 *  - candidate-updates.json is never consulted for activation.
 */

import { addDays, addYears, capAt, isValidIsoDate, maxDate, minDate } from "./dateCalculations";
import type {
  Attention,
  CandidateUpdate,
  Corpus,
  DerivedDate,
  EvaluationResult,
  Finding,
  InsufficientInfoNote,
  RuleRecord,
  SelfReportedGate,
  StudentProfile,
  YesNoUnsure,
} from "./types";

export const INSUFFICIENT_INFO_MESSAGE =
  "We don’t have enough verified information to evaluate this part of your situation. Confirm it with your DSO or a qualified immigration attorney.";

/** Legal statuses that must never yield a computed legal deadline. */
const NON_OPERATIVE_STATUSES = new Set([
  "proposed",
  "delayed",
  "stayed",
  "enjoined",
  "terminated",
  "superseded",
  "status_uncertain",
]);

type Predicate = (p: StudentProfile, ctx: { asOfDate: string; rule: RuleRecord }) => boolean;

/**
 * Predicates whose only evidence is the student's own assessment of a question
 * Stay Valid is not competent to answer.
 *
 * These are handled differently from ordinary predicates. An ordinary predicate
 * that fails simply skips its rule. A self-reported gate that is not answered
 * "yes" must NOT silently skip the rule: silence would imply the rule does not
 * apply, which is itself a status determination. Instead the engine emits an
 * insufficient-information note pointing the student at their DSO.
 *
 * When such a gate does pass, the resulting finding carries the gate so the UI
 * can state plainly that the finding rests on the student's own answer.
 */
const SELF_REPORTED_GATES: Record<
  string,
  {
    question: string;
    /** The profile field backing the answer. */
    read: (p: StudentProfile) => YesNoUnsure;
    /** Human-readable rendering of each possible answer. */
    label: Record<YesNoUnsure, string>;
    caveat: string;
    /** Shown when the answer was not "yes". */
    blockedMessage: string;
  }
> = {
  maintainingF1StatusOnEffectiveDate: {
    question: "Are you maintaining F-1 status?",
    read: (p) => p.maintainingStatus,
    label: {
      yes: "You said you believe you are.",
      no: "You said there may be a problem.",
      unsure: "You said you are not sure.",
    },
    caveat:
      "Stay Valid cannot determine whether you are maintaining status. This item appeared because of your own answer, not because your status was verified. Only your DSO or a qualified immigration attorney can confirm it.",
    blockedMessage:
      "This topic depends on whether you are maintaining F-1 status. Stay Valid cannot determine that, and it will not assume an answer. Ask your DSO to confirm your status, then revisit this page.",
  },
  presentInUSOnEffectiveDate: {
    question: "Are you currently in the United States?",
    read: (p) => p.presentInUS,
    label: {
      yes: "You said you are in the United States.",
      no: "You said you are outside the United States.",
      unsure: "You said you are not sure.",
    },
    caveat:
      "This item appeared because of your own answer about where you are. Your admission record is what governs, so confirm it against your I-94.",
    blockedMessage:
      "This topic depends on whether you are in the United States. Answer that question in the questionnaire, or confirm your admission record with your DSO.",
  },
};

/**
 * Named predicates used by `appliesWhen` in rules.json. Each returns a strict
 * boolean; "unsure" answers never satisfy a predicate.
 */
const PREDICATES: Record<string, Predicate> = {
  studentClassificationIsF1: (p) => p.classification === "F-1",
  i94NotationIsDS: (p) => p.i94Notation === "ds",
  i94NotationIsDate: (p) => p.i94Notation === "fixed_date",
  presentInUSOnEffectiveDate: (p) => p.presentInUS === "yes",
  maintainingF1StatusOnEffectiveDate: (p) => p.maintainingStatus === "yes",
  admissionDateOnOrAfterEffectiveDate: (p, { rule }) => {
    const gate = rule.activeFrom ?? rule.doNotActivateBefore;
    if (!gate || !isValidIsoDate(p.mostRecentEntryDate)) return false;
    return p.mostRecentEntryDate >= gate;
  },
  programCompleted: (p) => p.academicStage === "completed",
  noPostCompletionOptOrStemOpt: (p) =>
    p.optStage !== "post_completion_opt" && p.optStage !== "stem_opt",
  planningPostCompletionOpt: (p) =>
    p.optStage === "preparing" || p.optStage === "applied" || p.goals.includes("explore_opt"),
  plannedInternationalTravel: (p) => p.plannedTravel === true,
  expectedReentryOnOrAfterEffectiveDate: (p, { rule }) => {
    const gate = rule.activeFrom ?? rule.doNotActivateBefore;
    if (!gate) return false;
    // Travel plans without a reentry date still deserve the review; a reentry
    // date before the gate does not.
    if (!isValidIsoDate(p.expectedReentryDate)) return p.plannedTravel === true;
    return p.expectedReentryDate >= gate;
  },
};

/** Maps a rule's `requiredInputs` name to the profile value backing it. */
const REQUIRED_INPUT_RESOLVERS: Record<
  string,
  { label: string; get: (p: StudentProfile) => unknown }
> = {
  i94Notation: {
    label: "What your I-94 shows",
    get: (p) => (p.i94Notation === "unknown" ? null : p.i94Notation),
  },
  i94AdmitUntilDate: { label: "I-94 admit-until date", get: (p) => p.i94AdmitUntilDate },
  dateOfAdmission: { label: "Most recent U.S. entry date", get: (p) => p.mostRecentEntryDate },
  i20ProgramStartDate: { label: "I-20 program start date", get: (p) => p.i20ProgramStartDate },
  i20ProgramEndDate: { label: "I-20 program end date", get: (p) => p.i20ProgramEndDate },
  i20ProgramEndDateOnEffectiveDate: {
    label: "I-20 program end date",
    get: (p) => p.i20ProgramEndDate,
  },
  optOrStemOptStatus: { label: "OPT / STEM OPT stage", get: (p) => p.optStage },
  optOrStemOptEadEndDate: { label: "EAD expiration date", get: (p) => p.eadEndDate },
  optOrStemOptEadEndDateOnEffectiveDate: {
    label: "EAD expiration date",
    // Optional: a student with no EAD legitimately has no value here.
    get: (p) =>
      p.optStage === "post_completion_opt" || p.optStage === "stem_opt"
        ? p.eadEndDate
        : "not_applicable",
  },
  dsoOptRecommendationDate: {
    label: "Date your DSO entered the OPT recommendation",
    get: (p) => p.dsoOptRecommendationDate ?? (p.optStage === "preparing" ? "not_yet" : null),
  },
  plannedDepartureDate: { label: "Planned departure date", get: (p) => p.plannedDepartureDate },
  expectedReentryDate: { label: "Expected reentry date", get: (p) => p.expectedReentryDate },
  currentAdmissionFramework: {
    label: "Whether your current admission is D/S or a fixed date",
    get: (p) => (p.i94Notation === "unknown" ? null : p.i94Notation),
  },
  pendingOrApprovedEos: {
    label: "Whether an application is pending",
    get: (p) => p.pendingApplication,
  },
  pendingOrApprovedOtherBenefits: {
    label: "Whether another benefit request is pending",
    get: (p) => p.pendingApplication,
  },
};

function missingInputs(rule: RuleRecord, profile: StudentProfile): string[] {
  return rule.requiredInputs
    .filter((input) => {
      const resolver = REQUIRED_INPUT_RESOLVERS[input];
      if (!resolver) return false; // unknown inputs are not treated as blocking
      const value = resolver.get(profile);
      return value === null || value === undefined || value === "" || value === "unknown";
    })
    .map((input) => REQUIRED_INPUT_RESOLVERS[input]?.label ?? input);
}

interface PredicateOutcome {
  /** True when every non-self-reported condition is satisfied. */
  matched: boolean;
  matchedFacts: string[];
  /** Satisfied self-reported gates, carried onto the finding as caveats. */
  selfReportedGates: SelfReportedGate[];
  /**
   * Self-reported gates that were NOT answered "yes" even though every other
   * condition held. Their presence turns a silent skip into an explicit
   * insufficient-information note.
   */
  blockedBy: Array<{ predicate: string; message: string }>;
}

function predicatesMatch(
  rule: RuleRecord,
  profile: StudentProfile,
  asOfDate: string,
): PredicateOutcome {
  const ctx = { asOfDate, rule };
  const run = (name: string) => PREDICATES[name]?.(profile, ctx) ?? false;

  const selfReportedGates: SelfReportedGate[] = [];
  const blockedBy: Array<{ predicate: string; message: string }> = [];

  // Self-reported gates are pulled out of `all` and judged separately so that a
  // "no"/"unsure" answer produces an explicit note instead of silence.
  const selfReportedNames = rule.appliesWhen.all.filter((name) => name in SELF_REPORTED_GATES);
  const ordinaryAll = rule.appliesWhen.all.filter((name) => !(name in SELF_REPORTED_GATES));

  for (const name of selfReportedNames) {
    const gate = SELF_REPORTED_GATES[name];
    if (!gate) continue;
    const answer = gate.read(profile);
    if (answer === "yes") {
      selfReportedGates.push({
        predicate: name,
        question: gate.question,
        answer: gate.label.yes,
        caveat: gate.caveat,
      });
    } else {
      blockedBy.push({ predicate: name, message: gate.blockedMessage });
    }
  }

  const all = ordinaryAll.every(run);
  const any = rule.appliesWhen.any.length === 0 || rule.appliesWhen.any.some(run);
  const none = rule.appliesWhen.not.every((n) => !run(n));
  const matchedFacts = [...rule.appliesWhen.all, ...rule.appliesWhen.any].filter(run);

  return { matched: all && any && none, matchedFacts, selfReportedGates, blockedBy };
}

/**
 * Rule-specific date maths. Each calculator is a direct transcription of the
 * matching `calculation.formula` string in rules.json; thresholds live here, not
 * in components.
 */
const CALCULATORS: Record<
  string,
  (p: StudentProfile, rule: RuleRecord, asOfDate: string) => DerivedDate[]
> = {
  "rule-f1-program-end-ds-grace-period": (p, rule) => {
    // official_deadline = i20ProgramEndDate + 60 days
    const end = p.i20ProgramEndDate;
    if (!isValidIsoDate(end)) return [];
    const deadline = addDays(end, 60);
    const out: DerivedDate[] = [];
    if (deadline) {
      out.push({
        id: `${rule.id}:grace-end`,
        label: "End of 60-day grace period",
        date: deadline,
        kind: "official",
        basis:
          "Program end date plus 60 calendar days, per 8 CFR 214.2(f) grace-period guidance in the corpus.",
        ruleId: rule.id,
        sourceIds: rule.sourceIds,
      });
      const remind = addDays(end, -30);
      if (remind) {
        out.push({
          id: `${rule.id}:prep-reminder`,
          label: "Stay Valid reminder: plan your next step",
          date: remind,
          kind: "reminder",
          basis:
            "Stay Valid preparation reminder 30 days before your program end date. This is not a government deadline.",
          ruleId: rule.id,
          sourceIds: [],
        });
      }
    }
    return out;
  },

  "rule-f1-transition-existing-ds-student": (p, rule) => {
    // Transition end = min( max(programEnd, eadEnd), 2030-11-14 )
    const TRANSITION_CAP = "2030-11-14";
    const later = maxDate(p.i20ProgramEndDate, p.eadEndDate);
    const capped = capAt(later, TRANSITION_CAP);
    if (!capped) return [];
    const graceEnd = addDays(capped, 60);
    const dates: DerivedDate[] = [
      {
        id: `${rule.id}:transition-end`,
        label:
          capped === TRANSITION_CAP
            ? "Transition cap for D/S students (Nov 14, 2030)"
            : "End of transition authorized stay",
        date: capped,
        kind: "official",
        basis:
          "Later of the I-20 program end date and any OPT/STEM OPT EAD end date, capped at November 14, 2030 per the DHS transition provisions in the corpus.",
        ruleId: rule.id,
        sourceIds: rule.sourceIds,
      },
    ];
    if (graceEnd) {
      dates.push({
        id: `${rule.id}:transition-grace`,
        label: "End of 60-day grace period after transition end",
        date: graceEnd,
        kind: "needs_confirmation",
        basis:
          "Corpus describes a legacy 60-day grace period after the transition end date; confirm with your DSO because the rule is pending and subject to litigation.",
        ruleId: rule.id,
        sourceIds: rule.sourceIds,
      });
    }
    return dates;
  },

  "rule-f1-fixed-admission-after-effective-date": (p, rule) => {
    // AUD = min( programEnd, programStart + 4y, eadEnd ) + 30-day departure period
    const fourYearCap = p.i20ProgramStartDate ? addYears(p.i20ProgramStartDate, 4) : null;
    const base = minDate(p.i20ProgramEndDate, fourYearCap, p.eadEndDate);
    if (!base) return [];
    const departure = addDays(base, 30);
    const dates: DerivedDate[] = [
      {
        id: `${rule.id}:aud`,
        label: "Calculated admit-until basis date",
        date: base,
        kind: "official",
        basis:
          "Earliest of the I-20 program end date, four years from the program start date, and any EAD end date, per the fixed-admission formula in the corpus.",
        ruleId: rule.id,
        sourceIds: rule.sourceIds,
      },
    ];
    if (departure) {
      dates.push({
        id: `${rule.id}:departure`,
        label: "End of 30-day departure period",
        date: departure,
        kind: "official",
        basis: "Basis date plus the 30-day departure period described in the final rule.",
        ruleId: rule.id,
        sourceIds: rule.sourceIds,
      });
    }
    return dates;
  },

  "rule-f1-opt-filing-window": (p, rule) => {
    const end = p.i20ProgramEndDate;
    const out: DerivedDate[] = [];
    if (isValidIsoDate(end)) {
      const earliest = addDays(end, -90);
      const latest = addDays(end, 60);
      if (earliest)
        out.push({
          id: `${rule.id}:earliest-filing`,
          label: "Earliest Form I-765 filing date",
          date: earliest,
          kind: "official",
          basis: "Up to 90 days before the program end date, per USCIS OPT guidance in the corpus.",
          ruleId: rule.id,
          sourceIds: rule.sourceIds,
        });
      if (latest)
        out.push({
          id: `${rule.id}:latest-filing`,
          label: "End of 60-day window after program completion",
          date: latest,
          kind: "official",
          basis: "USCIS must receive Form I-765 within the 60-day period after program completion.",
          ruleId: rule.id,
          sourceIds: rule.sourceIds,
        });
    }
    if (isValidIsoDate(p.dsoOptRecommendationDate)) {
      const recDeadline = addDays(p.dsoOptRecommendationDate, 60);
      if (recDeadline)
        out.push({
          id: `${rule.id}:recommendation-deadline`,
          label: "60 days after DSO OPT recommendation",
          date: recDeadline,
          kind: "official",
          basis:
            "USCIS must receive Form I-765 no later than 60 days after the DSO enters the recommendation in SEVIS.",
          ruleId: rule.id,
          sourceIds: rule.sourceIds,
        });
    }
    return out;
  },

  "rule-f1-travel-readmission-fixed-period": (p, rule) => {
    if (!isValidIsoDate(p.expectedReentryDate)) return [];
    return [
      {
        id: `${rule.id}:reentry`,
        label: "Expected reentry — new I-94 review",
        date: p.expectedReentryDate,
        kind: "needs_confirmation",
        basis:
          "Reentry outcomes depend on CBP discretion and on whether the fixed-admission rule is in force; the corpus computes no deadline here.",
        ruleId: rule.id,
        sourceIds: rule.sourceIds,
      },
    ];
  },

  "rule-f1-unlawful-presence-fixed-aud": (p, rule) => {
    if (!isValidIsoDate(p.i94AdmitUntilDate)) return [];
    return [
      {
        id: `${rule.id}:aud-document`,
        label: "I-94 admit-until date",
        date: p.i94AdmitUntilDate,
        kind: "document",
        basis: "Date you entered from your own I-94 record.",
        ruleId: rule.id,
        sourceIds: rule.sourceIds,
      },
    ];
  },
};

function attentionFor(rule: RuleRecord, pending: boolean): Attention {
  if (!pending) return rule.finding.attention;
  // A rule that is not yet in force can never be presented as "confirm now".
  return rule.finding.attention === "information" ? "information" : "monitor";
}

export function evaluateRules(
  profile: StudentProfile,
  corpus: Corpus,
  asOfDate: string,
): EvaluationResult {
  const findings: Finding[] = [];
  const insufficient: InsufficientInfoNote[] = [];
  const evaluatedRuleIds: string[] = [];
  const skippedRuleIds: string[] = [];

  const rules = [...corpus.rules.rules].sort((a, b) => a.id.localeCompare(b.id));

  for (const rule of rules) {
    if (rule.classifications.length > 0 && !rule.classifications.includes(profile.classification)) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    // Window bounds: a rule outside its active window produces nothing.
    if (rule.activeUntil && asOfDate > rule.activeUntil) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    const { matched, matchedFacts, selfReportedGates, blockedBy } = predicatesMatch(
      rule,
      profile,
      asOfDate,
    );
    if (!matched) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    // Every ordinary condition held but a question only a DSO can answer did
    // not. Say so explicitly rather than dropping the rule silently.
    if (blockedBy.length > 0) {
      insufficient.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        reason: "self_reported_gate",
        missingInputs: blockedBy.map(
          (b) => SELF_REPORTED_GATES[b.predicate]?.question ?? b.predicate,
        ),
        message: blockedBy.map((b) => b.message).join(" "),
      });
      skippedRuleIds.push(rule.id);
      continue;
    }

    const missing = missingInputs(rule, profile);
    if (missing.length > 0) {
      insufficient.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        reason: "missing_input",
        missingInputs: missing,
        message: INSUFFICIENT_INFO_MESSAGE,
      });
      skippedRuleIds.push(rule.id);
      continue;
    }

    const gate = rule.doNotActivateBefore ?? rule.activeFrom;
    const gateNotReached = Boolean(gate && asOfDate < gate);
    const statusNonOperative = NON_OPERATIVE_STATUSES.has(String(rule.legalStatus));
    const pendingEffective =
      gateNotReached || rule.legalStatus === "published_pending_effective" || statusNonOperative;

    // Deadlines are only computed for rules in force whose gate has passed.
    const mayComputeDeadlines =
      !gateNotReached && !statusNonOperative && rule.calculation.isLegalDeadline;

    let dates: DerivedDate[] = [];
    if (!gateNotReached && !statusNonOperative) {
      dates = CALCULATORS[rule.id]?.(profile, rule, asOfDate) ?? [];
      if (!mayComputeDeadlines) {
        dates = dates.map((d) =>
          d.kind === "official" ? { ...d, kind: "needs_confirmation" as const } : d,
        );
      }
    }

    findings.push({
      ruleId: rule.id,
      title: rule.title,
      topic: rule.topic,
      attention: attentionFor(rule, pendingEffective),
      corpusAttention: rule.finding.attention,
      headline: rule.finding.headline,
      explanation: rule.finding.explanation,
      whyThisAppears: rule.finding.whyThisAppears,
      studentImpact: rule.finding.studentImpact,
      knownFacts: rule.finding.knownFacts,
      confirmationNeeded: rule.finding.confirmationNeeded,
      actions: rule.finding.actions,
      questionsForDso: rule.finding.questionsForDso,
      documentsOrDatesToBring: rule.finding.documentsOrDatesToBring,
      legalStatus: rule.legalStatus,
      pendingEffective,
      isLegalDeadline: mayComputeDeadlines,
      dates,
      pathways: rule.possiblePathways,
      sourceIds: rule.sourceIds,
      matchedFacts,
      selfReportedGates,
      uncertainty: rule.uncertainty ?? null,
      humanReviewRequired: rule.humanReviewRequired,
    });
    evaluatedRuleIds.push(rule.id);
  }

  const matchedIds = new Set(evaluatedRuleIds);
  const relatedCandidateUpdates: CandidateUpdate[] = corpus.candidates.updates.filter((u) =>
    u.affectedRuleIds.some((id) => matchedIds.has(id)),
  );

  const order: Attention[] = ["confirm_now", "prepare", "monitor", "information"];
  findings.sort((a, b) => order.indexOf(a.attention) - order.indexOf(b.attention));

  return {
    asOfDate,
    corpusVersion: corpus.rules.corpusVersion,
    researchedAsOf: corpus.rules.researchedAsOf,
    ruleSetStatus: corpus.rules.ruleSetStatus,
    findings,
    insufficient,
    relatedCandidateUpdates,
    evaluatedRuleIds,
    skippedRuleIds,
  };
}
