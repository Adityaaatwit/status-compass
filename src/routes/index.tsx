import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, FileSearch, ScrollText, ShieldCheck } from "lucide-react";

import { StudentSupportIllustration } from "@/components/illustrations/StudentSupportIllustration";
import { AttentionBadge } from "@/components/shared/AttentionBadge";
import { DateKindBadge } from "@/components/shared/DateKindBadge";
import { Disclaimer, EducationalNotice } from "@/components/shared/Disclaimer";
import { scenarios } from "@/domain/scenarios";
import { useStayValid } from "@/hooks/useStayValid";
import { formatDateTime } from "@/utils/dateFormatting";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stay Valid — F-1 status timelines and DSO meeting kits" },
      {
        name: "description",
        content:
          "Stay Valid turns F-1 immigration policy into dated checkpoints, clear attention levels, and a printable DSO meeting kit — every item traced to an official source.",
      },
      { property: "og:title", content: "Stay Valid — F-1 status timelines and DSO meeting kits" },
      {
        property: "og:description",
        content:
          "Turn F-1 policy uncertainty into a timeline, checkpoints, and a printable DSO meeting kit. No account, no uploads, no legal advice.",
      },
    ],
  }),
  component: HomePage,
});

const STEPS = [
  {
    icon: FileSearch,
    title: "Answer a few non-identifying questions",
    body: "Your I-94 notation, I-20 dates, program stage, and goals. No name, no SEVIS ID, no uploads.",
  },
  {
    icon: CalendarClock,
    title: "Get a timeline you can act on",
    body: "Official deadlines, your own document dates, and Stay Valid reminders — each labelled so you always know which is which.",
  },
  {
    icon: ScrollText,
    title: "Walk into your DSO meeting prepared",
    body: "A printable kit with your dates, what needs confirming, the questions to ask, and every source cited.",
  },
];

function HomePage() {
  const { corpus, loadScenario } = useStayValid();
  const navigate = useNavigate();

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <EducationalNotice className="border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground" />
            <h1 className="mt-5 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
              Immigration policy is written for agencies. Your life runs on dates.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-foreground/80">
              Stay Valid reads current F-1 rules and turns them into a timeline, checkpoints that
              tell you what to do next, and a DSO meeting kit you can print. It never guesses, never
              claims your status, and always shows the official source.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/check"
                className="sv-transition inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 text-sm font-semibold text-ink hover:bg-teal/90"
              >
                Check my situation
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                to="/sources"
                className="sv-transition inline-flex items-center gap-2 rounded-lg border border-ink-foreground/25 px-5 py-3 text-sm font-semibold text-ink-foreground hover:bg-ink-foreground/10"
              >
                See every source
              </Link>
            </div>

            <p className="mt-6 flex items-center gap-2 text-sm text-ink-foreground/70">
              <ShieldCheck aria-hidden="true" className="size-4" />
              No account. Nothing stored. Rules verified{" "}
              {formatDateTime(corpus.rules.researchedAsOf)}.
            </p>
          </div>

          <div className="rounded-2xl border border-ink-foreground/15 bg-ink-foreground/5 p-5 backdrop-blur">
            <p className="text-xs font-semibold tracking-widest text-ink-foreground/60 uppercase">
              Example of what you get
            </p>
            <ul className="mt-4 space-y-3">
              {/* The engine emits scheduled effective dates as
                  `needs_confirmation`, never `official` — publication is not
                  proof a rule is in force. The preview must match. */}
              <PreviewRow
                date="15 September 2026"
                label="Policy checkpoint: new admission-period framework"
                badge={<DateKindBadge kind="needs_confirmation" />}
              />
              <PreviewRow
                date="18 December 2026"
                label="Program end date on your Form I-20"
                badge={<DateKindBadge kind="document" />}
              />
              <PreviewRow
                date="18 November 2026"
                label="Review your OPT filing window with your DSO"
                badge={<DateKindBadge kind="reminder" />}
              />
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <AttentionBadge attention="confirm_now" />
              <AttentionBadge attention="prepare" />
              <AttentionBadge attention="monitor" />
              <AttentionBadge attention="information" />
            </div>
            <p className="mt-4 text-xs text-ink-foreground/60">
              Four attention levels, never a verdict on your status.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="how-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          How Stay Valid works
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <article key={step.title} className="sv-card p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-teal-soft text-attn-monitor">
                  <step.icon aria-hidden="true" className="size-4.5" />
                </span>
                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="support-heading"
        className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:pb-10"
      >
        <div className="sv-card grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <StudentSupportIllustration className="w-full" />
          <div>
            <h2
              id="support-heading"
              className="text-2xl font-semibold text-foreground sm:text-3xl"
            >
              Built for the conversation, not instead of it
            </h2>
            <p className="sv-prose mt-3 text-muted-foreground">
              Your DSO is the person who can confirm your status and sign your documents. Stay Valid
              exists so you arrive at that meeting with the right dates, the right questions, and
              the source behind each one — so the time you get is spent on decisions rather than
              on catching up.
            </p>
            <Link
              to="/check"
              className="sv-transition mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
            >
              Build my meeting kit
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>


      <section aria-labelledby="scenarios-heading" className="border-y border-border bg-card py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="scenarios-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Try a demonstration profile
          </h2>
          <p className="sv-prose mt-2 text-muted-foreground">
            Fictional profiles with synthetic dates, so you can see the full output before entering
            anything about yourself.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  loadScenario(scenario);
                  void navigate({ to: "/plan" });
                }}
                className="sv-transition group rounded-xl border border-border bg-paper p-5 text-left hover:border-teal hover:shadow-lift"
              >
                <h3 className="text-base font-semibold text-foreground">{scenario.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{scenario.summary}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  View this timeline
                  <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              What Stay Valid refuses to do
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-foreground">
              {[
                "Tell you whether you have, or have lost, lawful status.",
                "State that you are eligible for OPT, a transfer, or any benefit.",
                "Present a proposed or delayed rule as if it were in force.",
                "Fill in a date it cannot derive from your answers and a source.",
                "Ask for identifiers it does not need, or keep anything after you clear it.",
              ].map((item) => (
                <li key={item} className="sv-card p-4">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <Disclaimer />
            <div className="sv-card p-5">
              <h3 className="text-base font-semibold text-foreground">Traceable by construction</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {corpus.sources.sources.length} sources and {corpus.rules.rules.length} rules,
                versioned as {corpus.rules.corpusVersion}. Every checkpoint links to the document it
                came from, with its legal status and the date it was last checked.
              </p>
              <Link
                to="/sources"
                className="sv-transition mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
              >
                Review the source list
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PreviewRow({
  date,
  label,
  badge,
}: {
  date: string;
  label: string;
  badge: React.ReactNode;
}) {
  return (
    <li className="rounded-lg border border-ink-foreground/10 bg-ink/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{date}</span>
        {badge}
      </div>
      <p className="mt-1 text-sm text-ink-foreground/75">{label}</p>
    </li>
  );
}
