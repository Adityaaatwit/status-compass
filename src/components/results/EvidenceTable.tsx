import { ExternalLink } from "lucide-react";

import { LegalStatusChip } from "@/components/sources/LegalStatusChip";
import { sourcesByIds } from "@/domain/dataAdapters";
import type { Corpus, Finding } from "@/domain/types";
import { formatDate } from "@/utils/dateFormatting";

/**
 * Compact evidence table for every source behind the findings on screen.
 *
 * One component tree: a real <table> on wide screens, and the same rows
 * restyled as stacked cards below `sm` using display utilities on the row
 * elements rather than a duplicated mobile subtree.
 */
export function EvidenceTable({ findings, corpus }: { findings: Finding[]; corpus: Corpus }) {
  const ids = [...new Set(findings.flatMap((f) => f.sourceIds))];
  const sources = sourcesByIds(corpus, ids);
  if (sources.length === 0) return null;

  const relevantDate = (id: string) => {
    const dates = findings
      .filter((f) => f.sourceIds.includes(id))
      .flatMap((f) => f.dates)
      .map((d) => d.date)
      .sort();
    return dates[0] ?? null;
  };

  return (
    <section aria-labelledby="evidence-heading" id="evidence" className="scroll-mt-24">
      <h2 id="evidence-heading" className="text-2xl font-semibold text-foreground">
        Evidence behind your plan
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every source used above, with its authority and current legal status.
      </p>

      <div className="sv-card mt-5 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="hidden sm:table-header-group">
            <tr className="border-b border-border bg-paper text-xs tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="px-4 py-3 font-semibold">
                Source
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Authority
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Relevant date
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Why it matters
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.map((source) => {
              const date = relevantDate(source.id);
              return (
                <tr
                  key={source.id}
                  className="block px-4 py-4 sm:table-row sm:px-0 sm:py-0 sm:align-top"
                >
                  <Cell label="Source">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="sv-transition inline-flex items-start gap-1.5 font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                    >
                      <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2">{source.title}</span>
                    </a>
                  </Cell>
                  <Cell label="Authority">
                    <span className="text-muted-foreground">
                      {source.agency ?? source.publisher} · Tier {source.sourceTier}
                    </span>
                  </Cell>
                  <Cell label="Status">
                    <LegalStatusChip status={source.legalStatus} />
                  </Cell>
                  <Cell label="Relevant date">
                    <span className="text-muted-foreground tabular-nums">
                      {date
                        ? formatDate(date)
                        : source.actualEffectiveAt || source.scheduledEffectiveAt
                          ? formatDate(
                              (source.actualEffectiveAt ?? source.scheduledEffectiveAt) as string,
                            )
                          : "—"}
                    </span>
                  </Cell>
                  <Cell label="Why it matters">
                    <span className="line-clamp-3 text-muted-foreground">
                      {source.verifiedClaims[0] ?? source.topics.join(", ")}
                    </span>
                  </Cell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <td className="block py-1 sm:table-cell sm:px-4 sm:py-3">
      <span className="mr-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:hidden">
        {label}
      </span>
      {children}
    </td>
  );
}
