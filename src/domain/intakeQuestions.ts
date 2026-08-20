/**
 * Dependency-aware intake registry.
 *
 * One declarative list of questions is the single source of truth for:
 *  - which questions the wizard renders (and in which group),
 *  - which questions a chosen goal makes necessary,
 *  - which question a "missing information" note should send the student to.
 *
 * Pure data + pure predicates: no React, no clock, no I/O. The rules engine is
 * untouched by this file — it only decides *what to ask*, never what is true.
 */

import type { Goal, StudentProfile } from "@/domain/types";

export type IntakeFieldId =
  | "goals"
  | "i94Notation"
  | "i94AdmitUntilDate"
  | "mostRecentEntryDate"
  | "presentInUS"
  | "maintainingStatus"
  | "i20ProgramStartDate"
  | "i20ProgramEndDate"
  | "academicStage"
  | "optStage"
  | "eadStartDate"
  | "eadEndDate"
  | "dsoOptRecommendationDate"
  | "pendingApplication"
  | "plannedTravel"
  | "plannedDepartureDate"
  | "expectedReentryDate";

export type IntakeGroupId = "goals" | "admission" | "program" | "work" | "travel";

export const INTAKE_GROUPS: Array<{ id: IntakeGroupId; title: string }> = [
  { id: "goals", title: "What you need help with" },
  { id: "admission", title: "Your admission record" },
  { id: "program", title: "Your program dates" },
  { id: "work", title: "Work authorization" },
  { id: "travel", title: "Travel plans" },
];

export interface IntakeQuestion {
  id: IntakeFieldId;
  group: IntakeGroupId;
  /** Short label used in prompts such as "Add I-20 program end date". */
  shortLabel: string;
  /** Why the rules engine needs it, in plain language. */
  whyNeeded: string;
  /** Goals that make this question necessary before evaluation. */
  requiredForGoals: Goal[];
  /** Extra gate: only ask when the profile makes the question meaningful. */
  visibleWhen?: (profile: StudentProfile) => boolean;
  /** True when the profile already has a usable answer. */
  isAnswered: (profile: StudentProfile) => boolean;
}

const answeredDate = (value: string | null) => typeof value === "string" && value.length > 0;

const onOptWithEad = (p: StudentProfile) =>
  p.optStage === "post_completion_opt" || p.optStage === "stem_opt";

const optRelevant = (p: StudentProfile) =>
  p.goals.includes("explore_opt") ||
  p.goals.includes("complete_program") ||
  p.goals.includes("travel") ||
  p.optStage !== "none";

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "goals",
    group: "goals",
    shortLabel: "What you want help with",
    whyNeeded: "Your goal decides which checkpoints and questions Stay Valid puts in front of you.",
    requiredForGoals: [],
    isAnswered: (p) => p.goals.length > 0,
  },
  {
    id: "i94Notation",
    group: "admission",
    shortLabel: "What your I-94 shows",
    whyNeeded:
      "Whether you were admitted for duration of status or until a fixed date changes which rules apply to you.",
    requiredForGoals: ["continue_program", "travel", "transfer_school", "change_level"],
    isAnswered: (p) => p.i94Notation !== "unknown",
  },
  {
    id: "i94AdmitUntilDate",
    group: "admission",
    shortLabel: "I-94 admit-until date",
    whyNeeded: "A fixed admission date is itself a deadline, so the timeline needs the exact date.",
    requiredForGoals: [],
    visibleWhen: (p) => p.i94Notation === "fixed_date",
    isAnswered: (p) => answeredDate(p.i94AdmitUntilDate),
  },
  {
    id: "mostRecentEntryDate",
    group: "admission",
    shortLabel: "Most recent U.S. entry date",
    whyNeeded: "Your entry date explains which admission framework applied when you arrived.",
    requiredForGoals: [],
    isAnswered: (p) => answeredDate(p.mostRecentEntryDate),
  },
  {
    id: "presentInUS",
    group: "admission",
    shortLabel: "Whether you are in the U.S.",
    whyNeeded: "Reentry and departure checkpoints only make sense once this is known.",
    requiredForGoals: ["travel"],
    isAnswered: (p) => p.presentInUS !== "unsure",
  },
  {
    id: "maintainingStatus",
    group: "admission",
    shortLabel: "Whether anyone has flagged a problem",
    whyNeeded:
      "This only selects which topics appear. Stay Valid never determines your status either way.",
    requiredForGoals: [],
    isAnswered: () => true,
  },
  {
    id: "i20ProgramStartDate",
    group: "program",
    shortLabel: "I-20 program start date",
    whyNeeded: "Used to explain which admission rules were in force when your program began.",
    requiredForGoals: [],
    isAnswered: (p) => answeredDate(p.i20ProgramStartDate),
  },
  {
    id: "i20ProgramEndDate",
    group: "program",
    shortLabel: "I-20 program end date",
    whyNeeded:
      "Most F-1 deadlines are counted from this date — grace period, OPT filing window, and the fixed-period transition all depend on it.",
    requiredForGoals: [
      "continue_program",
      "complete_program",
      "explore_opt",
      "transfer_school",
      "change_level",
    ],
    isAnswered: (p) => answeredDate(p.i20ProgramEndDate),
  },
  {
    id: "academicStage",
    group: "program",
    shortLabel: "Where you are in your program",
    whyNeeded: "Completion checkpoints differ for a final term and for finished coursework.",
    requiredForGoals: ["complete_program", "transfer_school", "change_level"],
    isAnswered: () => true,
  },
  {
    id: "optStage",
    group: "work",
    shortLabel: "Your OPT stage",
    whyNeeded: "Filing windows, EAD dates and travel rules all depend on where you are with OPT.",
    requiredForGoals: ["explore_opt", "complete_program"],
    isAnswered: () => true,
  },
  {
    id: "eadStartDate",
    group: "work",
    shortLabel: "EAD start date",
    whyNeeded: "Only asked once you already hold an EAD, to place it on your timeline.",
    requiredForGoals: [],
    visibleWhen: onOptWithEad,
    isAnswered: (p) => answeredDate(p.eadStartDate),
  },
  {
    id: "eadEndDate",
    group: "work",
    shortLabel: "EAD end date",
    whyNeeded:
      "Your EAD expiration is a hard date on the timeline and drives the transition checkpoint.",
    requiredForGoals: [],
    visibleWhen: onOptWithEad,
    isAnswered: (p) => answeredDate(p.eadEndDate),
  },
  {
    id: "dsoOptRecommendationDate",
    group: "work",
    shortLabel: "Date your DSO entered the OPT recommendation",
    whyNeeded:
      "The I-765 filing window is counted from the recommendation date. Leave it blank if you have not received one yet — nothing will be guessed.",
    // Never required: exploring OPT must not demand a recommendation date.
    requiredForGoals: [],
    visibleWhen: (p) =>
      p.optStage === "applied" || p.optStage === "post_completion_opt" || p.optStage === "stem_opt",
    isAnswered: (p) => answeredDate(p.dsoOptRecommendationDate),
  },
  {
    id: "pendingApplication",
    group: "work",
    shortLabel: "Whether an application is pending with USCIS",
    whyNeeded: "A pending benefit request changes what happens at a fixed admission date.",
    requiredForGoals: [],
    visibleWhen: optRelevant,
    isAnswered: () => true,
  },
  {
    id: "plannedTravel",
    group: "travel",
    shortLabel: "Whether you plan to travel",
    whyNeeded: "Reentry review only applies if you are leaving the country.",
    requiredForGoals: ["travel"],
    isAnswered: () => true,
  },
  {
    id: "plannedDepartureDate",
    group: "travel",
    shortLabel: "Planned departure date",
    whyNeeded:
      "Departure and reentry dates decide which admission framework meets you at the port.",
    requiredForGoals: ["travel"],
    visibleWhen: (p) => p.plannedTravel,
    isAnswered: (p) => answeredDate(p.plannedDepartureDate),
  },
  {
    id: "expectedReentryDate",
    group: "travel",
    shortLabel: "Expected reentry date",
    whyNeeded:
      "A reentry after a policy effective date is reviewed under different admission rules.",
    requiredForGoals: ["travel"],
    visibleWhen: (p) => p.plannedTravel,
    isAnswered: (p) => answeredDate(p.expectedReentryDate),
  },
];

