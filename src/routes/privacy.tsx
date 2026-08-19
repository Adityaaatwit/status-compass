import { createFileRoute } from "@tanstack/react-router";
import { Ban, Eraser, Lock, ServerOff } from "lucide-react";

import { Disclaimer, PRIVACY_TEXT } from "@/components/shared/Disclaimer";
import { useStayValid } from "@/hooks/useStayValid";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy and data handling | Stay Valid" },
      {
        name: "description",
        content:
          "Stay Valid asks for no identifiers, stores nothing on a server, and lets you erase your answers instantly. Here is exactly what it does and does not collect.",
      },
      { property: "og:title", content: "Privacy and data handling | Stay Valid" },
      {
        property: "og:description",
        content:
          "No accounts, no uploads, no identifiers. Your answers stay in your browser and can be cleared at any time.",
      },
    ],
  }),
  component: PrivacyPage,
});

const NEVER_ASKED = [
  "Your name or date of birth",
  "Your SEVIS ID or student ID",
  "Passport, visa, or I-94 record number",
  "USCIS receipt number or A-number",
  "Your address, phone number, or email",
  "Employer name or salary",
  "Document uploads or scans of any kind",
];

const PRINCIPLES = [
  {
    icon: Lock,
    title: "No account, ever",
    body: "There is no sign-up, no login, and no way for Stay Valid to associate answers with a person.",
  },
  {
    icon: ServerOff,
    title: "Nothing leaves your browser",
    body: "Rules, sources, and date math all run locally in this page. Your answers are not sent to a server and are not stored between sessions.",
  },
  {
    icon: Eraser,
    title: "Erase in one click",
    body: "“Clear my information” in the header discards every answer immediately. Closing the tab does the same.",
  },
  {
    icon: Ban,
    title: "No status determination",
    body: "Stay Valid never decides whether you have or lack status, and never states eligibility. It prepares you to ask the right questions.",
  },
];

function PrivacyPage() {
  const { hasAnswers, clearAll } = useStayValid();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
        Privacy, by design and by default
      </h1>
      <p className="sv-prose mt-3 text-muted-foreground">{PRIVACY_TEXT}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((principle) => (
          <section key={principle.title} className="sv-card p-5">
            <principle.icon aria-hidden="true" className="size-5 text-teal" />
            <h2 className="mt-3 text-base font-semibold text-foreground">{principle.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{principle.body}</p>
          </section>
        ))}
      </div>

      <section aria-labelledby="never-heading" className="sv-card mt-8 p-5">
        <h2 id="never-heading" className="text-lg font-semibold text-foreground">
          What Stay Valid never asks for
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-foreground sm:grid-cols-2">
          {NEVER_ASKED.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attn-confirm" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="collected-heading" className="sv-card mt-6 p-5">
        <h2 id="collected-heading" className="text-lg font-semibold text-foreground">
          What it does ask for, and why
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <Item
            term="I-94 notation (D/S or a date)"
            def="Determines which admission-period rules can apply to you at all."
          />
          <Item
            term="I-20 program start and end dates"
            def="Anchors your timeline and any grace-period or filing-window checkpoints."
          />
          <Item
            term="Program stage, OPT stage, EAD dates"
            def="Selects which topics are relevant instead of showing you everything."
          />
          <Item
            term="Travel and pending-application answers"
            def="Surfaces readmission and pending-case topics to raise with your DSO."
          />
          <Item
            term="Your goals"
            def="Orders the pathways and DSO questions around what you actually want to do."
          />
        </dl>
      </section>

      {hasAnswers && (
        <button
          type="button"
          onClick={clearAll}
          className="sv-transition mt-8 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
        >
          <Eraser aria-hidden="true" className="size-4" />
          Clear my information now
        </button>
      )}

      <Disclaimer className="mt-10" />
    </div>
  );
}

function Item({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <dt className="font-semibold text-foreground">{term}</dt>
      <dd className="text-muted-foreground">{def}</dd>
    </div>
  );
}
