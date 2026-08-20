import { ExternalLink } from "lucide-react";

import { sourcesByIds } from "@/domain/dataAdapters";
import type { Corpus } from "@/domain/types";
import { LegalStatusChip } from "@/components/sources/LegalStatusChip";

export function SourceLinks({
  corpus,
  sourceIds,
  compact = false,
}: {
  corpus: Corpus;
  sourceIds: string[];
  compact?: boolean;
}) {
  const sources = sourcesByIds(corpus, sourceIds);
  if (sources.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {sources.map((source) => (
        <li key={source.id} className="text-sm">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="sv-transition inline-flex items-start gap-1.5 font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              View official source:{" "}
              {source.title.length > 90 && compact ? `${source.title.slice(0, 90)}…` : source.title}
            </span>
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{source.publisher}</span>
            <LegalStatusChip status={source.legalStatus} />
          </div>
        </li>
      ))}
    </ul>
  );
}
