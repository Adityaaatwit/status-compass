/**
 * Builds the personal timeline: document dates the student entered, official
 * dates computed by the rules engine, policy checkpoints from the source corpus,
 * and clearly-labelled Stay Valid preparation reminders.
 */

import { addDays, diffInDays, isValidIsoDate, minDate } from "./dateCalculations";
import type { Corpus, DerivedDate, EvaluationResult, StudentProfile, TimelineItem } from "./types";

function documentDates(profile: StudentProfile): DerivedDate[] {
  const items: Array<[string, string, string | null]> = [
    ["i20-start", "I-20 program start date", profile.i20ProgramStartDate],
    ["i20-end", "I-20 program end date", profile.i20ProgramEndDate],
    ["ead-start", "EAD start date", profile.eadStartDate],
    ["ead-end", "EAD expiration date", profile.eadEndDate],
    ["i94-aud", "I-94 admit-until date", profile.i94AdmitUntilDate],
    ["departure", "Planned departure", profile.plannedDepartureDate],
  ];
  return items
    .filter((entry): entry is [string, string, string] => isValidIsoDate(entry[2]))
    .map(([id, label, date]) => ({
      id: `doc:${id}`,
      label,
      date,
      kind: "document" as const,
      basis: "A date you entered from your own documents.",
      ruleId: null,
      sourceIds: [],
    }));
}

/** Policy checkpoints come from scheduled effective dates in the source corpus. */
function policyCheckpoints(corpus: Corpus): DerivedDate[] {
  return corpus.sources.sources
    .filter(
      (s) =>
        s.sourceTier === 1 &&
        isValidIsoDate(s.scheduledEffectiveAt) &&
        s.actualEffectiveAt === null,
    )
    .map((s) => ({
      id: `policy:${s.id}`,
      label: "Policy checkpoint — scheduled effective date",
      date: s.scheduledEffectiveAt as string,
      kind: "needs_confirmation" as const,
      basis: `${s.publisher} lists a scheduled effective date. Publication is not proof that the rule is in force, so this is a checkpoint to verify, not a personal deadline.`,
      ruleId: null,
      sourceIds: [s.id],
    }))
    .filter((item, index, arr) => arr.findIndex((other) => other.date === item.date) === index);
}

/**
 * A single preparation reminder placed ahead of the student's earliest key
 * document date, so it lands while there is still time to act.
 *
 * Deliberately offset: an earlier version put the reminder *on* the anchor date,
 * which both duplicated the document row and suggested the student should see
 * their DSO the day their I-20 expired.
 */
const DSO_REVIEW_LEAD_DAYS = 45;

function dsoFollowUp(profile: StudentProfile, asOfDate: string): DerivedDate[] {
  // Earliest, not first-non-null — the nearest deadline is the one that binds.
  const anchor = minDate(profile.i20ProgramEndDate, profile.eadEndDate, profile.i94AdmitUntilDate);
  if (!isValidIsoDate(anchor)) return [];

  const remind = addDays(anchor, -DSO_REVIEW_LEAD_DAYS);
  // A reminder in the past helps nobody; fall back to the anchor itself only if
  // that is still ahead of the student.
  const date = remind && remind >= asOfDate ? remind : null;
  if (!date) return [];

  return [
    {
      id: "reminder:dso-review",
      label: "Stay Valid reminder: DSO review",
      date,
      kind: "reminder",
      basis: `Suggested review point ${DSO_REVIEW_LEAD_DAYS} days before your earliest key document date. This is a Stay Valid preparation reminder, not a government deadline.`,
      ruleId: null,
      sourceIds: [],
    },
  ];
}

export function buildTimeline(
  profile: StudentProfile,
  evaluation: EvaluationResult,
  corpus: Corpus,
  asOfDate: string,
): TimelineItem[] {
  const ruleDates = evaluation.findings.flatMap((f) => f.dates);
  const all: DerivedDate[] = [
    {
      id: "today",
      label: "Today",
      date: asOfDate,
      kind: "reminder",
      basis: "The date used for this evaluation.",
      ruleId: null,
      sourceIds: [],
    },
    ...documentDates(profile),
    ...policyCheckpoints(corpus),
    ...ruleDates,
    ...dsoFollowUp(profile, asOfDate),
  ];

  // De-duplicate identical label+date pairs, preferring official > document > other.
  const rank: Record<DerivedDate["kind"], number> = {
    official: 0,
    document: 1,
    needs_confirmation: 2,
    reminder: 3,
  };
  const seen = new Map<string, DerivedDate>();
  for (const item of all) {
    const key = `${item.date}|${item.label}`;
    const existing = seen.get(key);
    if (!existing || rank[item.kind] < rank[existing.kind]) seen.set(key, item);
  }

  return [...seen.values()]
    .sort((a, b) => (a.date === b.date ? rank[a.kind] - rank[b.kind] : a.date < b.date ? -1 : 1))
    .map((item) => {
      const related = evaluation.findings.filter((f) => f.dates.some((d) => d.id === item.id));
      const days = diffInDays(asOfDate, item.date) ?? 0;
      return {
        ...item,
        status: days === 0 ? "today" : days < 0 ? "past" : "future",
        daysFromToday: days,
        findingRuleIds: related.map((f) => f.ruleId),
        pathwayIds: related.flatMap((f) => f.pathways.map((p) => p.id)),
        suggestedPreparation: related.flatMap((f) => f.actions).slice(0, 3),
        confirmationNeeded: related.flatMap((f) => f.confirmationNeeded).slice(0, 3),
        studentEntered: item.kind === "document" ? "You entered this date during intake." : null,
      } satisfies TimelineItem;
    });
}
