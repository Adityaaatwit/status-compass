/**
 * Single in-memory store for the session.
 *
 * Answers live in React state only. Nothing is written to localStorage, no
 * network request is made, and "Clear my information" resets everything.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { buildChecklist } from "@/domain/buildChecklist";
import { buildMeetingKit } from "@/domain/buildMeetingKit";
import { buildPathways } from "@/domain/buildPathways";
import { buildTimeline } from "@/domain/buildTimeline";
import { loadCorpus } from "@/domain/dataAdapters";
import { evaluateRules } from "@/domain/evaluateRules";
import { emptyProfile, type Scenario } from "@/domain/scenarios";
import type {
  ChecklistAction,
  Corpus,
  EvaluationResult,
  MeetingKit,
  PathwayCard,
  StudentProfile,
  TimelineItem,
} from "@/domain/types";
import type { CorpusValidation } from "@/domain/dataValidation";
import { todayIso } from "@/utils/dateFormatting";

interface StayValidState {
  corpus: Corpus;
  validation: CorpusValidation;
  asOfDate: string;
  profile: StudentProfile;
  scenarioLabel: string | null;
  hasAnswers: boolean;
  evaluation: EvaluationResult | null;
  timeline: TimelineItem[];
  pathways: PathwayCard[];
  actions: ChecklistAction[];
  meetingKit: MeetingKit | null;
  updateProfile: (patch: Partial<StudentProfile>) => void;
  loadScenario: (scenario: Scenario) => void;
  clearAll: () => void;
}

const StayValidContext = createContext<StayValidState | null>(null);

const { corpus, validation } = loadCorpus();

export function StayValidProvider({ children }: { children: ReactNode }) {
  // asOfDate is captured once per session so all derived output stays consistent.
  const [asOfDate] = useState(() => todayIso());
  const [profile, setProfile] = useState<StudentProfile>(emptyProfile);
  const [scenarioLabel, setScenarioLabel] = useState<string | null>(null);
  const [hasAnswers, setHasAnswers] = useState(false);

  const updateProfile = useCallback((patch: Partial<StudentProfile>) => {
    setHasAnswers(true);
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadScenario = useCallback((scenario: Scenario) => {
    setProfile(scenario.profile);
    setScenarioLabel(scenario.name);
    setHasAnswers(true);
  }, []);

  const clearAll = useCallback(() => {
    setProfile(emptyProfile);
    setScenarioLabel(null);
    setHasAnswers(false);
  }, []);

  const derived = useMemo(() => {
    if (!validation.ok || !hasAnswers) {
      return {
        evaluation: null,
        timeline: [] as TimelineItem[],
        pathways: [] as PathwayCard[],
        actions: [] as ChecklistAction[],
        meetingKit: null,
      };
    }
    const evaluation = evaluateRules(profile, corpus, asOfDate);
    const timeline = buildTimeline(profile, evaluation, corpus, asOfDate);
    const pathways = buildPathways(evaluation);
    const actions = buildChecklist(evaluation, asOfDate);
    const meetingKit = buildMeetingKit(profile, evaluation, timeline, pathways, actions, corpus, {
      label: scenarioLabel ?? "Stay Valid session",
    });
    return { evaluation, timeline, pathways, actions, meetingKit };
  }, [profile, asOfDate, hasAnswers, scenarioLabel]);

  const value = useMemo<StayValidState>(
    () => ({
      corpus,
      validation,
      asOfDate,
      profile,
      scenarioLabel,
      hasAnswers,
      ...derived,
      updateProfile,
      loadScenario,
      clearAll,
    }),
    [asOfDate, profile, scenarioLabel, hasAnswers, derived, updateProfile, loadScenario, clearAll],
  );

  return <StayValidContext.Provider value={value}>{children}</StayValidContext.Provider>;
}

export function useStayValid(): StayValidState {
  const ctx = useContext(StayValidContext);
  if (!ctx) throw new Error("useStayValid must be used inside <StayValidProvider>");
  return ctx;
}
