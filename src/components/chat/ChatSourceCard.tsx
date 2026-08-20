import { ExternalLink } from "lucide-react";

import { LegalStatusChip } from "@/components/sources/LegalStatusChip";
import type { RetrievedSource } from "@/domain/chat/chatTypes";
import { formatDate } from "@/utils/dateFormatting";

/**
 * A citation attached to a chat answer.
 *
 * Shows the legal status and the last-checked date on the card itself rather
 * than behind a link: a student reading "the rule says X" needs to see at a
 * glance that the rule is not yet in force.
 */
export function ChatSourceCard({ source }: { source: RetrievedSource }) {
  return (
    <li>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer noopener"
        className="sv-transition block rounded-lg border border-border bg-paper p-3 hover:border-teal hover:bg-teal-soft/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <LegalStatusChip status={source.legalStatus} />
          {source.lastCheckedAt && (
            <span className="text-[11px] text-muted-foreground">
              Checked {formatDate(source.lastCheckedAt.slice(0, 10))}
            </span>
          )}
        </div>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-foreground">
          <span>{source.title}</span>
          <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-accent" />
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{source.publisher}</p>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}
