import { AlertTriangle, CalendarClock, ChevronDown, Eye } from "lucide-react";
import { useState } from "react";

import { SourceLinks } from "@/components/shared/SourceLink";
import type { Attention, ChecklistAction, Corpus, Finding } from "@/domain/types";
import { cn } from "@/lib/utils";

/**
 * Three columns instead of a long list of rows: what to do now, what to line up
 * next, and what to keep an eye on. The grouping is the attention level the
 * engine already assigned — nothing is re-ranked here.
 */
const COLUMNS: Array<{
  key: "now" | "next" | "monitor";
  title: string;
  blurb: string;
  attentions: Attention[];
  icon: typeof AlertTriangle;
  accent: string;
}> = [
  {
    key: "now",
    title: "Do now",
    blurb: "Confirm these with your DSO before anything else.",
    attentions: ["confirm_now"],
    icon: AlertTriangle,
    accent: "text-attn-confirm",
  },
  {
    key: "next",
    title: "Prepare next",
    blurb: "Dates are coming; gather documents and book time.",
    attentions: ["prepare"],
    icon: CalendarClock,
    accent: "text-attn-prepare",
  },
  {
    key: "monitor",
    title: "Monitor",
    blurb: "Nothing to file today. Watch for changes.",
    attentions: ["monitor", "information"],
    icon: Eye,
    accent: "text-attn-monitor",
  },
];

export function ActionRoadmap({
  actions,
  findings,
  corpus,
}: {
  actions: ChecklistAction[];
  findings: Finding[];
  corpus: Corpus;
}) {
  if (actions.length === 0) return null;
  const titleByRule = new Map(findings.map((f) => [f.ruleId, f.headline]));

  return (
    <section aria-labelledby="roadmap-heading" id="actions" className="scroll-mt-24">
      <h2 id="roadmap-heading" className="text-2xl font-semibold text-foreground">
        Your action roadmap
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Grouped by how much attention each item needs. Expand an item for its source.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const items = actions.filter((a) => column.attentions.includes(a.attention));
          const Icon = column.icon;
          return (
            <div key={column.key} className="sv-card flex flex-col p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground uppercase">
                <Icon aria-hidden="true" className={cn("size-4", column.accent)} />
                {column.title}
                <span className="ml-auto rounded-full border border-border bg-muted px-2 text-xs font-semibold text-muted-foreground normal-case">
                  {items.length}
                </span>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{column.blurb}</p>

              {items.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nothing in this column right now.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {items.map((action) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      ruleTitle={titleByRule.get(action.ruleId) ?? null}
                      corpus={corpus}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActionItem({
  action,
  ruleTitle,
  corpus,
}: {
  action: ChecklistAction;
  ruleTitle: string | null;
  corpus: Corpus;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-border bg-paper">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="sv-transition flex w-full items-start gap-2 p-3 text-left"
      >
        <span className="text-sm text-foreground">{action.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("mt-0.5 ml-auto size-4 shrink-0 text-muted-foreground sv-transition", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-border px-3 pt-2 pb-3">
          {ruleTitle && <p className="text-xs text-muted-foreground">Why: {ruleTitle}</p>}
          <SourceLinks corpus={corpus} sourceIds={action.sourceIds} compact />
        </div>
      )}
    </li>
  );
}
