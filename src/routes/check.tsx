import { createFileRoute } from "@tanstack/react-router";

import { IntakeWizard } from "@/components/intake/IntakeWizard";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { getQuestion, type IntakeFieldId } from "@/domain/intakeQuestions";

/**
 * `focus` deep-links a single question so a "missing information" prompt on the
 * results page can send the student straight to it; `from=plan` offers a direct
 * return to the results once the answer is filled in.
 */
export const Route = createFileRoute("/check")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw =
      typeof search["focus"] === "string" ? (search["focus"] as IntakeFieldId) : undefined;
    const focus = raw && getQuestion(raw) ? raw : undefined;
    return {
      ...(focus ? { focus } : {}),
      ...(search["from"] === "plan" ? { from: "plan" as const } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Check my F-1 situation | Stay Valid" },
      {
        name: "description",
        content:
          "Answer a few questions about your I-20 and I-94 dates and Stay Valid builds a timeline of checkpoints and DSO questions from official sources.",
      },
      { property: "og:title", content: "Check my F-1 situation | Stay Valid" },
      {
        property: "og:description",
        content:
          "A short, no-account questionnaire that turns F-1 policy into dated checkpoints and DSO questions.",
      },
    ],
  }),
  component: CheckPage,
});

function CheckPage() {
  const { focus, from } = Route.useSearch();
  const question = focus ? getQuestion(focus) : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Step 1 of 2</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
          Tell Stay Valid about your situation
        </h1>
        <p className="sv-prose mt-3 text-muted-foreground">
          Only what is needed to read the rules. No name, no SEVIS ID, no passport or visa number,
          no receipt number, no uploads. Skip anything you are unsure about — Stay Valid will say
          when an answer is missing instead of guessing.
        </p>
      </header>

      {question && (
        <div className="mb-6 rounded-xl border border-teal bg-teal-soft/50 p-4">
          <p className="text-sm font-semibold text-foreground">
            One more detail: {question.shortLabel}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{question.whyNeeded}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything you already entered is still here.
          </p>
        </div>
      )}

      <IntakeWizard focusField={focus} returnTo={from} />

      <Disclaimer className="mt-10" />
    </div>
  );
}
