/**
 * Assembles the printable DSO meeting kit. Contains only non-identifying facts
 * the student typed plus corpus-derived content.
 */

import { sourcesByIds } from "./dataAdapters";
import type {
  ChecklistAction,
  Corpus,
  EvaluationResult,
  MeetingKit,
  PathwayCard,
  StudentProfile,
  TimelineItem,
} from "./types";

const I94_LABELS: Record<StudentProfile["i94Notation"], string> = {
  ds: "D/S (duration of status)",
  fixed_date: "A fixed admit-until date",
  unknown: "Not sure",
};

const STAGE_LABELS: Record<StudentProfile["academicStage"], string> = {
  not_started: "Program has not started yet",
  in_progress: "Currently studying",
  final_term: "Final term",
  completed: "Program completed",
};

const OPT_LABELS: Record<StudentProfile["optStage"], string> = {
  none: "Not involved with OPT",
  preparing: "Preparing for OPT",
  applied: "OPT application submitted",
  post_completion_opt: "On post-completion OPT",
  stem_opt: "On STEM OPT",
};

export const GOAL_LABELS: Record<StudentProfile["goals"][number], string> = {
  continue_program: "Continue current program",
  complete_program: "Complete the program",
  explore_opt: "Explore OPT or STEM OPT",
  transfer_school: "Transfer schools",
  change_level: "Change educational level",
  travel: "Travel internationally",
  dso_meeting: "Prepare for a DSO meeting",
};

export function profileFacts(profile: StudentProfile): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [
    { label: "Classification", value: profile.classification },
    { label: "I-94 shows", value: I94_LABELS[profile.i94Notation] },
  ];
  if (profile.i94AdmitUntilDate)
    facts.push({ label: "I-94 admit-until date", value: profile.i94AdmitUntilDate });
  if (profile.mostRecentEntryDate)
    facts.push({ label: "Most recent U.S. entry", value: profile.mostRecentEntryDate });
  if (profile.i20ProgramStartDate)
    facts.push({ label: "I-20 program start", value: profile.i20ProgramStartDate });
  if (profile.i20ProgramEndDate)
    facts.push({ label: "I-20 program end", value: profile.i20ProgramEndDate });
  facts.push({ label: "Academic stage", value: STAGE_LABELS[profile.academicStage] });
  facts.push({ label: "OPT / STEM OPT", value: OPT_LABELS[profile.optStage] });
  if (profile.eadStartDate) facts.push({ label: "EAD start", value: profile.eadStartDate });
  if (profile.eadEndDate) facts.push({ label: "EAD expiration", value: profile.eadEndDate });
  if (profile.dsoOptRecommendationDate)
    facts.push({ label: "DSO OPT recommendation entered", value: profile.dsoOptRecommendationDate });
  facts.push({ label: "Travel planned", value: profile.plannedTravel ? "Yes" : "No" });
  if (profile.plannedDepartureDate)
    facts.push({ label: "Planned departure", value: profile.plannedDepartureDate });
  if (profile.expectedReentryDate)
    facts.push({ label: "Expected reentry", value: profile.expectedReentryDate });
  facts.push({
    label: "Application pending",
    value: profile.pendingApplication ? "Yes" : "No",
  });
  facts.push({
    label: "Present in the U.S.",
    value: profile.presentInUS === "yes" ? "Yes" : profile.presentInUS === "no" ? "No" : "Not sure",
  });
  facts.push({
    label: "Goals",
    value: profile.goals.length
      ? profile.goals.map((g) => GOAL_LABELS[g]).join(", ")
      : "Not specified",
  });
  return facts;
}

export function buildMeetingKit(
  profile: StudentProfile,
  evaluation: EvaluationResult,
  timeline: TimelineItem[],
  pathways: PathwayCard[],
  actions: ChecklistAction[],
  corpus: Corpus,
  options: { label?: string } = {},
): MeetingKit {
  const questionPool = [
    ...evaluation.findings.flatMap((f) => f.questionsForDso),
    ...pathways.flatMap((p) => p.questionsForDso),
  ];
  const questions = [...new Set(questionPool)].slice(0, 5);

  const citationIds = [
    ...new Set([
      ...evaluation.findings.flatMap((f) => f.sourceIds),
      ...pathways.flatMap((p) => p.sourceIds),
    ]),
  ];

  return {
    generatedFor: options.label ?? "Stay Valid session",
    asOfDate: evaluation.asOfDate,
    corpusVersion: evaluation.corpusVersion,
    researchedAsOf: evaluation.researchedAsOf,
    ruleSetStatus: evaluation.ruleSetStatus,
    facts: profileFacts(profile),
    timeline,
    findings: evaluation.findings,
    confirmationTopics: [
      ...new Set([
        ...evaluation.findings.flatMap((f) => f.confirmationNeeded),
        ...pathways.flatMap((p) => p.confirmationNeeded),
      ]),
    ],
    pathways,
    questions,
    preparationChecklist: actions.slice(0, 8),
    citations: sourcesByIds(corpus, citationIds).map((s) => ({
      id: s.id,
      title: s.title,
      publisher: s.publisher,
      url: s.url,
      legalStatus: s.legalStatus,
      lastCheckedAt: s.lastCheckedAt,
    })),
    insufficient: evaluation.insufficient,
  };
}
