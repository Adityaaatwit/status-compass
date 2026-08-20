import { createFileRoute } from "@tanstack/react-router";
import { Ban, Eraser, Lock, MessageCircleQuestion, ServerOff } from "lucide-react";

import { Disclaimer, PRIVACY_TEXT } from "@/components/shared/Disclaimer";
import { useStayValid } from "@/hooks/useStayValid";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy and data handling | Stay Valid" },
      {
        name: "description",
        content:
          "Stay Valid asks for no identifiers and evaluates your situation in your browser. The optional AI chat is the only feature that can send anything to a third party, and only if it is switched on.",
      },
      { property: "og:title", content: "Privacy and data handling | Stay Valid" },
      {
        property: "og:description",
        content:
          "No accounts, no uploads, no identifiers. Your timeline is calculated in your browser; the optional AI chat is explained in full.",
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
    title: "Your timeline is calculated here",
    body: "Rules, sources and date maths all run in this page. Your answers are not stored on a server and do not survive a refresh.",
  },
  {
    icon: Eraser,
    title: "Erase in one click",
    body: "“Clear my information” in the header discards every answer and any chat conversation immediately. Closing the tab does the same.",
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

      {/* The one feature that can transmit anything. It gets its own section
          rather than a footnote, because burying it would make every other
          claim on this page read as less trustworthy than it deserves. */}
      <section aria-labelledby="ai-heading" className="sv-card mt-8 border-l-4 border-l-teal p-5">
        <h2
          id="ai-heading"
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
        >
          <MessageCircleQuestion aria-hidden="true" className="size-5 text-teal" />
          “Ask Stay Valid” and the optional AI
        </h2>

        <p className="sv-prose mt-3 text-sm text-foreground">
          Stay Valid includes a question box on your results page. It is the only part of the
          product that can send anything anywhere, so here is exactly how it behaves.
        </p>

        <h3 className="mt-4 text-sm font-semibold text-foreground">When AI is switched off</h3>
        <p className="sv-prose mt-1 text-sm text-muted-foreground">
          This is the default, and it is how the public deployment runs unless an operator
          configures a key. Your question is matched against the bundled verified sources inside
          your browser and answered there. No network request is made at all.
        </p>

        <h3 className="mt-4 text-sm font-semibold text-foreground">When AI is switched on</h3>
        <p className="sv-prose mt-1 text-sm text-muted-foreground">
          You are shown a disclosure and must acknowledge it before the first AI-assisted answer.
          Until you do, questions continue to be answered in your browser. If you accept, each
          question sends the following to the configured provider — and nothing else:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
          <li>your question;</li>
          <li>
            a few non-identifying profile fields: whether your I-94 shows D/S or a date, your
            academic stage, your OPT stage, whether you plan to travel, and whether a program-end or
            EAD date exists — <strong>not the dates themselves</strong>;
          </li>
          <li>
            the small number of verified rules that matched your question, and the dates Stay Valid
            already calculated for them;
          </li>
          <li>limited metadata for the sources those rules cite;</li>
          <li>up to six of your most recent messages, not the whole conversation.</li>
        </ul>

        <h3 className="mt-4 text-sm font-semibold text-foreground">What is never sent</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
          <li>The full research corpus, or any unverified candidate update.</li>
          <li>
            Any identifier — the app refuses to send a message that looks like it contains one.
          </li>
          <li>Any API key. Keys stay on the server and never reach your browser.</li>
        </ul>

        <h3 className="mt-4 text-sm font-semibold text-foreground">
          What the AI can and cannot do
        </h3>
        <p className="sv-prose mt-1 text-sm text-muted-foreground">
          It can only rephrase material Stay Valid already verified. It cannot create a rule, change
          a date, or decide anything about your status — answers are checked afterwards, and any
          answer that invents a citation, states a date the sources did not contain, or asserts a
          legal conclusion is discarded and replaced with the plain sourced version.
        </p>

        <h3 className="mt-4 text-sm font-semibold text-foreground">Storage and third parties</h3>
        <p className="sv-prose mt-1 text-sm text-muted-foreground">
          Stay Valid does not intentionally store your conversation; it lives in your browser's
          memory and is erased by a refresh or by “Clear my information”. The provider processes
          your request under <strong>its own privacy policy</strong>, which Stay Valid does not
          control. If that matters to you, the product remains fully useful without ever enabling
          AI: your timeline, checkpoints, pathways, checklist, calendar export and DSO meeting kit
          never involve a provider under any configuration.
        </p>
      </section>

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
