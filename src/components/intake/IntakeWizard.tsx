import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CheckboxGroupField, DateField, RadioGroupField } from "@/components/intake/Field";
import { isValidIsoDate } from "@/domain/dateCalculations";
import {
  INTAKE_GROUPS,
  activeGroups,
  getQuestion,
  groupForField,
  isVisible,
  outstandingQuestions,
  type IntakeFieldId,
  type IntakeGroupId,
} from "@/domain/intakeQuestions";
import { scenarios } from "@/domain/scenarios";
import type { Goal, StudentProfile } from "@/domain/types";
import { useStayValid } from "@/hooks/useStayValid";
import { cn } from "@/lib/utils";

const GOAL_OPTIONS: Array<{ value: Goal; label: string }> = [
  { value: "continue_program", label: "Continue my current program" },
  { value: "complete_program", label: "Complete my program soon" },
  { value: "explore_opt", label: "Explore OPT or STEM OPT" },
  { value: "transfer_school", label: "Transfer schools" },
  { value: "change_level", label: "Change education level" },
  { value: "travel", label: "Travel outside the US" },
  { value: "dso_meeting", label: "Prepare for a DSO meeting" },
];

const GROUP_TITLE = new Map(INTAKE_GROUPS.map((g) => [g.id, g.title]));

