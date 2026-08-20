import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";

import { AskStayValid } from "@/components/chat/AskStayValid";
import { ActionRoadmap } from "@/components/results/ActionRoadmap";
import { AtAGlance } from "@/components/results/AtAGlance";
import { EvidenceTable } from "@/components/results/EvidenceTable";
import { FindingCard } from "@/components/results/FindingCard";
import { HorizontalTimeline } from "@/components/results/HorizontalTimeline";
import { MeetingKitView } from "@/components/results/MeetingKitView";
import { PathwayMap } from "@/components/results/PathwayMap";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { InsufficientInfo } from "@/components/shared/InsufficientInfo";
import { VerificationChip } from "@/components/sources/LegalStatusChip";
import type { Attention } from "@/domain/types";
import { useStayValid } from "@/hooks/useStayValid";
import { formatDate, formatDateTime } from "@/utils/dateFormatting";
import { printPage } from "@/utils/print";

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

const ATTENTION_RANK: Attention[] = ["confirm_now", "prepare", "monitor", "information"];

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
    clearCount,
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

  const topAttention =
    ATTENTION_RANK.find((level) => evaluation.findings.some((f) => f.attention === level)) ?? null;
  const nextCheckpoint = timeline.find((item) => item.status === "future") ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
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
      </header>

      <AtAGlance
        attention={topAttention}
        nextCheckpoint={nextCheckpoint}
        actions={actions}
        researchedAsOf={evaluation.researchedAsOf}
        asOfDate={asOfDate}
        cta={
          <>
            <a
              href="#meeting-kit"
              className="sv-transition inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
            >
              Open my DSO meeting kit
            </a>
            <button
              type="button"
              onClick={printPage}
              className="sv-transition inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Printer aria-hidden="true" className="size-4" />
              Print
            </button>
            <Link
              to="/check"
              className="sv-transition inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Change my answers
            </Link>
          </>
        }
      />

      <Disclaimer className="mt-6" />

      <div className="mt-10 space-y-12">
        <HorizontalTimeline
          items={timeline}
          asOfDate={asOfDate}
          corpusVersion={evaluation.corpusVersion}
        />

        <ActionRoadmap actions={actions} findings={evaluation.findings} corpus={corpus} />

        {evaluation.insufficient.length > 0 && <InsufficientInfo notes={evaluation.insufficient} />}

        {/* The chat exists to explain what the student has just read, not to
            replace it. Keyed on clearCount so "Clear my information" discards
            the conversation along with the answers. */}
        <AskStayValid key={clearCount} />

        <PathwayMap pathways={pathways} corpus={corpus} />

        <section aria-labelledby="findings-heading" id="findings" className="scroll-mt-24">
          <h2 id="findings-heading" className="text-2xl font-semibold text-foreground">
            What needs your attention
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each item shows its attention level, why it appeared, and the official source behind it.
          </p>
          <div className="mt-5 space-y-4">
            {evaluation.findings.map((finding) => (
              <FindingCard key={finding.ruleId} finding={finding} corpus={corpus} />
            ))}
          </div>
        </section>

        <EvidenceTable findings={evaluation.findings} corpus={corpus} />

        {evaluation.relatedCandidateUpdates.length > 0 && (
          <section aria-labelledby="watch-heading" className="scroll-mt-24">
            <h2 id="watch-heading" className="text-2xl font-semibold text-foreground">
              Being watched, not applied
            </h2>
            <p className="sv-prose mt-1 text-sm text-muted-foreground">
              These developments relate to your topics but have not been verified against a primary
              government source. They do not change anything above.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
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

        <div id="meeting-kit" className="scroll-mt-24">
          <MeetingKitView kit={meetingKit} />
        </div>
      </div>

      <footer className="print-hidden mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-xs text-muted-foreground">
        <span>Corpus version {evaluation.corpusVersion}</span>
        <span>Sources last verified {formatDateTime(evaluation.researchedAsOf)}</span>
        <span>Rule set status: {evaluation.ruleSetStatus}</span>
        <Link to="/sources" className="font-semibold text-accent underline underline-offset-2">
          Review every source
        </Link>
      </footer>
    </div>
  );
}

function Empty({ title, body, detail }: { title: string; body: string; detail?: string }) {
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
