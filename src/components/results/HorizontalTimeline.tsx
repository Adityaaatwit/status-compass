import { CalendarPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DATE_KIND_HELP, DATE_KIND_LABEL, DateKindBadge } from "@/components/shared/DateKindBadge";
import type { DateKind, TimelineItem } from "@/domain/types";
import { cn } from "@/lib/utils";
import { downloadIcs } from "@/utils/calendarExport";
import { formatDate, relativeDays } from "@/utils/dateFormatting";

/**
 * A true horizontal timeline: one connecting line, compact nodes, and a single
 * detail panel below.
 *
 * Only the node list scrolls horizontally, so there is one component tree for
 * mobile and desktop. Nodes are real buttons in a roving-free tablist-style
 * group, so arrow keys and tab both work, and every status is carried by an
 * icon + text badge rather than colour alone.
 */
const NODE_SHAPE: Record<DateKind | "today", string> = {
  today: "border-ink bg-ink text-ink-foreground",
  official: "border-teal bg-teal-soft text-attn-monitor",
  document: "border-border bg-muted text-muted-foreground",
  reminder: "border-amber bg-amber-soft text-attn-prepare",
  needs_confirmation: "border-attn-confirm bg-attn-confirm-soft text-attn-confirm",
};

export function HorizontalTimeline({
  items,
  asOfDate,
  corpusVersion,
}: {
  items: TimelineItem[];
  asOfDate: string;
  corpusVersion: string;
}) {
  const exportable = useMemo(
    () => items.filter((item) => item.status !== "past" && item.id !== "today"),
    [items],
  );
  const defaultId = useMemo(
    () => items.find((i) => i.status === "future")?.id ?? items[0]?.id ?? null,
    [items],
  );
  const [selectedId, setSelectedId] = useState<string | null>(defaultId);
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => setSelectedId(defaultId), [defaultId]);

  if (items.length === 0) return null;

  const selected = items.find((i) => i.id === selectedId) ?? items[0];

  const move = (delta: number) => {
    const at = items.findIndex((i) => i.id === selectedId);
    const next = items[Math.min(items.length - 1, Math.max(0, at + delta))];
    if (!next) return;
    setSelectedId(next.id);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-node="${cssEscape(next.id)}"]`)
      ?.focus();
  };

  return (
    <section aria-labelledby="timeline-heading" className="scroll-mt-24" id="timeline">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="timeline-heading" className="text-2xl font-semibold text-foreground">
            Your timeline
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a checkpoint to see where its date came from. Only “Official date” entries come
            from a government source.
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

      <div className="sv-card mt-5 p-4 sm:p-6">
        <div className="print-hidden -mx-1 overflow-x-auto pb-2">
          <ol
            ref={listRef}
            className="relative flex min-w-max items-start gap-8 px-1 pt-8"
            aria-label="Timeline checkpoints"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                move(1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                move(-1);
              }
            }}
          >
            {/* the single connecting line */}
            <span
              aria-hidden="true"
              className="absolute top-[3.1rem] right-1 left-1 h-px bg-border"
            />
            {items.map((item) => {
              const isToday = item.id === "today" || item.status === "today";
              const active = item.id === selected?.id;
              return (
                <li key={item.id} className="relative w-36 shrink-0 text-center">
                  <button
                    type="button"
                    data-node={item.id}
                    aria-pressed={active}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "sv-transition group flex w-full flex-col items-center gap-2 rounded-lg px-1 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      item.status === "past" && "opacity-70",
                      active && "bg-paper",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "sv-transition relative z-10 grid size-4 place-items-center rounded-full border-2",
                        NODE_SHAPE[isToday ? "today" : item.kind],
                        active && "scale-125 shadow-card",
                      )}
                    />
                    <time
                      dateTime={item.date}
                      className="text-xs font-semibold text-foreground tabular-nums"
                    >
                      {formatDate(item.date)}
                    </time>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {isToday ? "Today" : DATE_KIND_LABEL[item.kind]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {selected && (
          <article className="mt-4 rounded-xl border border-border bg-paper p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time dateTime={selected.date} className="font-semibold text-foreground">
                {formatDate(selected.date)}
              </time>
              <span className="text-xs text-muted-foreground">
                {relativeDays(asOfDate, selected.date)}
              </span>
              <DateKindBadge kind={selected.kind} />
            </div>
            <h3 className="mt-2 font-medium text-foreground">{selected.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{selected.basis}</p>
            <p className="mt-1 text-xs text-muted-foreground italic">
              {DATE_KIND_HELP[selected.kind]}
            </p>

            {selected.suggestedPreparation.length > 0 && (
              <DetailList title="Suggested preparation" items={selected.suggestedPreparation} />
            )}
            {selected.confirmationNeeded.length > 0 && (
              <DetailList
                title="Confirm with your DSO"
                items={selected.confirmationNeeded}
                emphasis
              />
            )}
          </article>
        )}

        {/* Print and no-JS friendly: the full list stays in the document. */}
        <ol className="mt-4 hidden space-y-3 print:block">
          {items.map((item) => (
            <li key={`print-${item.id}`}>
              <span className="font-semibold">{formatDate(item.date)}</span> — {item.label} (
              {DATE_KIND_LABEL[item.kind]}). {item.basis}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function DetailList({
  title,
  items,
  emphasis = false,
}: {
  title: string;
  items: string[];
  emphasis?: boolean;
}) {
  return (
    <div className="mt-3">
      <h4
        className={cn(
          "text-xs font-semibold tracking-wide uppercase",
          emphasis ? "text-attn-confirm" : "text-muted-foreground",
        )}
      >
        {title}
      </h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

/** Minimal attribute-selector escape; ids come from the corpus, not the user. */
function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}