export function IntakeWizard({
  focusField,
  returnTo,
}: {
  focusField?: IntakeFieldId | undefined;
  returnTo?: "plan" | undefined;
}) {
  const { profile, updateProfile, loadScenario } = useStayValid();
  const navigate = useNavigate();

  const groups = useMemo(() => activeGroups(profile), [profile]);
  const [groupId, setGroupId] = useState<IntakeGroupId>(
    focusField ? groupForField(focusField) : "goals",
  );
  const focusRef = useRef<HTMLDivElement | null>(null);
  const handledFocus = useRef(false);

  // Deep link from a "missing information" prompt: land on the right step and
  // move the viewport (and focus) to the field that was asked for.
  useEffect(() => {
    if (!focusField || handledFocus.current) return;
    handledFocus.current = true;
    setGroupId(groupForField(focusField));
    const timer = window.setTimeout(() => {
      const node = focusRef.current;
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      node?.querySelector<HTMLElement>("input, button")?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusField]);

  const dateProblems = useMemo(() => collectDateProblems(profile), [profile]);
  const outstanding = useMemo(() => outstandingQuestions(profile), [profile]);
  const index = Math.max(0, groups.indexOf(groupId));
  const isLast = index === groups.length - 1;

  const goToResults = () => void navigate({ to: "/plan" });

  const toggleGoal = (goal: Goal) => {
    updateProfile({
      goals: profile.goals.includes(goal)
        ? profile.goals.filter((g) => g !== goal)
        : [...profile.goals, goal],
    });
  };

  const show = (id: IntakeFieldId) => {
    const q = getQuestion(id);
    return Boolean(q && q.group === groupId && isVisible(q, profile));
  };

  const wrap = (id: IntakeFieldId, node: React.ReactNode) => {
    if (!show(id)) return null;
    const highlighted = focusField === id;
    return (
      <div
        key={id}
        ref={highlighted ? focusRef : undefined}
        className={cn(
          "sv-transition rounded-xl",
          highlighted && "ring-2 ring-accent ring-offset-4 ring-offset-card",
        )}
      >
        {node}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section aria-label="Demonstration scenarios" className="sv-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles aria-hidden="true" className="size-4 text-accent" />
          Prefer to look around first?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Load a fictional demonstration profile. These contain no real personal information.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => {
                loadScenario(scenario);
                goToResults();
              }}
              className="sv-transition rounded-lg border border-border bg-paper p-3 text-left hover:border-teal hover:bg-teal-soft/50"
            >
              <span className="block text-sm font-semibold text-foreground">{scenario.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{scenario.summary}</span>
            </button>
          ))}
        </div>
      </section>

      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {groups.map((id, i) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => setGroupId(id)}
              aria-current={id === groupId ? "step" : undefined}
              className={cn(
                "sv-transition rounded-full border px-3 py-1.5 text-xs font-semibold",
                id === groupId
                  ? "border-ink bg-ink text-ink-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {i + 1}. {GROUP_TITLE.get(id)}
            </button>
          </li>
        ))}
      </ol>

      <form
        className="sv-card space-y-6 p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLast) goToResults();
          else setGroupId(groups[index + 1] ?? groupId);
        }}
      >
        <div>
          <h2 className="text-xl font-semibold text-foreground">{GROUP_TITLE.get(groupId)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the questions your goals actually need are shown.
          </p>
        </div>

        {wrap(
          "goals",
          <CheckboxGroupField
            label="What do you want help preparing for?"
            hint="Choose as many as apply. Your choices decide which questions come next."
            options={GOAL_OPTIONS}
            values={profile.goals}
            onToggle={toggleGoal}
          />,
        )}

        {wrap(
          "i94Notation",
          <RadioGroupField
            label="What does your most recent I-94 say under “Admit Until Date”?"
            hint="Check your I-94 record. If you cannot check right now, choose “I'm not sure”."
            value={profile.i94Notation}
            onChange={(i94Notation) => updateProfile({ i94Notation })}
            options={[
              { value: "ds", label: "D/S (duration of status)" },
              { value: "fixed_date", label: "A specific calendar date" },
              { value: "unknown", label: "I'm not sure" },
            ]}
          />,
        )}

        {wrap(
          "i94AdmitUntilDate",
          <DateField
            label="Admit Until Date on your I-94"
            value={profile.i94AdmitUntilDate}
            onChange={(i94AdmitUntilDate) => updateProfile({ i94AdmitUntilDate })}
          />,
        )}

        {wrap(
          "mostRecentEntryDate",
          <DateField
            label="Date of your most recent entry to the US"
            hint="Optional. Used to explain which admission rules applied when you entered."
            value={profile.mostRecentEntryDate}
            onChange={(mostRecentEntryDate) => updateProfile({ mostRecentEntryDate })}
          />,
        )}

        {wrap(
          "presentInUS",
          <RadioGroupField
            label="Are you currently in the United States?"
            value={profile.presentInUS}
            onChange={(presentInUS) => updateProfile({ presentInUS })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unsure", label: "I'm not sure" },
            ]}
          />,
        )}

        {wrap(
          "maintainingStatus",
          <RadioGroupField
            label="Has anyone told you there is a problem with your F-1 status?"
            hint="Stay Valid cannot determine your status and will not try. This answer only selects which topics to show you — “I'm not sure” is a perfectly good answer."
            value={profile.maintainingStatus}
            onChange={(maintainingStatus) => updateProfile({ maintainingStatus })}
            options={[
              { value: "yes", label: "No — as far as I know things are in order" },
              { value: "no", label: "Yes — I've been told there's a problem" },
              { value: "unsure", label: "I'm not sure" },
            ]}
          />,
        )}

        {wrap(
          "i20ProgramStartDate",
          <DateField
            label="Program start date on your Form I-20"
            value={profile.i20ProgramStartDate}
            onChange={(i20ProgramStartDate) => updateProfile({ i20ProgramStartDate })}
          />,
        )}

        {wrap(
          "i20ProgramEndDate",
          <DateField
            label="Program end date on your Form I-20"
            hint="This drives most of your timeline. Copy it exactly from your I-20."
            value={profile.i20ProgramEndDate}
            onChange={(i20ProgramEndDate) => updateProfile({ i20ProgramEndDate })}
          />,
        )}

        {wrap(
          "academicStage",
          <RadioGroupField
            label="Where are you in your program?"
            value={profile.academicStage}
            onChange={(academicStage) => updateProfile({ academicStage })}
            options={[
              { value: "not_started", label: "Not started yet" },
              { value: "in_progress", label: "In progress" },
              { value: "final_term", label: "Final term" },
              { value: "completed", label: "Completed my coursework" },
            ]}
          />,
        )}

        {wrap(
          "optStage",
          <RadioGroupField
            label="Where are you with OPT?"
            hint="Exploring is a complete answer — Stay Valid will not ask for a recommendation date you do not have."
            value={profile.optStage}
            onChange={(optStage) => updateProfile({ optStage })}
            options={[
              { value: "none", label: "Not considering OPT" },
              { value: "preparing", label: "Thinking about applying" },
              { value: "applied", label: "Application filed, waiting" },
              { value: "post_completion_opt", label: "On post-completion OPT" },
              { value: "stem_opt", label: "On STEM OPT" },
            ]}
          />,
        )}

        {(show("eadStartDate") || show("eadEndDate")) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {wrap(
              "eadStartDate",
              <DateField
                label="EAD start date"
                value={profile.eadStartDate}
                onChange={(eadStartDate) => updateProfile({ eadStartDate })}
              />,
            )}
            {wrap(
              "eadEndDate",
              <DateField
                label="EAD end date"
                value={profile.eadEndDate}
                onChange={(eadEndDate) => updateProfile({ eadEndDate })}
              />,
            )}
          </div>
        )}

        {wrap(
          "dsoOptRecommendationDate",
          <DateField
            label="Date your DSO entered the OPT recommendation in SEVIS"
            hint="Only if you already have one. Leave blank otherwise — nothing is assumed."
            value={profile.dsoOptRecommendationDate}
            onChange={(dsoOptRecommendationDate) => updateProfile({ dsoOptRecommendationDate })}
          />,
        )}

        {wrap(
          "pendingApplication",
          <RadioGroupField
            label="Do you have an application pending with USCIS?"
            value={profile.pendingApplication ? "yes" : "no"}
            onChange={(value) => updateProfile({ pendingApplication: value === "yes" })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />,
        )}

        {wrap(
          "plannedTravel",
          <RadioGroupField
            label="Are you planning to travel outside the US?"
            value={profile.plannedTravel ? "yes" : "no"}
            onChange={(value) => updateProfile({ plannedTravel: value === "yes" })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No / not yet" },
            ]}
          />,
        )}

        {(show("plannedDepartureDate") || show("expectedReentryDate")) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {wrap(
              "plannedDepartureDate",
              <DateField
                label="Planned departure date"
                value={profile.plannedDepartureDate}
                onChange={(plannedDepartureDate) => updateProfile({ plannedDepartureDate })}
              />,
            )}
            {wrap(
              "expectedReentryDate",
              <DateField
                label="Expected reentry date"
                value={profile.expectedReentryDate}
                onChange={(expectedReentryDate) => updateProfile({ expectedReentryDate })}
              />,
            )}
          </div>
        )}

        {dateProblems.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-attn-confirm/30 bg-attn-confirm-soft p-3 text-sm text-attn-confirm"
          >
            <p className="font-semibold">Please check these dates</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {dateProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}

        {outstanding.length > 0 && (
          <div className="rounded-lg border border-border bg-paper p-3 text-sm">
            <p className="font-semibold text-foreground">Still needed for the goals you selected</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {outstanding.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setGroupId(q.group)}
                    className="text-left font-medium text-accent underline underline-offset-2"
                  >
                    {q.shortLabel}
                  </button>{" "}
                  — {q.whyNeeded}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {index > 0 && (
            <button
              type="button"
              onClick={() => setGroupId(groups[index - 1] ?? groupId)}
              className="sv-transition inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={dateProblems.length > 0}
            className="sv-transition inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground hover:bg-ink/90 disabled:opacity-50"
          >
            {isLast ? "Build my timeline" : "Continue"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
          {returnTo === "plan" && (
            <button
              type="button"
              onClick={goToResults}
              disabled={dateProblems.length > 0}
              className="sv-transition inline-flex items-center gap-1.5 rounded-lg border border-teal bg-teal-soft/60 px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              <Check aria-hidden="true" className="size-4" />
              Back to my results
            </button>
          )}
          <button
            type="button"
            onClick={goToResults}
            className="text-sm font-medium text-accent underline underline-offset-2"
          >
            Skip ahead with what I've entered
          </button>
        </div>
      </form>
    </div>
  );
}

function collectDateProblems(profile: StudentProfile): string[] {
  const problems: string[] = [];
  const pairs: Array<[string | null, string | null, string]> = [
    [
      profile.i20ProgramStartDate,
      profile.i20ProgramEndDate,
      "Your I-20 program end date is before its start date.",
    ],
    [profile.eadStartDate, profile.eadEndDate, "Your EAD end date is before its start date."],
    [
      profile.plannedDepartureDate,
      profile.expectedReentryDate,
      "Your expected reentry date is before your departure date.",
    ],
  ];
  pairs.forEach(([start, end, message]) => {
    if (isValidIsoDate(start) && isValidIsoDate(end) && end < start) problems.push(message);
  });
  return problems;
}
