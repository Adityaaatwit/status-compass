import { createFileRoute, Link } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";

import { FindingCard } from "@/components/results/FindingCard";
import { MeetingKitView } from "@/components/results/MeetingKitView";
import { PathwayList } from "@/components/results/PathwayList";
import { TimelineView } from "@/components/results/TimelineView";
import { AttentionBadge } from "@/components/shared/AttentionBadge";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { InsufficientInfo } from "@/components/shared/InsufficientInfo";
import { VerificationChip } from "@/components/sources/LegalStatusChip";
import { useStayValid } from "@/hooks/useStayValid";
import { formatDate, formatDateTime } from "@/utils/dateFormatting";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "My F-1 timeline and DSO meeting kit | Stay Valid" },
      {
        name: "description",
        content:
          "Your dated checkpoints, what needs attention, possible pathways, and a printable DSO meeting kit — each item linked to its official source.",
      },
      { property: "og:title", content: "My F-1 timeline and DSO meeting kit | Stay Valid" },
      {
        property: "og:description",
        content:
          "Dated checkpoints, attention levels, and a printable DSO meeting kit built from official F-1 sources.",
      },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const {
    corpus,
    validation,
    asOfDate,
    hasAnswers,
    scenarioLabel,
    evaluation,
    timeline,
    pathways,
    actions,
    meetingKit,
  } = useStayValid();

  if (!validation.ok) {
    return (
      <Empty
        title="Stay Valid cannot show results right now"
        body="The research corpus failed validation, so no rules were evaluated. Nothing is guessed or filled in when data is unavailable."
        detail={validation.errors.join(" · ")}
      />
    );
  }

  if (!hasAnswers || !evaluation || !meetingKit) {
    return (
      <Empty
        title="No answers yet"
        body="Answer a few questions about your I-20 and I-94 and Stay Valid will build your timeline, checkpoints, and DSO meeting kit."
      />
    );
  }

  const attentionOrder = evaluation.findings;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="print-hidden">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Step 2 of 2</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
          Your timeline and meeting kit
        </h1>
        <p className="sv-prose mt-3 text-muted-foreground">
          {scenarioLabel
            ? `Showing the fictional demonstration profile “${scenarioLabel}”.`
            : "Built only from the answers you gave."}{" "}
          Evaluated as of {formatDate(asOfDate)}.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-semibold">Corpus version: </dt>
            <dd className="inline">{evaluation.corpusVersion}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Sources last verified: </dt>
            <dd className="inline">{formatDateTime(evaluation.researchedAsOf)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Rule set status: </dt>
            <dd className="inline">{evaluation.ruleSetStatus}</dd>
          </div>
        </dl>
      </header>

      <Disclaimer className="mt-6" />

      {actions.length > 0 && (
        <section aria-labelledby="next-heading" className="sv-card mt-8 p-5">
          <h2
            id="next-heading"
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
          >
            <ListChecks aria-hidden="true" className="size-5 text-accent" />
            Do these next
          </h2>
          <ol className="mt-3 space-y-3">
            {actions.slice(0, 3).map((action) => (
              <li key={action.id} className="flex flex-wrap items-start gap-2">
                <AttentionBadge attention={action.attention} />
                <span className="text-sm text-foreground">{action.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-10 space-y-12">
        <TimelineView
          items={timeline}
          asOfDate={asOfDate}
          corpusVersion={evaluation.corpusVersion}
        />

        <section aria-labelledby="findings-heading" id="findings" className="scroll-mt-24">
          <h2 id="findings-heading" className="text-2xl font-semibold text-foreground">
            What needs your attention
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each item shows its attention level, why it appeared, and the official source behind it.
          </p>
          <div className="mt-6 space-y-4">
            {attentionOrder.map((finding) => (
              <FindingCard key={finding.ruleId} finding={finding} corpus={corpus} />
            ))}
          </div>
        </section>

        {evaluation.insufficient.length > 0 && (
          <InsufficientInfo notes={evaluation.insufficient} />
        )}

        <PathwayList pathways={pathways} corpus={corpus} />

        {evaluation.relatedCandidateUpdates.length > 0 && (
          <section aria-labelledby="watch-heading" className="scroll-mt-24">
            <h2 id="watch-heading" className="text-2xl font-semibold text-foreground">
              Being watched, not applied
            </h2>
            <p className="sv-prose mt-1 text-sm text-muted-foreground">
              These developments relate to your topics but have not been verified against a primary
              government source. They do not change anything above.
            </p>
            <div className="mt-6 space-y-4">
              {evaluation.relatedCandidateUpdates.map((update) => (
                <article key={update.id} className="sv-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <VerificationChip status={update.verificationStatus} />
                    <span className="text-xs text-muted-foreground">
                      Noted {formatDateTime(update.discoveredAt)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-foreground">
                    {update.headline}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{update.summary}</p>
                  <p className="mt-2 text-sm text-foreground">{update.whyItMatters}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <MeetingKitView kit={meetingKit} />
      </div>

      <div className="print-hidden mt-10 flex flex-wrap gap-3">
        <Link
          to="/check"
          className="sv-transition rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Change my answers
        </Link>
        <Link
          to="/sources"
          className="sv-transition rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Review every source
        </Link>
      </div>
    </div>
  );
}

function Empty({
  title,
  body,
  detail,
}: {
  title: string;
  body: string;
  detail?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <div className="sv-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="sv-prose mx-auto mt-3 text-muted-foreground">{body}</p>
        {detail && <p className="mt-3 text-xs text-muted-foreground">{detail}</p>}
        <Link
          to="/check"
          className="sv-transition mt-6 inline-flex rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
        >
          Start the questionnaire
        </Link>
      </div>
    </div>
  );
}
