import { AttentionBadge } from "@/components/shared/AttentionBadge";
import { SourceLinks } from "@/components/shared/SourceLink";
import type { Corpus, PathwayCard } from "@/domain/types";

export function PathwayList({ pathways, corpus }: { pathways: PathwayCard[]; corpus: Corpus }) {
  if (pathways.length === 0) return null;

  return (
    <section aria-labelledby="pathways-heading" id="pathways" className="scroll-mt-24">
      <h2 id="pathways-heading" className="text-2xl font-semibold text-foreground">
        Possible pathways
      </h2>
      <p className="sv-prose mt-1 text-sm text-muted-foreground">
        These are options that may be relevant to your answers. Stay Valid does not determine
        eligibility — each pathway lists what must be confirmed and who can confirm it.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {pathways.map((pathway) => (
          <article key={pathway.id} className="sv-card flex flex-col p-5">
            <div className="flex flex-wrap items-center gap-2">
              <AttentionBadge attention={pathway.attention} />
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                Eligibility not determined
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{pathway.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{pathway.whyItMayBeRelevant}</p>

            {pathway.confirmationNeeded.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Must be confirmed
                </h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {pathway.confirmationNeeded.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {pathway.questionsForDso.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Ask your DSO
                </h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {pathway.questionsForDso.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto pt-2">
              <SourceLinks corpus={corpus} sourceIds={pathway.sourceIds} compact />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
