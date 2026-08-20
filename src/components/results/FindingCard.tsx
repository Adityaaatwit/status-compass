import { ChevronDown, UserCheck } from "lucide-react";
import { useState } from "react";

import { AttentionBadge } from "@/components/shared/AttentionBadge";
import { DateKindBadge } from "@/components/shared/DateKindBadge";
import { LegalStatusChip } from "@/components/sources/LegalStatusChip";
import { SourceLinks } from "@/components/shared/SourceLink";
import type { Corpus, Finding } from "@/domain/types";
import { formatDate } from "@/utils/dateFormatting";

export function FindingCard({ finding, corpus }: { finding: Finding; corpus: Corpus }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="sv-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <AttentionBadge attention={finding.attention} />
        <LegalStatusChip status={finding.legalStatus} />
        {finding.pendingEffective && (
          <span className="text-xs font-medium text-attn-prepare">
            Not yet in force — shown so you can prepare
          </span>
        )}
      </div>

      <h3 className="mt-3 text-lg font-semibold text-foreground">{finding.headline}</h3>
      <p className="sv-prose mt-2 text-sm text-muted-foreground">{finding.explanation}</p>

      {finding.selfReportedGates.length > 0 && (
        <div className="mt-3 rounded-lg border border-attn-prepare/30 bg-amber-soft p-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-attn-prepare uppercase">
            <UserCheck aria-hidden="true" className="size-3.5" />
            Based on your own answer, not a verified fact
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-foreground">
            {finding.selfReportedGates.map((gate) => (
              <li key={gate.predicate}>
                <span className="font-medium">{gate.question}</span> {gate.answer}
                <p className="mt-0.5 text-xs text-muted-foreground">{gate.caveat}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {finding.dates.length > 0 && (
        <ul className="mt-4 space-y-2">
          {finding.dates.map((date) => (
            <li key={date.id} className="rounded-lg border border-border bg-paper p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{formatDate(date.date)}</span>
                <DateKindBadge kind={date.kind} />
              </div>
              <p className="mt-1 text-sm text-foreground">{date.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{date.basis}</p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="sv-transition print-hidden mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
      >
        {open ? "Hide the reasoning" : "Why am I seeing this?"}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 ${open ? "rotate-180" : ""} sv-transition`}
        />
      </button>

      <div className={open ? "mt-4 space-y-4" : "mt-4 hidden space-y-4 print:block"}>
        <Block title="Why this appears" body={finding.whyThisAppears} />
        <Block title="What this means for you" body={finding.studentImpact} />
        {finding.uncertainty && <Block title="What is uncertain" body={finding.uncertainty} />}
        <List title="Facts used from your answers" items={finding.matchedFacts} />
        <List title="Known facts from the source" items={finding.knownFacts} />
        <List title="Needs confirmation" items={finding.confirmationNeeded} />
        <List title="Questions for your DSO" items={finding.questionsForDso} />
        <List title="Documents and dates to bring" items={finding.documentsOrDatesToBring} />
        <div>
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Official sources
          </h4>
          <SourceLinks corpus={corpus} sourceIds={finding.sourceIds} compact />
        </div>
      </div>
    </article>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      <p className="sv-prose mt-1 text-sm text-foreground">{body}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
