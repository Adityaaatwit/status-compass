import { CalendarPlus } from "lucide-react";

import { DATE_KIND_HELP, DateKindBadge } from "@/components/shared/DateKindBadge";
import type { TimelineItem } from "@/domain/types";
import { downloadIcs } from "@/utils/calendarExport";
import { formatDate, relativeDays } from "@/utils/dateFormatting";

export function TimelineView({
  items,
  asOfDate,
  corpusVersion,
}: {
  items: TimelineItem[];
  asOfDate: string;
  corpusVersion: string;
}) {
  const exportable = items.filter((item) => item.status !== "past" && item.id !== "today");

  return (
    <section aria-labelledby="timeline-heading" className="scroll-mt-24" id="timeline">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="timeline-heading" className="text-2xl font-semibold text-foreground">
            Your timeline
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every entry says where it came from. Only entries marked “Official date” come from a
            government source.
          </p>
        </div>
        {exportable.length > 0 && (
          <button
            type="button"
            onClick={() => downloadIcs(exportable, corpusVersion)}
            className="sv-transition print-hidden inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <CalendarPlus aria-hidden="true" className="size-4" />
            Add reminders to my calendar
          </button>
        )}
      </div>

      <ol className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={`sv-card relative p-4 pl-5 ${
              item.status === "past" ? "opacity-70" : ""
            } ${item.status === "today" ? "border-l-4 border-l-ink" : "border-l-4 border-l-transparent"}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time dateTime={item.date} className="font-semibold text-foreground">
                {formatDate(item.date)}
              </time>
              <span className="text-xs text-muted-foreground">
                {relativeDays(asOfDate, item.date)}
              </span>
              <DateKindBadge kind={item.kind} />
            </div>
            <p className="mt-1.5 font-medium text-foreground">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.basis}</p>
            <p className="mt-1 text-xs text-muted-foreground italic">{DATE_KIND_HELP[item.kind]}</p>

            {item.suggestedPreparation.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Suggested preparation
                </h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {item.suggestedPreparation.map((prep) => (
                    <li key={prep}>{prep}</li>
                  ))}
                </ul>
              </div>
            )}

            {item.confirmationNeeded.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold tracking-wide text-attn-confirm uppercase">
                  Confirm with your DSO
                </h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {item.confirmationNeeded.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
