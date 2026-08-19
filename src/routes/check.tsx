import { createFileRoute } from "@tanstack/react-router";

import { IntakeWizard } from "@/components/intake/IntakeWizard";
import { Disclaimer } from "@/components/shared/Disclaimer";

export const Route = createFileRoute("/check")({
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

      <IntakeWizard />

      <Disclaimer className="mt-10" />
    </div>
  );
}