const BY_ID = new Map(INTAKE_QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id: IntakeFieldId): IntakeQuestion | undefined {
  return BY_ID.get(id);
}

/** True when the question should be rendered for this profile. */
export function isVisible(question: IntakeQuestion, profile: StudentProfile): boolean {
  return question.visibleWhen ? question.visibleWhen(profile) : true;
}

/** Questions rendered in a group, in registry order. */
export function visibleQuestionsForGroup(
  group: IntakeGroupId,
  profile: StudentProfile,
): IntakeQuestion[] {
  return INTAKE_QUESTIONS.filter((q) => q.group === group && isVisible(q, profile));
}

/** Groups worth showing: those with at least one visible question. */
export function activeGroups(profile: StudentProfile): IntakeGroupId[] {
  const goals = profile.goals;
  return INTAKE_GROUPS.filter((group) => {
    const questions = visibleQuestionsForGroup(group.id, profile);
    if (questions.length === 0) return false;
    if (group.id === "goals") return true;
    if (goals.length === 0) return true;
    // Show a group when any of its questions is either goal-relevant or already
    // in play for this profile (e.g. an EAD date once OPT is under way).
    return questions.some(
      (q) => q.requiredForGoals.some((g) => goals.includes(g)) || q.visibleWhen !== undefined,
    );
  }).map((g) => g.id);
}

/**
 * Questions the selected goals make necessary and that are still unanswered.
 * This is what closes the "you picked a goal but were never asked" gap.
 */
export function outstandingQuestions(profile: StudentProfile): IntakeQuestion[] {
  return INTAKE_QUESTIONS.filter(
    (q) =>
      q.requiredForGoals.some((goal) => profile.goals.includes(goal)) &&
      isVisible(q, profile) &&
      !q.isAnswered(profile),
  );
}

/** Maps a rule's `requiredInputs` key onto the intake question that supplies it. */
export const REQUIRED_INPUT_TO_FIELD: Record<string, IntakeFieldId> = {
  i94Notation: "i94Notation",
  currentAdmissionFramework: "i94Notation",
  i94AdmitUntilDate: "i94AdmitUntilDate",
  dateOfAdmission: "mostRecentEntryDate",
  i20ProgramStartDate: "i20ProgramStartDate",
  i20ProgramEndDate: "i20ProgramEndDate",
  i20ProgramEndDateOnEffectiveDate: "i20ProgramEndDate",
  optOrStemOptStatus: "optStage",
  optOrStemOptEadEndDate: "eadEndDate",
  optOrStemOptEadEndDateOnEffectiveDate: "eadEndDate",
  dsoOptRecommendationDate: "dsoOptRecommendationDate",
  plannedDepartureDate: "plannedDepartureDate",
  expectedReentryDate: "expectedReentryDate",
  pendingOrApprovedEos: "pendingApplication",
  pendingOrApprovedOtherBenefits: "pendingApplication",
};

/** The group a field lives in — used to jump the wizard to the right step. */
export function groupForField(id: IntakeFieldId): IntakeGroupId {
  return BY_ID.get(id)?.group ?? "goals";
}
