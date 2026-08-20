import { CalendarClock, FileCheck2, Gauge, ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import { AttentionBadge, ATTENTION_LABEL } from "@/components/shared/AttentionBadge";
import type { Attention, ChecklistAction, TimelineItem } from "@/domain/types";
import { formatDate, formatDateTime, relativeDays } from "@/utils/dateFormatting";

/**
 * The five-second read: highest attention level, the next dated checkpoint, how
 * many actions there are, and when the corpus was last verified.
 */
export function AtAGlance({
  attention,
  nextCheckpoint,
  actions,
  researchedAsOf,
  asOfDate,
  cta,
}: {
  attention: Attention | null;
  nextCheckpoint: TimelineItem | null;
  actions: ChecklistAction[];
  researchedAsOf: string;
  asOfDate: string;
  cta: ReactNode;
}) {
  return (
    <section aria-labelledby="glance-heading" className="mt-6">
      <h2 id="glance-heading" className="sr-only">
        At a glance
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={<Gauge aria-hidden="true" className="size-4" />} label="Attention level">
          {attention ? (
            <AttentionBadge attention={attention} />
          ) : (
            <span className="text-sm text-muted-foreground">Nothing flagged</span>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {attention
              ? `Highest of ${ATTENTION_LABEL[attention].toLowerCase()} across your findings.`
              : "No rule in the verified corpus matched your answers."}
          </p>
        </Tile>

        <Tile
          icon={<CalendarClock aria-hidden="true" className="size-4" />}
          label="Next checkpoint"
        >
          {nextCheckpoint ? (
            <>
              <p className="text-lg font-semibold text-foreground">
                <time dateTime={nextCheckpoint.date}>{formatDate(nextCheckpoint.date)}</time>
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {nextCheckpoint.label} · {relativeDays(asOfDate, nextCheckpoint.date)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No future dated checkpoint yet.</p>
          )}
        </Tile>

        <Tile icon={<ListChecks aria-hidden="true" className="size-4" />} label="Actions">
          <p className="text-lg font-semibold text-foreground">{actions.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {actions.filter((a) => a.attention === "confirm_now").length} to confirm now
          </p>
        </Tile>

        <Tile icon={<FileCheck2 aria-hidden="true" className="size-4" />} label="Sources verified">
          <p className="text-sm font-semibold text-foreground">{formatDateTime(researchedAsOf)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every date below traces to a verified source.
          </p>
        </Tile>
      </div>
      <div className="print-hidden mt-4 flex flex-wrap gap-3">{cta}</div>
    </section>
  );
}

function Tile({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <article className="sv-card p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="text-accent">{icon}</span>
        {label}
      </h3>
      <div className="mt-2">{children}</div>
    </article>
  );
}
