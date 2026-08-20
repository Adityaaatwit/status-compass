/**
 * Fictional demonstration personas. All values are synthetic and contain no
 * identifying information. Used only so reviewers can explore the product.
 */

import type { StudentProfile } from "./types";

export interface Scenario {
  id: string;
  name: string;
  summary: string;
  profile: StudentProfile;
}

const base: StudentProfile = {
  classification: "F-1",
  i94Notation: "ds",
  i94AdmitUntilDate: null,
  mostRecentEntryDate: null,
  presentInUS: "yes",
  maintainingStatus: "yes",
  i20ProgramStartDate: null,
  i20ProgramEndDate: null,
  academicStage: "in_progress",
  optStage: "none",
  eadStartDate: null,
  eadEndDate: null,
  dsoOptRecommendationDate: null,
  plannedTravel: false,
  plannedDepartureDate: null,
  expectedReentryDate: null,
  pendingApplication: false,
  goals: [],
};

export const emptyProfile: StudentProfile = { ...base, i94Notation: "unknown" };

export const scenarios: Scenario[] = [
  {
    id: "continuing-ds",
    name: "Continuing student admitted for D/S",
    summary:
      "Fictional demonstration: a continuing undergraduate whose I-94 shows D/S and whose program runs into 2028.",
    profile: {
      ...base,
      i20ProgramStartDate: "2024-08-19",
      i20ProgramEndDate: "2028-05-12",
      mostRecentEntryDate: "2025-08-10",
      goals: ["continue_program", "dso_meeting"],
    },
  },
  {
    id: "approaching-program-end",
    name: "Student approaching the program end date",
    summary:
      "Fictional demonstration: a master's student in their final term with no OPT filing yet.",
    profile: {
      ...base,
      i20ProgramStartDate: "2025-01-13",
      i20ProgramEndDate: "2026-12-18",
      mostRecentEntryDate: "2025-01-05",
      academicStage: "final_term",
      optStage: "preparing",
      goals: ["complete_program", "explore_opt", "dso_meeting"],
    },
  },
  {
    id: "on-opt",
    name: "Student participating in STEM OPT",
    summary: "Fictional demonstration: a graduate on STEM OPT with an EAD expiring in 2028.",
    profile: {
      ...base,
      i20ProgramStartDate: "2022-08-22",
      i20ProgramEndDate: "2025-05-16",
      mostRecentEntryDate: "2024-06-02",
      academicStage: "completed",
      optStage: "stem_opt",
      eadStartDate: "2026-05-17",
      eadEndDate: "2028-05-16",
      goals: ["explore_opt", "dso_meeting"],
    },
  },
  {
    id: "planning-travel",
    name: "Student considering international travel",
    summary:
      "Fictional demonstration: a continuing student planning to leave and reenter around the scheduled policy checkpoint.",
    profile: {
      ...base,
      i20ProgramStartDate: "2025-08-25",
      i20ProgramEndDate: "2027-05-14",
      mostRecentEntryDate: "2025-08-15",
      plannedTravel: true,
      plannedDepartureDate: "2026-09-20",
      expectedReentryDate: "2026-10-05",
      goals: ["travel", "dso_meeting"],
    },
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
