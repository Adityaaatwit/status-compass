import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { LegalStatusChip, VerificationChip } from "@/components/sources/LegalStatusChip";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { useStayValid } from "@/hooks/useStayValid";
import { formatDate, formatDateTime } from "@/utils/dateFormatting";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Official sources and legal status | Stay Valid" },
      {
        name: "description",
        content:
          "Every rule Stay Valid uses, the government source behind it, its legal status, effective dates, and when it was last checked.",
      },
      { property: "og:title", content: "Official sources and legal status | Stay Valid" },
      {
        property: "og:description",
        content:
          "The full source list behind Stay Valid: publisher, legal status, effective dates, and verification notes.",
      },
    ],
  }),
  component: SourcesPage,
});

const TIER_LABEL: Record<number, string> = {
  1: "Tier 1 — government primary source",
  2: "Tier 2 — university or institutional guidance",
  3: "Tier 3 — professional analysis",
};

function SourcesPage() {
  const { corpus } = useStayValid();
  const [tier, setTier] = useState<"all" | 1 | 2 | 3>("all");

  const sources = useMemo(
    () =>
      corpus.sources.sources
        .filter((source) => tier === "all" || source.sourceTier === tier)
        .slice()
        .sort((a, b) => a.sourceTier - b.sourceTier || a.title.localeCompare(b.title)),
    [corpus, tier],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
          Sources, legal status, and what is still unverified
        </h1>
        <p className="sv-prose mt-3 text-muted-foreground">
          Stay Valid never paraphrases policy into certainty. Every rule points back to the document
          it came from, with its publication and effective dates, its current legal status, and the
          date it was last checked.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-semibold">Corpus version: </dt>
            <dd className="inline">{corpus.sources.corpusVersion}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Researched as of: </dt>
            <dd className="inline">{formatDateTime(corpus.sources.researchedAsOf)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Rule set status: </dt>
            <dd className="inline">{corpus.rules.ruleSetStatus}</dd>
          </div>
        </dl>
      </header>

      <Disclaimer className="mt-6" />

      <section aria-labelledby="candidates-heading" className="mt-12">
        <h2 id="candidates-heading" className="text-2xl font-semibold text-foreground">
          Watchlist — not applied to anyone's timeline
        </h2>
        <p className="sv-prose mt-1 text-sm text-muted-foreground">
          Developments Stay Valid is tracking. Because a primary government source has not been
          located or verified, none of these activate a rule or change a date.
        </p>
        <div className="mt-5 space-y-4">
          {corpus.candidates.updates.map((update) => (
            <article key={update.id} className="sv-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <VerificationChip status={update.verificationStatus} />
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {update.primaryAuthorityLocated
                    ? "Primary authority located"
                    : "No primary authority located"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Noted {formatDateTime(update.discoveredAt)}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{update.headline}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{update.summary}</p>
              <p className="mt-2 text-sm text-foreground">{update.whyItMatters}</p>
              {update.conflictingInformation.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-xs font-semibold tracking-wide text-attn-confirm uppercase">
                    Conflicting information
                  </h4>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {update.conflictingInformation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {update.nextVerificationSteps.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Next verification steps
                  </h4>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {update.nextVerificationSteps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="source-list-heading" className="mt-12">
        <h2 id="source-list-heading" className="text-2xl font-semibold text-foreground">
          Source list ({corpus.sources.sources.length})
        </h2>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by source tier">
          {(["all", 1, 2, 3] as const).map((option) => (
            <button
              key={String(option)}
              type="button"
              onClick={() => setTier(option)}
              aria-pressed={tier === option}
              className={`sv-transition rounded-full border px-3 py-1.5 text-xs font-semibold ${
                tier === option
                  ? "border-ink bg-ink text-ink-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "all" ? "All tiers" : TIER_LABEL[option]}
            </button>
          ))}
        </div>

        <ul className="mt-6 space-y-4">
          {sources.map((source) => (
            <li key={source.id} className="sv-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <LegalStatusChip status={source.legalStatus} />
                <VerificationChip status={source.verificationStatus} />
                <span className="text-xs text-muted-foreground">
                  {TIER_LABEL[source.sourceTier] ?? `Tier ${source.sourceTier}`}
                </span>
              </div>

              <h3 className="mt-2 text-base font-semibold text-foreground">{source.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {source.publisher}
                {source.citation ? ` — ${source.citation}` : ""}
              </p>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                <Row label="Published" value={formatDate(source.publishedAt)} />
                <Row label="Last checked" value={formatDateTime(source.lastCheckedAt)} />
                <Row label="Scheduled effective" value={formatDate(source.scheduledEffectiveAt)} />
                <Row label="Actual effective" value={formatDate(source.actualEffectiveAt)} />
              </dl>

              {source.minimalSupportingExcerpt && (
                <blockquote className="mt-3 border-l-2 border-teal pl-3 text-sm text-foreground italic">
                  “{source.minimalSupportingExcerpt}”
                </blockquote>
              )}

              {source.verificationNotes && (
                <p className="mt-3 text-xs text-muted-foreground">{source.verificationNotes}</p>
              )}

              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="sv-transition mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline underline-offset-2"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                View official source
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold">{label}: </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}
