import { ArrowRight, Compass, MessageCircleQuestion, Plane, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AttentionBadge } from "@/components/shared/AttentionBadge";
import { SourceLinks } from "@/components/shared/SourceLink";
import type { Corpus, PathwayCard } from "@/domain/types";
import { cn } from "@/lib/utils";

/**
 * Pathways as connected cards rather than paragraphs.
 *
 * Wording is fixed by policy: a pathway is always "worth discussing with your
 * DSO", never something the student "qualifies" for.
 */
function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes("travel") || t.includes("reentry") || t.includes("re-entry")) return Plane;
  if (t.includes("opt") || t.includes("work")) return Compass;
  if (t.includes("extension") || t.includes("status")) return ShieldCheck;
  return MessageCircleQuestion;
}

export function PathwayMap({ pathways, corpus }: { pathways: PathwayCard[]; corpus: Corpus }) {
  if (pathways.length === 0) return null;

  return (
    <section aria-labelledby="pathways-heading" id="pathways" className="scroll-mt-24">
      <h2 id="pathways-heading" className="text-2xl font-semibold text-foreground">
        Possible pathways
      </h2>
      <p className="sv-prose mt-1 text-sm text-muted-foreground">
        Options that may be relevant to your answers. Stay Valid never determines eligibility — each
        card says what must be confirmed and who confirms it.
      </p>

      <ol className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pathways.map((pathway, index) => {
          const Icon = iconFor(pathway.title);
          return (
            <li key={pathway.id} className="relative">
              {/* connector to the next card on wide screens */}
              {index < pathways.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-4 hidden h-px w-4 bg-border md:block"
                />
              )}
              <article className="sv-card sv-transition flex h-full flex-col p-5 hover:shadow-lift">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-teal/40 bg-teal-soft text-accent">
                    <Icon aria-hidden="true" className="size-4.5" />
                  </span>
                  <AttentionBadge attention={pathway.attention} />
                </div>

                <h3 className="mt-3 text-base font-semibold text-foreground">{pathway.title}</h3>
                <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">
                  {pathway.whyItMayBeRelevant}
                </p>

                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <MessageCircleQuestion aria-hidden="true" className="size-3.5" />
                  Worth discussing with your DSO
                </p>

                <Details pathway={pathway} corpus={corpus} />
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Details({ pathway, corpus }: { pathway: PathwayCard; corpus: Corpus }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-auto pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="sv-transition inline-flex items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        {open ? "Hide details" : "What to confirm and ask"}
        <ArrowRight
          aria-hidden="true"
          className={cn("size-3.5 sv-transition", open && "rotate-90")}
        />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <Block title="Confirmation needed" items={pathway.confirmationNeeded} />
          <Block title="Next conversation" items={pathway.questionsForDso} />
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sources
            </h4>
            <SourceLinks corpus={corpus} sourceIds={pathway.sourceIds} compact />
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
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
